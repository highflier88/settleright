/**
 * Arbitrator Analytics Service
 *
 * Provides comprehensive analytics for arbitrators:
 * - Performance metrics
 * - Workload analysis
 * - Earnings trends
 * - Quality metrics
 */

import { prisma } from '@/lib/db';

// ============================================================================
// TYPES
// ============================================================================

export interface PerformanceMetrics {
  totalCasesCompleted: number;
  casesThisMonth: number;
  casesThisWeek: number;
  averageReviewTimeMinutes: number;
  medianReviewTimeMinutes: number;
  onTimeCompletionRate: number;
  totalReviewTimeHours: number;
}

export interface WorkloadMetrics {
  pendingCases: number;
  casesInProgress: number;
  overdueCases: number;
  dueSoon: number; // Due within 3 days
  maxCasesPerWeek: number;
  currentWeekLoad: number;
  capacityUtilization: number; // As percentage
}

export interface EarningsTrends {
  totalLifetimeEarnings: number;
  last30DaysEarnings: number;
  last90DaysEarnings: number;
  averageEarningsPerCase: number;
  averageEarningsPerMonth: number;
  monthlyTrend: Array<{
    month: string;
    earnings: number;
    cases: number;
  }>;
}

export interface QualityMetrics {
  overallRating: number | null; // From QC audits
  citationAccuracyRate: number | null;
  escalationRate: number;
  revisionRate: number;
  awardsByOutcome: {
    claimantPrevailed: number;
    respondentPrevailed: number;
    split: number;
  };
}

export interface ArbitratorDashboardData {
  performance: PerformanceMetrics;
  workload: WorkloadMetrics;
  earnings: EarningsTrends;
  quality: QualityMetrics;
  recentActivity: RecentActivity[];
}

export interface RecentActivity {
  type: 'case_assigned' | 'review_completed' | 'award_signed' | 'payment_received';
  description: string;
  timestamp: Date;
  caseReference?: string;
  amount?: number;
}

// ============================================================================
// PERFORMANCE METRICS
// ============================================================================

/**
 * Get performance metrics for an arbitrator
 */
export async function getPerformanceMetrics(
  arbitratorProfileId: string
): Promise<PerformanceMetrics> {
  const profile = await prisma.arbitratorProfile.findUnique({
    where: { id: arbitratorProfileId },
    include: {
      user: {
        include: {
          assignedCases: {
            where: { reviewCompletedAt: { not: null } },
            include: {
              case: { select: { status: true } },
            },
          },
        },
      },
    },
  });

  if (!profile) {
    throw new Error('Arbitrator profile not found');
  }

  const now = new Date();
  const startOfMonth = new Date(now.getFullYear(), now.getMonth(), 1);
  const startOfWeek = new Date(now);
  startOfWeek.setDate(now.getDate() - now.getDay());

  const completedAssignments = profile.user.assignedCases;

  // Calculate metrics
  const totalCasesCompleted = completedAssignments.length;

  const casesThisMonth = completedAssignments.filter(
    (a) => a.reviewCompletedAt && a.reviewCompletedAt >= startOfMonth
  ).length;

  const casesThisWeek = completedAssignments.filter(
    (a) => a.reviewCompletedAt && a.reviewCompletedAt >= startOfWeek
  ).length;

  // Calculate review times
  const reviewTimes = completedAssignments
    .filter((a) => a.reviewStartedAt && a.reviewCompletedAt)
    .map((a) => {
      const start = a.reviewStartedAt!.getTime();
      const end = a.reviewCompletedAt!.getTime();
      return Math.round((end - start) / (1000 * 60)); // Minutes
    });

  const averageReviewTimeMinutes =
    reviewTimes.length > 0
      ? Math.round(reviewTimes.reduce((a, b) => a + b, 0) / reviewTimes.length)
      : 0;

  const sortedTimes = [...reviewTimes].sort((a, b) => a - b);
  const medianReviewTimeMinutes =
    sortedTimes.length > 0 ? (sortedTimes[Math.floor(sortedTimes.length / 2)] ?? 0) : 0;

  // On-time completion rate
  const onTimeCount = completedAssignments.filter((a) => {
    if (!a.reviewCompletedAt || !a.dueBy) return false;
    return a.reviewCompletedAt <= a.dueBy;
  }).length;

  const onTimeCompletionRate =
    totalCasesCompleted > 0 ? Math.round((onTimeCount / totalCasesCompleted) * 100) : 100;

  const totalReviewTimeHours = Math.round((reviewTimes.reduce((a, b) => a + b, 0) / 60) * 10) / 10;

  return {
    totalCasesCompleted,
    casesThisMonth,
    casesThisWeek,
    averageReviewTimeMinutes,
    medianReviewTimeMinutes,
    onTimeCompletionRate,
    totalReviewTimeHours,
  };
}

/**
 * Get workload metrics for an arbitrator
 */
