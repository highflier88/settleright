import { redirect } from 'next/navigation';

import { getAuthUser } from '@/lib/auth';
import { DashboardNav } from '@/components/layout/dashboard-nav';
import { DashboardHeader } from '@/components/layout/dashboard-header';

export default async function DashboardLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const user = await getAuthUser();

  if (!user) {
    redirect('/sign-in');
  }

  // If user hasn't completed onboarding, redirect them
  if (!user.addressCity || !user.addressState || !user.addressCountry) {
    redirect('/onboarding');
  }

  return (
    <div className="flex min-h-screen flex-col">
      <DashboardHeader user={user} />
      <div className="container flex-1 items-start md:grid md:grid-cols-[220px_minmax(0,1fr)] md:gap-6 lg:grid-cols-[240px_minmax(0,1fr)] lg:gap-10">
        <aside className="fixed top-14 z-30 -ml-2 hidden h-[calc(100vh-3.5rem)] w-full shrink-0 md:sticky md:block">
          <DashboardNav userRole={user.role} />
        </aside>
        <main className="flex w-full flex-col overflow-hidden py-6">{children}</main>
      </div>
    </div>
  );
}
