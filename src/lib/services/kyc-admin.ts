import { KYCAdminActionType, KYCStatus } from '@prisma/client';

import { prisma } from '@/lib/db';
import { createAuditLog } from '@/lib/services/audit';

// Types for KYC Admin operations
export interface KYCVerificationFilters {
  status?: KYCStatus;
  search?: string;
  dateFrom?: Date;
  dateTo?: Date;
}

export interface PaginationParams {
  page: number;
  perPage: number;
}

export interface KYCVerificationListItem {
  id: string;
  userId: string;
  status: KYCStatus;
  documentType: string | null;
  verifiedName: string | null;
  verifiedAt: Date | null;
  expiresAt: Date | null;
  failedAt: Date | null;
  failureReason: string | null;
  failureCount: number;
  lastFailureCode: string | null;
  createdAt: Date;
  updatedAt: Date;
  user: {
    id: string;
    email: string;
    name: string | null;
  };
  _count: {
    adminActions: number;
  };
}

export interface KYCVerificationDetail extends KYCVerificationListItem {
  provider: string | null;
  providerSessionId: string | null;
  initiatedAt: Date | null;
  verifiedDob: Date | null;
  adminActions: Array<{
    id: string;
    adminId: string;
    actionType: KYCAdminActionType;
    previousStatus: KYCStatus | null;
    newStatus: KYCStatus | null;
    reason: string;
    notes: string | null;
    createdAt: Date;
  }>;
  reminders: Array<{
    id: string;
    reminderType: string;
    sentAt: Date;
    emailSent: boolean;
  }>;
}

export interface KYCStats {
  total: number;
  byStatus: Record<KYCStatus, number>;
  expiringSoon: number; // Within 30 days
  recentFailures: number; // Last 7 days
  averageVerificationTime: number | null; // In hours
}

// Get paginated list of KYC verifications with filters
export async function getKYCVerifications(
  filters: KYCVerificationFilters,
  pagination: PaginationParams
): Promise<{ items: KYCVerificationListItem[]; total: number }> {
  const { status, search, dateFrom, dateTo } = filters;
  const { page, perPage } = pagination;

  const where: Record<string, unknown> = {};

  if (status) {
    where.status = status;
  }

  if (search) {
    where.user = {
      OR: [
        { email: { contains: search, mode: 'insensitive' } },
        { name: { contains: search, mode: 'insensitive' } },
      ],
    };
  }

  if (dateFrom || dateTo) {
    where.createdAt = {};
    if (dateFrom) {
      (where.createdAt as Record<string, Date>).gte = dateFrom;
    }
    if (dateTo) {
      (where.createdAt as Record<string, Date>).lte = dateTo;
    }
  }

  const [items, total] = await Promise.all([
    prisma.identityVerification.findMany({
      where,
      include: {
        user: {
          select: {
            id: true,
            email: true,
            name: true,
          },
        },
        _count: {
          select: {
            adminActions: true,
          },
        },
      },
      orderBy: { updatedAt: 'desc' },
      skip: (page - 1) * perPage,
      take: perPage,
    }),
    prisma.identityVerification.count({ where }),
  ]);

  return { items: items as KYCVerificationListItem[], total };
}

// Get detailed verification info including audit history
export async function getKYCVerificationDetail(
  id: string
): Promise<KYCVerificationDetail | null> {
  const verification = await prisma.identityVerification.findUnique({
    where: { id },
    include: {
      user: {
        select: {
          id: true,
          email: true,
          name: true,
        },
      },
      adminActions: {
        orderBy: { createdAt: 'desc' },
      },
      reminders: {
        orderBy: { sentAt: 'desc' },
      },
      _count: {
        select: {
          adminActions: true,
        },
      },
    },
  });

  return verification as KYCVerificationDetail | null;
}

// Manual status override by admin
export async function overrideKYCStatus(
  verificationId: string,
  newStatus: KYCStatus,
  adminId: string,
  reason: string,
  notes?: string
): Promise<{ success: boolean; error?: string }> {
  try {
    const verification = await prisma.identityVerification.findUnique({
      where: { id: verificationId },
      select: { status: true, userId: true },
    });

    if (!verification) {
      return { success: false, error: 'Verification not found' };
    }

    const previousStatus = verification.status;

    // Update verification status
    const updateData: Record<string, unknown> = {
      status: newStatus,
    };

    // Set appropriate timestamps based on new status
    if (newStatus === KYCStatus.VERIFIED) {
      updateData.verifiedAt = new Date();
      // Set expiration to 2 years from now
      updateData.expiresAt = new Date(Date.now() + 2 * 365 * 24 * 60 * 60 * 1000);
      updateData.failedAt = null;
      updateData.failureReason = null;
    } else if (newStatus === KYCStatus.FAILED) {
      updateData.failedAt = new Date();
      updateData.failureReason = `Manual override: ${reason}`;
    } else if (newStatus === KYCStatus.EXPIRED) {
      // Keep existing dates, just change status
    }

    await prisma.$transaction([
      // Update the verification
      prisma.identityVerification.update({
        where: { id: verificationId },
        data: updateData,
      }),
      // Create admin action log
      prisma.kYCAdminAction.create({
        data: {
          identityVerificationId: verificationId,
          adminId,
          actionType: KYCAdminActionType.MANUAL_OVERRIDE,
          previousStatus,
          newStatus,
          reason,
          notes,
        },
      }),
    ]);

    // Create audit log
    await createAuditLog({
      action: newStatus === KYCStatus.VERIFIED ? 'KYC_COMPLETED' : 'KYC_FAILED',
      userId: verification.userId,
      metadata: {
        adminOverride: true,
        adminId,
        previousStatus,
        newStatus,
        reason,
      },
    });

    return { success: true };
  } catch (error) {
    console.error('Failed to override KYC status:', error);
    return {
      success: false,
      error: error instanceof Error ? error.message : 'Failed to override status',
    };
  }
}

