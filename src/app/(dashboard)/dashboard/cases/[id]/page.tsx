import Link from 'next/link';
import { notFound, redirect } from 'next/navigation';

import { format } from 'date-fns';
import {
  ArrowLeft,
  Clock,
  FileText,
  Users,
  Scale,
  CheckCircle,
  Mail,
  RefreshCw,
} from 'lucide-react';

import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { getAuthUser } from '@/lib/auth';
import {
  getCaseWithDetails,
  userHasAccessToCase,
  CASE_STATUS_LABELS,
  DISPUTE_TYPE_LABELS,
} from '@/lib/services/case';
import { getInvitationStatusLabel, getInvitationTimeRemaining } from '@/lib/services/invitation';
import type { CaseStatus } from '@/types/shared';

import { CaseActions } from './case-actions';

import type { Metadata } from 'next';

interface EvidenceItem {
  id: string;
  fileName: string;
  submittedById: string;
  submittedAt: Date;
}

interface StatementItem {
  id: string;
  content: string;
  submittedById: string;
  submittedAt: Date;
}

interface SignatureItem {
  id: string;
  role: string;
  signedAt: Date;
}

export const metadata: Metadata = {
  title: 'Case Details',
  description: 'View case details',
};

interface PageProps {
  params: { id: string };
}

const STATUS_COLORS: Record<CaseStatus, string> = {
  DRAFT: 'bg-gray-100 text-gray-800',
  PENDING_RESPONDENT: 'bg-amber-100 text-amber-800',
  PENDING_AGREEMENT: 'bg-amber-100 text-amber-800',
  EVIDENCE_SUBMISSION: 'bg-blue-100 text-blue-800',
  ANALYSIS_PENDING: 'bg-purple-100 text-purple-800',
  ANALYSIS_IN_PROGRESS: 'bg-purple-100 text-purple-800',
  ARBITRATOR_REVIEW: 'bg-indigo-100 text-indigo-800',
  DECIDED: 'bg-green-100 text-green-800',
  CLOSED: 'bg-gray-100 text-gray-800',
};

