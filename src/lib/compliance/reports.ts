/**
 * Compliance Reports Service
 *
 * Generates comprehensive compliance reports for regulatory purposes:
 * - Platform activity reports
 * - Case resolution statistics
 * - Arbitrator performance reports
 * - Financial compliance reports
 * - Data integrity reports
 */

import { prisma } from '@/lib/db';
import { verifyAuditLogIntegrity, createAuditLog } from '@/lib/services/audit';

import type { AuditAction } from '@prisma/client';

// ============================================================================
// TYPES
// ============================================================================

export interface ComplianceReportOptions {
  startDate: Date;
  endDate: Date;
  includeDetails?: boolean;
}

export interface PlatformActivityReport {
  reportId: string;
  reportType: 'PLATFORM_ACTIVITY';
  period: {
    startDate: Date;
    endDate: Date;
    durationDays: number;
  };
  userMetrics: {
    totalUsers: number;
    newUsers: number;
    activeUsers: number;
    verifiedUsers: number;
  };
  caseMetrics: {
    totalCases: number;
    newCases: number;
    resolvedCases: number;
    pendingCases: number;
    averageResolutionDays: number;
    casesByStatus: Record<string, number>;
  };
  financialMetrics: {
    totalClaimAmount: number;
    totalAwardAmount: number;
    averageClaimAmount: number;
    averageAwardAmount: number;
  };
  auditMetrics: {
    totalAuditEvents: number;
    eventsByAction: Partial<Record<AuditAction, number>>;
    uniqueIPs: number;
  };
  generatedAt: Date;
  generatedBy: string;
}

export interface CaseResolutionReport {
  reportId: string;
  reportType: 'CASE_RESOLUTION';
  period: {
    startDate: Date;
    endDate: Date;
  };
  summary: {
    totalResolved: number;
    claimantPrevailed: number;
    respondentPrevailed: number;
    splitDecisions: number;
    averageResolutionDays: number;
    medianResolutionDays: number;
  };
  byDisputeType: Array<{
    type: string;
    count: number;
    avgResolutionDays: number;
    avgAwardAmount: number;
  }>;
  byJurisdiction: Array<{
    jurisdiction: string;
    count: number;
    avgResolutionDays: number;
  }>;
  resolutionTimeline: Array<{
    month: string;
    resolved: number;
    avgDays: number;
  }>;
  generatedAt: Date;
}

export interface ArbitratorPerformanceReport {
  reportId: string;
  reportType: 'ARBITRATOR_PERFORMANCE';
  period: {
    startDate: Date;
    endDate: Date;
  };
  summary: {
    totalArbitrators: number;
    activeArbitrators: number;
    totalCasesReviewed: number;
    averageCasesPerArbitrator: number;
    averageReviewTime: number;
  };
  arbitrators: Array<{
    id: string;
    name: string;
    casesCompleted: number;
    averageReviewDays: number;
    claimantFavorRate: number;
    respondentFavorRate: number;
    splitRate: number;
    averageAwardAmount: number;
  }>;
  generatedAt: Date;
}

export interface DataIntegrityReport {
  reportId: string;
  reportType: 'DATA_INTEGRITY';
  verificationPeriod: {
    startDate: Date;
    endDate: Date;
  };
  auditLogIntegrity: {
    isValid: boolean;
    totalLogs: number;
    validLogs: number;
    invalidLogs: number;
    invalidLogIds: string[];
    chainStatus: 'intact' | 'broken' | 'partial';
  };
  dataConsistency: {
    casesWithAuditTrail: number;
    casesWithoutAuditTrail: number;
    orphanedAuditLogs: number;
  };
  recommendations: string[];
  generatedAt: Date;
}

// ============================================================================
// REPORT GENERATION
// ============================================================================

/**
 * Generate platform activity compliance report
 */
