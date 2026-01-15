/**
 * Award API
 *
 * GET /api/cases/[id]/award - Retrieve issued award details
 * POST /api/cases/[id]/award - Finalize and issue award
 */

import { NextResponse } from 'next/server';

import { BadRequestError, ForbiddenError, NotFoundError } from '@/lib/api/errors';
import { errorResponse } from '@/lib/api/response';
import { withAuth, type AuthenticatedRequest } from '@/lib/api/with-auth';
import {
  finalizeAward,
  getIssuedAward,
  canIssueAward,
} from '@/lib/award';
import { prisma } from '@/lib/db';

/**
 * GET - Retrieve issued award for a case
 */
export const GET = withAuth(async (request: AuthenticatedRequest, context) => {
  const params = context?.params;
  const caseId = params?.id;

  if (!caseId) {
    return errorResponse(new BadRequestError('Case ID is required'));
  }

  try {
    // Get case and verify access
    const caseData = await prisma.case.findUnique({
      where: { id: caseId },
      select: {
        id: true,
        claimantId: true,
        respondentId: true,
        arbitratorAssignment: {
          select: {
            arbitratorId: true,
          },
        },
      },
    });

    if (!caseData) {
      return errorResponse(new NotFoundError('Case not found'));
    }

    // Verify user has access to this case
    const userId = request.user.id;
    const isParty =
      caseData.claimantId === userId || caseData.respondentId === userId;
    const isArbitrator = caseData.arbitratorAssignment?.arbitratorId === userId;

    if (!isParty && !isArbitrator) {
      return errorResponse(
        new ForbiddenError('You do not have access to this case')
      );
    }

    // Get issued award
    const award = await getIssuedAward(caseId);

    if (!award) {
      return NextResponse.json({
        success: true,
        data: {
          caseId,
          status: 'NOT_ISSUED',
          message: 'Award has not been issued for this case',
        },
      });
    }

    return NextResponse.json({
      success: true,
      data: {
        id: award.id,
        caseId: award.caseId,
        referenceNumber: award.referenceNumber,
        findingsOfFact: award.findingsOfFact,
        conclusionsOfLaw: award.conclusionsOfLaw,
        decision: award.decision,
        awardAmount: award.awardAmount,
        prevailingParty: award.prevailingParty,
        documentUrl: award.documentUrl,
        documentHash: award.documentHash,
        arbitratorId: award.arbitratorId,
        arbitratorName: award.arbitratorName,
        issuedAt: award.issuedAt,
        signedAt: award.signedAt,
        claimantNotifiedAt: award.claimantNotifiedAt,
        respondentNotifiedAt: award.respondentNotifiedAt,
      },
    });
  } catch (error) {
    console.error('Error retrieving award:', error);
    return errorResponse(error as Error);
  }
});

/**
 * POST - Finalize and issue the award
 */
export const POST = withAuth(
  async (request: AuthenticatedRequest, context) => {
    const params = context?.params;
    const caseId = params?.id;

    if (!caseId) {
      return errorResponse(new BadRequestError('Case ID is required'));
    }

    try {
      // Get case and verify arbitrator access
      const caseData = await prisma.case.findUnique({
        where: { id: caseId },
        select: {
          id: true,
          arbitratorAssignment: {
            select: {
              arbitratorId: true,
            },
          },
        },
      });

      if (!caseData) {
        return errorResponse(new NotFoundError('Case not found'));
      }

      // Only arbitrator can finalize
      const userId = request.user.id;
      const isArbitrator = caseData.arbitratorAssignment?.arbitratorId === userId;

      if (!isArbitrator) {
        return errorResponse(
          new ForbiddenError('Only the assigned arbitrator can finalize the award')
        );
      }

      // Check if award can be issued
      const canIssue = await canIssueAward(caseId);
      if (!canIssue.canIssue) {
        return errorResponse(
          new BadRequestError(canIssue.reason || 'Cannot issue award')
        );
      }

      // Get IP address and user agent for signature
      const forwardedFor = request.headers.get('x-forwarded-for');
      const ipAddress = forwardedFor
        ? (forwardedFor.split(',')[0]?.trim() || 'unknown')
        : (request.headers.get('x-real-ip') || 'unknown');
      const userAgent = request.headers.get('user-agent') || 'unknown';

      // Finalize the award
      const result = await finalizeAward({
        caseId,
        arbitratorId: userId,
        ipAddress,
        userAgent,
      });

      return NextResponse.json({
        success: true,
        message: 'Award issued successfully',
        data: {
          awardId: result.awardId,
          referenceNumber: result.referenceNumber,
          documentUrl: result.documentUrl,
          documentHash: result.documentHash,
          awardAmount: result.awardAmount,
          prevailingParty: result.prevailingParty,
          issuedAt: result.issuedAt,
          claimantNotified: result.claimantNotified,
          respondentNotified: result.respondentNotified,
        },
      });
    } catch (error) {
      console.error('Error finalizing award:', error);
      return errorResponse(error as Error);
    }
  },
  {
    rateLimit: { limit: 3, window: 60 }, // 3 requests per minute
  }
);
