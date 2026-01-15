/**
 * Arbitrator Stats API
 *
 * GET /api/arbitrator/stats - Get arbitrator's performance statistics
 */

import { NextResponse } from 'next/server';

import { errorResponse } from '@/lib/api/response';
import { withArbitrator, type AuthenticatedRequest } from '@/lib/api/with-auth';
import { prisma } from '@/lib/db';

interface ReviewTimeItem {
  reviewStartedAt: Date | null;
  reviewCompletedAt: Date | null;
}

/**
 * GET - Get arbitrator's performance statistics
 */
export const GET = withArbitrator(async (request: AuthenticatedRequest) => {
  try {
    const userId = request.user.id;

    // Get current date ranges
    const now = new Date();
    const startOfWeek = new Date(now);
    startOfWeek.setDate(now.getDate() - now.getDay());
    startOfWeek.setHours(0, 0, 0, 0);

    const startOfMonth = new Date(now.getFullYear(), now.getMonth(), 1);
    const _startOfYear = new Date(now.getFullYear(), 0, 1);

    // Get pending cases (not yet reviewed)
    const pendingCases = await prisma.arbitratorAssignment.count({
      where: {
        arbitratorId: userId,
        reviewCompletedAt: null,
        case: {
          status: 'ARBITRATOR_REVIEW',
        },
      },
    });

    // Get cases needing attention (with draft awards ready)
    const casesWithDraftAward = await prisma.arbitratorAssignment.count({
      where: {
        arbitratorId: userId,
        reviewCompletedAt: null,
        case: {
          status: 'ARBITRATOR_REVIEW',
          draftAward: {
            isNot: null,
          },
        },
      },
    });

    // Get completed reviews this week
    const completedThisWeek = await prisma.arbitratorAssignment.count({
      where: {
        arbitratorId: userId,
        reviewCompletedAt: {
          gte: startOfWeek,
        },
      },
    });

    // Get completed reviews this month
    const completedThisMonth = await prisma.arbitratorAssignment.count({
      where: {
        arbitratorId: userId,
        reviewCompletedAt: {
          gte: startOfMonth,
        },
      },
    });

    // Get total completed reviews
    const totalCompleted = await prisma.arbitratorAssignment.count({
      where: {
        arbitratorId: userId,
        reviewCompletedAt: { not: null },
      },
    });

    // Get issued awards count
    const issuedAwards = await prisma.award.count({
      where: { arbitratorId: userId },
    });

    // Get issued awards this month
    const awardsThisMonth = await prisma.award.count({
      where: {
        arbitratorId: userId,
        issuedAt: {
          gte: startOfMonth,
        },
      },
    });

    // Calculate average review time (in minutes)
    const reviewTimes = await prisma.arbitratorAssignment.findMany({
      where: {
        arbitratorId: userId,
        reviewStartedAt: { not: null },
        reviewCompletedAt: { not: null },
      },
      select: {
        reviewStartedAt: true,
        reviewCompletedAt: true,
      },
    });

    let avgReviewTimeMinutes: number | null = null;
    const typedReviewTimes = reviewTimes as ReviewTimeItem[];
    if (typedReviewTimes.length > 0) {
      const totalMinutes = typedReviewTimes.reduce((sum: number, r: ReviewTimeItem) => {
        if (r.reviewStartedAt && r.reviewCompletedAt) {
          return sum + (r.reviewCompletedAt.getTime() - r.reviewStartedAt.getTime()) / 60000;
        }
        return sum;
      }, 0);
      avgReviewTimeMinutes = Math.round(totalMinutes / typedReviewTimes.length);
    }

    // Get overdue cases
    const overdueCases = await prisma.arbitratorAssignment.count({
      where: {
        arbitratorId: userId,
        reviewCompletedAt: null,
        dueBy: {
          lt: now,
        },
      },
    });

    // Get cases due soon (within 3 days)
    const threeDaysFromNow = new Date(now);
    threeDaysFromNow.setDate(now.getDate() + 3);

    const dueSoon = await prisma.arbitratorAssignment.count({
      where: {
        arbitratorId: userId,
        reviewCompletedAt: null,
        dueBy: {
          gte: now,
          lt: threeDaysFromNow,
        },
      },
    });

    // Get review status breakdown
    const draftAwardStatuses = await prisma.draftAward.groupBy({
      by: ['reviewStatus'],
      where: {
        case: {
          arbitratorAssignment: {
            arbitratorId: userId,
          },
        },
      },
      _count: { id: true },
    });

    const reviewStatusBreakdown = draftAwardStatuses.reduce(
      (acc, status) => {
        if (status.reviewStatus) {
          acc[status.reviewStatus] = status._count.id;
        }
        return acc;
      },
      {} as Record<string, number>
    );

    // Get arbitrator profile for max cases
    const profile = await prisma.arbitratorProfile.findUnique({
      where: { userId },
      select: {
        maxCasesPerWeek: true,
        isActive: true,
      },
    });

    return NextResponse.json({
      success: true,
      data: {
        queue: {
          pending: pendingCases,
          withDraftAward: casesWithDraftAward,
          overdue: overdueCases,
          dueSoon,
        },
        completed: {
          thisWeek: completedThisWeek,
          thisMonth: completedThisMonth,
          total: totalCompleted,
        },
        awards: {
          total: issuedAwards,
          thisMonth: awardsThisMonth,
        },
        performance: {
          avgReviewTimeMinutes,
          reviewStatusBreakdown,
        },
        capacity: {
          maxCasesPerWeek: profile?.maxCasesPerWeek || 10,
          currentWeekLoad: completedThisWeek + pendingCases,
          isActive: profile?.isActive ?? true,
        },
      },
    });
  } catch (error) {
    console.error('Error fetching arbitrator stats:', error);
    return errorResponse(error as Error);
  }
});
