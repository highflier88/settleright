import { NotificationType } from '@prisma/client';

import { prisma } from '@/lib/db';

// Notification template IDs
export const NotificationTemplates = {
  // Case lifecycle
  CASE_CREATED: 'case_created',
  INVITATION_SENT: 'invitation_sent',
  INVITATION_REMINDER: 'invitation_reminder',
  INVITATION_ACCEPTED: 'invitation_accepted',
  INVITATION_EXPIRED: 'invitation_expired',

  // Agreement
  AGREEMENT_READY: 'agreement_ready',
  AGREEMENT_SIGNED_BY_OTHER: 'agreement_signed_by_other',
  AGREEMENT_COMPLETE: 'agreement_complete',

  // Evidence
  EVIDENCE_UPLOADED: 'evidence_uploaded',
  EVIDENCE_DEADLINE_REMINDER: 'evidence_deadline_reminder',

  // Statement
  STATEMENT_SUBMITTED: 'statement_submitted',
  STATEMENT_DEADLINE_REMINDER: 'statement_deadline_reminder',

  // Deadlines
  DEADLINE_24H_WARNING: 'deadline_24h_warning',
  DEADLINE_PASSED: 'deadline_passed',
  EXTENSION_REQUESTED: 'extension_requested',
  EXTENSION_APPROVED: 'extension_approved',
  EXTENSION_DENIED: 'extension_denied',

  // Analysis & Award
  ANALYSIS_STARTED: 'analysis_started',
  ANALYSIS_COMPLETE: 'analysis_complete',
  DRAFT_AWARD_READY: 'draft_award_ready',
  AWARD_ISSUED: 'award_issued',

  // General
  WELCOME: 'welcome',
  KYC_APPROVED: 'kyc_approved',
  KYC_FAILED: 'kyc_failed',
} as const;

export type NotificationTemplateId = typeof NotificationTemplates[keyof typeof NotificationTemplates];

// Template data interfaces
export interface BaseTemplateData {
  userName: string;
  userEmail: string;
}

export interface CaseTemplateData extends BaseTemplateData {
  caseReference: string;
  caseId: string;
}

export interface InvitationTemplateData extends CaseTemplateData {
  inviterName: string;
  invitationLink: string;
  expiresAt: string;
  disputeType: string;
  claimAmount: string;
}

export interface DeadlineTemplateData extends CaseTemplateData {
  deadlineType: string;
  deadlineDate: string;
  hoursRemaining?: number;
}

export interface AwardTemplateData extends CaseTemplateData {
  awardAmount?: string;
  prevailingParty: string;
  downloadLink: string;
}

// Notification creation input
export interface CreateNotificationInput {
  userId: string;
  type: NotificationType;
  templateId: NotificationTemplateId;
  subject?: string;
  body: string;
  metadata?: Record<string, unknown>;
}

// Send notification input
export interface SendNotificationInput {
  userId: string;
  templateId: NotificationTemplateId;
  data: Record<string, unknown>;
  channels?: NotificationType[];
}

// Get user's notification preferences
export async function getUserNotificationPreferences(userId: string) {
  let prefs = await prisma.notificationPreference.findUnique({
    where: { userId },
  });

  // Create default preferences if none exist
  if (!prefs) {
    prefs = await prisma.notificationPreference.create({
      data: {
        userId,
        emailEnabled: true,
        smsEnabled: true,
        inAppEnabled: true,
        caseUpdates: true,
        deadlineReminders: true,
        evidenceUploads: true,
        awardNotifications: true,
        marketingEmails: false,
      },
    });
  }

  return prefs;
}

// Update notification preferences
export async function updateNotificationPreferences(
  userId: string,
  updates: Partial<{
    emailEnabled: boolean;
    smsEnabled: boolean;
    inAppEnabled: boolean;
    caseUpdates: boolean;
    deadlineReminders: boolean;
    evidenceUploads: boolean;
    awardNotifications: boolean;
    marketingEmails: boolean;
  }>
) {
  return prisma.notificationPreference.upsert({
    where: { userId },
    update: updates,
    create: {
      userId,
      ...updates,
    },
  });
}

// Create an in-app notification
export async function createInAppNotification(
  input: CreateNotificationInput
): Promise<string> {
  const notification = await prisma.notification.create({
    data: {
      userId: input.userId,
      type: NotificationType.IN_APP,
      templateId: input.templateId,
      subject: input.subject,
      body: input.body,
      sentAt: new Date(),
    },
  });

  return notification.id;
}

// Get user's notifications
export async function getUserNotifications(
  userId: string,
  options: {
    unreadOnly?: boolean;
    limit?: number;
    offset?: number;
  } = {}
) {
  const { unreadOnly = false, limit = 50, offset = 0 } = options;

  const where: Record<string, unknown> = {
    userId,
    type: NotificationType.IN_APP,
  };

  if (unreadOnly) {
    where.readAt = null;
  }

  const [notifications, total, unreadCount] = await Promise.all([
    prisma.notification.findMany({
      where,
      orderBy: { sentAt: 'desc' },
      take: limit,
      skip: offset,
    }),
    prisma.notification.count({ where }),
    prisma.notification.count({
      where: {
        userId,
        type: NotificationType.IN_APP,
        readAt: null,
      },
    }),
  ]);

  return {
    notifications,
    total,
    unreadCount,
    hasMore: offset + notifications.length < total,
  };
}

// Mark notification as read
export async function markNotificationRead(
  notificationId: string,
  userId: string
): Promise<boolean> {
  const notification = await prisma.notification.findFirst({
    where: { id: notificationId, userId },
  });

  if (!notification) {
    return false;
  }

  await prisma.notification.update({
    where: { id: notificationId },
    data: { readAt: new Date() },
  });

  return true;
}

// Mark all notifications as read
export async function markAllNotificationsRead(userId: string): Promise<number> {
  const result = await prisma.notification.updateMany({
    where: {
      userId,
      type: NotificationType.IN_APP,
      readAt: null,
    },
    data: { readAt: new Date() },
  });

  return result.count;
}

// Delete old notifications (cleanup)
export async function deleteOldNotifications(daysOld: number = 90): Promise<number> {
  const cutoffDate = new Date();
  cutoffDate.setDate(cutoffDate.getDate() - daysOld);

  const result = await prisma.notification.deleteMany({
    where: {
      sentAt: { lt: cutoffDate },
      readAt: { not: null },
    },
  });

  return result.count;
}

// Get notification counts by type for a user
export async function getNotificationStats(userId: string) {
  const [total, unread, byTemplate] = await Promise.all([
    prisma.notification.count({
      where: { userId, type: NotificationType.IN_APP },
    }),
    prisma.notification.count({
      where: { userId, type: NotificationType.IN_APP, readAt: null },
    }),
    prisma.notification.groupBy({
      by: ['templateId'],
      where: { userId, type: NotificationType.IN_APP },
      _count: true,
    }),
  ]);

  return {
    total,
    unread,
    read: total - unread,
    byTemplate: byTemplate.reduce((acc, item) => {
      acc[item.templateId] = item._count;
      return acc;
    }, {} as Record<string, number>),
  };
}
