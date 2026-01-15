import Link from 'next/link';
import { notFound, redirect } from 'next/navigation';

import { UserRole } from '@prisma/client';
import { ArrowLeft } from 'lucide-react';

import { getAuthUser } from '@/lib/auth';
import { prisma } from '@/lib/db';
import type { AnalysisJob, DraftAward, Evidence, Statement } from '@/types/shared';

import { ReviewTabs } from './review-tabs';

import type { Metadata } from 'next';

type EvidenceWithSubmitter = Evidence & {
  submittedBy: { id: string; name: string | null };
};

type StatementWithSubmitter = Statement & {
  submittedBy: { id: string; name: string | null };
};

export const metadata: Metadata = {
  title: 'Case Review',
  description: 'Comprehensive case review interface for arbitrators',
};

interface PageProps {
  params: { id: string };
}

async function getCaseForReview(caseId: string, userId: string) {
  // Verify arbitrator assignment
  const assignment = await prisma.arbitratorAssignment.findFirst({
    where: {
      caseId,
      arbitratorId: userId,
    },
  });

  if (!assignment) return null;

  // Get comprehensive case data
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
        where: { deletedAt: null },
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

export default async function CaseReviewPage({ params }: PageProps) {
  const user = await getAuthUser();
  if (!user) return redirect('/sign-in');

  if (user.role !== UserRole.ARBITRATOR && user.role !== UserRole.ADMIN) {
    return redirect('/dashboard');
  }

  const result = await getCaseForReview(params.id, user.id);

  if (!result) {
    notFound();
  }

  const { assignment: _assignment, caseData } = result;

  // Separate evidence by party
  const claimantEvidence = caseData.evidence.filter((e) => e.submittedById === caseData.claimantId);
  const respondentEvidence = caseData.evidence.filter(
    (e) => e.submittedById === caseData.respondentId
  );

  // Separate statements by party
  const claimantStatement = caseData.statements.find(
    (s) => s.submittedById === caseData.claimantId
  );
  const respondentStatement = caseData.statements.find(
    (s) => s.submittedById === caseData.respondentId
  );

  return (
    <div className="space-y-4">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <Link
            href={`/arbitrator/cases/${caseData.id}`}
            className="text-muted-foreground hover:text-foreground"
          >
            <ArrowLeft className="h-4 w-4" />
          </Link>
          <div>
            <h1 className="text-2xl font-bold tracking-tight">
              Case Review - {caseData.referenceNumber}
            </h1>
            <p className="text-sm text-muted-foreground">
              {caseData.claimant?.name || 'Claimant'} v. {caseData.respondent?.name || 'Respondent'}
            </p>
          </div>
        </div>
      </div>

      {/* Review Tabs */}
      <ReviewTabs
        caseId={caseData.id}
        caseData={{
          id: caseData.id,
          referenceNumber: caseData.referenceNumber,
          status: caseData.status,
          disputeType: caseData.disputeType,
          jurisdiction: caseData.jurisdiction,
          amount: caseData.amount ? Number(caseData.amount) : null,
          description: caseData.description,
          claimant: caseData.claimant,
          respondent: caseData.respondent,
          claimantId: caseData.claimantId,
          respondentId: caseData.respondentId,
        }}
        claimantEvidence={JSON.parse(JSON.stringify(claimantEvidence)) as EvidenceWithSubmitter[]}
        respondentEvidence={JSON.parse(JSON.stringify(respondentEvidence)) as EvidenceWithSubmitter[]}
        claimantStatement={claimantStatement as StatementWithSubmitter | undefined}
        respondentStatement={respondentStatement as StatementWithSubmitter | undefined}
        draftAward={caseData.draftAward ? {
          ...JSON.parse(JSON.stringify(caseData.draftAward)),
          awardAmount: caseData.draftAward.awardAmount ? Number(caseData.draftAward.awardAmount) : null,
        } as DraftAward : null}
        analysisJob={caseData.analysisJob ? {
          ...JSON.parse(JSON.stringify(caseData.analysisJob)),
          estimatedCost: caseData.analysisJob.estimatedCost ? Number(caseData.analysisJob.estimatedCost) : null,
        } as AnalysisJob : null}
      />
    </div>
  );
}
