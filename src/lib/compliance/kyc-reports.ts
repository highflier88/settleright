import { KYCStatus } from '@prisma/client';

import { prisma } from '@/lib/db';

export interface KYCComplianceReport {
  period: {
    startDate: Date;
    endDate: Date;
  };
  summary: {
    total: number;
    success: number;
    failed: number;
    pending: number;
    expired: number;
    notStarted: number;
    successRate: number;
    avgVerificationTimeHours: number | null;
  };
  byStatus: Record<KYCStatus, number>;
  byDocumentType: Array<{ type: string; count: number }>;
  failureReasons: Array<{ reason: string; count: number }>;
  dailyStats: Array<{
    date: string;
    verified: number;
    failed: number;
    initiated: number;
  }>;
}

export interface GenerateReportOptions {
  startDate: Date;
  endDate: Date;
}

export interface ExportFilters {
  status?: KYCStatus;
  startDate?: Date;
  endDate?: Date;
}

// Generate a comprehensive KYC compliance report
export async function generateKYCComplianceReport(
  options: GenerateReportOptions
): Promise<KYCComplianceReport> {
  const { startDate, endDate } = options;

  // Get all verifications in the period
  const verifications = await prisma.identityVerification.findMany({
    where: {
      createdAt: {
        gte: startDate,
        lte: endDate,
      },
    },
    select: {
      id: true,
      status: true,
      documentType: true,
      failureReason: true,
      initiatedAt: true,
      verifiedAt: true,
      failedAt: true,
      createdAt: true,
    },
  });

  // Calculate summary stats
  const total = verifications.length;
  const success = verifications.filter((v) => v.status === KYCStatus.VERIFIED).length;
  const failed = verifications.filter((v) => v.status === KYCStatus.FAILED).length;
  const pending = verifications.filter((v) => v.status === KYCStatus.PENDING).length;
  const expired = verifications.filter((v) => v.status === KYCStatus.EXPIRED).length;
  const notStarted = verifications.filter((v) => v.status === KYCStatus.NOT_STARTED).length;

  const successRate = total > 0 ? (success / total) * 100 : 0;

  // Calculate average verification time
  const completedVerifications = verifications.filter(
    (v) => v.initiatedAt && v.verifiedAt
  );
  let avgVerificationTimeHours: number | null = null;
  if (completedVerifications.length > 0) {
    const totalMs = completedVerifications.reduce((sum, v) => {
      return sum + (v.verifiedAt!.getTime() - v.initiatedAt!.getTime());
    }, 0);
    avgVerificationTimeHours = totalMs / completedVerifications.length / (1000 * 60 * 60);
  }

  // Group by status
  const byStatus: Record<KYCStatus, number> = {
    NOT_STARTED: notStarted,
    PENDING: pending,
    VERIFIED: success,
    FAILED: failed,
    EXPIRED: expired,
  };

  // Group by document type
  const documentTypeCounts: Record<string, number> = {};
  verifications.forEach((v) => {
    const type = v.documentType ?? 'unknown';
    documentTypeCounts[type] = (documentTypeCounts[type] ?? 0) + 1;
  });
  const byDocumentType = Object.entries(documentTypeCounts)
    .map(([type, count]) => ({ type, count }))
    .sort((a, b) => b.count - a.count);

  // Group failure reasons
  const failureReasonCounts: Record<string, number> = {};
  verifications
    .filter((v) => v.failureReason)
    .forEach((v) => {
      const reason = v.failureReason!;
      failureReasonCounts[reason] = (failureReasonCounts[reason] ?? 0) + 1;
    });
  const failureReasons = Object.entries(failureReasonCounts)
    .map(([reason, count]) => ({ reason, count }))
    .sort((a, b) => b.count - a.count);

  // Generate daily stats
  const dailyStatsMap: Record<
    string,
    { verified: number; failed: number; initiated: number }
  > = {};

  // Initialize all days in the range
  const currentDate = new Date(startDate);
  while (currentDate <= endDate) {
    const dateKeyParts = currentDate.toISOString().split('T');
    const dateKey = dateKeyParts[0] ?? '';
    if (dateKey) {
      dailyStatsMap[dateKey] = { verified: 0, failed: 0, initiated: 0 };
    }
    currentDate.setDate(currentDate.getDate() + 1);
  }

  // Populate stats
  verifications.forEach((v) => {
    if (v.initiatedAt) {
      const dateKeyParts = v.initiatedAt.toISOString().split('T');
      const dateKey = dateKeyParts[0] ?? '';
      const entry = dateKey ? dailyStatsMap[dateKey] : undefined;
      if (entry) {
        entry.initiated++;
      }
    }
    if (v.verifiedAt) {
      const dateKeyParts = v.verifiedAt.toISOString().split('T');
      const dateKey = dateKeyParts[0] ?? '';
      const entry = dateKey ? dailyStatsMap[dateKey] : undefined;
      if (entry) {
        entry.verified++;
      }
    }
    if (v.failedAt) {
      const dateKeyParts = v.failedAt.toISOString().split('T');
      const dateKey = dateKeyParts[0] ?? '';
      const entry = dateKey ? dailyStatsMap[dateKey] : undefined;
      if (entry) {
        entry.failed++;
      }
    }
  });

  const dailyStats = Object.entries(dailyStatsMap)
    .map(([date, stats]) => ({ date, ...stats }))
    .sort((a, b) => a.date.localeCompare(b.date));

  return {
    period: { startDate, endDate },
    summary: {
      total,
      success,
      failed,
      pending,
      expired,
      notStarted,
      successRate,
      avgVerificationTimeHours,
    },
    byStatus,
    byDocumentType,
    failureReasons,
    dailyStats,
  };
}

