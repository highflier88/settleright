/**
 * Draft Award API
 *
 * POST /api/cases/[id]/draft-award - Generate a draft award
 * GET /api/cases/[id]/draft-award - Retrieve draft award
 * PATCH /api/cases/[id]/draft-award - Submit review with workflow actions
 */

import { NextResponse } from 'next/server';

import { BadRequestError, ForbiddenError, NotFoundError } from '@/lib/api/errors';
import { errorResponse } from '@/lib/api/response';
import { withAuth, type AuthenticatedRequest } from '@/lib/api/with-auth';
import {
  generateDraftAward,
  getDraftAward,
  loadDraftAwardInput,
  submitDraftAwardReview,
  createInitialRevision,
  modifyDraftAward,
  rejectDraftAward,
  escalateDraftAward,
  approveDraftAward,
  getRevisionHistory,
  getEscalation,
} from '@/lib/award';
import type {
  ReviewDecision,
  AwardModification,
  RejectionFeedback,
  EscalationInput,
} from '@/lib/award';
import { prisma } from '@/lib/db';

/**
 * POST - Generate a draft award from completed analysis
 */
export const POST = withAuth(
  async (request: AuthenticatedRequest, context) => {
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
          referenceNumber: true,
          claimantId: true,
          respondentId: true,
          arbitratorAssignment: {
            select: {
              arbitratorId: true,
            },
          },
          status: true,
        },
      });

      if (!caseData) {
        return errorResponse(new NotFoundError('Case not found'));
      }

      // Verify user has access to this case
      const userId = request.user.id;
      const isParty = caseData.claimantId === userId || caseData.respondentId === userId;
      const isArbitrator = caseData.arbitratorAssignment?.arbitratorId === userId;

      if (!isParty && !isArbitrator) {
        return errorResponse(new ForbiddenError('You do not have access to this case'));
      }

      // Check if legal analysis is complete
      const analysisJob = await prisma.analysisJob.findUnique({
        where: { caseId },
        select: {
          status: true,
          legalAnalysisStatus: true,
        },
      });

      if (!analysisJob || analysisJob.status !== 'COMPLETED') {
        return errorResponse(
          new BadRequestError('Fact analysis must be completed before generating draft award')
        );
      }

      if (analysisJob.legalAnalysisStatus !== 'COMPLETED') {
        return errorResponse(
          new BadRequestError('Legal analysis must be completed before generating draft award')
        );
      }

      // Parse request body
      const body = (await request.json().catch(() => ({}))) as {
        force?: boolean;
      };

      // Check for existing draft award
      const existing = await getDraftAward(caseId);
      if (existing && !body.force) {
        return NextResponse.json({
          success: true,
          message: 'Draft award already exists',
          data: {
            draftAwardId: existing.id,
            caseId,
            prevailingParty: existing.prevailingParty,
            awardAmount: existing.awardAmount,
            confidence: existing.confidence,
            findingsCount: existing.findingsOfFact.length,
            conclusionsCount: existing.conclusionsOfLaw.length,
            generatedAt: existing.generatedAt,
            reviewStatus: existing.reviewStatus,
          },
        });
      }

      // Load input data from analysis
      const input = await loadDraftAwardInput(caseId);

      if (!input) {
        return errorResponse(
          new BadRequestError(
            'Could not load analysis data. Ensure both fact and legal analysis are complete.'
          )
        );
      }

      // Generate draft award
      const result = await generateDraftAward(input, { force: body.force });

      // Create initial revision for tracking
      const draftAward = await getDraftAward(caseId);
      if (draftAward) {
        await createInitialRevision(draftAward.id, request.user.id);
      }

      return NextResponse.json({
        success: true,
        message: 'Draft award generated successfully',
        data: {
          draftAwardId: draftAward?.id || result.findingsOfFact[0]?.id,
          caseId,
          prevailingParty: result.decision.prevailingParty,
          awardAmount: result.decision.awardAmount,
          totalAward: result.decision.totalAward,
          confidence: result.confidence,
          findingsCount: result.findingsOfFact.length,
          conclusionsCount: result.conclusionsOfLaw.length,
          tokensUsed: result.tokensUsed,
          generatedAt: result.generatedAt,
        },
      });
    } catch (error) {
      console.error('Error generating draft award:', error);
      return errorResponse(error as Error);
    }
  },
  {
    rateLimit: { limit: 3, window: 60 }, // 3 requests per minute
  }
);

