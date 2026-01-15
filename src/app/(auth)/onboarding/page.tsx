import { redirect } from 'next/navigation';

import { getAuthUser } from '@/lib/auth';

import { OnboardingForm } from './onboarding-form';

import type { Metadata } from 'next';

export const metadata: Metadata = {
  title: 'Complete Your Profile',
  description: 'Complete your Settleright.ai profile to get started',
};

export default async function OnboardingPage() {
  const user = await getAuthUser();

  if (!user) {
    redirect('/sign-in');
  }

  // If user already has address info, they've completed onboarding
  if (user.addressCity && user.addressState && user.addressCountry) {
    redirect('/dashboard');
  }

  return (
    <>
      <div className="flex flex-col space-y-2 text-center">
        <h1 className="text-2xl font-semibold tracking-tight">Complete Your Profile</h1>
        <p className="text-sm text-muted-foreground">
          We need a few more details to set up your account
        </p>
      </div>
      <OnboardingForm user={user} />
    </>
  );
}
