import { redirect } from 'next/navigation';

import { getAuthUser } from '@/lib/auth';
import { UserRole } from '@prisma/client';

export default async function AdminLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const user = await getAuthUser();

  if (!user || user.role !== UserRole.ADMIN) {
    redirect('/dashboard');
  }

  return <>{children}</>;
}
