import { redirect } from 'next/navigation';

import { getAuthUser } from '@/lib/auth';

export default async function AdminLayout({ children }: { children: React.ReactNode }) {
  const user = await getAuthUser();

  if (!user || user.role !== 'ADMIN') {
    redirect('/dashboard');
  }

  return <>{children}</>;
}