export async function generatePlatformActivityReport(
  options: ComplianceReportOptions,
  generatedBy: string
): Promise<PlatformActivityReport> {
  const { startDate, endDate } = options;
  const durationDays = Math.ceil((endDate.getTime() - startDate.getTime()) / (1000 * 60 * 60 * 24));

  // User metrics
  const [totalUsers, newUsers, verifiedUsers] = await Promise.all([
    prisma.user.count(),
    prisma.user.count({
      where: {
        createdAt: { gte: startDate, lte: endDate },
      },
    }),
    prisma.user.count({
      where: {
        identityVerification: {
          status: 'VERIFIED',
        },
      },
    }),
  ]);

  // Active users (logged in during period)
  const activeUserLogs = await prisma.auditLog.findMany({
    where: {
      action: 'USER_LOGIN',
      timestamp: { gte: startDate, lte: endDate },
      userId: { not: null },
    },
    distinct: ['userId'],
    select: { userId: true },
  });

  // Case metrics
  const [totalCases, newCases, casesByStatus] = await Promise.all([
    prisma.case.count(),
    prisma.case.count({
      where: {
        createdAt: { gte: startDate, lte: endDate },
      },
    }),
    prisma.case.groupBy({
      by: ['status'],
      _count: { status: true },
    }),
  ]);

  const resolvedCases = await prisma.case.count({
    where: {
      status: { in: ['DECIDED', 'CLOSED'] },
      updatedAt: { gte: startDate, lte: endDate },
    },
  });

  const pendingCases = await prisma.case.count({
    where: {
      status: {
        notIn: ['DECIDED', 'CLOSED'],
      },
    },
  });

  // Calculate average resolution time
  const resolvedCasesData = await prisma.case.findMany({
    where: {
      status: { in: ['DECIDED', 'CLOSED'] },
      updatedAt: { gte: startDate, lte: endDate },
    },
    select: {
      createdAt: true,
      updatedAt: true,
    },
  });

  const avgResolutionDays =
    resolvedCasesData.length > 0
      ? resolvedCasesData.reduce((sum, c) => {
          const days = (c.updatedAt.getTime() - c.createdAt.getTime()) / (1000 * 60 * 60 * 24);
          return sum + days;
        }, 0) / resolvedCasesData.length
      : 0;

  // Financial metrics
  const financialData = await prisma.case.aggregate({
    where: {
      createdAt: { gte: startDate, lte: endDate },
    },
    _sum: { amount: true },
    _avg: { amount: true },
    _count: { id: true },
  });

  const awardData = await prisma.award.aggregate({
    where: {
      issuedAt: { gte: startDate, lte: endDate },
    },
    _sum: { awardAmount: true },
    _avg: { awardAmount: true },
  });

  // Audit metrics
  const [totalAuditEvents, eventsByAction, uniqueIPsResult] = await Promise.all([
    prisma.auditLog.count({
      where: {
        timestamp: { gte: startDate, lte: endDate },
      },
    }),
    prisma.auditLog.groupBy({
      by: ['action'],
      where: {
        timestamp: { gte: startDate, lte: endDate },
      },
      _count: { action: true },
    }),
    prisma.auditLog.findMany({
      where: {
        timestamp: { gte: startDate, lte: endDate },
        ipAddress: { not: null },
      },
      distinct: ['ipAddress'],
      select: { ipAddress: true },
    }),
  ]);

  const eventsByActionMap: Partial<Record<AuditAction, number>> = {};
  for (const item of eventsByAction) {
    eventsByActionMap[item.action] = item._count.action;
  }

  const statusCounts: Record<string, number> = {};
  for (const item of casesByStatus) {
    statusCounts[item.status] = item._count.status;
  }

  const reportId = `PAR-${Date.now()}`;

  // Log the report generation
  await createAuditLog({
    action: 'COMPLIANCE_REPORT_GENERATED',
    userId: generatedBy,
    metadata: {
      reportId,
      reportType: 'PLATFORM_ACTIVITY',
      startDate: startDate.toISOString(),
      endDate: endDate.toISOString(),
    },
  });

  return {
    reportId,
    reportType: 'PLATFORM_ACTIVITY',
    period: {
      startDate,
      endDate,
      durationDays,
    },
    userMetrics: {
      totalUsers,
      newUsers,
      activeUsers: activeUserLogs.length,
      verifiedUsers,
    },
    caseMetrics: {
      totalCases,
      newCases,
      resolvedCases,
      pendingCases,
      averageResolutionDays: Math.round(avgResolutionDays * 10) / 10,
      casesByStatus: statusCounts,
    },
    financialMetrics: {
      totalClaimAmount: financialData._sum.amount?.toNumber() || 0,
      totalAwardAmount: awardData._sum.awardAmount?.toNumber() || 0,
      averageClaimAmount: financialData._avg.amount?.toNumber() || 0,
      averageAwardAmount: awardData._avg.awardAmount?.toNumber() || 0,
    },
    auditMetrics: {
      totalAuditEvents,
      eventsByAction: eventsByActionMap,
      uniqueIPs: uniqueIPsResult.length,
    },
    generatedAt: new Date(),
    generatedBy,
  };
}

/**
 * Generate case resolution compliance report
 */
