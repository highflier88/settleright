/**
 * Legal Analysis API
 *
 * POST /api/cases/[id]/legal-analysis - Start legal analysis for a case
 * GET /api/cases/[id]/legal-analysis - Get legal analysis status and results
 */

import { NextResponse } from 'next/server';

import { BadRequestError, ForbiddenError, NotFoundError } from '@/lib/api/errors';
import { errorResponse } from '@/lib/api/response';
import { withAuth, type AuthenticatedRequest } from '@/lib/api/with-auth';
import { prisma } from '@/lib/db';
import {
  getLegalAnalysisStatus,
  loadLegalAnalysisInput,
  runLegalAnalysis,
} from '@/lib/legal-analysis';

/**
 * POST - Start legal analysis for a case
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

      // Check if fact analysis is complete
      const factAnalysis = await prisma.analysisJob.findUnique({
        where: { caseId },
        select: {
          status: true,
          legalAnalysisStatus: true,
        },
      });

      if (!factAnalysis || factAnalysis.status !== 'COMPLETED') {
        return errorResponse(
          new BadRequestError(
            'Fact analysis must be completed before running legal analysis'
          )
        );
      }

      // Parse request body
      const body = (await request.json().catch(() => ({}))) as {
        force?: boolean;
      };

      // Check if legal analysis already exists
      if (
        factAnalysis.legalAnalysisStatus === 'COMPLETED' &&
        !body.force
      ) {
        return NextResponse.json({
          success: true,
          message: 'Legal analysis already completed',
          data: {
            caseId,
            status: 'COMPLETED',
          },
        });
      }

      if (factAnalysis.legalAnalysisStatus === 'PROCESSING') {
        return NextResponse.json({
          success: true,
          message: 'Legal analysis already in progress',
          data: {
            caseId,
            status: 'PROCESSING',
          },
        });
      }

      // Load analysis input
      const input = await loadLegalAnalysisInput(caseId);

      if (!input) {
        return errorResponse(
          new BadRequestError(
            'Could not load analysis input. Ensure fact analysis is complete.'
          )
        );
      }

      // Mark as started
      await prisma.analysisJob.update({
        where: { caseId },
        data: {
          legalAnalysisStatus: 'PROCESSING',
          legalAnalysisStartedAt: new Date(),
          legalAnalysisError: null,
        },
      });

      // Run legal analysis
      const result = await runLegalAnalysis(input, { force: body.force });

      if (result.status === 'completed') {
        return NextResponse.json({
          success: true,
          message: 'Legal analysis completed successfully',
          data: {
            caseId,
            jobId: result.jobId,
            status: 'COMPLETED',
            processingTimeMs: result.processingTimeMs,
            tokensUsed: result.tokensUsed,
            estimatedCost: result.estimatedCost,
            confidence: result.overallConfidence,
            issueCount: result.legalIssues?.length || 0,
            recommendedAward: result.awardRecommendation?.awardAmount,
            prevailingParty: result.awardRecommendation?.prevailingParty,
          },
        });
      } else {
        return NextResponse.json({
          success: false,
          message: 'Legal analysis failed',
          data: {
            caseId,
            jobId: result.jobId,
            status: 'FAILED',
            error: result.error,
          },
        }, { status: 500 });
      }
    } catch (error) {
      console.error('Error starting legal analysis:', error);
      return errorResponse(error as Error);
    }
  },
  {
    rateLimit: { limit: 5, window: 60 }, // 5 requests per minute
  }
);

/**
 * GET - Get legal analysis status and results
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

    // Get legal analysis status
    const status = await getLegalAnalysisStatus(caseId);

    if (!status) {
      return NextResponse.json({
        success: true,
        data: {
          caseId,
          status: 'NOT_STARTED',
          message: 'Legal analysis has not been started for this case',
        },
      });
    }

    // Build response
    const response: Record<string, unknown> = {
      caseId,
      jobId: status.id,
      status: status.legalAnalysisStatus || 'NOT_STARTED',
      startedAt: status.legalAnalysisStartedAt,
      completedAt: status.legalAnalysisCompletedAt,
      error: status.legalAnalysisError,
      tokensUsed: status.legalAnalysisTokens,
      confidence: status.legalConfidence,
    };

    // Include results if completed
    if (status.legalAnalysisStatus === 'COMPLETED') {
      response.results = {
        legalIssues: status.legalIssues,
        burdenOfProof: status.burdenOfProof,
        damagesCalculation: status.damagesCalculation,
        conclusionsOfLaw: status.conclusionsOfLaw,
        citationsUsed: status.citationsUsed,
      };

      // Extract summary information
      const damagesCalc = status.damagesCalculation as {
        recommendedTotal?: number;
        claimedTotal?: number;
        supportedTotal?: number;
      } | null;

      const burdenResult = status.burdenOfProof as {
        overallBurdenMet?: boolean;
      } | null;

      const issues = status.legalIssues as Array<{
        category: string;
        description: string;
      }> | null;

      response.summary = {
        issueCount: issues?.length || 0,
        issues: issues?.map((i) => ({
          category: i.category,
          description: i.description,
        })),
        burdenMet: burdenResult?.overallBurdenMet,
        claimedAmount: damagesCalc?.claimedTotal,
        supportedAmount: damagesCalc?.supportedTotal,
        recommendedAward: damagesCalc?.recommendedTotal,
      };
    }

    return NextResponse.json({
      success: true,
      data: response,
    });
  } catch (error) {
    console.error('Error getting legal analysis status:', error);
    return errorResponse(error as Error);
  }
});
