import { headers } from 'next/headers';

import { AuditAction } from '@prisma/client';

import { NotFoundError, ForbiddenError, BadRequestError } from '@/lib/api/errors';
import { successResponse, errorResponse } from '@/lib/api/response';
import { withAuth, type AuthenticatedRequest } from '@/lib/api/with-auth';
import {
  getAgreementForCase,
  signAgreement,
  canSignAgreement,
  getAgreementStatusInfo,
  generateAgreementContent,
  generateConsentText,
  AGREEMENT_TEMPLATE_VERSION,
  PROCEDURAL_RULES_VERSION,
} from '@/lib/services/agreement';
import { createAuditLog } from '@/lib/services/audit';
import { userHasAccessToCase } from '@/lib/services/case';

// GET /api/cases/[id]/agreement - Get agreement details
export const GET = withAuth(
  async (request: AuthenticatedRequest, context?: { params: Record<string, string> }) => {
    try {
      const caseId = context?.params.id;
      if (!caseId) {
        throw new NotFoundError('Case not found');
      }

      // Check access
      const access = await userHasAccessToCase(request.user.id, caseId);
      if (!access.hasAccess) {
        throw new ForbiddenError('You do not have access to this case');
      }

      // Get agreement
      const agreement = await getAgreementForCase(caseId);
      if (!agreement) {
        throw new NotFoundError('Agreement not found');
      }

      // Log view
      await createAuditLog({
        action: AuditAction.AGREEMENT_VIEWED,
        userId: request.user.id,
        caseId,
        metadata: {
          role: access.role,
        },
      });

      // Check if user can sign
      const signStatus = await canSignAgreement(caseId, request.user.id);

      // Get status info
      const statusInfo = getAgreementStatusInfo(agreement);

      // Generate agreement content for display
      const agreementContent = generateAgreementContent(
        {
          referenceNumber: agreement.case.referenceNumber,
          jurisdiction: agreement.case.jurisdiction,
          disputeType: agreement.case.disputeType,
          amount: Number(agreement.case.amount),
          description: agreement.case.description,
        },
        agreement.case.claimant,
        agreement.case.respondent!
      );

      // Generate consent text for the user's role
      const consentText = signStatus.role
        ? generateConsentText(signStatus.role, agreement.case.referenceNumber)
        : null;

      return successResponse({
        agreement: {
          id: agreement.id,
          templateVersion: AGREEMENT_TEMPLATE_VERSION,
          rulesVersion: PROCEDURAL_RULES_VERSION,
          status: agreement.status,
          documentHash: agreement.documentHash,
          createdAt: agreement.createdAt,
          updatedAt: agreement.updatedAt,
        },
        content: agreementContent,
        consentText,
        statusInfo,
        signatures: agreement.signatures.map((sig) => ({
          role: sig.role,
          signedAt: sig.signedAt,
          userId: sig.userId,
        })),
        userRole: access.role,
        canSign: signStatus.canSign,
        signReason: signStatus.reason,
        alreadySigned: signStatus.alreadySigned,
      });
    } catch (error) {
      return errorResponse(error as Error);
    }
  }
);

// POST /api/cases/[id]/agreement - Sign the agreement
export const POST = withAuth(
  async (request: AuthenticatedRequest, context?: { params: Record<string, string> }) => {
    try {
      const caseId = context?.params.id;
      if (!caseId) {
        throw new NotFoundError('Case not found');
      }

      // Check access
      const access = await userHasAccessToCase(request.user.id, caseId);
      if (!access.hasAccess) {
        throw new ForbiddenError('You do not have access to this case');
      }

      // Verify user can sign
      const signStatus = await canSignAgreement(caseId, request.user.id);
      if (!signStatus.canSign) {
        throw new BadRequestError(signStatus.reason ?? 'Cannot sign agreement');
      }

      // Get request metadata
      const headersList = headers();
      const ipAddress =
        headersList.get('x-forwarded-for')?.split(',')[0] ??
        headersList.get('x-real-ip') ??
        'unknown';
      const userAgent = headersList.get('user-agent') ?? 'unknown';

      // Get device fingerprint from body if provided
      const body = (await request.json().catch(() => ({}))) as { deviceFingerprint?: string };
      const deviceFingerprint = body.deviceFingerprint;

      // Sign the agreement
      const result = await signAgreement({
        caseId,
        userId: request.user.id,
        role: signStatus.role!,
        ipAddress,
        userAgent,
        deviceFingerprint,
      });

      if (!result.success) {
        throw new BadRequestError(result.error ?? 'Failed to sign agreement');
      }

      return successResponse({
        message: 'Agreement signed successfully',
        signature: {
          id: result.signature!.id,
          role: result.signature!.role,
          signedAt: result.signature!.signedAt,
        },
        agreementComplete: result.agreementComplete,
        nextStep: result.agreementComplete
          ? 'Both parties have signed. You can now submit evidence.'
          : 'Waiting for the other party to sign.',
      });
    } catch (error) {
      return errorResponse(error as Error);
    }
  }
);
