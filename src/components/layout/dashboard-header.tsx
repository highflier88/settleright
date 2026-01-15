'use client';

import Link from 'next/link';
import { UserButton } from '@clerk/nextjs';
import { Menu } from 'lucide-react';

import { Button } from '@/components/ui/button';
import { Sheet, SheetContent, SheetTrigger } from '@/components/ui/sheet';
import { DashboardNav } from './dashboard-nav';

import type { User } from '@prisma/client';

interface DashboardHeaderProps {
  user: User;
}

export function DashboardHeader({ user }: DashboardHeaderProps) {
  return (
    <header className="sticky top-0 z-40 border-b bg-background">
      <div className="container flex h-14 items-center justify-between">
        <div className="flex items-center gap-4">
          <Sheet>
            <SheetTrigger asChild>
              <Button variant="ghost" size="icon" className="md:hidden">
                <Menu className="h-5 w-5" />
                <span className="sr-only">Toggle menu</span>
              </Button>
            </SheetTrigger>
            <SheetContent side="left" className="w-[240px] p-0">
              <div className="border-b px-6 py-4">
                <Link href="/dashboard" className="flex items-center">
                  <span className="text-lg font-semibold">Settleright.ai</span>
                </Link>
              </div>
              <DashboardNav userRole={user.role} />
            </SheetContent>
          </Sheet>
          <Link href="/dashboard" className="hidden items-center gap-2 md:flex">
            <span className="text-lg font-semibold">Settleright.ai</span>
          </Link>
        </div>

        <div className="flex items-center gap-4">
          <div className="flex items-center gap-2">
            <span className="hidden text-sm text-muted-foreground sm:inline-block">
              {user.name ?? user.email}
            </span>
            <UserButton
              afterSignOutUrl="/"
              appearance={{
                elements: {
                  avatarBox: 'h-8 w-8',
                },
              }}
            />
          </div>
        </div>
      </div>
    </header>
  );
}
