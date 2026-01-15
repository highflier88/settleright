import { type NextRequest } from 'next/server';

import { successResponse, errorResponse } from '@/lib/api';
import { requireAuth } from '@/lib/auth';
import { prisma } from '@/lib/db';
import { validateBody } from '@/lib/validations';
import { notificationPreferencesSchema } from '@/lib/validations/user';

export async function GET() {
  try {
    const user = await requireAuth();

    let prefs = await prisma.notificationPreference.findUnique({
      where: { userId: user.id },
    });

    // Create default preferences if they don't exist
    if (!prefs) {
      prefs = await prisma.notificationPreference.create({
        data: {
          userId: user.id,
        },
      });
    }

    return successResponse({
      emailEnabled: prefs.emailEnabled,
      smsEnabled: prefs.smsEnabled,
      inAppEnabled: prefs.inAppEnabled,
      caseUpdates: prefs.caseUpdates,
      deadlineReminders: prefs.deadlineReminders,
      evidenceUploads: prefs.evidenceUploads,
      awardNotifications: prefs.awardNotifications,
      marketingEmails: prefs.marketingEmails,
    });
  } catch (error) {
    return errorResponse(error as Error);
  }
}

export async function PATCH(request: NextRequest) {
  try {
    const user = await requireAuth();
    const body: unknown = await request.json();
    const data = validateBody(notificationPreferencesSchema, body);

    const prefs = await prisma.notificationPreference.upsert({
      where: { userId: user.id },
      update: data,
      create: {
        userId: user.id,
        ...data,
      },
    });

    return successResponse({
      emailEnabled: prefs.emailEnabled,
      smsEnabled: prefs.smsEnabled,
      inAppEnabled: prefs.inAppEnabled,
      caseUpdates: prefs.caseUpdates,
      deadlineReminders: prefs.deadlineReminders,
      evidenceUploads: prefs.evidenceUploads,
      awardNotifications: prefs.awardNotifications,
      marketingEmails: prefs.marketingEmails,
    });
  } catch (error) {
    return errorResponse(error as Error);
  }
}
