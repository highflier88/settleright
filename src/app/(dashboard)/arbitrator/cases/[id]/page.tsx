import Link from 'next/link';
import { notFound, redirect } from 'next/navigation';

import { format } from 'date-fns';
import {
  ArrowLeft,
  Scale,
  FileText,
  Users,
  Clock,
  AlertTriangle,
  CheckCircle,
  Gavel,
  Eye,
  Download,
  MessageSquare,
  ChevronRight,
} from 'lucide-react';

import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { getAuthUser } from '@/lib/auth';
import { prisma } from '@/lib/db';

import type { Metadata } from 'next';

export const metadata: Metadata = {
  title: 'Case Review',
  description: 'Review case details and make arbitration decisions',
};

interface PageProps {
  params: { id: string };
}

async function getCaseForArbitrator(caseId: string, userId: string) {
  // Get the assignment
  const assignment = await prisma.arbitratorAssignment.findFirst({
    where: {
      caseId,
      arbitratorId: userId,
    },
  });

  if (!assignment) return null;

  // Get the case with all related data
  const caseData = await prisma.case.findUnique({
    where: { id: caseId },
    include: {
      claimant: {
        select: {
          id: true,
          name: true,
          email: true,
        },
      },
      respondent: {
        select: {
          id: true,
          name: true,
          email: true,
        },
      },
      evidence: {
        orderBy: { submittedAt: 'asc' },
        include: {
          submittedBy: {
            select: { id: true, name: true },
          },
        },
      },
      statements: {
        orderBy: { submittedAt: 'asc' },
        include: {
          submittedBy: {
            select: { id: true, name: true },
          },
        },
      },
      draftAward: true,
      award: true,
      analysisJob: true,
    },
  });

  if (!caseData) return null;

  return { assignment, caseData };
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

function getPriorityBadge(priority: string) {
  switch (priority) {
    case 'urgent':
      return <Badge variant="destructive">Urgent Priority</Badge>;
    case 'high':
      return (
        <Badge variant="default" className="bg-orange-500">
          High Priority
        </Badge>
      );
    default:
      return <Badge variant="secondary">Normal Priority</Badge>;
  }
}

function getReviewStatusBadge(status: string | null) {
  switch (status) {
    case 'APPROVE':
      return (
        <Badge variant="default" className="bg-green-600">
          Approved
        </Badge>
      );
    case 'MODIFY':
      return (
        <Badge variant="default" className="bg-blue-600">
          Modified
        </Badge>
      );
    case 'REJECT':
      return <Badge variant="destructive">Rejected</Badge>;
    case 'ESCALATE':
      return (
        <Badge variant="default" className="bg-purple-600">
          Escalated
        </Badge>
      );
    default:
      return <Badge variant="outline">Pending Review</Badge>;
  }
}

export default async function ArbitratorCaseDetailPage({ params }: PageProps) {
  const user = await getAuthUser();
  if (!user) return redirect('/sign-in');

  // Ensure user is an arbitrator
  if (user.role !== 'ARBITRATOR' && user.role !== 'ADMIN') {
    return redirect('/dashboard');
  }

  const result = await getCaseForArbitrator(params.id, user.id);

  if (!result) {
    notFound();
  }

  const { assignment, caseData } = result;
  const isOverdue = assignment.dueBy && new Date(assignment.dueBy) < new Date();
  const hasDraftAward = !!caseData.draftAward;
  const hasIssuedAward = !!caseData.award;
  const analysisJob = caseData.analysisJob;

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-start justify-between">
        <div className="space-y-1">
          <div className="flex items-center gap-2">
            <Link href="/arbitrator" className="text-muted-foreground hover:text-foreground">
              <ArrowLeft className="h-4 w-4" />
            </Link>
            <h1 className="text-2xl font-bold tracking-tight">Case {caseData.referenceNumber}</h1>
          </div>
          <div className="flex flex-wrap items-center gap-2">
            {getPriorityBadge(assignment.priority)}
            <Badge variant="outline">{caseData.disputeType}</Badge>
            <Badge variant="outline">{caseData.jurisdiction}</Badge>
            {isOverdue && (
              <Badge variant="destructive">
                <AlertTriangle className="mr-1 h-3 w-3" />
                Overdue
              </Badge>
            )}
            {hasDraftAward && (
              <Badge variant="outline" className="border-green-600 text-green-600">
                <CheckCircle className="mr-1 h-3 w-3" />
                Draft Award Ready
              </Badge>
            )}
            {hasIssuedAward && (
              <Badge variant="default" className="bg-green-600">
                <Gavel className="mr-1 h-3 w-3" />
                Award Issued
              </Badge>
            )}
          </div>
        </div>

        <div className="flex items-center gap-2">
          <Link href={`/arbitrator/cases/${caseData.id}/review`}>
            <Button variant="outline">
              <Eye className="mr-2 h-4 w-4" />
              Full Review
            </Button>
          </Link>
          {hasDraftAward && !hasIssuedAward && (
            <Link href={`/arbitrator/cases/${caseData.id}/award`}>
              <Button>
                <Gavel className="mr-2 h-4 w-4" />
                Review Award
              </Button>
            </Link>
          )}
          {hasIssuedAward && (
            <Link href={`/api/cases/${caseData.id}/award/download`}>
              <Button variant="outline">
                <Download className="mr-2 h-4 w-4" />
                Download Award
              </Button>
            </Link>
          )}
        </div>
      </div>

      {/* Assignment Info */}
      <Card className={isOverdue ? 'border-destructive' : ''}>
        <CardHeader className="pb-3">
          <CardTitle className="flex items-center gap-2 text-lg">
            <Scale className="h-5 w-5" />
            Assignment Details
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="grid gap-4 md:grid-cols-4">
            <div>
              <span className="text-sm text-muted-foreground">Assigned</span>
              <p className="font-medium">
                {format(new Date(assignment.assignedAt), 'MMM d, yyyy')}
              </p>
            </div>
            <div>
              <span className="text-sm text-muted-foreground">Due By</span>
              <p className={`font-medium ${isOverdue ? 'text-destructive' : ''}`}>
                {assignment.dueBy
                  ? format(new Date(assignment.dueBy), 'MMM d, yyyy')
                  : 'No deadline'}
              </p>
            </div>
            <div>
              <span className="text-sm text-muted-foreground">Review Started</span>
              <p className="font-medium">
                {assignment.reviewStartedAt
                  ? format(new Date(assignment.reviewStartedAt), 'MMM d, yyyy')
                  : 'Not started'}
              </p>
            </div>
            <div>
              <span className="text-sm text-muted-foreground">Review Status</span>
              <p className="font-medium">
                {assignment.reviewCompletedAt
                  ? `Completed ${format(new Date(assignment.reviewCompletedAt), 'MMM d, yyyy')}`
                  : 'In Progress'}
              </p>
            </div>
          </div>
        </CardContent>
      </Card>

      <div className="grid gap-6 md:grid-cols-2">
        {/* Case Details */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <FileText className="h-5 w-5" />
              Case Details
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div>
              <span className="text-sm text-muted-foreground">Claim Amount</span>
              <p className="text-2xl font-bold">
                {formatCurrency(caseData.amount ? Number(caseData.amount) : null)}
              </p>
            </div>
            <div>
              <span className="text-sm text-muted-foreground">Filed</span>
              <p className="font-medium">{format(new Date(caseData.createdAt), 'MMMM d, yyyy')}</p>
            </div>
            <div>
              <span className="text-sm text-muted-foreground">Case Status</span>
              <p className="font-medium">{caseData.status.replace(/_/g, ' ')}</p>
            </div>
            <div>
              <span className="text-sm text-muted-foreground">Description</span>
              <p className="mt-1 line-clamp-4 whitespace-pre-wrap text-sm">
                {caseData.description}
              </p>
            </div>
          </CardContent>
        </Card>

        {/* Parties */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Users className="h-5 w-5" />
              Parties
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="rounded-lg border p-3">
              <span className="text-xs uppercase tracking-wide text-muted-foreground">
                Claimant
              </span>
              <p className="mt-1 font-medium">{caseData.claimant?.name || 'Unknown'}</p>
              <p className="text-sm text-muted-foreground">{caseData.claimant?.email}</p>
            </div>
            <div className="text-center text-sm text-muted-foreground">v.</div>
            <div className="rounded-lg border p-3">
              <span className="text-xs uppercase tracking-wide text-muted-foreground">
                Respondent
              </span>
              <p className="mt-1 font-medium">{caseData.respondent?.name || 'Unknown'}</p>
              <p className="text-sm text-muted-foreground">{caseData.respondent?.email}</p>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Analysis Summary */}
      {analysisJob && (
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Scale className="h-5 w-5" />
              AI Analysis Summary
            </CardTitle>
            <CardDescription>Automated analysis of case facts and legal issues</CardDescription>
          </CardHeader>
          <CardContent>
            <div className="grid gap-4 md:grid-cols-2">
              <div className="rounded-lg border p-4">
                <h4 className="mb-2 font-medium">Fact Analysis</h4>
                <div className="space-y-2 text-sm">
                  <p>
                    <span className="text-muted-foreground">Status: </span>
                    <Badge variant={analysisJob.status === 'COMPLETED' ? 'default' : 'secondary'}>
                      {analysisJob.status}
                    </Badge>
                  </p>
                  {analysisJob.completedAt && (
                    <p className="text-muted-foreground">
                      Completed: {format(new Date(analysisJob.completedAt), 'MMM d, yyyy')}
                    </p>
                  )}
                </div>
              </div>
              <div className="rounded-lg border p-4">
                <h4 className="mb-2 font-medium">Legal Analysis</h4>
                <div className="space-y-2 text-sm">
                  <p>
                    <span className="text-muted-foreground">Status: </span>
                    <Badge
                      variant={
                        analysisJob.legalAnalysisStatus === 'COMPLETED' ? 'default' : 'secondary'
                      }
                    >
                      {analysisJob.legalAnalysisStatus || 'PENDING'}
                    </Badge>
                  </p>
                  {analysisJob.legalAnalysisCompletedAt && (
                    <p className="text-muted-foreground">
                      Completed:{' '}
                      {format(new Date(analysisJob.legalAnalysisCompletedAt), 'MMM d, yyyy')}
                    </p>
                  )}
                </div>
              </div>
            </div>
          </CardContent>
        </Card>
      )}

      {/* Draft Award Summary */}
      {caseData.draftAward && (
        <Card>
          <CardHeader>
            <div className="flex items-center justify-between">
              <div>
                <CardTitle className="flex items-center gap-2">
                  <Gavel className="h-5 w-5" />
                  Draft Award
                </CardTitle>
                <CardDescription>AI-generated award recommendation</CardDescription>
              </div>
              {getReviewStatusBadge(caseData.draftAward.reviewStatus)}
            </div>
          </CardHeader>
          <CardContent>
            <div className="mb-4 grid gap-4 md:grid-cols-3">
              <div className="rounded-lg border p-4 text-center">
                <span className="text-sm text-muted-foreground">Recommended Award</span>
                <p className="mt-1 text-2xl font-bold">
                  {formatCurrency(
                    caseData.draftAward.awardAmount ? Number(caseData.draftAward.awardAmount) : null
                  )}
                </p>
              </div>
              <div className="rounded-lg border p-4 text-center">
                <span className="text-sm text-muted-foreground">Prevailing Party</span>
                <p className="mt-1 text-lg font-medium capitalize">
                  {caseData.draftAward.prevailingParty?.toLowerCase() || 'N/A'}
                </p>
              </div>
              <div className="rounded-lg border p-4 text-center">
                <span className="text-sm text-muted-foreground">AI Confidence</span>
                <p className="mt-1 text-lg font-medium">
                  {caseData.draftAward.confidence
                    ? `${Math.round(caseData.draftAward.confidence * 100)}%`
                    : 'N/A'}
                </p>
              </div>
            </div>

            <div className="border-t pt-4">
              <h4 className="mb-2 font-medium">Reasoning Summary</h4>
              <p className="line-clamp-3 text-sm text-muted-foreground">
                {caseData.draftAward.reasoning || 'No reasoning provided'}
              </p>
            </div>

            <div className="mt-4 flex justify-end">
              <Link href={`/arbitrator/cases/${caseData.id}/award`}>
                <Button>
                  Review Full Award
                  <ChevronRight className="ml-2 h-4 w-4" />
                </Button>
              </Link>
            </div>
          </CardContent>
        </Card>
      )}

      {/* Evidence Section */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <FileText className="h-5 w-5" />
            Evidence ({caseData.evidence.length})
          </CardTitle>
          <CardDescription>Documents and files submitted as evidence</CardDescription>
        </CardHeader>
        <CardContent>
          {caseData.evidence.length === 0 ? (
            <p className="py-8 text-center text-sm text-muted-foreground">
              No evidence has been submitted.
            </p>
          ) : (
            <div className="divide-y">
              {caseData.evidence.map((ev) => (
                <div key={ev.id} className="flex items-center justify-between py-3">
                  <div className="flex items-center gap-3">
                    <FileText className="h-8 w-8 text-muted-foreground" />
                    <div>
                      <p className="font-medium">{ev.fileName}</p>
                      <div className="flex items-center gap-2 text-xs text-muted-foreground">
                        <span>
                          Submitted by{' '}
                          {ev.submittedById === caseData.claimantId ? 'Claimant' : 'Respondent'}
                        </span>
                        <span>|</span>
                        <span>{format(new Date(ev.submittedAt), 'MMM d, yyyy')}</span>
                        {ev.description && (
                          <>
                            <span>|</span>
                            <span>{ev.description}</span>
                          </>
                        )}
                      </div>
                    </div>
                  </div>
                  <div className="flex items-center gap-2">
                    <Badge variant="outline">{ev.fileType.split('/')[1] || ev.fileType}</Badge>
                    <Button variant="ghost" size="sm">
                      <Eye className="mr-1 h-4 w-4" />
                      View
                    </Button>
                  </div>
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>

      {/* Statements Section */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <MessageSquare className="h-5 w-5" />
            Party Statements ({caseData.statements.length})
          </CardTitle>
          <CardDescription>Written statements from both parties</CardDescription>
        </CardHeader>
        <CardContent>
          {caseData.statements.length === 0 ? (
            <p className="py-8 text-center text-sm text-muted-foreground">
              No statements have been submitted.
            </p>
          ) : (
            <div className="space-y-4">
              {caseData.statements.map((stmt) => (
                <div key={stmt.id} className="rounded-lg border p-4">
                  <div className="mb-2 flex items-center justify-between">
                    <div className="flex items-center gap-2">
                      <Badge variant="outline">
                        {stmt.submittedById === caseData.claimantId
                          ? "Claimant's Statement"
                          : "Respondent's Statement"}
                      </Badge>
                      {stmt.type && <Badge variant="secondary">{stmt.type}</Badge>}
                    </div>
                    <span className="text-xs text-muted-foreground">
                      {format(new Date(stmt.submittedAt), 'MMM d, yyyy')}
                    </span>
                  </div>
                  <p className="line-clamp-6 whitespace-pre-wrap text-sm">{stmt.content}</p>
                  <Button variant="link" size="sm" className="mt-2 p-0">
                    Read full statement
                  </Button>
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>

      {/* Quick Actions */}
      {!hasIssuedAward && (
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Clock className="h-5 w-5" />
              Actions
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="flex flex-wrap gap-3">
              {hasDraftAward ? (
                <Link href={`/arbitrator/cases/${caseData.id}/award`}>
                  <Button>
                    <Gavel className="mr-2 h-4 w-4" />
                    Review & Finalize Award
                  </Button>
                </Link>
              ) : (
                <Button disabled variant="outline">
                  <Clock className="mr-2 h-4 w-4" />
                  Awaiting Draft Award Generation
                </Button>
              )}
            </div>
          </CardContent>
        </Card>
      )}
    </div>
  );
}
