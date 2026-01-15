import { successResponse } from '@/lib/api/response';
import { withAdmin, type AuthenticatedRequest } from '@/lib/api/with-auth';
import { prisma } from '@/lib/db';
import type { UserRole, CaseStatus, KYCStatus } from '@/types/shared';

interface RoleGroupBy {
  role: UserRole;
  _count: { role: number };
}

interface KYCGroupBy {
  status: KYCStatus;
  _count: { status: number };
}

interface CaseStatusGroupBy {
  status: CaseStatus;
  _count: { status: number };
}

const USER_ROLES: UserRole[] = ['USER', 'ARBITRATOR', 'ADMIN'];
const CASE_STATUSES: CaseStatus[] = [
  'DRAFT',
  'PENDING_RESPONDENT',
  'PENDING_AGREEMENT',
  'EVIDENCE_SUBMISSION',
  'ANALYSIS_PENDING',
  'ANALYSIS_IN_PROGRESS',
  'ARBITRATOR_REVIEW',
  'DECIDED',
  'CLOSED',
];
const KYC_STATUSES: KYCStatus[] = ['NOT_STARTED', 'PENDING', 'VERIFIED', 'FAILED', 'EXPIRED'];

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
  const typedUsersByRole = usersByRole as RoleGroupBy[];
  const roleStats = USER_ROLES.reduce(
    (acc, role) => {
      const found = typedUsersByRole.find((r) => r.role === role);
      acc[role] = found?._count.role ?? 0;
      return acc;
    },
    {} as Record<UserRole, number>
  );

  // Format KYC stats
  const typedUsersByKycStatus = usersByKycStatus as KYCGroupBy[];
  const kycStats = KYC_STATUSES.reduce(
    (acc, status) => {
      const found = typedUsersByKycStatus.find((k) => k.status === status);
      acc[status] = found?._count.status ?? 0;
      return acc;
    },
    {} as Record<KYCStatus, number>
  );

  // Calculate users without KYC
  const usersWithKyc = Object.values(kycStats).reduce((a, b) => a + b, 0);
  kycStats.NOT_STARTED = totalUsers - usersWithKyc + (kycStats.NOT_STARTED ?? 0);

  // Format case stats
  const typedCasesByStatus = casesByStatus as CaseStatusGroupBy[];
  const caseStats = CASE_STATUSES.reduce(
    (acc, status) => {
      const found = typedCasesByStatus.find((c) => c.status === status);
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
