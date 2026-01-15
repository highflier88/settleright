import { CaseStatus } from '@prisma/client';

import { BadRequestError, ForbiddenError } from '@/lib/api/errors';
import { successResponse, errorResponse } from '@/lib/api/response';
import { withAuth, type AuthenticatedRequest } from '@/lib/api/with-auth';
import { checkKYCStatus } from '@/lib/kyc';
import { createCase, getUserCases, getUserCaseStats } from '@/lib/services/case';
import { sendCaseInvitationEmail } from '@/lib/services/email';
import { sendSms } from '@/lib/services/twilio';
import { validateBody } from '@/lib/validations';
import { createCaseSchema } from '@/lib/validations/case';

// POST /api/cases - Create a new case
export const POST = withAuth(
  async (request: AuthenticatedRequest) => {
    try {
      const body: unknown = await request.json();
      const data = validateBody(createCaseSchema, body);

      // Check KYC status
      const kycStatus = await checkKYCStatus(request.user.id);
      if (!kycStatus.isVerified) {
        throw new ForbiddenError(
          'Identity verification required before filing a case. ' + kycStatus.message
        );
      }

      // Create the case
      const result = await createCase({
        claimantId: request.user.id,
        disputeType: data.disputeType,
        jurisdiction: data.jurisdiction,
        description: data.description,
        amount: data.amount,
        respondent: data.respondent,
      });

      if (!result.success || !result.case) {
        throw new BadRequestError(result.error ?? 'Failed to create case');
      }

      // Send invitation to respondent
      const invitationUrl = `${process.env.NEXT_PUBLIC_APP_URL}/invitation/${result.invitationToken}`;

      // Send email invitation
      await sendCaseInvitationEmail(data.respondent.email, {
        recipientName: data.respondent.name ?? 'Respondent',
        claimantName: request.user.name ?? 'Claimant',
        caseReference: result.case.referenceNumber,
        disputeAmount: `$${data.amount.toLocaleString()}`,
        disputeDescription: data.description,
        invitationUrl,
        expiresAt: new Date(Date.now() + 14 * 24 * 60 * 60 * 1000).toISOString(),
      });

      // Send SMS invitation if phone provided
      if (data.respondent.phone) {
        await sendSms(
          data.respondent.phone,
          `You've been invited to respond to a dispute on Settleright.ai. ` +
            `Case #${result.case.referenceNumber}. View and respond: ${invitationUrl}`
        );
      }

      return successResponse(
        {
          case: {
            id: result.case.id,
            referenceNumber: result.case.referenceNumber,
            status: result.case.status,
            disputeType: result.case.disputeType,
            jurisdiction: result.case.jurisdiction,
            amount: result.case.amount,
            createdAt: result.case.createdAt,
          },
          invitationSent: true,
        },
        201
      );
    } catch (error) {
      return errorResponse(error as Error);
    }
  },
  {
    rateLimit: 'api',
  }
);

// GET /api/cases - List user's cases
export const GET = withAuth(async (request: AuthenticatedRequest) => {
  try {
    const { searchParams } = new URL(request.url);

    const page = parseInt(searchParams.get('page') ?? '1', 10);
    const limit = Math.min(parseInt(searchParams.get('limit') ?? '20', 10), 50);
    const statusParam = searchParams.get('status');
    const roleParam = searchParams.get('role') as 'claimant' | 'respondent' | 'all' | null;
    const includeStats = searchParams.get('includeStats') === 'true';

    let status: CaseStatus | undefined;
    if (statusParam && Object.values(CaseStatus).includes(statusParam as CaseStatus)) {
      status = statusParam as CaseStatus;
    }

    const [casesResult, stats] = await Promise.all([
      getUserCases(request.user.id, {
        page,
        limit,
        status,
        role: roleParam ?? 'all',
      }),
      includeStats ? getUserCaseStats(request.user.id) : null,
    ]);

    return successResponse({
      ...casesResult,
      ...(stats ? { stats } : {}),
    });
  } catch (error) {
    return errorResponse(error as Error);
  }
});
