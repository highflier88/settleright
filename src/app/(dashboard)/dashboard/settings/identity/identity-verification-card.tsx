'use client';

import { useEffect, useState } from 'react';

import { useRouter } from 'next/navigation';

import { AlertTriangle, CheckCircle, Clock, RefreshCw, Shield, XCircle } from 'lucide-react';
import { toast } from 'sonner';

import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { formatDate } from '@/lib/utils';
import type { IdentityVerification, KYCStatus, User } from '@/types/shared';

interface IdentityVerificationCardProps {
  user: User;
  verification: IdentityVerification | null;
}

interface VerificationStatus {
  status: KYCStatus;
  isValid: boolean;
  canStartVerification: boolean;
  verifiedAt: string | null;
  expiresAt: string | null;
  verifiedName: string | null;
  documentType: string | null;
  failureReason: string | null;
  initiatedAt: string | null;
}

const STATUS_CONFIG = {
  NOT_STARTED: {
    icon: Shield,
    label: 'Not Started',
    variant: 'outline' as const,
    description: 'You have not started identity verification yet.',
    color: 'gray',
  },
  PENDING: {
    icon: Clock,
    label: 'Pending',
    variant: 'secondary' as const,
    description: 'Your identity verification is being processed.',
    color: 'yellow',
  },
  VERIFIED: {
    icon: CheckCircle,
    label: 'Verified',
    variant: 'default' as const,
    description: 'Your identity has been verified successfully.',
    color: 'green',
  },
  FAILED: {
    icon: XCircle,
    label: 'Failed',
    variant: 'destructive' as const,
    description: 'Identity verification failed. Please try again.',
    color: 'red',
  },
  EXPIRED: {
    icon: AlertTriangle,
    label: 'Expired',
    variant: 'destructive' as const,
    description: 'Your identity verification has expired. Please verify again.',
    color: 'red',
  },
};

