'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import {
  LayoutDashboard,
  FileText,
  PlusCircle,
  Settings,
  Shield,
  Users,
  Scale,
  BarChart,
  ScrollText,
} from 'lucide-react';

import { cn } from '@/lib/utils';
import { UserRole } from '@prisma/client';

interface NavItem {
  title: string;
  href: string;
  icon: React.ComponentType<{ className?: string }>;
  roles?: UserRole[];
}

const navItems: NavItem[] = [
  {
    title: 'Dashboard',
    href: '/dashboard',
    icon: LayoutDashboard,
  },
  {
    title: 'My Cases',
    href: '/dashboard/cases',
    icon: FileText,
  },
  {
    title: 'Start New Case',
    href: '/dashboard/cases/new',
    icon: PlusCircle,
  },
  {
    title: 'Settings',
    href: '/dashboard/settings',
    icon: Settings,
  },
];

const arbitratorNavItems: NavItem[] = [
  {
    title: 'Review Queue',
    href: '/arbitrator',
    icon: Scale,
    roles: [UserRole.ARBITRATOR, UserRole.ADMIN],
  },
  {
    title: 'My Reviews',
    href: '/arbitrator/reviews',
    icon: FileText,
    roles: [UserRole.ARBITRATOR, UserRole.ADMIN],
  },
];

const adminNavItems: NavItem[] = [
  {
    title: 'Admin Dashboard',
    href: '/admin',
    icon: BarChart,
    roles: [UserRole.ADMIN],
  },
  {
    title: 'User Management',
    href: '/admin/users',
    icon: Users,
    roles: [UserRole.ADMIN],
  },
  {
    title: 'Audit Logs',
    href: '/admin/audit-logs',
    icon: ScrollText,
    roles: [UserRole.ADMIN],
  },
  {
    title: 'System Settings',
    href: '/admin/settings',
    icon: Shield,
    roles: [UserRole.ADMIN],
  },
];

interface DashboardNavProps {
  userRole: UserRole;
}

export function DashboardNav({ userRole }: DashboardNavProps) {
  const pathname = usePathname();

  const filteredArbitratorItems = arbitratorNavItems.filter(
    (item) => !item.roles || item.roles.includes(userRole)
  );

  const filteredAdminItems = adminNavItems.filter(
    (item) => !item.roles || item.roles.includes(userRole)
  );

  return (
    <nav className="flex flex-col gap-2 p-4">
      <div className="space-y-1">
        {navItems.map((item) => (
          <Link
            key={item.href}
            href={item.href}
            className={cn(
              'flex items-center gap-3 rounded-lg px-3 py-2 text-sm transition-colors',
              pathname === item.href
                ? 'bg-primary text-primary-foreground'
                : 'text-muted-foreground hover:bg-muted hover:text-foreground'
            )}
          >
            <item.icon className="h-4 w-4" />
            {item.title}
          </Link>
        ))}
      </div>

      {filteredArbitratorItems.length > 0 && (
        <>
          <div className="my-2 border-t" />
          <p className="px-3 text-xs font-semibold uppercase text-muted-foreground">
            Arbitrator
          </p>
          <div className="space-y-1">
            {filteredArbitratorItems.map((item) => (
              <Link
                key={item.href}
                href={item.href}
                className={cn(
                  'flex items-center gap-3 rounded-lg px-3 py-2 text-sm transition-colors',
                  pathname === item.href
                    ? 'bg-primary text-primary-foreground'
                    : 'text-muted-foreground hover:bg-muted hover:text-foreground'
                )}
              >
                <item.icon className="h-4 w-4" />
                {item.title}
              </Link>
            ))}
          </div>
        </>
      )}

      {filteredAdminItems.length > 0 && (
        <>
          <div className="my-2 border-t" />
          <p className="px-3 text-xs font-semibold uppercase text-muted-foreground">
            Administration
          </p>
          <div className="space-y-1">
            {filteredAdminItems.map((item) => (
              <Link
                key={item.href}
                href={item.href}
                className={cn(
                  'flex items-center gap-3 rounded-lg px-3 py-2 text-sm transition-colors',
                  pathname === item.href
                    ? 'bg-primary text-primary-foreground'
                    : 'text-muted-foreground hover:bg-muted hover:text-foreground'
                )}
              >
                <item.icon className="h-4 w-4" />
                {item.title}
              </Link>
            ))}
          </div>
        </>
      )}
    </nav>
  );
}