// Export verification records in various formats
export async function exportKYCVerificationRecords(
  filters: ExportFilters,
  format: 'csv' | 'json'
): Promise<string> {
  const where: Record<string, unknown> = {};

  if (filters.status) {
    where.status = filters.status;
  }

  if (filters.startDate || filters.endDate) {
    where.createdAt = {};
    if (filters.startDate) {
      (where.createdAt as Record<string, Date>).gte = filters.startDate;
    }
    if (filters.endDate) {
      (where.createdAt as Record<string, Date>).lte = filters.endDate;
    }
  }

  const verifications = await prisma.identityVerification.findMany({
    where,
    include: {
      user: {
        select: {
          email: true,
          name: true,
        },
      },
    },
    orderBy: { createdAt: 'desc' },
  });

  const records = verifications.map((v) => ({
    id: v.id,
    userId: v.userId,
    userEmail: v.user.email,
    userName: v.user.name,
    status: v.status,
    documentType: v.documentType,
    verifiedName: v.verifiedName,
    provider: v.provider,
    initiatedAt: v.initiatedAt?.toISOString() ?? null,
    verifiedAt: v.verifiedAt?.toISOString() ?? null,
    expiresAt: v.expiresAt?.toISOString() ?? null,
    failedAt: v.failedAt?.toISOString() ?? null,
    failureReason: v.failureReason,
    failureCount: v.failureCount,
    lastFailureCode: v.lastFailureCode,
    createdAt: v.createdAt.toISOString(),
    updatedAt: v.updatedAt.toISOString(),
  }));

  if (format === 'json') {
    return JSON.stringify(records, null, 2);
  }

  // CSV format
  if (records.length === 0) {
    return '';
  }

  const firstRecord = records[0];
  if (!firstRecord) {
    return '';
  }

  const headers = Object.keys(firstRecord);
  const csvRows = [
    headers.join(','),
    ...records.map((record) =>
      headers
        .map((header) => {
          const value = record[header as keyof typeof record];
          if (value === null || value === undefined) return '';
          if (typeof value === 'string' && (value.includes(',') || value.includes('"'))) {
            return `"${value.replace(/"/g, '""')}"`;
          }
          return String(value);
        })
        .join(',')
    ),
  ];

  return csvRows.join('\n');
}
