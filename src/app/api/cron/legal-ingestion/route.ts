/**
 * Legal Document Ingestion Cron Job
 *
 * GET /api/cron/legal-ingestion
 *
 * Runs periodically to ingest new legal documents from configured sources.
 * Configure in vercel.json: { "path": "/api/cron/legal-ingestion", "schedule": "0 2 * * 0" }
 * (Runs weekly on Sunday at 2 AM)
 */

import type { NextRequest } from 'next/server';
import { NextResponse } from 'next/server';

import {
  ingestCaliforniaStatutes,
  ingestCaliforniaCaseLaw,
  getIngestionStats,
} from '@/lib/legal/ingestion';

// Topics to ingest case law for
const CASE_LAW_TOPICS = [
  'breach of contract',
  'consumer protection',
  'warranty dispute',
  'payment dispute',
  'service dispute',
];

export async function GET(request: NextRequest) {
  // Verify cron secret
  const authHeader = request.headers.get('authorization');
  const cronSecret = process.env.CRON_SECRET;

  if (cronSecret && authHeader !== `Bearer ${cronSecret}`) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  // Check if this is a full or incremental run
  const searchParams = request.nextUrl.searchParams;
  const mode = searchParams.get('mode') || 'incremental';

  try {
    const results = {
      mode,
      statutes: null as { total: number; successful: number; failed: number } | null,
      caseLaw: [] as Array<{ topic: string; total: number; successful: number; failed: number }>,
      stats: null as Awaited<ReturnType<typeof getIngestionStats>> | null,
    };

    // Full mode: reingest all statutes
    if (mode === 'full') {
      const statuteResults = await ingestCaliforniaStatutes();
      results.statutes = {
        total: statuteResults.total,
        successful: statuteResults.successful,
        failed: statuteResults.failed,
      };
    }

    // Ingest case law for each topic (limited to avoid timeout)
    const caseLawLimit = mode === 'full' ? 20 : 5;

    for (const topic of CASE_LAW_TOPICS) {
      try {
        const caseResults = await ingestCaliforniaCaseLaw({
          topic,
          limit: caseLawLimit,
        });

        results.caseLaw.push({
          topic,
          total: caseResults.total,
          successful: caseResults.successful,
          failed: caseResults.failed,
        });
      } catch (error) {
        console.error(`Failed to ingest case law for topic "${topic}":`, error);
        results.caseLaw.push({
          topic,
          total: 0,
          successful: 0,
          failed: 1,
        });
      }
    }

    // Get final stats
    results.stats = await getIngestionStats();

    return NextResponse.json({
      success: true,
      message: 'Legal document ingestion completed',
      results,
    });
  } catch (error) {
    console.error('Legal ingestion cron error:', error);
    return NextResponse.json(
      {
        success: false,
        error: 'Failed to complete legal document ingestion',
        details: error instanceof Error ? error.message : 'Unknown error',
      },
      { status: 500 }
    );
  }
}

// POST endpoint for manual/on-demand ingestion
export async function POST(request: NextRequest) {
  // Verify cron secret or admin auth
  const authHeader = request.headers.get('authorization');
  const cronSecret = process.env.CRON_SECRET;

  if (cronSecret && authHeader !== `Bearer ${cronSecret}`) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  try {
    const body = (await request.json()) as { action?: string; topic?: string; limit?: number };
    const { action, topic, limit } = body;

    if (action === 'statutes') {
      const results = await ingestCaliforniaStatutes();
      return NextResponse.json({
        success: true,
        message: 'Statute ingestion completed',
        results: {
          total: results.total,
          successful: results.successful,
          failed: results.failed,
        },
      });
    }

    if (action === 'case-law' && topic) {
      const results = await ingestCaliforniaCaseLaw({
        topic,
        limit: limit || 20,
      });
      return NextResponse.json({
        success: true,
        message: `Case law ingestion completed for topic: ${topic}`,
        results: {
          total: results.total,
          successful: results.successful,
          failed: results.failed,
        },
      });
    }

    if (action === 'stats') {
      const stats = await getIngestionStats();
      return NextResponse.json({
        success: true,
        stats,
      });
    }

    return NextResponse.json(
      {
        success: false,
        error: 'Invalid action. Use "statutes", "case-law", or "stats"',
      },
      { status: 400 }
    );
  } catch (error) {
    console.error('Legal ingestion POST error:', error);
    return NextResponse.json(
      {
        success: false,
        error: 'Failed to perform ingestion action',
      },
      { status: 500 }
    );
  }
}
