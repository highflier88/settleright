import { createHash } from 'crypto';

import { AuditAction } from '@prisma/client';

import { prisma } from '@/lib/db';

export interface AuditLogEntry {
  action: AuditAction;
  userId?: string | null;
  caseId?: string | null;
  ipAddress?: string | null;
  userAgent?: string | null;
  metadata?: Record<string, unknown>;
}

interface AuditLogResult {
  success: boolean;
  logId?: string;
  error?: string;
}

// Generate a SHA-256 hash of the log entry for integrity verification
function generateHash(entry: AuditLogEntry, timestamp: Date, previousHash: string | null): string {
  const data = JSON.stringify({
    action: entry.action,
    userId: entry.userId,
    caseId: entry.caseId,
    ipAddress: entry.ipAddress,
    metadata: entry.metadata,
    timestamp: timestamp.toISOString(),
    previousHash,
  });

  return createHash('sha256').update(data).digest('hex');
}

// Get the hash of the most recent audit log entry
async function getLatestHash(): Promise<string | null> {
  const latestLog = await prisma.auditLog.findFirst({
    orderBy: { timestamp: 'desc' },
    select: { hash: true },
  });

  return latestLog?.hash ?? null;
}

// Create a new audit log entry with integrity chaining
export async function createAuditLog(entry: AuditLogEntry): Promise<AuditLogResult> {
  try {
    const timestamp = new Date();
    const previousHash = await getLatestHash();
    const hash = generateHash(entry, timestamp, previousHash);

    const log = await prisma.auditLog.create({
      data: {
        action: entry.action,
        userId: entry.userId,
        caseId: entry.caseId,
        ipAddress: entry.ipAddress,
        userAgent: entry.userAgent,
        metadata: (entry.metadata as object) ?? undefined,
        timestamp,
        previousHash,
        hash,
      },
    });

    return { success: true, logId: log.id };
  } catch (error) {
    console.error('Failed to create audit log:', error);
    return {
      success: false,
      error: error instanceof Error ? error.message : 'Unknown error',
    };
  }
}

// Fire and forget version - doesn't await the result
export function logAuditEvent(entry: AuditLogEntry): void {
  createAuditLog(entry).catch((error) => {
    console.error('Failed to log audit event:', error);
  });
}

// Verify the integrity of the audit log chain
export async function verifyAuditLogIntegrity(
  startDate?: Date,
  endDate?: Date
): Promise<{
  isValid: boolean;
  totalLogs: number;
  invalidLogs: { id: string; reason: string }[];
}> {
  const where: Record<string, unknown> = {};
  if (startDate || endDate) {
    where.timestamp = {};
    if (startDate) (where.timestamp as Record<string, unknown>).gte = startDate;
    if (endDate) (where.timestamp as Record<string, unknown>).lte = endDate;
  }

  const logs = await prisma.auditLog.findMany({
    where,
    orderBy: { timestamp: 'asc' },
    select: {
      id: true,
      action: true,
      userId: true,
      caseId: true,
      ipAddress: true,
      metadata: true,
      timestamp: true,
      previousHash: true,
      hash: true,
    },
  });

  const invalidLogs: { id: string; reason: string }[] = [];
  let previousHash: string | null = null;

  for (let i = 0; i < logs.length; i++) {
    const log = logs[i];
    if (!log) continue;

    // Check if previousHash matches the previous log's hash
    if (i > 0 && log.previousHash !== previousHash) {
      invalidLogs.push({
        id: log.id,
        reason: 'Previous hash mismatch - chain broken',
      });
    }

    // Verify the hash of the current entry
    const expectedHash = generateHash(
      {
        action: log.action,
        userId: log.userId ?? undefined,
        caseId: log.caseId ?? undefined,
        ipAddress: log.ipAddress ?? undefined,
        metadata: (log.metadata as Record<string, unknown>) ?? undefined,
      },
      log.timestamp,
      log.previousHash
    );

    if (log.hash !== expectedHash) {
      invalidLogs.push({
        id: log.id,
        reason: 'Hash mismatch - entry may have been tampered with',
      });
    }

    previousHash = log.hash;
  }

  return {
    isValid: invalidLogs.length === 0,
    totalLogs: logs.length,
    invalidLogs,
  };
}

// Get audit logs with filtering and pagination
export interface AuditLogFilters {
  userId?: string;
  caseId?: string;
  action?: AuditAction;
  actions?: AuditAction[];
  startDate?: Date;
  endDate?: Date;
  ipAddress?: string;
}

export interface PaginationOptions {
  page?: number;
  limit?: number;
}

