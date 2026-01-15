/**
 * Arbitrator Earnings API
 *
 * GET /api/arbitrator/earnings - Get earnings summary and history
 */

import { type NextRequest, NextResponse } from 'next/server';

import { auth } from '@clerk/nextjs/server';

import { getEarningsSummary, getCompensationHistory } from '@/lib/arbitrator';
import { prisma } from '@/lib/db';

import type { CompensationStatus } from '@prisma/client';

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
    const view = searchParams.get('view') || 'summary';
    const limit = parseInt(searchParams.get('limit') || '50');
    const offset = parseInt(searchParams.get('offset') || '0');
    const statusFilter = searchParams.get('status');

    if (view === 'history') {
      const statusOptions: CompensationStatus[] | undefined = statusFilter
        ? (statusFilter.split(',') as CompensationStatus[])
        : undefined;

      const history = await getCompensationHistory(user.arbitratorProfile.id, {
        status: statusOptions,
        limit,
        offset,
      });

      return NextResponse.json({
        success: true,
        data: { history },
      });
    }

    // Default: summary
    const summary = await getEarningsSummary(user.arbitratorProfile.id);

    // Also get recent history for dashboard
    const recentHistory = await getCompensationHistory(user.arbitratorProfile.id, { limit: 10 });

    return NextResponse.json({
      success: true,
      data: {
        summary,
        recentHistory,
      },
    });
  } catch (error) {
    console.error('[Arbitrator Earnings API] GET error:', error);
    const message = error instanceof Error ? error.message : 'Failed to get earnings';
    return NextResponse.json({ success: false, error: message }, { status: 500 });
  }
}
