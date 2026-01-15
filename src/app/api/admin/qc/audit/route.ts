/**
 * Audit Sampling API Route
 *
 * GET /api/admin/qc/audit - Get audit queue and stats
 * POST /api/admin/qc/audit - Select new audit sample
 */

import { type NextRequest, NextResponse } from 'next/server';

import { requireRole } from '@/lib/auth';
import {
  selectAuditSample,
  getAuditQueue,
  getAuditStats,
  createAuditTask,
  type AuditTask,
} from '@/lib/qc';

export async function GET(request: NextRequest) {
  try {
    // Verify admin role
    await requireRole('ADMIN');

    // Parse query parameters
    const { searchParams } = new URL(request.url);
    const view = searchParams.get('view') || 'queue';
    const periodDays = parseInt(searchParams.get('periodDays') || '30');

    if (view === 'stats') {
      // Get audit statistics
      const periodStart = new Date(Date.now() - periodDays * 24 * 60 * 60 * 1000);
      const stats = await getAuditStats({ periodStart });

      return NextResponse.json({
        success: true,
        data: stats,
      });
    }

    // Get audit queue
    const queue = await getAuditQueue({
      status: ['pending', 'in_progress'],
      limit: 50,
    });

    return NextResponse.json({
      success: true,
      data: {
        queue,
        totalPending: queue.filter((t: AuditTask) => t.status === 'pending').length,
        totalInProgress: queue.filter((t: AuditTask) => t.status === 'in_progress').length,
      },
    });
  } catch (error) {
    console.error('[Audit API] GET error:', error);
    const message = error instanceof Error ? error.message : 'Failed to fetch audit data';
    const status = message.includes('required') || message.includes('Insufficient') ? 401 : 500;
    return NextResponse.json({ success: false, error: message }, { status });
  }
}

export async function POST(request: NextRequest) {
  try {
    // Verify admin role
    await requireRole('ADMIN');

    const body = (await request.json()) as {
      periodDays?: number;
      maxSamples?: number;
      includeRiskBased?: boolean;
      createTasks?: boolean;
      assignTo?: string;
    };
    const {
      periodDays = 30,
      maxSamples = 50,
      includeRiskBased = true,
      createTasks = false,
      assignTo,
    } = body;

    // Select audit sample
    const periodStart = new Date(Date.now() - periodDays * 24 * 60 * 60 * 1000);
    const samples = await selectAuditSample({
      periodStart,
      maxSamples,
      includeRiskBased,
    });

    // Optionally create tasks for each sample
    const tasks = [];
    if (createTasks) {
      for (const sample of samples) {
        const task = await createAuditTask(sample, { assignTo });
        tasks.push(task);
      }
    }

    return NextResponse.json({
      success: true,
      data: {
        samples,
        sampleCount: samples.length,
        tasks: createTasks ? tasks : undefined,
        tasksCreated: createTasks ? tasks.length : 0,
      },
    });
  } catch (error) {
    console.error('[Audit API] POST error:', error);
    const message = error instanceof Error ? error.message : 'Failed to select audit sample';
    const status = message.includes('required') || message.includes('Insufficient') ? 401 : 500;
    return NextResponse.json({ success: false, error: message }, { status });
  }
}
