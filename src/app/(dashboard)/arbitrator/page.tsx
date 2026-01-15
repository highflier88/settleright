import Link from 'next/link';
import { redirect } from 'next/navigation';

import { UserRole } from '@prisma/client';
import { Scale, Clock, AlertTriangle, CheckCircle, FileText, ArrowRight } from 'lucide-react';

import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from '@/components/ui/card';
import { getAuthUser } from '@/lib/auth';
import { prisma } from '@/lib/db';

import type { Metadata } from 'next';

export const metadata: Metadata = {
  title: 'Arbitrator Portal',
  description: 'Manage your assigned cases and reviews',
};

async function getArbitratorStats(userId: string) {
  const now = new Date();
  const startOfWeek = new Date(now);
  startOfWeek.setDate(now.getDate() - now.getDay());
  startOfWeek.setHours(0, 0, 0, 0);

  const [pending, withDraftAward, completedThisWeek, overdue] = await Promise.all([
    prisma.arbitratorAssignment.count({
      where: {
        arbitratorId: userId,
        reviewCompletedAt: null,
      },
    }),
    prisma.arbitratorAssignment.count({
      where: {
        arbitratorId: userId,
        reviewCompletedAt: null,
        case: {
          draftAward: { isNot: null },
        },
      },
    }),
    prisma.arbitratorAssignment.count({
      where: {
        arbitratorId: userId,
        reviewCompletedAt: { gte: startOfWeek },
      },
    }),
    prisma.arbitratorAssignment.count({
      where: {
        arbitratorId: userId,
        reviewCompletedAt: null,
        dueBy: { lt: now },
      },
    }),
  ]);

  return { pending, withDraftAward, completedThisWeek, overdue };
}

async function getPendingAssignments(userId: string, limit = 10) {
  return prisma.arbitratorAssignment.findMany({
    where: {
      arbitratorId: userId,
      reviewCompletedAt: null,
    },
    include: {
      case: {
        select: {
          id: true,
          referenceNumber: true,
          status: true,
          disputeType: true,
          jurisdiction: true,
          amount: true,
          createdAt: true,
          claimant: { select: { name: true } },
          respondent: { select: { name: true } },
          draftAward: {
            select: {
              id: true,
              reviewStatus: true,
              confidence: true,
              generatedAt: true,
            },
          },
        },
      },
    },
    orderBy: [
      { priority: 'desc' },
      { dueBy: 'asc' },
      { assignedAt: 'asc' },
    ],
    take: limit,
  });
}

function getPriorityBadge(priority: string) {
  switch (priority) {
    case 'urgent':
      return <Badge variant="destructive">Urgent</Badge>;
    case 'high':
      return <Badge variant="default" className="bg-orange-500">High</Badge>;
    default:
      return <Badge variant="secondary">Normal</Badge>;
  }
}

function formatCurrency(amount: number | null) {
  if (!amount) return 'N/A';
  return new Intl.NumberFormat('en-US', {
    style: 'currency',
    currency: 'USD',
    minimumFractionDigits: 0,
    maximumFractionDigits: 0,
  }).format(amount);
}

export default async function ArbitratorPage() {
  const user = await getAuthUser();
  if (!user) return redirect('/sign-in');

  // Ensure user is an arbitrator
  if (user.role !== UserRole.ARBITRATOR && user.role !== UserRole.ADMIN) {
    return redirect('/dashboard');
  }

  const [stats, assignments] = await Promise.all([
    getArbitratorStats(user.id),
    getPendingAssignments(user.id),
  ]);

  return (
    <div className="space-y-8">
      <div>
        <h1 className="text-3xl font-bold tracking-tight">Arbitrator Portal</h1>
        <p className="text-muted-foreground">
          Review and manage your assigned arbitration cases
        </p>
      </div>

      {/* Stats Cards */}
      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Pending Review</CardTitle>
            <Clock className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{stats.pending}</div>
            <p className="text-xs text-muted-foreground">
              Cases awaiting your review
            </p>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Ready for Decision</CardTitle>
            <FileText className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{stats.withDraftAward}</div>
            <p className="text-xs text-muted-foreground">
              With AI-generated draft award
            </p>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Completed This Week</CardTitle>
            <CheckCircle className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{stats.completedThisWeek}</div>
            <p className="text-xs text-muted-foreground">
              Reviews completed
            </p>
          </CardContent>
        </Card>
        <Card className={stats.overdue > 0 ? 'border-destructive' : ''}>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Overdue</CardTitle>
            <AlertTriangle className={`h-4 w-4 ${stats.overdue > 0 ? 'text-destructive' : 'text-muted-foreground'}`} />
          </CardHeader>
          <CardContent>
            <div className={`text-2xl font-bold ${stats.overdue > 0 ? 'text-destructive' : ''}`}>
              {stats.overdue}
            </div>
            <p className="text-xs text-muted-foreground">
              Past deadline
            </p>
          </CardContent>
        </Card>
      </div>

      {/* Review Queue */}
      <Card>
        <CardHeader>
          <div className="flex items-center justify-between">
            <div>
              <CardTitle>Review Queue</CardTitle>
              <CardDescription>
                Cases assigned to you for arbitration review
              </CardDescription>
            </div>
            <Link href="/arbitrator/reviews">
              <Button variant="outline" size="sm">
                View All
                <ArrowRight className="ml-2 h-4 w-4" />
              </Button>
            </Link>
          </div>
        </CardHeader>
        <CardContent>
          {assignments.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-8 text-center">
              <Scale className="h-12 w-12 text-muted-foreground mb-4" />
              <h3 className="text-lg font-medium">No pending cases</h3>
              <p className="text-sm text-muted-foreground">
                You have no cases currently assigned for review.
              </p>
            </div>
          ) : (
            <div className="space-y-4">
              {assignments.map((assignment) => (
                <div
                  key={assignment.id}
                  className="flex items-center justify-between rounded-lg border p-4 hover:bg-muted/50 transition-colors"
                >
                  <div className="space-y-1">
                    <div className="flex items-center gap-2">
                      <span className="font-medium">
                        {assignment.case.referenceNumber}
                      </span>
                      {getPriorityBadge(assignment.priority)}
                      {assignment.case.draftAward && (
                        <Badge variant="outline" className="text-green-600 border-green-600">
                          Draft Ready
                        </Badge>
                      )}
                    </div>
                    <div className="flex items-center gap-4 text-sm text-muted-foreground">
                      <span>
                        {assignment.case.claimant?.name || 'Claimant'} v.{' '}
                        {assignment.case.respondent?.name || 'Respondent'}
                      </span>
                      <span>|</span>
                      <span>{assignment.case.disputeType}</span>
                      <span>|</span>
                      <span>{formatCurrency(assignment.case.amount ? Number(assignment.case.amount) : null)}</span>
                    </div>
                    <div className="text-xs text-muted-foreground">
                      Assigned: {new Date(assignment.assignedAt).toLocaleDateString()}
                      {assignment.dueBy && (
                        <span className={new Date(assignment.dueBy) < new Date() ? 'text-destructive ml-2' : 'ml-2'}>
                          Due: {new Date(assignment.dueBy).toLocaleDateString()}
                        </span>
                      )}
                    </div>
                  </div>
                  <Link href={`/arbitrator/cases/${assignment.case.id}`}>
                    <Button size="sm">
                      Review Case
                      <ArrowRight className="ml-2 h-4 w-4" />
                    </Button>
                  </Link>
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