// Add admin note to verification
export async function addAdminNote(
  verificationId: string,
  adminId: string,
  note: string
): Promise<{ success: boolean; error?: string }> {
  try {
    const verification = await prisma.identityVerification.findUnique({
      where: { id: verificationId },
      select: { status: true },
    });

    if (!verification) {
      return { success: false, error: 'Verification not found' };
    }

    await prisma.kYCAdminAction.create({
      data: {
        identityVerificationId: verificationId,
        adminId,
        actionType: KYCAdminActionType.NOTE_ADDED,
        reason: 'Note added',
        notes: note,
      },
    });

    return { success: true };
  } catch (error) {
    console.error('Failed to add admin note:', error);
    return {
      success: false,
      error: error instanceof Error ? error.message : 'Failed to add note',
    };
  }
}

// Extend verification expiration
export async function extendExpiration(
  verificationId: string,
  adminId: string,
  newExpirationDate: Date,
  reason: string
): Promise<{ success: boolean; error?: string }> {
  try {
    const verification = await prisma.identityVerification.findUnique({
      where: { id: verificationId },
      select: { status: true, expiresAt: true },
    });

    if (!verification) {
      return { success: false, error: 'Verification not found' };
    }

    if (verification.status !== KYCStatus.VERIFIED && verification.status !== KYCStatus.EXPIRED) {
      return { success: false, error: 'Can only extend verified or expired verifications' };
    }

    await prisma.$transaction([
      prisma.identityVerification.update({
        where: { id: verificationId },
        data: {
          expiresAt: newExpirationDate,
          status: KYCStatus.VERIFIED, // Re-verify if was expired
        },
      }),
      prisma.kYCAdminAction.create({
        data: {
          identityVerificationId: verificationId,
          adminId,
          actionType: KYCAdminActionType.EXPIRATION_EXTENDED,
          previousStatus: verification.status,
          newStatus: KYCStatus.VERIFIED,
          reason,
          notes: `Extended expiration from ${verification.expiresAt?.toISOString() ?? 'not set'} to ${newExpirationDate.toISOString()}`,
        },
      }),
    ]);

    return { success: true };
  } catch (error) {
    console.error('Failed to extend expiration:', error);
    return {
      success: false,
      error: error instanceof Error ? error.message : 'Failed to extend expiration',
    };
  }
}

// Get KYC statistics for dashboard
export async function getKYCStats(dateRange?: { from: Date; to: Date }): Promise<KYCStats> {
  const dateFilter = dateRange
    ? { createdAt: { gte: dateRange.from, lte: dateRange.to } }
    : {};

  const now = new Date();
  const thirtyDaysFromNow = new Date(now.getTime() + 30 * 24 * 60 * 60 * 1000);
  const sevenDaysAgo = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000);

  const [
    total,
    notStarted,
    pending,
    verified,
    failed,
    expired,
    expiringSoon,
    recentFailures,
    verificationTimes,
  ] = await Promise.all([
    prisma.identityVerification.count({ where: dateFilter }),
    prisma.identityVerification.count({
      where: { ...dateFilter, status: KYCStatus.NOT_STARTED },
    }),
    prisma.identityVerification.count({
      where: { ...dateFilter, status: KYCStatus.PENDING },
    }),
    prisma.identityVerification.count({
      where: { ...dateFilter, status: KYCStatus.VERIFIED },
    }),
    prisma.identityVerification.count({
      where: { ...dateFilter, status: KYCStatus.FAILED },
    }),
    prisma.identityVerification.count({
      where: { ...dateFilter, status: KYCStatus.EXPIRED },
    }),
    prisma.identityVerification.count({
      where: {
        status: KYCStatus.VERIFIED,
        expiresAt: { gte: now, lte: thirtyDaysFromNow },
      },
    }),
    prisma.identityVerification.count({
      where: {
        status: KYCStatus.FAILED,
        failedAt: { gte: sevenDaysAgo },
      },
    }),
    // Get average verification time (from initiated to verified)
    prisma.identityVerification.findMany({
      where: {
        ...dateFilter,
        status: KYCStatus.VERIFIED,
        initiatedAt: { not: null },
        verifiedAt: { not: null },
      },
      select: {
        initiatedAt: true,
        verifiedAt: true,
      },
    }),
  ]);

  // Calculate average verification time in hours
  let averageVerificationTime: number | null = null;
  if (verificationTimes.length > 0) {
    const totalMs = verificationTimes.reduce((sum, v) => {
      if (v.initiatedAt && v.verifiedAt) {
        return sum + (v.verifiedAt.getTime() - v.initiatedAt.getTime());
      }
      return sum;
    }, 0);
    averageVerificationTime = totalMs / verificationTimes.length / (1000 * 60 * 60); // Convert to hours
  }

  return {
    total,
    byStatus: {
      NOT_STARTED: notStarted,
      PENDING: pending,
      VERIFIED: verified,
      FAILED: failed,
      EXPIRED: expired,
    },
    expiringSoon,
    recentFailures,
    averageVerificationTime,
  };
}
