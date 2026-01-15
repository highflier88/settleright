/**
 * Case Fact Analysis API
 *
 * POST /api/cases/[id]/analysis - Start fact analysis for a case
 * GET /api/cases/[id]/analysis - Get analysis status and results
 */

import { NextResponse } from 'next/server';

import {
  getAnalysisStatus,
  loadAnalysisInput,
  queueAnalysis,
  runAnalysis,
} from '@/lib/analysis';
import { BadRequestError, ForbiddenError, NotFoundError } from '@/lib/api/errors';
import { errorResponse } from '@/lib/api/response';
import { withAuth, type AuthenticatedRequest } from '@/lib/api/with-auth';
import { prisma } from '@/lib/db';

/**
 * POST - Start fact analysis for a case
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
          claimantId: true,
          respondentId: true,
          status: true,
        },
      });

      if (!caseData) {
        return errorResponse(new NotFoundError('Case not found'));
      }

      // Verify user has access to this case
      const userId = request.user.id;
      const isParty =
        caseData.claimantId === userId || caseData.respondentId === userId;

      if (!isParty) {
        return errorResponse(
          new ForbiddenError('You do not have access to this case')
        );
      }

      // Check if analysis already exists and is complete
      const existingStatus = await getAnalysisStatus(caseId);
      const body = (await request.json().catch(() => ({}))) as {
        async?: boolean;
        force?: boolean;
      };

      if (
        existingStatus?.status === 'COMPLETED' &&
        !body.force
      ) {
        return NextResponse.json({
          success: true,
          message: 'Analysis already completed',
          data: {
            caseId,
            jobId: existingStatus.jobId,
            status: existingStatus.status,
            progress: existingStatus.progress,
          },
        });
      }

      if (
        existingStatus?.status === 'PROCESSING' ||
        existingStatus?.status === 'QUEUED'
      ) {
        return NextResponse.json({
          success: true,
          message: 'Analysis already in progress',
          data: {
            caseId,
            jobId: existingStatus.jobId,
            status: existingStatus.status,
            progress: existingStatus.progress,
          },
        });
      }

      // Load analysis input
      const input = await loadAnalysisInput(caseId);

      if (!input) {
        return errorResponse(
          new BadRequestError(
            'Case does not have required data for analysis. Ensure claimant has submitted a statement.'
          )
        );
      }

      // Queue or run immediately based on async flag
      if (body.async !== false) {
        // Queue for background processing
        const jobId = await queueAnalysis(caseId);

        return NextResponse.json({
          success: true,
          message: 'Analysis queued for processing',
          data: {
            caseId,
            jobId,
            status: 'QUEUED',
          },
        });
      } else {
        // Run analysis immediately (synchronous)
        const result = await runAnalysis(input, { force: body.force });

        return NextResponse.json({
          success: result.status === 'completed',
          message:
            result.status === 'completed'
              ? 'Analysis completed successfully'
              : 'Analysis failed',
          data: {
            caseId,
            jobId: result.jobId,
            status: result.status === 'completed' ? 'COMPLETED' : 'FAILED',
            processingTimeMs: result.processingTimeMs,
            totalTokensUsed: result.totalTokensUsed,
            estimatedCost: result.estimatedCost,
            error: result.error,
          },
        });
      }
    } catch (error) {
      console.error('Error starting analysis:', error);
      return errorResponse(error as Error);
    }
  },
  {
    rateLimit: { limit: 5, window: 60 }, // 5 requests per minute
  }
);

/**
 * GET - Get analysis status and results for a case
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
      },
    });

    if (!caseData) {
      return errorResponse(new NotFoundError('Case not found'));
    }

    // Verify user has access to this case
    const userId = request.user.id;
    const isParty =
      caseData.claimantId === userId || caseData.respondentId === userId;

    if (!isParty) {
      return errorResponse(
        new ForbiddenError('You do not have access to this case')
      );
    }

    // Get analysis status
    const status = await getAnalysisStatus(caseId);

    if (!status) {
      return NextResponse.json({
        success: true,
        data: {
          caseId,
          status: 'NOT_STARTED',
          message: 'Analysis has not been started for this case',
        },
      });
    }

    // Prepare response based on status
    const response: Record<string, unknown> = {
      caseId,
      jobId: status.jobId,
      status: status.status,
      progress: status.progress,
      startedAt: status.startedAt,
      completedAt: status.completedAt,
      failedAt: status.failedAt,
      failureReason: status.failureReason,
      tokensUsed: status.tokensUsed,
      processingTimeMs: status.processingTimeMs,
      estimatedCost: status.estimatedCost
        ? Number(status.estimatedCost)
        : undefined,
    };

    // Include results if completed
    if (status.status === 'COMPLETED') {
      response.results = {
        extractedFacts: status.extractedFacts,
        disputedFacts: status.disputedFacts,
        undisputedFacts: status.undisputedFacts,
        timeline: status.timeline,
        contradictions: status.contradictions,
        credibilityScores: status.credibilityScores,
      };
    }

    return NextResponse.json({
      success: true,
      data: response,
    });
  } catch (error) {
    console.error('Error getting analysis status:', error);
    return errorResponse(error as Error);
  }
});
