/**
 * Arbitrator Analytics API
 *
 * GET /api/arbitrator/analytics - Get analytics dashboard data
 */

import { type NextRequest, NextResponse } from 'next/server';

import { auth } from '@clerk/nextjs/server';

import {
  getArbitratorDashboardData,
  getPerformanceMetrics,
  getWorkloadMetrics,
  getEarningsTrends,
  getQualityMetrics,
  getRecentActivity,
} from '@/lib/arbitrator';
import { prisma } from '@/lib/db';

export const dynamic = 'force-dynamic';

export async function GET(request: NextRequest) {
  try {
    const { userId: clerkId } = auth();

    if (!clerkId) {
      return NextResponse.json({ success: false, error: 'Unauthorized' }, { status: 401 });
    }

    // Get user and profile
    const user = await prisma.user.findUnique({
      where: { clerkId },
      include: { arbitratorProfile: true },
    });

    if (!user) {
      return NextResponse.json({ success: false, error: 'User not found' }, { status: 404 });
    }

    if (!user.arbitratorProfile) {
      return NextResponse.json(
        { success: false, error: 'Arbitrator profile not found' },
        { status: 404 }
      );
    }

    const { searchParams } = new URL(request.url);
    const section = searchParams.get('section');

    // If specific section requested, return just that
    if (section) {
      let data;
      switch (section) {
        case 'performance':
          data = await getPerformanceMetrics(user.arbitratorProfile.id);
          break;
        case 'workload':
          data = await getWorkloadMetrics(user.arbitratorProfile.id);
          break;
        case 'earnings':
          data = await getEarningsTrends(user.arbitratorProfile.id);
          break;
        case 'quality':
          data = await getQualityMetrics(user.arbitratorProfile.id);
          break;
        case 'activity':
          const limit = parseInt(searchParams.get('limit') || '10');
          data = await getRecentActivity(user.arbitratorProfile.id, limit);
          break;
        default:
          return NextResponse.json({ success: false, error: 'Invalid section' }, { status: 400 });
      }

      return NextResponse.json({
        success: true,
        data: { [section]: data },
      });
    }

    // Return full dashboard data
    const dashboardData = await getArbitratorDashboardData(user.arbitratorProfile.id);

    return NextResponse.json({
      success: true,
      data: dashboardData,
    });
  } catch (error) {
    console.error('[Arbitrator Analytics API] GET error:', error);
    const message = error instanceof Error ? error.message : 'Failed to get analytics';
    return NextResponse.json({ success: false, error: message }, { status: 500 });
  }
}
