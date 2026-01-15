/**
 * Consistency Analysis API Route
 *
 * GET /api/admin/qc/consistency?awardId=xxx - Get consistency analysis for an award
 * GET /api/admin/qc/consistency?caseId=xxx&similar=true - Get similar awards for a case
 */

import { type NextRequest, NextResponse } from 'next/server';

import { requireRole } from '@/lib/auth';
import { analyzeConsistency, getConsistencyReport, findSimilarAwards } from '@/lib/qc';

export async function GET(request: NextRequest) {
  try {
    // Verify admin/arbitrator role
    await requireRole(['ADMIN', 'ARBITRATOR']);

    // Parse query parameters
    const { searchParams } = new URL(request.url);
    const awardId = searchParams.get('awardId');
    const caseId = searchParams.get('caseId');
    const similar = searchParams.get('similar') === 'true';
    const limit = parseInt(searchParams.get('limit') || '10');

    // Get similar awards for a case
    if (caseId && similar) {
      const similarAwards = await findSimilarAwards(caseId, limit);

      return NextResponse.json({
        success: true,
        data: {
          caseId,
          similarAwards,
          count: similarAwards.length,
        },
      });
    }

    if (awardId) {
      // Get consistency analysis for specific award
      const analysis = await analyzeConsistency(awardId);

      return NextResponse.json({
        success: true,
        data: analysis,
      });
    }

    if (caseId) {
      // Get consistency report by case ID
      const report = await getConsistencyReport(caseId);

      if (!report) {
        return NextResponse.json(
          { success: false, error: 'No award found for case' },
          { status: 404 }
        );
      }

      return NextResponse.json({
        success: true,
        data: report,
      });
    }

    return NextResponse.json(
      { success: false, error: 'Award ID or Case ID is required' },
      { status: 400 }
    );
  } catch (error) {
    console.error('[Consistency API] GET error:', error);
    const message = error instanceof Error ? error.message : 'Failed to fetch consistency analysis';
    const status = message.includes('required') || message.includes('Insufficient') ? 401 : 500;
    return NextResponse.json({ success: false, error: message }, { status });
  }
}
