/**
 * Bias Report API Route
 *
 * GET /api/admin/qc/bias - Generate bias report for all arbitrators
 * GET /api/admin/qc/bias?arbitratorId=xxx - Get bias analysis for specific arbitrator
 */

import { type NextRequest, NextResponse } from 'next/server';

import { requireRole } from '@/lib/auth';
import { generateBiasReport, detectBias, getBiasMetrics } from '@/lib/qc';

export async function GET(request: NextRequest) {
  try {
    // Verify admin role
    await requireRole('ADMIN');

    // Parse query parameters
    const { searchParams } = new URL(request.url);
    const arbitratorId = searchParams.get('arbitratorId');
    const metricsOnly = searchParams.get('metrics') === 'true';

    if (arbitratorId) {
      // Get specific arbitrator analysis
      if (metricsOnly) {
        const metrics = await getBiasMetrics(arbitratorId);
        return NextResponse.json({
          success: true,
          data: metrics,
        });
      }

      const analysis = await detectBias(arbitratorId);
      return NextResponse.json({
        success: true,
        data: analysis,
      });
    }

    // Generate full bias report
    const report = await generateBiasReport();

    return NextResponse.json({
      success: true,
      data: report,
    });
  } catch (error) {
    console.error('[Bias API] GET error:', error);
    const message = error instanceof Error ? error.message : 'Failed to generate bias report';
    const status = message.includes('required') || message.includes('Insufficient') ? 401 : 500;
    return NextResponse.json({ success: false, error: message }, { status });
  }
}