export async function generateCaseResolutionReport(
  options: ComplianceReportOptions
): Promise<CaseResolutionReport> {
  const { startDate, endDate } = options;

  // Get resolved cases
  const resolvedCases = await prisma.case.findMany({
    where: {
      status: { in: ['DECIDED', 'CLOSED'] },
      updatedAt: { gte: startDate, lte: endDate },
    },
    include: {
      award: true,
    },
  });

  // Calculate prevailing party stats
  let claimantPrevailed = 0;
  let respondentPrevailed = 0;
  let splitDecisions = 0;

  for (const c of resolvedCases) {
    if (c.award) {
      switch (c.award.prevailingParty) {
        case 'CLAIMANT':
          claimantPrevailed++;
          break;
        case 'RESPONDENT':
          respondentPrevailed++;
          break;
        case 'SPLIT':
          splitDecisions++;
          break;
      }
    }
  }

  // Calculate resolution times
  const resolutionTimes = resolvedCases.map((c) =>
    Math.ceil((c.updatedAt.getTime() - c.createdAt.getTime()) / (1000 * 60 * 60 * 24))
  );

  const avgResolutionDays =
    resolutionTimes.length > 0
      ? resolutionTimes.reduce((a, b) => a + b, 0) / resolutionTimes.length
      : 0;

  const sortedTimes = [...resolutionTimes].sort((a, b) => a - b);
  const medianResolutionDays =
    sortedTimes.length > 0 ? sortedTimes[Math.floor(sortedTimes.length / 2)] || 0 : 0;

  // Group by dispute type
  const byDisputeType = await prisma.case.groupBy({
    by: ['disputeType'],
    where: {
      status: { in: ['DECIDED', 'CLOSED'] },
      updatedAt: { gte: startDate, lte: endDate },
    },
    _count: { id: true },
  });

  const disputeTypeStats = await Promise.all(
    byDisputeType.map(async (dt) => {
      const cases = await prisma.case.findMany({
        where: {
          disputeType: dt.disputeType,
          status: { in: ['DECIDED', 'CLOSED'] },
          updatedAt: { gte: startDate, lte: endDate },
        },
        include: { award: true },
      });

      const avgDays =
        cases.length > 0
          ? cases.reduce(
              (sum, c) =>
                sum + (c.updatedAt.getTime() - c.createdAt.getTime()) / (1000 * 60 * 60 * 24),
              0
            ) / cases.length
          : 0;

      const avgAward =
        cases.filter((c) => c.award).length > 0
          ? cases.reduce((sum, c) => sum + (c.award?.awardAmount?.toNumber() || 0), 0) /
            cases.filter((c) => c.award).length
          : 0;

      return {
        type: dt.disputeType,
        count: dt._count.id,
        avgResolutionDays: Math.round(avgDays * 10) / 10,
        avgAwardAmount: Math.round(avgAward * 100) / 100,
      };
    })
  );

  // Group by jurisdiction
  const byJurisdiction = await prisma.case.groupBy({
    by: ['jurisdiction'],
    where: {
      status: { in: ['DECIDED', 'CLOSED'] },
      updatedAt: { gte: startDate, lte: endDate },
    },
    _count: { id: true },
  });

  const jurisdictionStats = await Promise.all(
    byJurisdiction.map(async (j) => {
      const cases = await prisma.case.findMany({
        where: {
          jurisdiction: j.jurisdiction,
          status: { in: ['DECIDED', 'CLOSED'] },
          updatedAt: { gte: startDate, lte: endDate },
        },
      });

      const avgDays =
        cases.length > 0
          ? cases.reduce(
              (sum, c) =>
                sum + (c.updatedAt.getTime() - c.createdAt.getTime()) / (1000 * 60 * 60 * 24),
              0
            ) / cases.length
          : 0;

      return {
        jurisdiction: j.jurisdiction,
        count: j._count.id,
        avgResolutionDays: Math.round(avgDays * 10) / 10,
      };
    })
  );

  // Monthly resolution timeline
  const resolutionTimeline: Array<{
    month: string;
    resolved: number;
    avgDays: number;
  }> = [];

  const current = new Date(startDate);
  while (current <= endDate) {
    const monthStart = new Date(current.getFullYear(), current.getMonth(), 1);
    const monthEnd = new Date(current.getFullYear(), current.getMonth() + 1, 0);

    const monthCases = resolvedCases.filter(
      (c) => c.updatedAt >= monthStart && c.updatedAt <= monthEnd
    );

    const monthAvgDays =
      monthCases.length > 0
        ? monthCases.reduce(
            (sum, c) =>
              sum + (c.updatedAt.getTime() - c.createdAt.getTime()) / (1000 * 60 * 60 * 24),
            0
          ) / monthCases.length
        : 0;

    resolutionTimeline.push({
      month: `${current.getFullYear()}-${String(current.getMonth() + 1).padStart(2, '0')}`,
      resolved: monthCases.length,
      avgDays: Math.round(monthAvgDays * 10) / 10,
    });

    current.setMonth(current.getMonth() + 1);
  }

  return {
    reportId: `CRR-${Date.now()}`,
    reportType: 'CASE_RESOLUTION',
    period: { startDate, endDate },
    summary: {
      totalResolved: resolvedCases.length,
      claimantPrevailed,
      respondentPrevailed,
      splitDecisions,
      averageResolutionDays: Math.round(avgResolutionDays * 10) / 10,
      medianResolutionDays,
    },
    byDisputeType: disputeTypeStats,
    byJurisdiction: jurisdictionStats,
    resolutionTimeline,
    generatedAt: new Date(),
  };
}

