import Link from 'next/link';
import { PlusCircle, FileText, Clock, CheckCircle } from 'lucide-react';

import { getAuthUser } from '@/lib/auth';
import { prisma } from '@/lib/db';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';

import type { Metadata } from 'next';

export const metadata: Metadata = {
  title: 'Dashboard',
  description: 'Your Settleright.ai dashboard',
};

async function getCaseStats(userId: string) {
  const [totalCases, activeCases, resolvedCases] = await Promise.all([
    prisma.case.count({
      where: {
        OR: [{ claimantId: userId }, { respondentId: userId }],
      },
    }),
    prisma.case.count({
      where: {
        OR: [{ claimantId: userId }, { respondentId: userId }],
        status: {
          notIn: ['CLOSED', 'DECIDED'],
        },
      },
    }),
    prisma.case.count({
      where: {
        OR: [{ claimantId: userId }, { respondentId: userId }],
        status: {
          in: ['CLOSED', 'DECIDED'],
        },
      },
    }),
  ]);

  return { totalCases, activeCases, resolvedCases };
}

async function getKycStatus(userId: string) {
  const verification = await prisma.identityVerification.findUnique({
    where: { userId },
    select: { status: true },
  });
  return verification?.status;
}

async function getRecentCases(userId: string) {
  return prisma.case.findMany({
    where: {
      OR: [{ claimantId: userId }, { respondentId: userId }],
    },
    orderBy: { updatedAt: 'desc' },
    take: 5,
    select: {
      id: true,
      referenceNumber: true,
      status: true,
      disputeType: true,
      amount: true,
      createdAt: true,
      updatedAt: true,
      claimantId: true,
    },
  });
}

export default async function DashboardPage() {
  const user = await getAuthUser();
  if (!user) return null;

  const [stats, recentCases, kycStatus] = await Promise.all([
    getCaseStats(user.id),
    getRecentCases(user.id),
    getKycStatus(user.id),
  ]);

  return (
    <div className="space-y-8">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold tracking-tight">
            Welcome back, {user.name?.split(' ')[0] ?? 'there'}
          </h1>
          <p className="text-muted-foreground">
            Here&apos;s an overview of your dispute resolution activity
          </p>
        </div>
        <Link href="/dashboard/cases/new">
          <Button>
            <PlusCircle className="mr-2 h-4 w-4" />
            Start New Case
          </Button>
        </Link>
      </div>

      {/* Stats Cards */}
      <div className="grid gap-4 md:grid-cols-3">
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Total Cases</CardTitle>
            <FileText className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{stats.totalCases}</div>
            <p className="text-xs text-muted-foreground">
              Cases you&apos;re involved in
            </p>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Active Cases</CardTitle>
            <Clock className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{stats.activeCases}</div>
            <p className="text-xs text-muted-foreground">Currently in progress</p>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Resolved Cases</CardTitle>
            <CheckCircle className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{stats.resolvedCases}</div>
            <p className="text-xs text-muted-foreground">
              Successfully resolved
            </p>
          </CardContent>
        </Card>
      </div>

      {/* Recent Cases */}
      <Card>
        <CardHeader>
          <CardTitle>Recent Cases</CardTitle>
          <CardDescription>Your most recently updated cases</CardDescription>
        </CardHeader>
        <CardContent>
          {recentCases.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-8 text-center">
              <FileText className="h-12 w-12 text-muted-foreground/50" />
              <h3 className="mt-4 text-lg font-semibold">No cases yet</h3>
              <p className="mt-2 text-sm text-muted-foreground">
                Get started by creating your first case
              </p>
              <Link href="/dashboard/cases/new" className="mt-4">
                <Button>
                  <PlusCircle className="mr-2 h-4 w-4" />
                  Start New Case
                </Button>
              </Link>
            </div>
          ) : (
            <div className="space-y-4">
              {recentCases.map((case_) => (
                <Link
                  key={case_.id}
                  href={`/dashboard/cases/${case_.id}`}
                  className="block"
                >
                  <div className="flex items-center justify-between rounded-lg border p-4 transition-colors hover:bg-muted/50">
                    <div className="space-y-1">
                      <p className="font-medium">{case_.referenceNumber}</p>
                      <p className="text-sm text-muted-foreground">
                        {case_.disputeType.toLowerCase().replace('_', ' ')} -{' '}
                        {case_.claimantId === user.id ? 'Claimant' : 'Respondent'}
                      </p>
                    </div>
                    <div className="text-right">
                      <p className="font-medium">
                        ${Number(case_.amount).toLocaleString()}
                      </p>
                      <p className="text-sm text-muted-foreground">
                        {case_.status.toLowerCase().replace(/_/g, ' ')}
                      </p>
                    </div>
                  </div>
                </Link>
              ))}
            </div>
          )}
        </CardContent>
      </Card>

      {/* KYC Status */}
      {kycStatus !== 'VERIFIED' && (
        <Card className="border-warning bg-warning/5">
          <CardHeader>
            <CardTitle className="text-warning">Identity Verification Required</CardTitle>
            <CardDescription>
              To participate in binding arbitration, you need to verify your identity.
              This helps ensure the integrity of the arbitration process.
            </CardDescription>
          </CardHeader>
          <CardContent>
            <Link href="/dashboard/settings/identity">
              <Button variant="outline">Verify Identity</Button>
            </Link>
          </CardContent>
        </Card>
      )}
    </div>
  );
}
