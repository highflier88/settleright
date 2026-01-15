import { notFound } from 'next/navigation';

import { format } from 'date-fns';
import { Scale, Clock, FileText, AlertTriangle } from 'lucide-react';

import { Badge } from '@/components/ui/badge';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { getAuthUser } from '@/lib/auth';
import { DISPUTE_TYPE_LABELS } from '@/lib/services/case';
import {
  getInvitationByToken,
  getInvitationTimeRemaining,
  getInvitationStatusLabel,
} from '@/lib/services/invitation';

import { InvitationActions } from './invitation-actions';

import type { Metadata } from 'next';

// Local type for invitation data
type InvitationStatus = 'PENDING' | 'VIEWED' | 'ACCEPTED' | 'EXPIRED' | 'CANCELLED';
type DisputeType = 'CONTRACT' | 'PAYMENT' | 'SERVICE' | 'GOODS' | 'OTHER';

interface InvitationData {
  id: string;
  status: InvitationStatus;
  email: string;
  name: string | null;
  expiresAt: Date;
  viewedAt: Date | null;
  case: {
    id: string;
    referenceNumber: string;
    disputeType: DisputeType;
    jurisdiction: string;
    description: string;
    amount: unknown;
    responseDeadline: Date | null;
    createdAt: Date;
    claimant: {
      id: string;
      name: string | null;
      email: string;
    };
  };
}

export const metadata: Metadata = {
  title: "You've Been Invited to Respond",
  description: 'Review and respond to an arbitration case',
};

interface PageProps {
  params: { token: string };
}

