/**
 * Admin Arbitrator Compensation API
 *
 * GET /api/admin/arbitrators/compensation - Get pending compensations
 * POST /api/admin/arbitrators/compensation - Approve/process compensations
 */

import { type NextRequest, NextResponse } from 'next/server';

import {
  getPendingCompensations,
  approveCompensation,
  processPendingPayouts,
} from '@/lib/arbitrator';
import { requireRole } from '@/lib/auth';

export async function GET(request: NextRequest) {
  try {
    // Verify admin role
    await requireRole('ADMIN');

    const { searchParams } = new URL(request.url);
    const limit = parseInt(searchParams.get('limit') || '100');

    const pending = await getPendingCompensations({ limit });

    return NextResponse.json({
      success: true,
      data: {
        compensations: pending,
        count: pending.length,
        totalAmount: pending.reduce((sum, c) => sum + c.amount, 0),
      },
    });
  } catch (error) {
    console.error('[Admin Compensation API] GET error:', error);
    const message = error instanceof Error ? error.message : 'Failed to get compensations';
    const status = message.includes('required') || message.includes('Insufficient') ? 401 : 500;
    return NextResponse.json(
      { success: false, error: message },
      { status }
    );
  }
}

export async function POST(request: NextRequest) {
  try {
    // Verify admin role
    const user = await requireRole('ADMIN');

    const body = await request.json() as {
      action: 'approve' | 'process_payouts';
      compensationId?: string;
    };

    if (!body.action) {
      return NextResponse.json(
        { success: false, error: 'Action is required' },
        { status: 400 }
      );
    }

    if (body.action === 'approve') {
      if (!body.compensationId) {
        return NextResponse.json(
          { success: false, error: 'Compensation ID is required for approval' },
          { status: 400 }
        );
      }

      await approveCompensation(body.compensationId, user.id);

      return NextResponse.json({
        success: true,
        message: 'Compensation approved',
      });
    }

    if (body.action === 'process_payouts') {
      const result = await processPendingPayouts();

      return NextResponse.json({
        success: true,
        data: {
          processed: result.processed,
          failed: result.failed,
          errors: result.errors,
        },
      });
    }

    return NextResponse.json(
      { success: false, error: 'Invalid action' },
      { status: 400 }
    );
  } catch (error) {
    console.error('[Admin Compensation API] POST error:', error);
    const message = error instanceof Error ? error.message : 'Failed to process compensation';
    const status = message.includes('required') || message.includes('Insufficient') ? 401 : 500;
    return NextResponse.json(
      { success: false, error: message },
      { status }
    );
  }
}