export async function getWorkloadMetrics(arbitratorProfileId: string): Promise<WorkloadMetrics> {
  const profile = await prisma.arbitratorProfile.findUnique({
    where: { id: arbitratorProfileId },
    include: {
      user: {
        include: {
          assignedCases: {
            include: {
              case: { select: { status: true } },
            },
          },
        },
      },
    },
  });

  if (!profile) {
    throw new Error('Arbitrator profile not found');
  }

  const now = new Date();
  const threeDaysFromNow = new Date(now);
  threeDaysFromNow.setDate(now.getDate() + 3);

  const startOfWeek = new Date(now);
  startOfWeek.setDate(now.getDate() - now.getDay());
  const endOfWeek = new Date(startOfWeek);
  endOfWeek.setDate(startOfWeek.getDate() + 7);

  const assignments = profile.user.assignedCases;

  // Calculate metrics
  const pendingCases = assignments.filter((a) => !a.reviewStartedAt && !a.reviewCompletedAt).length;

  const casesInProgress = assignments.filter(
    (a) => a.reviewStartedAt && !a.reviewCompletedAt
  ).length;

  const overdueCases = assignments.filter(
    (a) => !a.reviewCompletedAt && a.dueBy && a.dueBy < now
  ).length;

  const dueSoon = assignments.filter(
    (a) => !a.reviewCompletedAt && a.dueBy && a.dueBy >= now && a.dueBy <= threeDaysFromNow
  ).length;

  // Current week load
  const currentWeekLoad = assignments.filter((a) => {
    if (a.reviewCompletedAt) {
      return a.reviewCompletedAt >= startOfWeek && a.reviewCompletedAt < endOfWeek;
    }
    return a.assignedAt >= startOfWeek && a.assignedAt < endOfWeek;
  }).length;

  const maxCasesPerWeek = profile.maxCasesPerWeek;
  const capacityUtilization =
    maxCasesPerWeek > 0 ? Math.round((currentWeekLoad / maxCasesPerWeek) * 100) : 0;

  return {
    pendingCases,
    casesInProgress,
    overdueCases,
    dueSoon,
    maxCasesPerWeek,
    currentWeekLoad,
    capacityUtilization,
  };
}

// ============================================================================
// EARNINGS TRENDS
// ============================================================================

/**
 * Get earnings trends for an arbitrator
 */
export async function getEarningsTrends(arbitratorProfileId: string): Promise<EarningsTrends> {
  const compensations = await prisma.arbitratorCompensation.findMany({
    where: { arbitratorProfileId },
    orderBy: { calculatedAt: 'desc' },
  });

  const now = new Date();
  const thirtyDaysAgo = new Date(now);
  thirtyDaysAgo.setDate(now.getDate() - 30);
  const ninetyDaysAgo = new Date(now);
  ninetyDaysAgo.setDate(now.getDate() - 90);

  // Calculate totals
  let totalLifetimeEarnings = 0;
  let last30DaysEarnings = 0;
  let last90DaysEarnings = 0;

  const monthlyData = new Map<string, { earnings: number; cases: number }>();

  for (const comp of compensations) {
    if (comp.status !== 'PAID' && comp.status !== 'CALCULATED' && comp.status !== 'APPROVED') {
      continue;
    }

    const amount = comp.amount.toNumber();
    totalLifetimeEarnings += amount;

    if (comp.calculatedAt >= thirtyDaysAgo) {
      last30DaysEarnings += amount;
    }

    if (comp.calculatedAt >= ninetyDaysAgo) {
      last90DaysEarnings += amount;
    }

    // Monthly aggregation
    const monthKey = comp.calculatedAt.toISOString().substring(0, 7); // YYYY-MM
    const existing = monthlyData.get(monthKey) || { earnings: 0, cases: 0 };
    existing.earnings += amount;
    existing.cases += 1;
    monthlyData.set(monthKey, existing);
  }

  // Calculate averages
  const totalCases = compensations.filter(
    (c) => c.status === 'PAID' || c.status === 'CALCULATED' || c.status === 'APPROVED'
  ).length;

  const averageEarningsPerCase =
    totalCases > 0 ? Math.round((totalLifetimeEarnings / totalCases) * 100) / 100 : 0;

  const totalMonths = monthlyData.size || 1;
  const averageEarningsPerMonth = Math.round((totalLifetimeEarnings / totalMonths) * 100) / 100;

  // Build monthly trend (last 12 months)
  const monthlyTrend: Array<{ month: string; earnings: number; cases: number }> = [];
  const currentMonth = new Date(now.getFullYear(), now.getMonth(), 1);

  for (let i = 11; i >= 0; i--) {
    const month = new Date(currentMonth);
    month.setMonth(month.getMonth() - i);
    const monthKey = month.toISOString().substring(0, 7);
    const data = monthlyData.get(monthKey) || { earnings: 0, cases: 0 };

    monthlyTrend.push({
      month: monthKey,
      earnings: Math.round(data.earnings * 100) / 100,
      cases: data.cases,
    });
  }

  return {
    totalLifetimeEarnings: Math.round(totalLifetimeEarnings * 100) / 100,
    last30DaysEarnings: Math.round(last30DaysEarnings * 100) / 100,
    last90DaysEarnings: Math.round(last90DaysEarnings * 100) / 100,
    averageEarningsPerCase,
    averageEarningsPerMonth,
    monthlyTrend,
  };
}

