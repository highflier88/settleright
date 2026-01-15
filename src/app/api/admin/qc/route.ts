/**
 * QC Dashboard API Route
 *
 * GET /api/admin/qc - Get QC dashboard data
 * POST /api/admin/qc - Run quality check on specific award
 */

import { type NextRequest, NextResponse } from 'next/server';

import { requireRole } from '@/lib/auth';
import { getQCDashboardData, runQualityCheck, type QCCheckType } from '@/lib/qc';

export async function GET(request: NextRequest) {
  try {
    // Verify admin/arbitrator role
    await requireRole(['ADMIN', 'ARBITRATOR']);

    // Parse query parameters
    const { searchParams } = new URL(request.url);
    const periodDays = parseInt(searchParams.get('periodDays') || '30');
    const limit = parseInt(searchParams.get('limit') || '20');

    // Get dashboard data
    const dashboardData = await getQCDashboardData({
      periodDays,
      limit,
    });

    return NextResponse.json({
      success: true,
      data: dashboardData,
    });
  } catch (error) {
    console.error('[QC API] GET error:', error);
    const message = error instanceof Error ? error.message : 'Failed to fetch QC data';
    const status = message.includes('required') || message.includes('Insufficient') ? 401 : 500;
    return NextResponse.json({ success: false, error: message }, { status });
  }
}

export async function POST(request: NextRequest) {
  try {
    // Verify admin/arbitrator role
    await requireRole(['ADMIN', 'ARBITRATOR']);

    const body = (await request.json()) as { awardId?: string; checkType?: QCCheckType };
    const { awardId, checkType = 'full' } = body;

    if (!awardId) {
      return NextResponse.json({ success: false, error: 'Award ID is required' }, { status: 400 });
    }

    // Run quality check
    const result = await runQualityCheck(awardId, { checkType });

    return NextResponse.json({
      success: true,
      data: result,
    });
  } catch (error) {
    console.error('[QC API] POST error:', error);
    const message = error instanceof Error ? error.message : 'Failed to run QC check';
    const status = message.includes('required') || message.includes('Insufficient') ? 401 : 500;
    return NextResponse.json({ success: false, error: message }, { status });
  }
}