export default async function CaseDetailPage({ params }: PageProps) {
  const user = await getAuthUser();

  if (!user) {
    redirect('/sign-in');
  }

  const access = await userHasAccessToCase(user.id, params.id);
  if (!access.hasAccess) {
    notFound();
  }

  const caseData = await getCaseWithDetails(params.id);
  if (!caseData) {
    notFound();
  }

  const isClaimant = access.role === 'claimant';
  const _otherParty = isClaimant ? caseData.respondent : caseData.claimant;

  // Calculate invitation time remaining
  const invitationTimeRemaining = caseData.invitation
    ? getInvitationTimeRemaining(caseData.invitation.expiresAt)
    : null;

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-start justify-between">
        <div className="space-y-1">
          <div className="flex items-center gap-2">
            <Link href="/dashboard/cases" className="text-muted-foreground hover:text-foreground">
              <ArrowLeft className="h-4 w-4" />
            </Link>
            <h1 className="text-2xl font-bold tracking-tight">Case {caseData.referenceNumber}</h1>
          </div>
          <div className="flex items-center gap-2">
            <Badge className={STATUS_COLORS[caseData.status]}>
              {CASE_STATUS_LABELS[caseData.status]}
            </Badge>
            <Badge variant="outline">{DISPUTE_TYPE_LABELS[caseData.disputeType]}</Badge>
            <Badge variant={isClaimant ? 'default' : 'secondary'}>
              You are the {isClaimant ? 'Claimant' : 'Respondent'}
            </Badge>
          </div>
        </div>

        <CaseActions
          caseId={caseData.id}
          status={caseData.status}
          isClaimant={isClaimant}
          hasInvitation={!!caseData.invitation}
          invitationStatus={caseData.invitation?.status}
        />
      </div>

      {/* Status Timeline/Progress */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Scale className="h-5 w-5" />
            Case Progress
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="flex justify-between">
            {[
              { status: 'PENDING_RESPONDENT', label: 'Invitation', icon: Mail },
              { status: 'PENDING_AGREEMENT', label: 'Agreement', icon: FileText },
              { status: 'EVIDENCE_SUBMISSION', label: 'Evidence', icon: FileText },
              { status: 'ANALYSIS_IN_PROGRESS', label: 'Analysis', icon: Scale },
              { status: 'DECIDED', label: 'Decision', icon: CheckCircle },
            ].map((step, index) => {
              const statusOrder = [
                'DRAFT',
                'PENDING_RESPONDENT',
                'PENDING_AGREEMENT',
                'EVIDENCE_SUBMISSION',
                'ANALYSIS_PENDING',
                'ANALYSIS_IN_PROGRESS',
                'ARBITRATOR_REVIEW',
                'DECIDED',
                'CLOSED',
              ];
              const currentIndex = statusOrder.indexOf(caseData.status);
              const stepIndex = statusOrder.indexOf(step.status);
              const isComplete = currentIndex >= stepIndex;
              const isCurrent = caseData.status === step.status;

              return (
                <div
                  key={step.status}
                  className={`flex flex-col items-center ${index < 4 ? 'flex-1' : ''}`}
                >
                  <div
                    className={`flex h-10 w-10 items-center justify-center rounded-full border-2 ${
                      isComplete
                        ? 'border-primary bg-primary text-primary-foreground'
                        : isCurrent
                          ? 'border-primary text-primary'
                          : 'border-muted text-muted-foreground'
                    }`}
                  >
                    <step.icon className="h-5 w-5" />
                  </div>
                  <span
                    className={`mt-2 text-xs font-medium ${
                      isComplete || isCurrent ? 'text-foreground' : 'text-muted-foreground'
                    }`}
                  >
                    {step.label}
                  </span>
                  {index < 4 && (
                    <div
                      className={`absolute mt-5 h-0.5 w-full ${
                        isComplete ? 'bg-primary' : 'bg-muted'
                      }`}
                      style={{ left: '50%', width: 'calc(100% - 2.5rem)' }}
                    />
                  )}
                </div>
              );
            })}
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
              <span className="text-sm text-muted-foreground">Jurisdiction</span>
              <p className="font-medium">{caseData.jurisdiction}</p>
            </div>
            <div>
              <span className="text-sm text-muted-foreground">Claim Amount</span>
              <p className="text-2xl font-bold">${Number(caseData.amount).toLocaleString()}</p>
            </div>
            <div>
              <span className="text-sm text-muted-foreground">Filed</span>
              <p className="font-medium">{format(new Date(caseData.createdAt), 'MMMM d, yyyy')}</p>
            </div>
            <div>
              <span className="text-sm text-muted-foreground">Description</span>
              <p className="mt-1 whitespace-pre-wrap text-sm">{caseData.description}</p>
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
            <div>
              <span className="text-sm text-muted-foreground">Claimant</span>
              <p className="font-medium">
                {caseData.claimant.name ?? caseData.claimant.email}
                {isClaimant && ' (You)'}
              </p>
              <p className="text-sm text-muted-foreground">{caseData.claimant.email}</p>
            </div>

            <div>
              <span className="text-sm text-muted-foreground">Respondent</span>
              {caseData.respondent ? (
                <>
                  <p className="font-medium">
                    {caseData.respondent.name ?? caseData.respondent.email}
                    {!isClaimant && ' (You)'}
                  </p>
                  <p className="text-sm text-muted-foreground">{caseData.respondent.email}</p>
                </>
              ) : caseData.invitation ? (
                <div className="mt-2 rounded-lg border border-amber-200 bg-amber-50 p-3 dark:border-amber-900 dark:bg-amber-950">
                  <div className="flex items-center gap-2">
                    <Clock className="h-4 w-4 text-amber-600" />
                    <span className="font-medium text-amber-800 dark:text-amber-200">
                      Invitation {getInvitationStatusLabel(caseData.invitation.status)}
                    </span>
                  </div>
                  <p className="mt-1 text-sm text-amber-700 dark:text-amber-300">
                    Sent to: {caseData.invitation.email}
                  </p>
                  {invitationTimeRemaining && !invitationTimeRemaining.isExpired && (
                    <p className="mt-1 text-xs text-amber-600 dark:text-amber-400">
                      Expires in {invitationTimeRemaining.daysRemaining} days
                    </p>
                  )}
                  {isClaimant && caseData.invitation.status !== 'ACCEPTED' && (
                    <Button
                      variant="outline"
                      size="sm"
                      className="mt-2"
                      onClick={() => {
                        // This would trigger a resend - handled by CaseActions
                      }}
                    >
                      <RefreshCw className="mr-1 h-3 w-3" />
                      Resend Invitation
                    </Button>
                  )}
                </div>
              ) : (
                <p className="text-muted-foreground">Not yet assigned</p>
              )}
            </div>
          </CardContent>
        </Card>

        {/* Deadlines */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Clock className="h-5 w-5" />
              Deadlines
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            {caseData.responseDeadline && (
              <div className="flex items-center justify-between">
                <div>
                  <span className="text-sm text-muted-foreground">Response Deadline</span>
                  <p className="font-medium">
                    {format(new Date(caseData.responseDeadline), 'MMMM d, yyyy')}
                  </p>
                </div>
                {new Date(caseData.responseDeadline) < new Date() && (
                  <Badge variant="destructive">Overdue</Badge>
                )}
              </div>
            )}

            {caseData.evidenceDeadline && (
              <div className="flex items-center justify-between">
                <div>
                  <span className="text-sm text-muted-foreground">Evidence Deadline</span>
                  <p className="font-medium">
                    {format(new Date(caseData.evidenceDeadline), 'MMMM d, yyyy')}
                  </p>
                </div>
                {new Date(caseData.evidenceDeadline) < new Date() && (
                  <Badge variant="destructive">Overdue</Badge>
                )}
              </div>
            )}

            {caseData.rebuttalDeadline && (
              <div className="flex items-center justify-between">
                <div>
                  <span className="text-sm text-muted-foreground">Rebuttal Deadline</span>
                  <p className="font-medium">
                    {format(new Date(caseData.rebuttalDeadline), 'MMMM d, yyyy')}
                  </p>
                </div>
                {new Date(caseData.rebuttalDeadline) < new Date() && (
                  <Badge variant="destructive">Overdue</Badge>
                )}
              </div>
            )}

            {!caseData.responseDeadline &&
              !caseData.evidenceDeadline &&
              !caseData.rebuttalDeadline && (
                <p className="text-sm text-muted-foreground">No active deadlines</p>
              )}
          </CardContent>
        </Card>

        {/* Agreement Status */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <FileText className="h-5 w-5" />
              Submission Agreement
            </CardTitle>
          </CardHeader>
          <CardContent>
            {caseData.agreement ? (
              <div className="space-y-3">
                <div className="flex items-center justify-between">
                  <span className="text-sm text-muted-foreground">Status</span>
                  <Badge
                    variant={caseData.agreement.status === 'COMPLETE' ? 'default' : 'secondary'}
                  >
                    {caseData.agreement.status === 'COMPLETE'
                      ? 'Signed by Both Parties'
                      : caseData.agreement.status === 'PENDING_CLAIMANT'
                        ? 'Awaiting Claimant Signature'
                        : 'Awaiting Respondent Signature'}
                  </Badge>
                </div>

                {(caseData.agreement.signatures as SignatureItem[]).map((sig) => (
                  <div key={sig.id} className="flex items-center gap-2 text-sm">
                    <CheckCircle className="h-4 w-4 text-green-600" />
                    <span>
                      {sig.role === 'CLAIMANT' ? 'Claimant' : 'Respondent'} signed on{' '}
                      {format(new Date(sig.signedAt), 'MMM d, yyyy')}
                    </span>
                  </div>
                ))}

                {caseData.agreement.status !== 'COMPLETE' && (
                  <Button asChild className="mt-4 w-full">
                    <Link href={`/dashboard/cases/${caseData.id}/agreement`}>
                      Review & Sign Agreement
                    </Link>
                  </Button>
                )}
              </div>
            ) : (
              <p className="text-sm text-muted-foreground">
                Agreement will be available once the respondent joins the case.
              </p>
            )}
          </CardContent>
        </Card>
      </div>

      {/* Evidence Section */}
      <Card>
        <CardHeader className="flex flex-row items-center justify-between">
          <div>
            <CardTitle>Evidence</CardTitle>
            <CardDescription>Documents and files submitted as evidence</CardDescription>
          </div>
          {caseData.status === 'EVIDENCE_SUBMISSION' && (
            <Button asChild>
              <Link href={`/dashboard/cases/${caseData.id}/evidence/upload`}>Upload Evidence</Link>
            </Button>
          )}
        </CardHeader>
        <CardContent>
          {caseData.evidence.length === 0 ? (
            <p className="py-8 text-center text-sm text-muted-foreground">
              No evidence has been submitted yet.
            </p>
          ) : (
            <div className="divide-y">
              {(caseData.evidence as EvidenceItem[]).map((ev) => (
                <div key={ev.id} className="flex items-center justify-between py-3">
                  <div className="flex items-center gap-3">
                    <FileText className="h-8 w-8 text-muted-foreground" />
                    <div>
                      <p className="font-medium">{ev.fileName}</p>
                      <p className="text-xs text-muted-foreground">
                        Uploaded by {ev.submittedById === user.id ? 'you' : 'other party'} on{' '}
                        {format(new Date(ev.submittedAt), 'MMM d, yyyy')}
                      </p>
                    </div>
                  </div>
                  <Button variant="ghost" size="sm">
                    View
                  </Button>
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>

      {/* Statements Section */}
      <Card>
        <CardHeader className="flex flex-row items-center justify-between">
          <div>
            <CardTitle>Statements</CardTitle>
            <CardDescription>Written statements from both parties</CardDescription>
          </div>
          {caseData.status === 'EVIDENCE_SUBMISSION' && (
            <Button asChild>
              <Link href={`/dashboard/cases/${caseData.id}/statement`}>Submit Statement</Link>
            </Button>
          )}
        </CardHeader>
        <CardContent>
          {caseData.statements.length === 0 ? (
            <p className="py-8 text-center text-sm text-muted-foreground">
              No statements have been submitted yet.
            </p>
          ) : (
            <div className="space-y-4">
              {(caseData.statements as StatementItem[]).map((stmt) => (
                <div key={stmt.id} className="rounded-lg border p-4">
                  <div className="mb-2 flex items-center justify-between">
                    <Badge variant="outline">
                      {stmt.submittedById === caseData.claimantId
                        ? "Claimant's Statement"
                        : "Respondent's Statement"}
                    </Badge>
                    <span className="text-xs text-muted-foreground">
                      {format(new Date(stmt.submittedAt), 'MMM d, yyyy')}
                    </span>
                  </div>
                  <p className="line-clamp-4 whitespace-pre-wrap text-sm">{stmt.content}</p>
                  <Button variant="link" size="sm" className="mt-2 p-0">
                    Read full statement
                  </Button>
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
