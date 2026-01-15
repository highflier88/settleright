/**
 * Document Processing Queue
 *
 * Manages batch processing of documents and queue operations.
 * Uses database as a persistent queue with status tracking.
 */

import { prisma } from '@/lib/db';
import { setCache, getCache } from '@/lib/storage/kv';
import type { ProcessorOptions, ProcessingProgress } from '@/types/documents';

import { processDocument } from './processor';

import type { ProcessingStatus } from '@prisma/client';

// Queue constants
const BATCH_SIZE = 5; // Process 5 documents in parallel
const PROGRESS_CACHE_PREFIX = 'doc_progress:';

/**
 * Queue a single document for processing
 */
export async function queueDocument(evidenceId: string): Promise<string> {
  // Check if already queued or processing
  const existing = await prisma.documentProcessingJob.findFirst({
    where: {
      evidenceId,
      status: {
        in: [
          'PENDING',
          'QUEUED',
          'EXTRACTING',
          'OCR_PROCESSING',
          'CLASSIFYING',
          'EXTRACTING_ENTITIES',
          'SUMMARIZING',
        ],
      },
    },
  });

  if (existing) {
    return existing.id;
  }

  // Create new job
  const job = await prisma.documentProcessingJob.create({
    data: {
      evidenceId,
      status: 'PENDING',
    },
  });

  // Update evidence status
  await prisma.evidence.update({
    where: { id: evidenceId },
    data: { processingStatus: 'PENDING' },
  });

  return job.id;
}

/**
 * Queue all unprocessed documents for a case
 */
export async function queueCaseDocuments(caseId: string): Promise<string[]> {
  // Get all evidence that hasn't been processed
  const evidence = await prisma.evidence.findMany({
    where: {
      caseId,
      deletedAt: null,
      processingStatus: { in: ['PENDING', 'FAILED'] },
    },
    select: { id: true },
  });

  const jobIds: string[] = [];
  for (const item of evidence) {
    const jobId = await queueDocument(item.id);
    jobIds.push(jobId);
  }

  return jobIds;
}

/**
 * Process pending documents from the queue
 */
export async function processPendingDocuments(
  limit: number = BATCH_SIZE,
  options?: ProcessorOptions
): Promise<{
  processed: number;
  failed: number;
  results: Array<{ evidenceId: string; success: boolean; error?: string }>;
}> {
  // Get pending jobs
  const pendingJobs = await prisma.documentProcessingJob.findMany({
    where: { status: 'PENDING' },
    orderBy: { createdAt: 'asc' },
    take: limit,
    include: { evidence: true },
  });

  if (pendingJobs.length === 0) {
    return { processed: 0, failed: 0, results: [] };
  }

  let processed = 0;
  let failed = 0;
  const results: Array<{ evidenceId: string; success: boolean; error?: string }> = [];

  // Process in parallel (up to limit)
  await Promise.all(
    pendingJobs.map(async (job) => {
      try {
        const result = await processDocument(job.evidenceId, options, async (progress) => {
          // Cache progress for real-time polling
          await setCache(`${PROGRESS_CACHE_PREFIX}${job.evidenceId}`, progress, 300);
        });

        if (result.status === 'COMPLETED') {
          processed++;
          results.push({ evidenceId: job.evidenceId, success: true });
        } else {
          failed++;
          results.push({ evidenceId: job.evidenceId, success: false, error: result.error });
        }
      } catch (error) {
        failed++;
        results.push({
          evidenceId: job.evidenceId,
          success: false,
          error: error instanceof Error ? error.message : 'Unknown error',
        });
      }
    })
  );

  return { processed, failed, results };
}

/**
 * Get cached processing progress
 */
export async function getCachedProgress(evidenceId: string): Promise<ProcessingProgress | null> {
  return getCache<ProcessingProgress>(`${PROGRESS_CACHE_PREFIX}${evidenceId}`);
}

/**
 * Get queue statistics
 */
export async function getQueueStats(): Promise<{
  pending: number;
  processing: number;
  completed: number;
  failed: number;
  byStatus: Record<ProcessingStatus, number>;
}> {
  const stats = await prisma.evidence.groupBy({
    by: ['processingStatus'],
    _count: { processingStatus: true },
    where: { deletedAt: null },
  });

  const byStatus: Record<ProcessingStatus, number> = {
    PENDING: 0,
    QUEUED: 0,
    EXTRACTING: 0,
    OCR_PROCESSING: 0,
    CLASSIFYING: 0,
    EXTRACTING_ENTITIES: 0,
    SUMMARIZING: 0,
    COMPLETED: 0,
    FAILED: 0,
  };

  for (const stat of stats) {
    byStatus[stat.processingStatus] = stat._count.processingStatus;
  }

  const processingStatuses: ProcessingStatus[] = [
    'QUEUED',
    'EXTRACTING',
    'OCR_PROCESSING',
    'CLASSIFYING',
    'EXTRACTING_ENTITIES',
    'SUMMARIZING',
  ];

  return {
    pending: byStatus.PENDING,
    processing: processingStatuses.reduce((sum, status) => sum + byStatus[status], 0),
    completed: byStatus.COMPLETED,
    failed: byStatus.FAILED,
    byStatus,
  };
}

/**
 * Retry failed documents
 */
export async function retryFailedDocuments(caseId?: string): Promise<number> {
  const where = {
    processingStatus: 'FAILED' as ProcessingStatus,
    deletedAt: null,
    ...(caseId ? { caseId } : {}),
  };

  // Reset failed documents to pending
  const result = await prisma.evidence.updateMany({
    where,
    data: { processingStatus: 'PENDING', processingError: null },
  });

  return result.count;
}

/**
 * Cancel pending jobs for an evidence item
 */
export async function cancelProcessing(evidenceId: string): Promise<boolean> {
  const result = await prisma.documentProcessingJob.updateMany({
    where: {
      evidenceId,
      status: { in: ['PENDING', 'QUEUED'] },
    },
    data: {
      status: 'FAILED',
      errorMessage: 'Cancelled by user',
      completedAt: new Date(),
    },
  });

  if (result.count > 0) {
    await prisma.evidence.update({
      where: { id: evidenceId },
      data: { processingStatus: 'PENDING' },
    });
  }

  return result.count > 0;
}

/**
 * Clean up old completed jobs (keep last 10 per evidence)
 */
export async function cleanupOldJobs(olderThanDays: number = 7): Promise<number> {
  const cutoff = new Date();
  cutoff.setDate(cutoff.getDate() - olderThanDays);

  const result = await prisma.documentProcessingJob.deleteMany({
    where: {
      status: 'COMPLETED',
      completedAt: { lt: cutoff },
    },
  });

  return result.count;
}
