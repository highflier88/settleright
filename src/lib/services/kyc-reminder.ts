import { KYCReminderType, KYCStatus } from '@prisma/client';

import { prisma } from '@/lib/db';
import { sendKYCExpirationReminderEmail } from '@/lib/services/email';

interface ExpiringVerification {
  id: string;
  userId: string;
  expiresAt: Date;
  user: {
    email: string;
    name: string | null;
  };
}

// Get verifications expiring within a certain number of days
export async function getExpiringVerifications(
  daysUntilExpiry: number
): Promise<ExpiringVerification[]> {
  const now = new Date();
  const targetDate = new Date(now.getTime() + daysUntilExpiry * 24 * 60 * 60 * 1000);

  // For exact day matching, create a range
  const startOfDay = new Date(targetDate);
  startOfDay.setHours(0, 0, 0, 0);
  const endOfDay = new Date(targetDate);
  endOfDay.setHours(23, 59, 59, 999);

  const verifications = await prisma.identityVerification.findMany({
    where: {
      status: KYCStatus.VERIFIED,
      expiresAt: {
        gte: startOfDay,
        lte: endOfDay,
      },
    },
    select: {
      id: true,
      userId: true,
      expiresAt: true,
      user: {
        select: {
          email: true,
          name: true,
        },
      },
    },
  });

  return verifications.filter((v) => v.expiresAt !== null) as ExpiringVerification[];
}

// Get all verifications that have already expired but not yet marked
export async function getExpiredVerifications(): Promise<ExpiringVerification[]> {
  const now = new Date();

  const verifications = await prisma.identityVerification.findMany({
    where: {
      status: KYCStatus.VERIFIED,
      expiresAt: {
        lt: now,
      },
    },
    select: {
      id: true,
      userId: true,
      expiresAt: true,
      user: {
        select: {
          email: true,
          name: true,
        },
      },
    },
  });

  return verifications.filter((v) => v.expiresAt !== null) as ExpiringVerification[];
}

// Check if a specific reminder type has already been sent
export async function hasReminderBeenSent(
  verificationId: string,
  reminderType: KYCReminderType
): Promise<boolean> {
  const existing = await prisma.kYCExpirationReminder.findUnique({
    where: {
      identityVerificationId_reminderType: {
        identityVerificationId: verificationId,
        reminderType,
      },
    },
  });

  return existing !== null;
}

// Record that a reminder was sent
export async function recordReminderSent(
  verificationId: string,
  reminderType: KYCReminderType,
  emailSent: boolean
): Promise<void> {
  await prisma.kYCExpirationReminder.upsert({
    where: {
      identityVerificationId_reminderType: {
        identityVerificationId: verificationId,
        reminderType,
      },
    },
    create: {
      identityVerificationId: verificationId,
      reminderType,
      emailSent,
    },
    update: {
      emailSent,
      sentAt: new Date(),
    },
  });
}

// Send expiration reminder and record it
export async function sendExpirationReminder(
  verification: ExpiringVerification,
  daysRemaining: number,
  reminderType: KYCReminderType
): Promise<{ success: boolean; emailSent: boolean }> {
  // Check if already sent
  const alreadySent = await hasReminderBeenSent(verification.id, reminderType);
  if (alreadySent) {
    return { success: true, emailSent: false };
  }

  const baseUrl = process.env.NEXT_PUBLIC_APP_URL ?? 'https://settleright.ai';
  const reverifyUrl = `${baseUrl}/dashboard/settings/identity`;

  // Send email
  const emailResult = await sendKYCExpirationReminderEmail(verification.user.email, {
    userName: verification.user.name ?? 'User',
    daysRemaining,
    expirationDate: verification.expiresAt.toLocaleDateString('en-US', {
      year: 'numeric',
      month: 'long',
      day: 'numeric',
    }),
    reverifyUrl,
  });

  // Record the reminder
  await recordReminderSent(verification.id, reminderType, emailResult.success);

  return { success: true, emailSent: emailResult.success };
}

// Mark verifications as expired
export async function markVerificationsAsExpired(verificationIds: string[]): Promise<number> {
  if (verificationIds.length === 0) return 0;

  const result = await prisma.identityVerification.updateMany({
    where: {
      id: { in: verificationIds },
    },
    data: {
      status: KYCStatus.EXPIRED,
    },
  });

  return result.count;
}

// Process all expiration reminders (called by cron job)
export async function processExpirationReminders(): Promise<{
  thirtyDayReminders: number;
  fourteenDayReminders: number;
  sevenDayReminders: number;
  expiredNotices: number;
  markedExpired: number;
}> {
  const results = {
    thirtyDayReminders: 0,
    fourteenDayReminders: 0,
    sevenDayReminders: 0,
    expiredNotices: 0,
    markedExpired: 0,
  };

  // Process 30-day reminders
  const thirtyDayVerifications = await getExpiringVerifications(30);
  for (const v of thirtyDayVerifications) {
    const result = await sendExpirationReminder(v, 30, KYCReminderType.THIRTY_DAYS);
    if (result.emailSent) results.thirtyDayReminders++;
  }

  // Process 14-day reminders
  const fourteenDayVerifications = await getExpiringVerifications(14);
  for (const v of fourteenDayVerifications) {
    const result = await sendExpirationReminder(v, 14, KYCReminderType.FOURTEEN_DAYS);
    if (result.emailSent) results.fourteenDayReminders++;
  }

  // Process 7-day reminders
  const sevenDayVerifications = await getExpiringVerifications(7);
  for (const v of sevenDayVerifications) {
    const result = await sendExpirationReminder(v, 7, KYCReminderType.SEVEN_DAYS);
    if (result.emailSent) results.sevenDayReminders++;
  }

  // Process already expired verifications
  const expiredVerifications = await getExpiredVerifications();
  for (const v of expiredVerifications) {
    const result = await sendExpirationReminder(v, 0, KYCReminderType.EXPIRED);
    if (result.emailSent) results.expiredNotices++;
  }

  // Mark expired verifications
  if (expiredVerifications.length > 0) {
    results.markedExpired = await markVerificationsAsExpired(
      expiredVerifications.map((v) => v.id)
    );
  }

  return results;
}