// ============================================================================
// QUALITY METRICS
// ============================================================================

/**
 * Get quality metrics for an arbitrator
 */
export async function getQualityMetrics(arbitratorProfileId: string): Promise<QualityMetrics> {
  const profile = await prisma.arbitratorProfile.findUnique({
    where: { id: arbitratorProfileId },
    include: {
      user: {
        include: {
          signedAwards: true,
          escalationsCreated: true,
        },
      },
    },
  });

  if (!profile) {
    throw new Error('Arbitrator profile not found');
  }

  const awards = profile.user.signedAwards;

  // Count by outcome
  let claimantPrevailed = 0;
  let respondentPrevailed = 0;
  let split = 0;

  for (const award of awards) {
    switch (award.prevailingParty) {
      case 'CLAIMANT':
        claimantPrevailed++;
        break;
      case 'RESPONDENT':
        respondentPrevailed++;
        break;
      case 'SPLIT':
        split++;
        break;
    }
  }

  // Escalation rate
  const escalationRate =
    awards.length > 0
      ? Math.round((profile.user.escalationsCreated.length / awards.length) * 100)
      : 0;

  // Note: Revision rate and other quality metrics would need additional data from QC module
  // For now, return placeholder values
  return {
    overallRating: null, // Would come from QC audits
    citationAccuracyRate: null, // Would come from citation verification
    escalationRate,
    revisionRate: 0, // Would need draft revision tracking
    awardsByOutcome: {
      claimantPrevailed,
      respondentPrevailed,
      split,
    },
  };
}

// ============================================================================
// DASHBOARD DATA
// ============================================================================

/**
 * Get complete dashboard data for an arbitrator
 */
export async function getArbitratorDashboardData(
  arbitratorProfileId: string
): Promise<ArbitratorDashboardData> {
  const [performance, workload, earnings, quality, recentActivity] = await Promise.all([
    getPerformanceMetrics(arbitratorProfileId),
    getWorkloadMetrics(arbitratorProfileId),
    getEarningsTrends(arbitratorProfileId),
    getQualityMetrics(arbitratorProfileId),
    getRecentActivity(arbitratorProfileId),
  ]);

  return {
    performance,
    workload,
    earnings,
    quality,
    recentActivity,
  };
}

/**
 * Get recent activity for an arbitrator
 */
export async function getRecentActivity(
  arbitratorProfileId: string,
  limit: number = 10
): Promise<RecentActivity[]> {
  const profile = await prisma.arbitratorProfile.findUnique({
    where: { id: arbitratorProfileId },
    include: {
      user: {
        include: {
          assignedCases: {
            include: { case: { select: { referenceNumber: true } } },
            orderBy: { assignedAt: 'desc' },
            take: limit,
          },
          signedAwards: {
            include: { case: { select: { referenceNumber: true } } },
            orderBy: { signedAt: 'desc' },
            take: limit,
          },
        },
      },
      compensations: {
        where: { status: 'PAID' },
        include: { case: { select: { referenceNumber: true } } },
        orderBy: { paidAt: 'desc' },
        take: limit,
      },
    },
  });

  if (!profile) {
    return [];
  }

  const activities: RecentActivity[] = [];

  // Add case assignments
  for (const assignment of profile.user.assignedCases) {
    activities.push({
      type: 'case_assigned',
      description: `Assigned to case ${assignment.case.referenceNumber}`,
      timestamp: assignment.assignedAt,
      caseReference: assignment.case.referenceNumber,
    });

    if (assignment.reviewCompletedAt) {
      activities.push({
        type: 'review_completed',
        description: `Completed review for case ${assignment.case.referenceNumber}`,
        timestamp: assignment.reviewCompletedAt,
        caseReference: assignment.case.referenceNumber,
      });
    }
  }

  // Add signed awards
  for (const award of profile.user.signedAwards) {
    activities.push({
      type: 'award_signed',
      description: `Signed award for case ${award.case.referenceNumber}`,
      timestamp: award.signedAt,
      caseReference: award.case.referenceNumber,
      amount: award.awardAmount?.toNumber(),
    });
  }

  // Add payments received
  for (const comp of profile.compensations) {
    if (comp.paidAt) {
      activities.push({
        type: 'payment_received',
        description: `Payment received for case ${comp.case.referenceNumber}`,
        timestamp: comp.paidAt,
        caseReference: comp.case.referenceNumber,
        amount: comp.amount.toNumber(),
      });
    }
  }

  // Sort by timestamp and limit
  return activities.sort((a, b) => b.timestamp.getTime() - a.timestamp.getTime()).slice(0, limit);
}
