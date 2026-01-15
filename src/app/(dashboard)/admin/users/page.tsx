import { Suspense } from 'react';

import { UsersTable } from './users-table';
import { UsersTableSkeleton } from './users-table-skeleton';

import type { Metadata } from 'next';

export const metadata: Metadata = {
  title: 'User Management',
  description: 'Manage platform users',
};

interface PageProps {
  searchParams: {
    page?: string;
    search?: string;
    role?: string;
    kycStatus?: string;
  };
}

export default function AdminUsersPage({ searchParams }: PageProps) {
  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-3xl font-bold tracking-tight">User Management</h1>
        <p className="text-muted-foreground">
          View and manage all platform users
        </p>
      </div>

      <Suspense fallback={<UsersTableSkeleton />}>
        <UsersTable searchParams={searchParams} />
      </Suspense>
    </div>
  );
}