/**
 * Generate data integrity compliance report
 */
export async function generateDataIntegrityReport(
  options: ComplianceReportOptions
): Promise<DataIntegrityReport> {
  const { startDate, endDate } = options;

  // Verify audit log integrity
  const integrityResult = await verifyAuditLogIntegrity(startDate, endDate);

  // Check for cases without audit trails
  const allCaseIds = await prisma.case.findMany({
    where: {
      createdAt: { gte: startDate, lte: endDate },
    },
    select: { id: true },
  });

  const casesWithAuditLogs = await prisma.auditLog.findMany({
    where: {
      caseId: { not: null },
      timestamp: { gte: startDate, lte: endDate },
    },
    distinct: ['caseId'],
    select: { caseId: true },
  });

  const caseIdsWithLogs = new Set(casesWithAuditLogs.map((l) => l.caseId));
  const casesWithoutAuditTrail = allCaseIds.filter((c) => !caseIdsWithLogs.has(c.id)).length;

  // Check for orphaned audit logs (logs referencing non-existent cases)
  const auditLogsWithCaseIds = await prisma.auditLog.findMany({
    where: {
      caseId: { not: null },
      timestamp: { gte: startDate, lte: endDate },
    },
    select: { caseId: true },
    distinct: ['caseId'],
  });

  let orphanedLogs = 0;
  for (const log of auditLogsWithCaseIds) {
    if (log.caseId) {
      const caseExists = await prisma.case.findUnique({
        where: { id: log.caseId },
        select: { id: true },
      });
      if (!caseExists) {
        orphanedLogs++;
      }
    }
  }

  // Generate recommendations
  const recommendations: string[] = [];

  if (!integrityResult.isValid) {
    recommendations.push(
      'CRITICAL: Audit log chain integrity issues detected. Investigate invalid entries immediately.'
    );
  }

  if (casesWithoutAuditTrail > 0) {
    recommendations.push(
      `${casesWithoutAuditTrail} case(s) have no audit trail entries. Review case creation process.`
    );
  }

  if (orphanedLogs > 0) {
    recommendations.push(
      `${orphanedLogs} orphaned audit log entries found. Consider cleanup or investigation.`
    );
  }

  if (recommendations.length === 0) {
    recommendations.push('No data integrity issues detected.');
  }

  // Determine chain status
  let chainStatus: 'intact' | 'broken' | 'partial' = 'intact';
  if (integrityResult.invalidLogs.length > 0) {
    chainStatus =
      integrityResult.invalidLogs.length > integrityResult.totalLogs * 0.1 ? 'broken' : 'partial';
  }

  return {
    reportId: `DIR-${Date.now()}`,
    reportType: 'DATA_INTEGRITY',
    verificationPeriod: { startDate, endDate },
    auditLogIntegrity: {
      isValid: integrityResult.isValid,
      totalLogs: integrityResult.totalLogs,
      validLogs: integrityResult.totalLogs - integrityResult.invalidLogs.length,
      invalidLogs: integrityResult.invalidLogs.length,
      invalidLogIds: integrityResult.invalidLogs.map((l) => l.id),
      chainStatus,
    },
    dataConsistency: {
      casesWithAuditTrail: caseIdsWithLogs.size,
      casesWithoutAuditTrail,
      orphanedAuditLogs: orphanedLogs,
    },
    recommendations,
    generatedAt: new Date(),
  };
}

/**
 * Generate arbitrator performance compliance report
 */
