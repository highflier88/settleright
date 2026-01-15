/**
 * Case Document Batch Processing API
 *
 * POST /api/cases/[id]/process-documents - Queue all unprocessed documents for processing
 * GET /api/cases/[id]/process-documents - Get processing status for all case documents
 */

import { NextResponse } from 'next/server';

import { NotFoundError, ForbiddenError, BadRequestError } from '@/lib/api/errors';
import { errorResponse } from '@/lib/api/response';
import { withAuth, type AuthenticatedRequest } from '@/lib/api/with-auth';
import { prisma } from '@/lib/db';
import { queueCaseDocuments, getQueueStats } from '@/lib/documents';

/**
 * POST - Queue all unprocessed documents in a case for processing
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
        return errorResponse(new ForbiddenError('You do not have access to this case'));
      }

      // Get all evidence for the case
      const evidence = await prisma.evidence.findMany({
        where: {
          caseId,
          deletedAt: null,
        },
        select: {
          id: true,
          fileName: true,
          fileType: true,
          processingStatus: true,
        },
      });

      // Queue unprocessed documents
      const jobIds = await queueCaseDocuments(caseId);

      // Get processing summary
      const processingCount = evidence.filter((e) =>
        ['QUEUED', 'EXTRACTING', 'OCR_PROCESSING', 'CLASSIFYING', 'EXTRACTING_ENTITIES', 'SUMMARIZING'].includes(
          e.processingStatus
        )
      ).length;
      const completedCount = evidence.filter(
        (e) => e.processingStatus === 'COMPLETED'
      ).length;

      return NextResponse.json({
        success: true,
        message: `${jobIds.length} document(s) queued for processing`,
        data: {
          caseId,
          totalDocuments: evidence.length,
          queued: jobIds.length,
          alreadyProcessing: processingCount,
          completed: completedCount,
          jobs: jobIds.map((jobId, index) => ({
            jobId,
            evidenceId: evidence[index]?.id,
          })),
        },
      });
    } catch (error) {
      console.error('Error queuing case documents:', error);
      return errorResponse(error as Error);
    }
  },
  {
    rateLimit: { limit: 5, window: 60 }, // 5 requests per minute
  }
);

/**
 * GET - Get processing status for all documents in a case
 */
export const GET = withAuth(
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
        return errorResponse(new ForbiddenError('You do not have access to this case'));
      }

      // Get all evidence with processing status
      const evidence = await prisma.evidence.findMany({
        where: {
          caseId,
          deletedAt: null,
        },
        select: {
          id: true,
          fileName: true,
          fileType: true,
          processingStatus: true,
          processedAt: true,
          processingError: true,
          documentType: true,
          summary: true,
        },
        orderBy: { submittedAt: 'desc' },
      });

      // Get global queue stats
      const queueStats = await getQueueStats();

      // Calculate case-specific stats
      const caseStats = {
        total: evidence.length,
        pending: evidence.filter((e) => e.processingStatus === 'PENDING').length,
        queued: evidence.filter((e) => e.processingStatus === 'QUEUED').length,
        processing: evidence.filter((e) =>
          ['EXTRACTING', 'OCR_PROCESSING', 'CLASSIFYING', 'EXTRACTING_ENTITIES', 'SUMMARIZING'].includes(
            e.processingStatus
          )
        ).length,
        completed: evidence.filter((e) => e.processingStatus === 'COMPLETED').length,
        failed: evidence.filter((e) => e.processingStatus === 'FAILED').length,
      };

      return NextResponse.json({
        success: true,
        data: {
          caseId,
          stats: caseStats,
          globalQueueStats: queueStats,
          documents: evidence.map((e) => ({
            id: e.id,
            fileName: e.fileName,
            fileType: e.fileType,
            processingStatus: e.processingStatus,
            processedAt: e.processedAt,
            error: e.processingError,
            documentType: e.documentType,
            summary: e.summary?.slice(0, 200), // Truncate for response
          })),
        },
      });
    } catch (error) {
      console.error('Error getting case processing status:', error);
      return errorResponse(error as Error);
    }
  }
);
