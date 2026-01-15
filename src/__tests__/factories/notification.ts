/**
 * Notification Factory
 *
 * Creates mock Notification objects for testing.
 */

import { generateId } from './utils';

export interface NotificationFactoryOptions {
  id?: string;
  userId?: string;
  type?: string;
  title?: string;
  message?: string;
  actionUrl?: string | null;
  read?: boolean;
  createdAt?: Date;
}

export interface NotificationPreferenceFactoryOptions {
  userId?: string;
  emailEnabled?: boolean;
  smsEnabled?: boolean;
  inAppEnabled?: boolean;
}

/**
 * Create a mock Notification
 */
export function createNotification(options: NotificationFactoryOptions = {}) {
  const id = options.id ?? generateId();
  const createdAt = options.createdAt ?? new Date();

  return {
    id,
    userId: options.userId ?? generateId(),
    type: options.type ?? 'CASE_UPDATE',
    title: options.title ?? 'Case Update',
    message: options.message ?? 'There has been an update to your case.',
    actionUrl: options.actionUrl ?? '/dashboard/cases/123',
    read: options.read ?? false,
    readAt: options.read ? new Date() : null,
    createdAt,
    updatedAt: createdAt,
  };
}

/**
 * Create an unread notification
 */
export function createUnreadNotification(
  options: Omit<NotificationFactoryOptions, 'read'> = {}
) {
  return createNotification({ ...options, read: false });
}

/**
 * Create a read notification
 */
export function createReadNotification(
  options: Omit<NotificationFactoryOptions, 'read'> = {}
) {
  return createNotification({ ...options, read: true });
}

/**
 * Create a case invitation notification
 */
export function createInvitationNotification(
  options: Omit<NotificationFactoryOptions, 'type' | 'title'> = {}
) {
  return createNotification({
    ...options,
    type: 'CASE_INVITATION',
    title: 'You have been invited to a case',
    message: options.message ?? 'You have been invited to participate in an arbitration case.',
  });
}

/**
 * Create a deadline reminder notification
 */
export function createDeadlineNotification(
  options: Omit<NotificationFactoryOptions, 'type' | 'title'> = {}
) {
  return createNotification({
    ...options,
    type: 'DEADLINE_REMINDER',
    title: 'Deadline Approaching',
    message: options.message ?? 'Your evidence submission deadline is in 3 days.',
  });
}

/**
 * Create an award issued notification
 */
export function createAwardNotification(
  options: Omit<NotificationFactoryOptions, 'type' | 'title'> = {}
) {
  return createNotification({
    ...options,
    type: 'AWARD_ISSUED',
    title: 'Award Issued',
    message: options.message ?? 'The arbitration award for your case has been issued.',
  });
}

/**
 * Create a payment notification
 */
export function createPaymentNotification(
  options: Omit<NotificationFactoryOptions, 'type' | 'title'> = {}
) {
  return createNotification({
    ...options,
    type: 'PAYMENT_COMPLETED',
    title: 'Payment Confirmed',
    message: options.message ?? 'Your payment has been successfully processed.',
  });
}

/**
 * Create a mock NotificationPreference
 */
export function createNotificationPreference(
  options: NotificationPreferenceFactoryOptions = {}
) {
  const userId = options.userId ?? generateId();
  const createdAt = new Date();

  return {
    id: generateId(),
    userId,
    emailEnabled: options.emailEnabled ?? true,
    smsEnabled: options.smsEnabled ?? false,
    inAppEnabled: options.inAppEnabled ?? true,
    caseUpdates: true,
    deadlineReminders: true,
    paymentAlerts: true,
    systemAnnouncements: true,
    createdAt,
    updatedAt: createdAt,
  };
}

/**
 * Create multiple notifications for a user
 */
export function createNotificationSet(userId: string, count = 5) {
  const types = [
    { type: 'CASE_UPDATE', title: 'Case Update' },
    { type: 'DEADLINE_REMINDER', title: 'Deadline Reminder' },
    { type: 'EVIDENCE_SUBMITTED', title: 'New Evidence' },
    { type: 'STATEMENT_SUBMITTED', title: 'New Statement' },
    { type: 'PAYMENT_COMPLETED', title: 'Payment Confirmed' },
  ];

  return Array.from({ length: count }, (_, i) => {
    const typeInfo = types[i % types.length]!;
    return createNotification({
      userId,
      type: typeInfo.type,
      title: typeInfo.title,
      message: `Notification ${i + 1} for testing`,
      read: i < 2, // First 2 are read
    });
  });
}
