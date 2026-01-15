import { redirect } from 'next/navigation';

import { getAuthUser } from '@/lib/auth';

import { ProfileForm } from './profile-form';

import type { Metadata } from 'next';

export const metadata: Metadata = {
  title: 'Profile Settings',
  description: 'Update your profile information',
};

export default async function ProfileSettingsPage() {
  const user = await getAuthUser();

  if (!user) {
    redirect('/sign-in');
  }

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-3xl font-bold tracking-tight">Profile</h1>
        <p className="text-muted-foreground">Update your personal information</p>
      </div>

      <ProfileForm user={user} />
    </div>
  );
}
