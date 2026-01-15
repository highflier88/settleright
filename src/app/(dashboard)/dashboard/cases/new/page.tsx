import { redirect } from 'next/navigation';

import { getAuthUser } from '@/lib/auth';
import { checkKYCStatus } from '@/lib/kyc';
import { NewCaseForm } from './new-case-form';

import type { Metadata } from 'next';

export const metadata: Metadata = {
  title: 'Start New Case',
  description: 'File a new arbitration case',
};

export default async function NewCasePage() {
  const user = await getAuthUser();

  if (!user) {
    redirect('/sign-in');
  }

  // Check KYC status
  const kycStatus = await checkKYCStatus(user.id);

  return (
    <div className="mx-auto max-w-3xl space-y-6">
      <div>
        <h1 className="text-3xl font-bold tracking-tight">Start New Case</h1>
        <p className="text-muted-foreground">
          File a new dispute for binding arbitration
        </p>
      </div>

      {!kycStatus.isVerified ? (
        <div className="rounded-lg border border-destructive/50 bg-destructive/10 p-6">
          <h2 className="text-lg font-semibold text-destructive">
            Identity Verification Required
          </h2>
          <p className="mt-2 text-sm text-muted-foreground">
            You must verify your identity before filing a case. This ensures the
            enforceability of arbitration awards.
          </p>
          <p className="mt-4">
            <a
              href="/dashboard/settings/identity"
              className="text-primary hover:underline"
            >
              Complete identity verification →
            </a>
          </p>
        </div>
      ) : (
        <NewCaseForm user={user} />
      )}
    </div>
  );
}
