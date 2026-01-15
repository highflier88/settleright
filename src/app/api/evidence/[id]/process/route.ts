/**
 * Evidence Document Processing API
 *
 * POST /api/evidence/[id]/process - Trigger document processing
 * GET /api/evidence/[id]/process - Get processing status
 */

import { NextResponse } from 'next/server';

import { NotFoundError, ForbiddenError, BadRequestError } from '@/lib/api/errors';
import { errorResponse } from '@/lib/api/response';
import { withAuth, type AuthenticatedRequest } from '@/lib/api/with-auth';
import { prisma } from '@/lib/db';
import {
  queueDocument,
  processDocument,
  getProcessingStatus,
  getCachedProgress,
} from '@/lib/documents';

/**
 * POST - Trigger document processing for an evidence item
 */
export const POST = withAuth(
  async (request: AuthenticatedRequest, context) => {
    const params = context?.params;
    const evidenceId = params?.id;

    if (!evidenceId) {
      return errorResponse(new BadRequestError('Evidence ID is required'));
    }

    try {
      // Get evidence and verify access
      const evidence = await prisma.evidence.findUnique({
        where: { id: evidenceId },
        include: { case: true },
      });

      if (!evidence || evidence.deletedAt) {
        return errorResponse(new NotFoundError('Evidence not found'));
      }

      // Verify user has access to this case
      const userId = request.user.id;
      const isParty = evidence.case.claimantId === userId || evidence.case.respondentId === userId;

      if (!isParty) {
        return errorResponse(new ForbiddenError('You do not have access to this evidence'));
      }

      // Check if already processing
      if (evidence.processingStatus !== 'PENDING' && evidence.processingStatus !== 'FAILED') {
        return NextResponse.json({
          success: true,
          message: 'Document is already being processed or completed',
          data: {
            evidenceId,
            status: evidence.processingStatus,
          },
        });
      }

      // Parse options from request body
      const body = (await request.json().catch(() => ({}))) as {
        async?: boolean;
        options?: {
          skipOCR?: boolean;
          skipClassification?: boolean;
          skipEntities?: boolean;
          skipSummarization?: boolean;
        };
      };

      // Queue or process immediately based on async flag
      if (body.async !== false) {
        // Queue for background processing
        const jobId = await queueDocument(evidenceId);

        return NextResponse.json({
          success: true,
          message: 'Document queued for processing',
          data: {
            evidenceId,
            jobId,
            status: 'QUEUED',
          },
        });
      } else {
        // Process immediately (synchronous)
        const result = await processDocument(evidenceId, body.options);

        return NextResponse.json({
          success: result.status === 'COMPLETED',
          message:
            result.status === 'COMPLETED'
              ? 'Document processed successfully'
              : 'Document processing failed',
          data: {
            evidenceId,
            status: result.status,
            processingTimeMs: result.processingTimeMs,
            error: result.error,
          },
        });
      }
    } catch (error) {
      console.error('Error processing document:', error);
      return errorResponse(error as Error);
    }
  },
  {
    rateLimit: { limit: 10, window: 60 }, // 10 requests per minute
  }
);

/**
 * GET - Get processing status for an evidence item
 */
export const GET = withAuth(async (request: AuthenticatedRequest, context) => {
  const params = context?.params;
  const evidenceId = params?.id;

  if (!evidenceId) {
    return errorResponse(new BadRequestError('Evidence ID is required'));
  }

  try {
    // Get evidence and verify access
    const evidence = await prisma.evidence.findUnique({
      where: { id: evidenceId },
      include: { case: true },
    });

    if (!evidence || evidence.deletedAt) {
      return errorResponse(new NotFoundError('Evidence not found'));
    }

    // Verify user has access to this case
    const userId = request.user.id;
    const isParty = evidence.case.claimantId === userId || evidence.case.respondentId === userId;

    if (!isParty) {
      return errorResponse(new ForbiddenError('You do not have access to this evidence'));
    }

    // Get processing status
    const status = await getProcessingStatus(evidenceId);
    const cachedProgress = await getCachedProgress(evidenceId);

    return NextResponse.json({
      success: true,
      data: {
        evidenceId,
        status: status?.processingStatus || 'PENDING',
        processedAt: status?.processedAt,
        error: status?.processingError,
        progress: cachedProgress?.progress,
        currentStep: cachedProgress?.step,
        // Extracted data
        extractedText: status?.extractedText?.slice(0, 500), // Truncate for response
        documentType: status?.documentType,
        extractedEntities: status?.extractedEntities,
        summary: status?.summary,
        keyPoints: status?.keyPoints,
        // Job info
        currentJob: status?.currentJob
          ? {
              id: status.currentJob.id,
              status: status.currentJob.status,
              progress: status.currentJob.progress,
              startedAt: status.currentJob.startedAt,
              completedAt: status.currentJob.completedAt,
            }
          : null,
      },
    });
  } catch (error) {
    console.error('Error getting processing status:', error);
    return errorResponse(error as Error);
  }
});