export default async function InvitationPage({ params }: PageProps) {
  const invitationResult = await getInvitationByToken(params.token);

  if (!invitationResult) {
    notFound();
  }

  const invitation = invitationResult as unknown as InvitationData;
  const user = await getAuthUser();
  const timeRemaining = getInvitationTimeRemaining(invitation.expiresAt);

  const isExpired = timeRemaining.isExpired || invitation.status === 'EXPIRED';
  const isAccepted = invitation.status === 'ACCEPTED';
  const isCancelled = invitation.status === 'CANCELLED';

  const isLoggedIn = !!user;
  const isCorrectEmail = user?.email === invitation.email;

  return (
    <div className="min-h-screen bg-gradient-to-b from-background to-muted/20">
      <div className="mx-auto max-w-2xl px-4 py-12">
        {/* Header */}
        <div className="mb-8 text-center">
          <Scale className="mx-auto mb-4 h-16 w-16 text-primary" />
          <h1 className="text-3xl font-bold tracking-tight">You&apos;ve Been Invited to Respond</h1>
          <p className="mt-2 text-muted-foreground">
            {invitation.case.claimant.name ?? 'Someone'} has filed a dispute and invited you to
            respond.
          </p>
        </div>

        {/* Status Banner */}
        {isExpired && (
          <Card className="mb-6 border-destructive bg-destructive/10">
            <CardContent className="flex items-center gap-3 py-4">
              <AlertTriangle className="h-5 w-5 text-destructive" />
              <p className="font-medium text-destructive">
                This invitation has expired. Please contact the claimant for a new invitation.
              </p>
            </CardContent>
          </Card>
        )}

        {isAccepted && (
          <Card className="mb-6 border-green-500 bg-green-500/10">
            <CardContent className="flex items-center gap-3 py-4">
              <Scale className="h-5 w-5 text-green-600" />
              <p className="font-medium text-green-700 dark:text-green-400">
                You&apos;ve already accepted this invitation. View the case in your dashboard.
              </p>
            </CardContent>
          </Card>
        )}

        {isCancelled && (
          <Card className="mb-6 border-amber-500 bg-amber-500/10">
            <CardContent className="flex items-center gap-3 py-4">
              <AlertTriangle className="h-5 w-5 text-amber-600" />
              <p className="font-medium text-amber-700 dark:text-amber-400">
                This invitation has been cancelled by the claimant.
              </p>
            </CardContent>
          </Card>
        )}

        {/* Case Summary Card */}
        <Card className="mb-6">
          <CardHeader>
            <div className="flex items-center justify-between">
              <CardTitle>Case Summary</CardTitle>
              <Badge variant="outline">{invitation.case.referenceNumber}</Badge>
            </div>
            <CardDescription>Review the details of the dispute before responding</CardDescription>
          </CardHeader>
          <CardContent className="space-y-6">
            <div className="grid gap-4 md:grid-cols-2">
              <div>
                <span className="text-sm text-muted-foreground">Dispute Type</span>
                <p className="font-medium">{DISPUTE_TYPE_LABELS[invitation.case.disputeType]}</p>
              </div>
              <div>
                <span className="text-sm text-muted-foreground">Jurisdiction</span>
                <p className="font-medium">{invitation.case.jurisdiction}</p>
              </div>
              <div>
                <span className="text-sm text-muted-foreground">Claim Amount</span>
                <p className="text-2xl font-bold text-primary">
                  ${Number(invitation.case.amount).toLocaleString()}
                </p>
              </div>
              <div>
                <span className="text-sm text-muted-foreground">Filed By</span>
                <p className="font-medium">
                  {invitation.case.claimant.name ?? invitation.case.claimant.email}
                </p>
              </div>
            </div>

            <div>
              <span className="text-sm text-muted-foreground">Description</span>
              <p className="mt-1 whitespace-pre-wrap rounded-lg bg-muted/50 p-4 text-sm">
                {invitation.case.description}
              </p>
            </div>

            <div className="flex items-center justify-between border-t pt-4">
              <div className="flex items-center gap-2 text-sm">
                <Clock className="h-4 w-4 text-muted-foreground" />
                <span className="text-muted-foreground">Filed on</span>
                <span>{format(new Date(invitation.case.createdAt), 'MMMM d, yyyy')}</span>
              </div>
              {invitation.case.responseDeadline && (
                <div className="flex items-center gap-2 text-sm text-amber-600">
                  <AlertTriangle className="h-4 w-4" />
                  <span>
                    Response due by{' '}
                    {format(new Date(invitation.case.responseDeadline), 'MMMM d, yyyy')}
                  </span>
                </div>
              )}
            </div>
          </CardContent>
        </Card>

        {/* Invitation Details */}
        <Card className="mb-6">
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <FileText className="h-5 w-5" />
              Invitation Details
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="flex items-center justify-between">
              <span className="text-sm text-muted-foreground">Status</span>
              <Badge variant={isExpired ? 'destructive' : isAccepted ? 'default' : 'secondary'}>
                {getInvitationStatusLabel(invitation.status)}
              </Badge>
            </div>
            <div className="flex items-center justify-between">
              <span className="text-sm text-muted-foreground">Sent to</span>
              <span className="font-medium">{invitation.email}</span>
            </div>
            {!isExpired && !isAccepted && !isCancelled && (
              <div className="flex items-center justify-between">
                <span className="text-sm text-muted-foreground">Time remaining</span>
                <span className="font-medium text-amber-600">
                  {timeRemaining.daysRemaining} days, {timeRemaining.hoursRemaining} hours
                </span>
              </div>
            )}
          </CardContent>
        </Card>

        {/* Actions */}
        {!isExpired && !isAccepted && !isCancelled && (
          <InvitationActions
            token={params.token}
            invitationEmail={invitation.email}
            isLoggedIn={isLoggedIn}
            isCorrectEmail={isCorrectEmail}
            userEmail={user?.email}
          />
        )}

        {/* What Happens Next */}
        <Card className="mt-6">
          <CardHeader>
            <CardTitle>What Happens Next?</CardTitle>
          </CardHeader>
          <CardContent>
            <ol className="list-inside list-decimal space-y-3 text-sm text-muted-foreground">
              <li>
                <strong className="text-foreground">Accept the Invitation</strong> - Create an
                account or log in with the email address the invitation was sent to.
              </li>
              <li>
                <strong className="text-foreground">Verify Your Identity</strong> - Complete a quick
                identity verification to ensure the enforceability of the arbitration.
              </li>
              <li>
                <strong className="text-foreground">Sign the Submission Agreement</strong> - Both
                parties must agree to binding arbitration before proceeding.
              </li>
              <li>
                <strong className="text-foreground">Submit Your Response</strong> - Present your
                side of the dispute, upload evidence, and submit your statement.
              </li>
              <li>
                <strong className="text-foreground">Receive the Decision</strong> - An AI analysis
                reviewed by a human arbitrator will issue a binding decision.
              </li>
            </ol>
          </CardContent>
        </Card>

        {/* Footer */}
        <div className="mt-8 text-center text-sm text-muted-foreground">
          <p>
            Settleright.ai provides binding online arbitration services.{' '}
            <a href="/legal/procedural-rules" className="text-primary hover:underline">
              View our Procedural Rules
            </a>
          </p>
        </div>
      </div>
    </div>
  );
}