export async function getAuditLogs(
  filters: AuditLogFilters = {},
  pagination: PaginationOptions = {}
): Promise<{
  logs: Awaited<ReturnType<typeof prisma.auditLog.findMany>>;
  total: number;
  page: number;
  limit: number;
  totalPages: number;
}> {
  const page = pagination.page ?? 1;
  const limit = Math.min(pagination.limit ?? 50, 100);
  const skip = (page - 1) * limit;

  const where: Record<string, unknown> = {};

  if (filters.userId) {
    where.userId = filters.userId;
  }

  if (filters.caseId) {
    where.caseId = filters.caseId;
  }

  if (filters.action) {
    where.action = filters.action;
  }

  if (filters.actions && filters.actions.length > 0) {
    where.action = { in: filters.actions };
  }

  if (filters.ipAddress) {
    where.ipAddress = filters.ipAddress;
  }

  if (filters.startDate || filters.endDate) {
    where.timestamp = {};
    if (filters.startDate) (where.timestamp as Record<string, unknown>).gte = filters.startDate;
    if (filters.endDate) (where.timestamp as Record<string, unknown>).lte = filters.endDate;
  }

  const [logs, total] = await Promise.all([
    prisma.auditLog.findMany({
      where,
      orderBy: { timestamp: 'desc' },
      skip,
      take: limit,
    }),
    prisma.auditLog.count({ where }),
  ]);

  return {
    logs,
    total,
    page,
    limit,
    totalPages: Math.ceil(total / limit),
  };
}

// Get audit logs for a specific user
export async function getUserAuditLogs(userId: string, pagination?: PaginationOptions) {
  return getAuditLogs({ userId }, pagination);
}

// Get audit logs for a specific case
export async function getCaseAuditLogs(caseId: string, pagination?: PaginationOptions) {
  return getAuditLogs({ caseId }, pagination);
}

// Get authentication-related audit logs
export async function getAuthenticationLogs(pagination?: PaginationOptions) {
  return getAuditLogs(
    {
      actions: [AuditAction.USER_REGISTERED, AuditAction.USER_LOGIN, AuditAction.USER_LOGOUT],
    },
    pagination
  );
}

// Get KYC-related audit logs
export async function getKYCLogs(pagination?: PaginationOptions) {
  return getAuditLogs(
    {
      actions: [AuditAction.KYC_INITIATED, AuditAction.KYC_COMPLETED, AuditAction.KYC_FAILED],
    },
    pagination
  );
}

// Export audit logs to a format suitable for compliance reporting
export async function exportAuditLogs(
  filters: AuditLogFilters = {},
  format: 'json' | 'csv' = 'json'
): Promise<string> {
  const { logs } = await getAuditLogs(filters, { limit: 10000 });

  if (format === 'csv') {
    const headers = [
      'ID',
      'Timestamp',
      'Action',
      'User ID',
      'Case ID',
      'IP Address',
      'User Agent',
      'Metadata',
      'Hash',
    ];

    const rows = logs.map((log) => [
      log.id,
      log.timestamp.toISOString(),
      log.action,
      log.userId ?? '',
      log.caseId ?? '',
      log.ipAddress ?? '',
      log.userAgent ?? '',
      JSON.stringify(log.metadata),
      log.hash,
    ]);

    return [headers.join(','), ...rows.map((row) => row.join(','))].join('\n');
  }

  return JSON.stringify(logs, null, 2);
}

// Get audit statistics for dashboard
export async function getAuditStats(days: number = 30): Promise<{
  totalLogs: number;
  logsByAction: Record<string, number>;
  logsByDay: { date: string; count: number }[];
  uniqueUsers: number;
  uniqueIPs: number;
}> {
  const startDate = new Date();
  startDate.setDate(startDate.getDate() - days);

  const [totalLogs, logsByAction, uniqueUsers, uniqueIPs] = await Promise.all([
    prisma.auditLog.count({
      where: { timestamp: { gte: startDate } },
    }),
    prisma.auditLog.groupBy({
      by: ['action'],
      where: { timestamp: { gte: startDate } },
      _count: { action: true },
    }),
    prisma.auditLog.findMany({
      where: {
        timestamp: { gte: startDate },
        userId: { not: null },
      },
      distinct: ['userId'],
      select: { userId: true },
    }),
    prisma.auditLog.findMany({
      where: {
        timestamp: { gte: startDate },
        ipAddress: { not: null },
      },
      distinct: ['ipAddress'],
      select: { ipAddress: true },
    }),
  ]);

  // Get logs by day for charting
  const logsByDayRaw = await prisma.$queryRaw<{ date: Date; count: bigint }[]>`
    SELECT DATE_TRUNC('day', timestamp) as date, COUNT(*) as count
    FROM audit_logs
    WHERE timestamp >= ${startDate}
    GROUP BY DATE_TRUNC('day', timestamp)
    ORDER BY date ASC
  `;

  const logsByDay = logsByDayRaw.map((row) => ({
    date: row.date.toISOString().split('T')[0] ?? '',
    count: Number(row.count),
  }));

  const actionCounts: Record<string, number> = {};
  for (const item of logsByAction) {
    actionCounts[item.action] = item._count.action;
  }

  return {
    totalLogs,
    logsByAction: actionCounts,
    logsByDay,
    uniqueUsers: uniqueUsers.length,
    uniqueIPs: uniqueIPs.length,
  };
}
