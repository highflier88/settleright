import { redirect } from 'next/navigation';

import { getAuthUser } from '@/lib/auth';
import { prisma } from '@/lib/db';

import { NotificationsForm } from './notifications-form';

import type { Metadata } from 'next';

export const metadata: Metadata = {
  title: 'Notification Settings',
  description: 'Manage your notification preferences',
};

export default async function NotificationSettingsPage() {
  const user = await getAuthUser();

  if (!user) {
    redirect('/sign-in');
  }

  let prefs = await prisma.notificationPreference.findUnique({
    where: { userId: user.id },
  });

  // Create default preferences if they don't exist
  if (!prefs) {
    prefs = await prisma.notificationPreference.create({
      data: { userId: user.id },
    });
  }

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-3xl font-bold tracking-tight">Notifications</h1>
        <p className="text-muted-foreground">Configure how you want to receive updates</p>
      </div>

      <NotificationsForm preferences={prefs} />
    </div>
  );
}
