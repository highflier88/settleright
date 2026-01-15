import { redirect } from 'next/navigation';

import { getAuthUser } from '@/lib/auth';
import { prisma } from '@/lib/db';

import { IdentityVerificationCard } from './identity-verification-card';

import type { Metadata } from 'next';

export const metadata: Metadata = {
  title: 'Identity Verification',
  description: 'Verify your identity for binding arbitration',
};

export default async function IdentityVerificationPage() {
  const user = await getAuthUser();

  if (!user) {
    redirect('/sign-in');
  }

  const verification = await prisma.identityVerification.findUnique({
    where: { userId: user.id },
  });

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-3xl font-bold tracking-tight">Identity Verification</h1>
        <p className="text-muted-foreground">
          Verify your identity to participate in binding arbitration
        </p>
      </div>

      <IdentityVerificationCard user={user} verification={verification} />
    </div>
  );
}