export async function generateArbitratorPerformanceReport(
  options: ComplianceReportOptions
): Promise<ArbitratorPerformanceReport> {
  const { startDate, endDate } = options;

  // Get all arbitrators
  const arbitrators = await prisma.arbitratorProfile.findMany({
    include: {
      user: {
        select: { id: true, name: true },
      },
    },
  });

  const activeArbitrators = arbitrators.filter((a) => a.isActive);

  // Get case assignments for the period
  const assignments = await prisma.arbitratorAssignment.findMany({
    where: {
      assignedAt: { gte: startDate, lte: endDate },
    },
    include: {
      case: {
        include: { award: true },
      },
    },
  });

  // Calculate per-arbitrator stats
  const arbitratorStats = arbitrators.map((arb) => {
    const arbAssignments = assignments.filter((a) => a.arbitratorId === arb.userId);

    const completedAssignments = arbAssignments.filter((a) => a.reviewCompletedAt);

    // Calculate review times
    const reviewTimes = completedAssignments.map((a) =>
      a.reviewCompletedAt
        ? (a.reviewCompletedAt.getTime() - a.assignedAt.getTime()) / (1000 * 60 * 60 * 24)
        : 0
    );

    const avgReviewDays =
      reviewTimes.length > 0 ? reviewTimes.reduce((a, b) => a + b, 0) / reviewTimes.length : 0;

    // Calculate prevailing party rates
    const casesWithAwards = completedAssignments.filter((a) => a.case.award);
    const claimantWins = casesWithAwards.filter(
      (a) => a.case.award?.prevailingParty === 'CLAIMANT'
    ).length;
    const respondentWins = casesWithAwards.filter(
      (a) => a.case.award?.prevailingParty === 'RESPONDENT'
    ).length;
    const splits = casesWithAwards.filter((a) => a.case.award?.prevailingParty === 'SPLIT').length;

    const total = casesWithAwards.length || 1; // Avoid division by zero

    // Calculate average award amount
    const totalAwardAmount = casesWithAwards.reduce(
      (sum, a) => sum + (a.case.award?.awardAmount?.toNumber() || 0),
      0
    );

    return {
      id: arb.userId,
      name: arb.user.name || 'Unknown',
      casesCompleted: completedAssignments.length,
      averageReviewDays: Math.round(avgReviewDays * 10) / 10,
      claimantFavorRate: Math.round((claimantWins / total) * 100) / 100,
      respondentFavorRate: Math.round((respondentWins / total) * 100) / 100,
      splitRate: Math.round((splits / total) * 100) / 100,
      averageAwardAmount:
        casesWithAwards.length > 0
          ? Math.round((totalAwardAmount / casesWithAwards.length) * 100) / 100
          : 0,
    };
  });

  // Calculate summary stats
  const totalCasesReviewed = arbitratorStats.reduce((sum, a) => sum + a.casesCompleted, 0);
  const avgCasesPerArbitrator =
    arbitrators.length > 0 ? totalCasesReviewed / arbitrators.length : 0;
  const avgReviewTime =
    arbitratorStats.length > 0
      ? arbitratorStats.reduce((sum, a) => sum + a.averageReviewDays, 0) /
        arbitratorStats.filter((a) => a.casesCompleted > 0).length
      : 0;

  return {
    reportId: `APR-${Date.now()}`,
    reportType: 'ARBITRATOR_PERFORMANCE',
    period: { startDate, endDate },
    summary: {
      totalArbitrators: arbitrators.length,
      activeArbitrators: activeArbitrators.length,
      totalCasesReviewed,
      averageCasesPerArbitrator: Math.round(avgCasesPerArbitrator * 10) / 10,
      averageReviewTime: Math.round(avgReviewTime * 10) / 10,
    },
    arbitrators: arbitratorStats.sort((a, b) => b.casesCompleted - a.casesCompleted),
    generatedAt: new Date(),
  };
}

/**
 * Export compliance report to various formats
 */
export function exportComplianceReport<T extends { reportId: string }>(
  report: T,
  format: 'json' | 'csv' = 'json'
): string {
  if (format === 'json') {
    return JSON.stringify(report, null, 2);
  }

  // For CSV, flatten the report structure
  const flatData: Record<string, unknown> = {};

  function flatten(obj: unknown, prefix = ''): void {
    if (obj === null || obj === undefined) return;

    if (typeof obj === 'object' && !Array.isArray(obj) && !(obj instanceof Date)) {
      for (const [key, value] of Object.entries(obj as Record<string, unknown>)) {
        flatten(value, prefix ? `${prefix}.${key}` : key);
      }
    } else if (Array.isArray(obj)) {
      flatData[prefix] = JSON.stringify(obj);
    } else if (obj instanceof Date) {
      flatData[prefix] = obj.toISOString();
    } else {
      flatData[prefix] = obj;
    }
  }

  flatten(report);

  const headers = Object.keys(flatData);
  const values = Object.values(flatData).map((v) => String(v));

  return [headers.join(','), values.join(',')].join('\n');
}