/**
 * GET - Retrieve draft award for a case
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
    const isParty = caseData.claimantId === userId || caseData.respondentId === userId;
    const isArbitrator = caseData.arbitratorAssignment?.arbitratorId === userId;

    if (!isParty && !isArbitrator) {
      return errorResponse(new ForbiddenError('You do not have access to this case'));
    }

    // Get draft award
    const draftAward = await getDraftAward(caseId);

    if (!draftAward) {
      return NextResponse.json({
        success: true,
        data: {
          caseId,
          status: 'NOT_GENERATED',
          message: 'Draft award has not been generated for this case',
        },
      });
    }

    // Get revision history and escalation info
    const [revisions, escalation] = await Promise.all([
      getRevisionHistory(draftAward.id),
      getEscalation(draftAward.id),
    ]);

    return NextResponse.json({
      success: true,
      data: {
        id: draftAward.id,
        caseId: draftAward.caseId,
        findingsOfFact: draftAward.findingsOfFact,
        conclusionsOfLaw: draftAward.conclusionsOfLaw,
        decision: draftAward.decision,
        awardAmount: draftAward.awardAmount,
        prevailingParty: draftAward.prevailingParty,
        reasoning: draftAward.reasoning,
        confidence: draftAward.confidence,
        citationsVerified: draftAward.citationsVerified,
        reviewStatus: draftAward.reviewStatus,
        reviewNotes: draftAward.reviewNotes,
        generatedAt: draftAward.generatedAt,
        reviewedAt: draftAward.reviewedAt,
        // New workflow data
        revisions,
        escalation,
        currentVersion: revisions[0]?.version ?? 1,
      },
    });
  } catch (error) {
    console.error('Error retrieving draft award:', error);
    return errorResponse(error as Error);
  }
});

/**
 * PATCH - Submit review of draft award with workflow actions
 *
 * Supports different action types:
 * - APPROVE: Approve the draft award
 * - MODIFY: Apply modifications to the award
 * - REJECT: Reject with structured feedback
 * - ESCALATE: Escalate to senior arbitrator
 */
export const PATCH = withAuth(async (request: AuthenticatedRequest, context) => {
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

    // Only arbitrator can review
    const userId = request.user.id;
    const isArbitrator = caseData.arbitratorAssignment?.arbitratorId === userId;
    const isAdmin = request.user.role === 'ADMIN';

    if (!isArbitrator && !isAdmin) {
      return errorResponse(
        new ForbiddenError('Only the assigned arbitrator can review the draft award')
      );
    }

    // Parse request body
    const body = (await request.json()) as {
      reviewStatus?: ReviewDecision;
      reviewNotes?: string;
      // For MODIFY action
      modifications?: AwardModification;
      changeSummary?: string;
      // For REJECT action
      rejectionFeedback?: RejectionFeedback;
      // For ESCALATE action
      escalation?: EscalationInput;
    };

    if (!body.reviewStatus) {
      return errorResponse(new BadRequestError('Review status is required'));
    }

    const validStatuses = ['APPROVE', 'MODIFY', 'REJECT', 'ESCALATE'];
    if (!validStatuses.includes(body.reviewStatus)) {
      return errorResponse(
        new BadRequestError(`Invalid review status. Must be one of: ${validStatuses.join(', ')}`)
      );
    }

    // Check draft award exists
    const existing = await getDraftAward(caseId);
    if (!existing) {
      return errorResponse(new NotFoundError('Draft award not found for this case'));
    }

    // Handle different workflow actions
    switch (body.reviewStatus) {
      case 'APPROVE': {
        const result = await approveDraftAward(caseId, userId, body.reviewNotes);
        return NextResponse.json({
          success: true,
          message: result.message,
          data: {
            reviewStatus: 'APPROVE',
            nextStep: result.nextStep,
          },
        });
      }

      case 'MODIFY': {
        if (!body.modifications) {
          return errorResponse(new BadRequestError('Modifications are required for MODIFY action'));
        }
        const result = await modifyDraftAward(
          caseId,
          userId,
          body.modifications,
          body.changeSummary
        );
        return NextResponse.json({
          success: true,
          message: 'Award modified successfully',
          data: {
            reviewStatus: 'MODIFY',
            version: result.version,
            changedFields: result.changedFields,
            changeSummary: result.changeSummary,
            modifiedAt: result.modifiedAt,
          },
        });
      }

      case 'REJECT': {
        if (!body.rejectionFeedback) {
          return errorResponse(
            new BadRequestError('Rejection feedback is required for REJECT action')
          );
        }
        const result = await rejectDraftAward(caseId, userId, body.rejectionFeedback);
        return NextResponse.json({
          success: true,
          message: result.message,
          data: {
            reviewStatus: 'REJECT',
            nextStep: 'Case will be re-analyzed based on feedback',
          },
        });
      }

      case 'ESCALATE': {
        if (!body.escalation) {
          return errorResponse(
            new BadRequestError('Escalation details are required for ESCALATE action')
          );
        }
        const result = await escalateDraftAward(caseId, userId, body.escalation);
        return NextResponse.json({
          success: true,
          message: 'Award escalated successfully',
          data: {
            reviewStatus: 'ESCALATE',
            escalationId: result.escalationId,
            status: result.status,
            assignedToId: result.assignedToId,
            assignedToName: result.assignedToName,
            escalatedAt: result.escalatedAt,
          },
        });
      }

      default: {
        // Fallback to legacy behavior
        const result = await submitDraftAwardReview(caseId, {
          reviewStatus: body.reviewStatus as ReviewDecision,
          reviewNotes: body.reviewNotes,
        });
        return NextResponse.json({
          success: true,
          message: `Draft award review submitted: ${String(body.reviewStatus)}`,
          data: {
            id: result.id,
            reviewStatus: result.reviewStatus,
            reviewedAt: result.reviewedAt,
            nextStep: result.nextStep,
          },
        });
      }
    }
  } catch (error) {
    console.error('Error submitting draft award review:', error);
    return errorResponse(error as Error);
  }
});
