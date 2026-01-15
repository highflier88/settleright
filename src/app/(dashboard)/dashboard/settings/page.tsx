import Link from 'next/link';

import { User, Bell, Shield, CreditCard } from 'lucide-react';

import { Card, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';

import type { Metadata } from 'next';

export const metadata: Metadata = {
  title: 'Settings',
  description: 'Manage your account settings',
};

const settingsLinks = [
  {
    title: 'Profile',
    description: 'Update your personal information and address',
    href: '/dashboard/settings/profile',
    icon: User,
  },
  {
    title: 'Notifications',
    description: 'Configure how you receive updates and alerts',
    href: '/dashboard/settings/notifications',
    icon: Bell,
  },
  {
    title: 'Identity Verification',
    description: 'Verify your identity for binding arbitration',
    href: '/dashboard/settings/identity',
    icon: Shield,
  },
  {
    title: 'Billing',
    description: 'Manage your payment methods and view invoices',
    href: '/dashboard/settings/billing',
    icon: CreditCard,
  },
];

export default function SettingsPage() {
  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-3xl font-bold tracking-tight">Settings</h1>
        <p className="text-muted-foreground">Manage your account settings and preferences</p>
      </div>

      <div className="grid gap-4 md:grid-cols-2">
        {settingsLinks.map((link) => (
          <Link key={link.href} href={link.href}>
            <Card className="transition-colors hover:bg-muted/50">
              <CardHeader>
                <div className="flex items-center gap-4">
                  <div className="rounded-lg bg-primary/10 p-2">
                    <link.icon className="h-6 w-6 text-primary" />
                  </div>
                  <div>
                    <CardTitle className="text-lg">{link.title}</CardTitle>
                    <CardDescription>{link.description}</CardDescription>
                  </div>
                </div>
              </CardHeader>
            </Card>
          </Link>
        ))}
      </div>
    </div>
  );
}
