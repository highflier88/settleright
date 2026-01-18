'use client';

import Link from 'next/link';

import { AlertTriangle } from 'lucide-react';

import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';
import { Button } from '@/components/ui/button';
import type { KYCStatus } from '@/types/shared';

interface KYCExpirationBannerProps {
  status: KYCStatus;
  expiresAt: Date | null;
}

export function KYCExpirationBanner({ status, expiresAt }: KYCExpirationBannerProps) {
  // Only show for verified users with an expiration date
  if (status !== 'VERIFIED' || !expiresAt) {
    return null;
  }

  const now = new Date();
  const expirationDate = new Date(expiresAt);
  const daysUntilExpiry = Math.ceil(
    (expirationDate.getTime() - now.getTime()) / (1000 * 60 * 60 * 24)
  );

  // Don't show if more than 30 days until expiry
  if (daysUntilExpiry > 30) {
    return null;
  }

  const isExpired = daysUntilExpiry <= 0;
  const isUrgent = daysUntilExpiry <= 7;

  return (
    <Alert variant={isExpired || isUrgent ? 'destructive' : 'default'} className="mb-6">
      <AlertTriangle className="h-4 w-4" />
      <AlertTitle>
        {isExpired
          ? 'Identity Verification Expired'
          : `Identity Verification Expires ${isUrgent ? 'Soon' : 'in ' + daysUntilExpiry + ' Days'}`}
      </AlertTitle>
      <AlertDescription className="mt-2">
        {isExpired ? (
          <>
            Your identity verification has expired. You will need to complete a new verification
            before you can file or respond to cases.
          </>
        ) : (
          <>
            Your identity verification expires on{' '}
            {expirationDate.toLocaleDateString('en-US', {
              year: 'numeric',
              month: 'long',
              day: 'numeric',
            })}
            . To avoid any interruption in using Settleright.ai, please complete a new verification
            before the expiration date.
          </>
        )}
        <div className="mt-3">
          <Link href="/dashboard/settings/identity">
            <Button variant={isExpired || isUrgent ? 'destructive' : 'outline'} size="sm">
              Re-verify Identity
            </Button>
          </Link>
        </div>
      </AlertDescription>
    </Alert>
  );
}
