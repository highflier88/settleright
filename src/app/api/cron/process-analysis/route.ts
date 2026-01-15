/**
 * Cron Job: Process Pending Analysis Jobs
 *
 * This endpoint is designed to be called by a cron job (e.g., Vercel Cron)
 * to process queued analysis jobs in the background.
 *
 * POST /api/cron/process-analysis - Process pending analysis jobs
 *
 * Security: Requires CRON_SECRET environment variable for authentication
 */

import { NextResponse } from 'next/server';
import type { NextRequest } from 'next/server';

import { processPendingAnalysis } from '@/lib/analysis';
import { prisma } from '@/lib/db';

/**
 * Verify cron secret
 */
function verifyCronSecret(request: NextRequest): boolean {
  const cronSecret = process.env.CRON_SECRET;

  // In development, allow without secret
  if (process.env.NODE_ENV === 'development' && !cronSecret) {
    return true;
  }

  if (!cronSecret) {
    console.warn('CRON_SECRET not set - cron endpoints are disabled');
    return false;
  }

  // Check Authorization header
  const authHeader = request.headers.get('authorization');
  if (authHeader === `Bearer ${cronSecret}`) {
    return true;
  }

  // Check x-cron-secret header (Vercel Cron)
  const cronHeader = request.headers.get('x-cron-secret');
  if (cronHeader === cronSecret) {
    return true;
  }

  return false;
}

/**
 * POST - Process pending analysis jobs
 */
export async function POST(request: NextRequest) {
  // Verify cron secret
  if (!verifyCronSecret(request)) {
    return NextResponse.json({ success: false, error: 'Unauthorized' }, { status: 401 });
  }

  try {
    // Parse request body for options
    const body = (await request.json().catch(() => ({}))) as {
      limit?: number;
    };

    const limit = Math.min(body.limit || 5, 10); // Max 10 jobs per run

    // Get queue stats before processing
    const beforeStats = await getQueueStats();

    // Process pending jobs
    const processed = await processPendingAnalysis(limit);

    // Get queue stats after processing
    const afterStats = await getQueueStats();

    return NextResponse.json({
      success: true,
      data: {
        processed,
        before: beforeStats,
        after: afterStats,
        timestamp: new Date().toISOString(),
      },
    });
  } catch (error) {
    console.error('Error processing analysis jobs:', error);

    return NextResponse.json(
      {
        success: false,
        error: error instanceof Error ? error.message : 'Unknown error',
      },
      { status: 500 }
    );
  }
}

/**
 * GET - Get queue stats (for monitoring)
 */
export async function GET(request: NextRequest) {
  // Verify cron secret
  if (!verifyCronSecret(request)) {
    return NextResponse.json({ success: false, error: 'Unauthorized' }, { status: 401 });
  }

  try {
    const stats = await getQueueStats();

    return NextResponse.json({
      success: true,
      data: {
        stats,
        timestamp: new Date().toISOString(),
      },
    });
  } catch (error) {
    console.error('Error getting queue stats:', error);

    return NextResponse.json(
      {
        success: false,
        error: error instanceof Error ? error.message : 'Unknown error',
      },
      { status: 500 }
    );
  }
}

/**
 * Get analysis queue statistics
 */
async function getQueueStats() {
  const [pending, queued, processing, completed, failed] = await Promise.all([
    prisma.analysisJob.count({ where: { status: 'PENDING' } }),
    prisma.analysisJob.count({ where: { status: 'QUEUED' } }),
    prisma.analysisJob.count({ where: { status: 'PROCESSING' } }),
    prisma.analysisJob.count({ where: { status: 'COMPLETED' } }),
    prisma.analysisJob.count({ where: { status: 'FAILED' } }),
  ]);

  // Get oldest queued job
  const oldestQueued = await prisma.analysisJob.findFirst({
    where: { status: 'QUEUED' },
    orderBy: { queuedAt: 'asc' },
    select: { queuedAt: true },
  });

  // Get recent completions
  const recentCompletions = await prisma.analysisJob.findMany({
    where: {
      status: 'COMPLETED',
      completedAt: { not: null },
    },
    orderBy: { completedAt: 'desc' },
    take: 5,
    select: {
      caseId: true,
      completedAt: true,
      processingTimeMs: true,
      tokensUsed: true,
    },
  });

  return {
    counts: {
      pending,
      queued,
      processing,
      completed,
      failed,
      total: pending + queued + processing + completed + failed,
    },
    oldestQueuedAt: oldestQueued?.queuedAt || null,
    recentCompletions,
  };
}
