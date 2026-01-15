import { Suspense } from 'react';

import Link from 'next/link';
import { redirect } from 'next/navigation';

import { PlusCircle } from 'lucide-react';

import { Button } from '@/components/ui/button';
import { getAuthUser } from '@/lib/auth';

import { CasesList } from './cases-list';
import { CasesListSkeleton } from './cases-list-skeleton';

import type { Metadata } from 'next';

export const metadata: Metadata = {
  title: 'My Cases',
  description: 'View and manage your arbitration cases',
};

interface PageProps {
  searchParams: {
    page?: string;
    status?: string;
    role?: string;
  };
}

export default async function CasesPage({ searchParams }: PageProps) {
  const user = await getAuthUser();

  if (!user) {
    redirect('/sign-in');
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold tracking-tight">My Cases</h1>
          <p className="text-muted-foreground">View and manage your arbitration cases</p>
        </div>
        <Button asChild>
          <Link href="/dashboard/cases/new">
            <PlusCircle className="mr-2 h-4 w-4" />
            Start New Case
          </Link>
        </Button>
      </div>

      <Suspense fallback={<CasesListSkeleton />}>
        <CasesList userId={user.id} searchParams={searchParams} />
      </Suspense>
    </div>
  );
}
