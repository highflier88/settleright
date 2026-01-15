import Link from 'next/link';
import { notFound, redirect } from 'next/navigation';
import { format } from 'date-fns';
import {
  ArrowLeft,
  Gavel,
  CheckCircle,
  FileText,
  Scale,
  AlertTriangle,
  Download,
  ExternalLink,
} from 'lucide-react';

import { getAuthUser } from '@/lib/auth';
import { prisma } from '@/lib/db';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from '@/components/ui/card';
import { UserRole } from '@prisma/client';
import { AwardReviewForm } from './award-review-form';

import type { Metadata } from 'next';
import type { FindingOfFact, AwardConclusionOfLaw } from '@/lib/award/types';

export const metadata: Metadata = {
  title: 'Review Award',
  description: 'Review and finalize arbitration award',
};

interface PageProps {
  params: { id: string };
}

async function getDraftAwardForReview(caseId: string, userId: string) {
  // Verify arbitrator assignment
  const assignment = await prisma.arbitratorAssignment.findFirst({
    where: {
      caseId,
      arbitratorId: userId,
    },
  });

  if (!assignment) {
    return null;
  }

  // Get the case with draft award
  const caseData = await prisma.case.findUnique({
    where: { id: caseId },
    include: {
      claimant: {
        select: { id: true, name: true, email: true },
      },
      respondent: {
        select: { id: true, name: true, email: true },
      },
      draftAward: true,
      award: true,
    },
  });

  return { assignment, caseData };
}

function formatCurrency(amount: number | null) {
  if (!amount) return 'N/A';
  return new Intl.NumberFormat('en-US', {
    style: 'currency',
    currency: 'USD',
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  }).format(amount);
}

function getReviewStatusBadge(status: string | null) {
  switch (status) {
    case 'APPROVE':
      return <Badge variant="default" className="bg-green-600">Approved</Badge>;
    case 'MODIFY':
      return <Badge variant="default" className="bg-blue-600">Modified</Badge>;
    case 'REJECT':
      return <Badge variant="destructive">Rejected</Badge>;
    case 'ESCALATE':
      return <Badge variant="default" className="bg-purple-600">Escalated</Badge>;
    default:
      return <Badge variant="outline">Pending Review</Badge>;
  }
}

