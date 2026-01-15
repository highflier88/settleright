import { Suspense } from 'react';

import { AuditLogsTable } from './audit-logs-table';
import { AuditLogsTableSkeleton } from './audit-logs-table-skeleton';
import { AuditStats } from './audit-stats';

import type { Metadata } from 'next';

export const metadata: Metadata = {
  title: 'Audit Logs',
  description: 'View system audit logs',
};

interface PageProps {
  searchParams: {
    page?: string;
    userId?: string;
    caseId?: string;
    action?: string;
    startDate?: string;
    endDate?: string;
  };
}

export default function AuditLogsPage({ searchParams }: PageProps) {
  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-3xl font-bold tracking-tight">Audit Logs</h1>
        <p className="text-muted-foreground">
          View and analyze system audit logs for compliance and security monitoring
        </p>
      </div>

      <Suspense fallback={<div className="h-32 animate-pulse bg-muted rounded-lg" />}>
        <AuditStats />
      </Suspense>

      <Suspense fallback={<AuditLogsTableSkeleton />}>
        <AuditLogsTable searchParams={searchParams} />
      </Suspense>
    </div>
  );
}
