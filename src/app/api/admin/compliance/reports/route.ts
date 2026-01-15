/**
 * Compliance Reports API
 *
 * GET /api/admin/compliance/reports - List available report types
 * POST /api/admin/compliance/reports - Generate a compliance report
 */

import { type NextRequest, NextResponse } from 'next/server';

import { requireRole } from '@/lib/auth';
import {
  generatePlatformActivityReport,
  generateCaseResolutionReport,
  generateDataIntegrityReport,
  generateArbitratorPerformanceReport,
  exportComplianceReport,
} from '@/lib/compliance/reports';

export async function GET() {
  try {
    await requireRole('ADMIN');

    return NextResponse.json({
      success: true,
      data: {
        availableReports: [
          {
            type: 'PLATFORM_ACTIVITY',
            name: 'Platform Activity Report',
            description: 'Comprehensive metrics on platform usage, cases, and financial activity',
          },
          {
            type: 'CASE_RESOLUTION',
            name: 'Case Resolution Report',
            description: 'Statistics on case outcomes, resolution times, and trends',
          },
          {
            type: 'DATA_INTEGRITY',
            name: 'Data Integrity Report',
            description: 'Audit log integrity verification and data consistency checks',
          },
          {
            type: 'ARBITRATOR_PERFORMANCE',
            name: 'Arbitrator Performance Report',
            description: 'Arbitrator case statistics, review times, and decision patterns',
          },
        ],
      },
    });
  } catch (error) {
    console.error('[Compliance Reports API] GET error:', error);
    const message = error instanceof Error ? error.message : 'Failed to get report types';
    const status = message.includes('required') || message.includes('Insufficient') ? 401 : 500;
    return NextResponse.json({ success: false, error: message }, { status });
  }
}

export async function POST(request: NextRequest) {
  try {
    const user = await requireRole('ADMIN');

    const body = (await request.json()) as {
      reportType:
        | 'PLATFORM_ACTIVITY'
        | 'CASE_RESOLUTION'
        | 'DATA_INTEGRITY'
        | 'ARBITRATOR_PERFORMANCE';
      startDate: string;
      endDate: string;
      format?: 'json' | 'csv';
    };

    if (!body.reportType) {
      return NextResponse.json(
        { success: false, error: 'Report type is required' },
        { status: 400 }
      );
    }

    if (!body.startDate || !body.endDate) {
      return NextResponse.json(
        { success: false, error: 'Start date and end date are required' },
        { status: 400 }
      );
    }

    const startDate = new Date(body.startDate);
    const endDate = new Date(body.endDate);

    if (isNaN(startDate.getTime()) || isNaN(endDate.getTime())) {
      return NextResponse.json({ success: false, error: 'Invalid date format' }, { status: 400 });
    }

    if (startDate > endDate) {
      return NextResponse.json(
        { success: false, error: 'Start date must be before end date' },
        { status: 400 }
      );
    }

    const options = { startDate, endDate };
    let report;

    switch (body.reportType) {
      case 'PLATFORM_ACTIVITY':
        report = await generatePlatformActivityReport(options, user.id);
        break;
      case 'CASE_RESOLUTION':
        report = await generateCaseResolutionReport(options);
        break;
      case 'DATA_INTEGRITY':
        report = await generateDataIntegrityReport(options);
        break;
      case 'ARBITRATOR_PERFORMANCE':
        report = await generateArbitratorPerformanceReport(options);
        break;
      default:
        return NextResponse.json({ success: false, error: 'Invalid report type' }, { status: 400 });
    }

    if (body.format === 'csv') {
      const csv = exportComplianceReport(report, 'csv');
      return new NextResponse(csv, {
        headers: {
          'Content-Type': 'text/csv',
          'Content-Disposition': `attachment; filename="${report.reportId}.csv"`,
        },
      });
    }

    return NextResponse.json({
      success: true,
      data: report,
    });
  } catch (error) {
    console.error('[Compliance Reports API] POST error:', error);
    const message = error instanceof Error ? error.message : 'Failed to generate report';
    const status = message.includes('required') || message.includes('Insufficient') ? 401 : 500;
    return NextResponse.json({ success: false, error: message }, { status });
  }
}