export default async function AwardReviewPage({ params }: PageProps) {
  const user = await getAuthUser();
  if (!user) return redirect('/sign-in');

  // Ensure user is an arbitrator
  if (user.role !== UserRole.ARBITRATOR && user.role !== UserRole.ADMIN) {
    return redirect('/dashboard');
  }

  const result = await getDraftAwardForReview(params.id, user.id);

  if (!result || !result.caseData) {
    notFound();
  }

  const { assignment, caseData } = result;

  // If award already issued, show the issued award
  if (caseData.award) {
    return (
      <div className="space-y-6">
        <div className="flex items-center gap-2">
          <Link
            href={`/arbitrator/cases/${caseData.id}`}
            className="text-muted-foreground hover:text-foreground"
          >
            <ArrowLeft className="h-4 w-4" />
          </Link>
          <h1 className="text-2xl font-bold tracking-tight">
            Award Issued - {caseData.referenceNumber}
          </h1>
        </div>

        <Card>
          <CardHeader>
            <div className="flex items-center justify-between">
              <div>
                <CardTitle className="flex items-center gap-2">
                  <CheckCircle className="h-5 w-5 text-green-600" />
                  Award Has Been Issued
                </CardTitle>
                <CardDescription>
                  Reference: {caseData.award.referenceNumber}
                </CardDescription>
              </div>
              <Badge variant="default" className="bg-green-600">Final</Badge>
            </div>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="grid gap-4 md:grid-cols-3">
              <div className="rounded-lg border p-4 text-center">
                <span className="text-sm text-muted-foreground">Award Amount</span>
                <p className="text-2xl font-bold mt-1">
                  {formatCurrency(caseData.award.awardAmount ? Number(caseData.award.awardAmount) : null)}
                </p>
              </div>
              <div className="rounded-lg border p-4 text-center">
                <span className="text-sm text-muted-foreground">Prevailing Party</span>
                <p className="text-lg font-medium mt-1 capitalize">
                  {caseData.award.prevailingParty?.toLowerCase() || 'N/A'}
                </p>
              </div>
              <div className="rounded-lg border p-4 text-center">
                <span className="text-sm text-muted-foreground">Issued On</span>
                <p className="text-lg font-medium mt-1">
                  {caseData.award.issuedAt
                    ? format(new Date(caseData.award.issuedAt), 'MMM d, yyyy')
                    : 'N/A'}
                </p>
              </div>
            </div>

            <div className="flex justify-center pt-4">
              <a href={`/api/cases/${caseData.id}/award/download`} target="_blank" rel="noopener noreferrer">
                <Button>
                  <Download className="h-4 w-4 mr-2" />
                  Download Award PDF
                </Button>
              </a>
            </div>
          </CardContent>
        </Card>
      </div>
    );
  }

  // If no draft award, show waiting message
  if (!caseData.draftAward) {
    return (
      <div className="space-y-6">
        <div className="flex items-center gap-2">
          <Link
            href={`/arbitrator/cases/${caseData.id}`}
            className="text-muted-foreground hover:text-foreground"
          >
            <ArrowLeft className="h-4 w-4" />
          </Link>
          <h1 className="text-2xl font-bold tracking-tight">
            Award Review - {caseData.referenceNumber}
          </h1>
        </div>

        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <AlertTriangle className="h-5 w-5 text-amber-500" />
              No Draft Award Available
            </CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-muted-foreground">
              The AI-generated draft award has not been created yet. Please check back
              later or ensure the case analysis has been completed.
            </p>
            <Link href={`/arbitrator/cases/${caseData.id}`}>
              <Button variant="outline" className="mt-4">
                <ArrowLeft className="h-4 w-4 mr-2" />
                Back to Case
              </Button>
            </Link>
          </CardContent>
        </Card>
      </div>
    );
  }

  const draftAward = caseData.draftAward;
  const findingsOfFact = (draftAward.findingsOfFact as unknown as FindingOfFact[]) || [];
  const conclusionsOfLaw = (draftAward.conclusionsOfLaw as unknown as AwardConclusionOfLaw[]) || [];
  const isReviewed = !!draftAward.reviewStatus;
  const isApproved = draftAward.reviewStatus === 'APPROVE';

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-start justify-between">
        <div className="space-y-1">
          <div className="flex items-center gap-2">
            <Link
              href={`/arbitrator/cases/${caseData.id}`}
              className="text-muted-foreground hover:text-foreground"
            >
              <ArrowLeft className="h-4 w-4" />
            </Link>
            <h1 className="text-2xl font-bold tracking-tight">
              Award Review - {caseData.referenceNumber}
            </h1>
          </div>
          <div className="flex items-center gap-2">
            {getReviewStatusBadge(draftAward.reviewStatus)}
            <Badge variant="outline">
              Confidence: {Math.round((draftAward.confidence || 0) * 100)}%
            </Badge>
            {draftAward.citationsVerified && (
              <Badge variant="outline" className="text-green-600 border-green-600">
                <CheckCircle className="h-3 w-3 mr-1" />
                Citations Verified
              </Badge>
            )}
          </div>
        </div>
      </div>

      {/* Case Summary */}
      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="text-lg">Case Summary</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="grid gap-4 md:grid-cols-4">
            <div>
              <span className="text-sm text-muted-foreground">Claimant</span>
              <p className="font-medium">{caseData.claimant?.name || 'Unknown'}</p>
            </div>
            <div>
              <span className="text-sm text-muted-foreground">Respondent</span>
              <p className="font-medium">{caseData.respondent?.name || 'Unknown'}</p>
            </div>
            <div>
              <span className="text-sm text-muted-foreground">Claim Amount</span>
              <p className="font-medium">
                {formatCurrency(caseData.amount ? Number(caseData.amount) : null)}
              </p>
            </div>
            <div>
              <span className="text-sm text-muted-foreground">Jurisdiction</span>
              <p className="font-medium">{caseData.jurisdiction}</p>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Award Decision Summary */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Gavel className="h-5 w-5" />
            Award Recommendation
          </CardTitle>
          <CardDescription>
            AI-recommended decision based on case analysis
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div className="grid gap-4 md:grid-cols-3 mb-6">
            <div className="rounded-lg border-2 border-primary/20 bg-primary/5 p-4 text-center">
              <span className="text-sm text-muted-foreground">Recommended Award</span>
              <p className="text-3xl font-bold mt-1 text-primary">
                {formatCurrency(draftAward.awardAmount ? Number(draftAward.awardAmount) : null)}
              </p>
            </div>
            <div className="rounded-lg border p-4 text-center">
              <span className="text-sm text-muted-foreground">Prevailing Party</span>
              <p className="text-xl font-medium mt-1 capitalize">
                {draftAward.prevailingParty?.toLowerCase() || 'N/A'}
              </p>
            </div>
            <div className="rounded-lg border p-4 text-center">
              <span className="text-sm text-muted-foreground">Generated</span>
              <p className="text-lg font-medium mt-1">
                {format(new Date(draftAward.generatedAt), 'MMM d, yyyy')}
              </p>
            </div>
          </div>

          <div className="rounded-lg border p-4">
            <h4 className="font-medium mb-2">Decision Narrative</h4>
            <p className="text-sm whitespace-pre-wrap">{draftAward.decision}</p>
          </div>
        </CardContent>
      </Card>

      {/* Findings of Fact */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <FileText className="h-5 w-5" />
            Findings of Fact ({findingsOfFact.length})
          </CardTitle>
          <CardDescription>
            Factual determinations based on evidence and testimony
          </CardDescription>
        </CardHeader>
        <CardContent>
          {findingsOfFact.length === 0 ? (
            <p className="text-muted-foreground text-center py-8">
              No findings of fact available.
            </p>
          ) : (
            <div className="space-y-4">
              {findingsOfFact.map((finding, index) => (
                <div key={finding.id || index} className="rounded-lg border p-4">
                  <div className="flex items-start gap-3">
                    <span className="flex h-6 w-6 items-center justify-center rounded-full bg-primary/10 text-sm font-medium text-primary">
                      {finding.number || index + 1}
                    </span>
                    <div className="flex-1">
                      <p className="text-sm">{finding.finding}</p>
                      <div className="flex items-center gap-2 mt-2">
                        <Badge variant="outline" className="text-xs">
                          {finding.basis === 'undisputed'
                            ? 'Undisputed'
                            : finding.basis === 'proven'
                              ? 'Proven by Evidence'
                              : 'Credibility Determination'}
                        </Badge>
                        {finding.date && (
                          <span className="text-xs text-muted-foreground">
                            Date: {finding.date}
                          </span>
                        )}
                        {finding.amount && (
                          <span className="text-xs text-muted-foreground">
                            Amount: {formatCurrency(finding.amount)}
                          </span>
                        )}
                      </div>
                      {finding.credibilityNote && (
                        <p className="text-xs text-muted-foreground mt-2 italic">
                          {finding.credibilityNote}
                        </p>
                      )}
                    </div>
                  </div>
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>

      {/* Conclusions of Law */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Scale className="h-5 w-5" />
            Conclusions of Law ({conclusionsOfLaw.length})
          </CardTitle>
          <CardDescription>
            Legal conclusions based on applicable law
          </CardDescription>
        </CardHeader>
        <CardContent>
          {conclusionsOfLaw.length === 0 ? (
            <p className="text-muted-foreground text-center py-8">
              No conclusions of law available.
            </p>
          ) : (
            <div className="space-y-4">
              {conclusionsOfLaw.map((conclusion, index) => (
                <div key={conclusion.id || index} className="rounded-lg border p-4">
                  <div className="flex items-start gap-3">
                    <span className="flex h-6 w-6 items-center justify-center rounded-full bg-primary/10 text-sm font-medium text-primary">
                      {conclusion.number || index + 1}
                    </span>
                    <div className="flex-1">
                      <p className="font-medium text-sm mb-1">{conclusion.issue}</p>
                      <p className="text-sm">{conclusion.conclusion}</p>
                      {conclusion.legalBasis && conclusion.legalBasis.length > 0 && (
                        <div className="flex flex-wrap gap-1 mt-2">
                          {conclusion.legalBasis.map((citation, i) => (
                            <Badge key={i} variant="secondary" className="text-xs">
                              {citation}
                            </Badge>
                          ))}
                        </div>
                      )}
                      {conclusion.supportingFindings && conclusion.supportingFindings.length > 0 && (
                        <p className="text-xs text-muted-foreground mt-2">
                          Based on Findings: {conclusion.supportingFindings.join(', ')}
                        </p>
                      )}
                    </div>
                  </div>
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>

      {/* Reasoning */}
      <Card>
        <CardHeader>
          <CardTitle>Full Reasoning</CardTitle>
          <CardDescription>
            Complete reasoning for the award recommendation
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div className="prose prose-sm max-w-none">
            <p className="whitespace-pre-wrap">{draftAward.reasoning}</p>
          </div>
        </CardContent>
      </Card>

      {/* Review Form */}
      <AwardReviewForm
        caseId={caseData.id}
        draftAwardId={draftAward.id}
        currentStatus={draftAward.reviewStatus}
        currentNotes={draftAward.reviewNotes}
        isApproved={isApproved}
      />
    </div>
  );
}