export function IdentityVerificationCard({
  user: _user,
  verification: initialVerification,
}: IdentityVerificationCardProps) {
  const router = useRouter();
  const [isLoading, setIsLoading] = useState(false);
  const [isPolling, setIsPolling] = useState(false);
  const [status, setStatus] = useState<VerificationStatus | null>(null);

  const currentStatus = status?.status ?? initialVerification?.status ?? 'NOT_STARTED';
  const config = STATUS_CONFIG[currentStatus];
  const StatusIcon = config.icon;

  // Fetch current status
  const fetchStatus = async () => {
    try {
      const response = await fetch('/api/user/identity/status');
      if (response.ok) {
        const data = (await response.json()) as { data: VerificationStatus };
        setStatus(data.data);
        return data.data;
      }
    } catch (error) {
      console.error('Failed to fetch status:', error);
    }
    return null;
  };

  // Poll for status updates when pending
  useEffect(() => {
    void fetchStatus();

    if (currentStatus === 'PENDING') {
      setIsPolling(true);
      const interval = setInterval(() => {
        void (async () => {
          const newStatus = await fetchStatus();
          if (newStatus && newStatus.status !== 'PENDING') {
            setIsPolling(false);
            clearInterval(interval);
            router.refresh();

            if (newStatus.status === 'VERIFIED') {
              toast.success('Identity verification completed successfully!');
            } else if (newStatus.status === 'FAILED') {
              toast.error('Identity verification failed. Please try again.');
            }
          }
        })();
      }, 5000); // Poll every 5 seconds

      return () => {
        clearInterval(interval);
        setIsPolling(false);
      };
    }
    return undefined;
  }, [currentStatus, router]);

  const canStartVerification =
    status?.canStartVerification ??
    (currentStatus === 'NOT_STARTED' || currentStatus === 'FAILED' || currentStatus === 'EXPIRED');

  const handleStartVerification = async () => {
    setIsLoading(true);

    try {
      const response = await fetch('/api/user/identity/start', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          returnUrl: `${window.location.origin}/dashboard/settings/identity`,
        }),
      });

      if (!response.ok) {
        const error = (await response.json()) as { error?: { message?: string } };
        throw new Error(error.error?.message || 'Failed to start verification');
      }

      const data = (await response.json()) as { data?: { url?: string } };

      if (data.data?.url) {
        // Redirect to Stripe Identity verification
        window.location.href = data.data.url;
      } else {
        toast.success('Verification started');
        router.refresh();
      }
    } catch (error) {
      toast.error(error instanceof Error ? error.message : 'Something went wrong');
    } finally {
      setIsLoading(false);
    }
  };

  const handleRefresh = async () => {
    setIsLoading(true);
    await fetchStatus();
    setIsLoading(false);
    router.refresh();
  };

  return (
    <div className="space-y-6">
      {/* Status Card */}
      <Card>
        <CardHeader>
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-4">
              <div
                className={`rounded-full p-3 ${
                  config.color === 'green'
                    ? 'bg-green-100 text-green-600 dark:bg-green-900/30 dark:text-green-400'
                    : config.color === 'yellow'
                      ? 'bg-yellow-100 text-yellow-600 dark:bg-yellow-900/30 dark:text-yellow-400'
                      : config.color === 'red'
                        ? 'bg-red-100 text-red-600 dark:bg-red-900/30 dark:text-red-400'
                        : 'bg-gray-100 text-gray-600 dark:bg-gray-800 dark:text-gray-400'
                }`}
              >
                <StatusIcon className={`h-6 w-6 ${isPolling ? 'animate-pulse' : ''}`} />
              </div>
              <div>
                <CardTitle>Verification Status</CardTitle>
                <CardDescription>{config.description}</CardDescription>
              </div>
            </div>
            <div className="flex items-center gap-2">
              {currentStatus === 'PENDING' && (
                <Button variant="ghost" size="icon" onClick={handleRefresh} disabled={isLoading}>
                  <RefreshCw className={`h-4 w-4 ${isPolling ? 'animate-spin' : ''}`} />
                </Button>
              )}
              <Badge variant={config.variant}>{config.label}</Badge>
            </div>
          </div>
        </CardHeader>
        <CardContent>
          <div className="space-y-4">
            {/* Status Details */}
            {(status || initialVerification) && (
              <div className="space-y-2 text-sm">
                {(status?.verifiedAt || initialVerification?.verifiedAt) && (
                  <p>
                    <span className="text-muted-foreground">Verified on:</span>{' '}
                    {formatDate(status?.verifiedAt ?? initialVerification?.verifiedAt ?? '')}
                  </p>
                )}
                {(status?.expiresAt || initialVerification?.expiresAt) && (
                  <p>
                    <span className="text-muted-foreground">Expires on:</span>{' '}
                    {formatDate(status?.expiresAt ?? initialVerification?.expiresAt ?? '')}
                  </p>
                )}
                {(status?.verifiedName || initialVerification?.verifiedName) && (
                  <p>
                    <span className="text-muted-foreground">Verified name:</span>{' '}
                    {status?.verifiedName ?? initialVerification?.verifiedName}
                  </p>
                )}
                {(status?.documentType || initialVerification?.documentType) && (
                  <p>
                    <span className="text-muted-foreground">Document type:</span>{' '}
                    {(status?.documentType ?? initialVerification?.documentType)?.replace(
                      /_/g,
                      ' '
                    )}
                  </p>
                )}
                {(status?.failureReason || initialVerification?.failureReason) && (
                  <p className="text-destructive">
                    <span className="font-medium">Reason:</span>{' '}
                    {status?.failureReason ?? initialVerification?.failureReason}
                  </p>
                )}
                {currentStatus === 'PENDING' && (
                  <p className="italic text-muted-foreground">
                    {isPolling
                      ? 'Checking for updates...'
                      : 'Please complete the verification process in the popup window.'}
                  </p>
                )}
              </div>
            )}

            {/* Action Button */}
            {canStartVerification && (
              <Button
                onClick={handleStartVerification}
                isLoading={isLoading}
                disabled={isLoading}
                className="mt-4"
              >
                {currentStatus === 'NOT_STARTED' ? 'Start Verification' : 'Try Again'}
              </Button>
            )}
          </div>
        </CardContent>
      </Card>

      {/* Information Card */}
      <Card>
        <CardHeader>
          <CardTitle>Why Verify Your Identity?</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <p className="text-muted-foreground">
            Identity verification is required to participate in binding arbitration on
            Settleright.ai. This ensures:
          </p>
          <ul className="list-inside list-disc space-y-2 text-muted-foreground">
            <li>
              <strong>Legal enforceability</strong> - Arbitration awards are only enforceable when
              parties are properly identified
            </li>
            <li>
              <strong>Fraud prevention</strong> - Prevents fraudulent claims and protects all
              parties
            </li>
            <li>
              <strong>Compliance</strong> - Meets regulatory requirements for dispute resolution
              services
            </li>
          </ul>
        </CardContent>
      </Card>

      {/* What You'll Need Card */}
      <Card>
        <CardHeader>
          <CardTitle>What You&apos;ll Need</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <p className="text-muted-foreground">
            To complete identity verification, please have one of the following ready:
          </p>
          <ul className="list-inside list-disc space-y-2 text-muted-foreground">
            <li>Valid government-issued photo ID (driver&apos;s license, passport, or state ID)</li>
            <li>A device with a camera for taking photos</li>
            <li>Good lighting for clear images</li>
          </ul>
          <p className="text-sm text-muted-foreground">
            The verification process typically takes 2-5 minutes and results are usually available
            within a few minutes.
          </p>
        </CardContent>
      </Card>

      {/* Privacy Note */}
      <Card>
        <CardHeader>
          <CardTitle>Your Privacy</CardTitle>
        </CardHeader>
        <CardContent>
          <p className="text-sm text-muted-foreground">
            Your identity documents are processed securely by Stripe Identity, our trusted
            verification partner. We only store your verification status and verified name - your
            actual identity documents are not stored on our servers. For more information, see our{' '}
            <a href="/privacy" className="text-primary hover:underline">
              Privacy Policy
            </a>
            .
          </p>
        </CardContent>
      </Card>
    </div>
  );
}
