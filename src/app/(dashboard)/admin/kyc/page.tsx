import { Suspense } from 'react';

import { Skeleton } from '@/components/ui/skeleton';
import { prisma } from '@/lib/db';

import { KYCStatsCards } from './components/kyc-stats-cards';
import { KYCTable } from './components/kyc-table';

import type { Metadata } from 'next';

export const metadata: Metadata = {
  title: 'KYC Management',
  description: 'Manage user identity verifications',
};

interface PageProps {
  searchParams: Promise<{
    page?: string;
    search?: string;
    status?: string;
  }>;
}

async function KYCStats() {
  const now = new Date();
  const thirtyDaysFromNow = new Date(now.getTime() + 30 * 24 * 60 * 60 * 1000);
  const sevenDaysAgo = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000);

  const [total, notStarted, pending, verified, failed, expired, expiringSoon, recentFailures] =
    await Promise.all([
      prisma.identityVerification.count(),
      prisma.identityVerification.count({ where: { status: 'NOT_STARTED' } }),
      prisma.identityVerification.count({ where: { status: 'PENDING' } }),
      prisma.identityVerification.count({ where: { status: 'VERIFIED' } }),
      prisma.identityVerification.count({ where: { status: 'FAILED' } }),
      prisma.identityVerification.count({ where: { status: 'EXPIRED' } }),
      prisma.identityVerification.count({
        where: {
          status: 'VERIFIED',
          expiresAt: { gte: now, lte: thirtyDaysFromNow },
        },
      }),
      prisma.identityVerification.count({
        where: {
          status: 'FAILED',
          failedAt: { gte: sevenDaysAgo },
        },
      }),
    ]);

  return (
    <KYCStatsCards
      stats={{
        total,
        byStatus: {
          NOT_STARTED: notStarted,
          PENDING: pending,
          VERIFIED: verified,
          FAILED: failed,
          EXPIRED: expired,
        },
        expiringSoon,
        recentFailures,
        averageVerificationTime: null, // Computed on demand in stats API
      }}
    />
  );
}

function StatsSkeleton() {
  return (
    <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
      {Array.from({ length: 6 }).map((_, i) => (
        <Skeleton key={i} className="h-[120px]" />
      ))}
    </div>
  );
}

function TableSkeleton() {
  return (
    <div className="space-y-4">
      <div className="flex gap-4">
        <Skeleton className="h-10 flex-1" />
        <Skeleton className="h-10 w-[150px]" />
      </div>
      <Skeleton className="h-[400px]" />
    </div>
  );
}

export default async function AdminKYCPage({ searchParams }: PageProps) {
  const params = await searchParams;

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-3xl font-bold tracking-tight">KYC Management</h1>
        <p className="text-muted-foreground">
          View and manage user identity verifications
        </p>
      </div>

      <Suspense fallback={<StatsSkeleton />}>
        <KYCStats />
      </Suspense>

      <Suspense fallback={<TableSkeleton />}>
        <KYCTable searchParams={params} />
      </Suspense>
    </div>
  );
}
