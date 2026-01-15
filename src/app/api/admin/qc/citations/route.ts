/**
 * Citation Verification API Route
 *
 * GET /api/admin/qc/citations?awardId=xxx - Get citation report for an award
 * POST /api/admin/qc/citations - Verify a single citation
 */

import { type NextRequest, NextResponse } from 'next/server';

import { requireRole } from '@/lib/auth';
import { verifyCitations, verifyCitation, getCitationVerificationReport } from '@/lib/qc';

export async function GET(request: NextRequest) {
  try {
    // Verify admin/arbitrator role
    await requireRole(['ADMIN', 'ARBITRATOR']);

    // Parse query parameters
    const { searchParams } = new URL(request.url);
    const awardId = searchParams.get('awardId');
    const caseId = searchParams.get('caseId');

    if (awardId) {
      // Get citation report for specific award
      const report = await verifyCitations(awardId);

      return NextResponse.json({
        success: true,
        data: report,
      });
    }

    if (caseId) {
      // Get citation report by case ID
      const report = await getCitationVerificationReport(caseId);

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
    console.error('[Citations API] GET error:', error);
    const message = error instanceof Error ? error.message : 'Failed to fetch citation report';
    const status = message.includes('required') || message.includes('Insufficient') ? 401 : 500;
    return NextResponse.json(
      { success: false, error: message },
      { status }
    );
  }
}

export async function POST(request: NextRequest) {
  try {
    // Verify admin/arbitrator role
    await requireRole(['ADMIN', 'ARBITRATOR']);

    const body = await request.json() as { citation?: string };
    const { citation } = body;

    if (!citation || typeof citation !== 'string') {
      return NextResponse.json(
        { success: false, error: 'Citation text is required' },
        { status: 400 }
      );
    }

    // Verify the citation
    const result = await verifyCitation(citation.trim());

    return NextResponse.json({
      success: true,
      data: result,
    });
  } catch (error) {
    console.error('[Citations API] POST error:', error);
    const message = error instanceof Error ? error.message : 'Failed to verify citation';
    const status = message.includes('required') || message.includes('Insufficient') ? 401 : 500;
    return NextResponse.json(
      { success: false, error: message },
      { status }
    );
  }
}
