/**
 * Audit Task API Route
 *
 * PATCH /api/admin/qc/audit/[taskId] - Complete audit task with findings
 */

import { type NextRequest, NextResponse } from 'next/server';

import { requireRole } from '@/lib/auth';
import { completeAuditTask, type AuditFindings } from '@/lib/qc';

export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ taskId: string }> }
) {
  try {
    // Verify admin role
    const user = await requireRole('ADMIN');

    const { taskId } = await params;
    const body = await request.json() as { findings?: AuditFindings };

    // Validate findings
    const { findings } = body;

    if (!findings) {
      return NextResponse.json(
        { success: false, error: 'Findings are required' },
        { status: 400 }
      );
    }

    if (!findings.overallRating || findings.overallRating < 1 || findings.overallRating > 5) {
      return NextResponse.json(
        { success: false, error: 'Overall rating must be between 1 and 5' },
        { status: 400 }
      );
    }

    // Complete the audit task
    const completedTask = await completeAuditTask(
      taskId,
      user.id,
      findings
    );

    return NextResponse.json({
      success: true,
      data: completedTask,
    });
  } catch (error) {
    console.error('[Audit Task API] PATCH error:', error);
    const message = error instanceof Error ? error.message : 'Failed to complete audit task';
    const status = message.includes('required') || message.includes('Insufficient') ? 401 : 500;
    return NextResponse.json(
      { success: false, error: message },
      { status }
    );
  }
}
