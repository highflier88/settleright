import { prisma } from '@/lib/db';
import { withAdmin, AuthenticatedRequest } from '@/lib/api/with-auth';
import { successResponse } from '@/lib/api/response';
import { UserRole, CaseStatus, KYCStatus } from '@prisma/client';

async function handleGet(_request: AuthenticatedRequest) {
  const [
    totalUsers,
    usersByRole,
    usersByKycStatus,
    totalCases,
    casesByStatus,
    recentUsers,
    recentCases,
  ] = await Promise.all([
    // Total users
    prisma.user.count(),

    // Users by role
    prisma.user.groupBy({
      by: ['role'],
      _count: { role: true },
    }),

    // Users by KYC status
    prisma.identityVerification.groupBy({
      by: ['status'],
      _count: { status: true },
    }),

    // Total cases
    prisma.case.count(),

    // Cases by status
    prisma.case.groupBy({
      by: ['status'],
      _count: { status: true },
    }),

    // Recent users (last 7 days)
    prisma.user.count({
      where: {
        createdAt: {
          gte: new Date(Date.now() - 7 * 24 * 60 * 60 * 1000),
        },
      },
    }),

    // Recent cases (last 7 days)
    prisma.case.count({
      where: {
        createdAt: {
          gte: new Date(Date.now() - 7 * 24 * 60 * 60 * 1000),
        },
      },
    }),
  ]);

  // Format role stats
  const roleStats = Object.values(UserRole).reduce(
    (acc, role) => {
      const found = usersByRole.find((r) => r.role === role);
      acc[role] = found?._count.role ?? 0;
      return acc;
    },
    {} as Record<UserRole, number>
  );

  // Format KYC stats
  const kycStats = Object.values(KYCStatus).reduce(
    (acc, status) => {
      const found = usersByKycStatus.find((k) => k.status === status);
      acc[status] = found?._count.status ?? 0;
      return acc;
    },
    {} as Record<KYCStatus, number>
  );

  // Calculate users without KYC
  const usersWithKyc = Object.values(kycStats).reduce((a, b) => a + b, 0);
  kycStats.NOT_STARTED = totalUsers - usersWithKyc + (kycStats.NOT_STARTED ?? 0);

  // Format case stats
  const caseStats = Object.values(CaseStatus).reduce(
    (acc, status) => {
      const found = casesByStatus.find((c) => c.status === status);
      acc[status] = found?._count.status ?? 0;
      return acc;
    },
    {} as Record<CaseStatus, number>
  );

  return successResponse({
    users: {
      total: totalUsers,
      newThisWeek: recentUsers,
      byRole: roleStats,
      byKycStatus: kycStats,
    },
    cases: {
      total: totalCases,
      newThisWeek: recentCases,
      byStatus: caseStats,
      active:
        (caseStats.PENDING_RESPONDENT ?? 0) +
        (caseStats.PENDING_AGREEMENT ?? 0) +
        (caseStats.EVIDENCE_SUBMISSION ?? 0) +
        (caseStats.ANALYSIS_PENDING ?? 0) +
        (caseStats.ANALYSIS_IN_PROGRESS ?? 0) +
        (caseStats.ARBITRATOR_REVIEW ?? 0),
      resolved: (caseStats.DECIDED ?? 0) + (caseStats.CLOSED ?? 0),
    },
  });
}

export const GET = withAdmin(handleGet);
