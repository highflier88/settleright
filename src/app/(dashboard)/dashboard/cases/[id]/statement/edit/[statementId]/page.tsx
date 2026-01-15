import Link from 'next/link';
import { notFound, redirect } from 'next/navigation';

import { CaseStatus, StatementType } from '@prisma/client';
import { ArrowLeft } from 'lucide-react';

import { getAuthUser } from '@/lib/auth';
import { userHasAccessToCase, getCaseWithDetails } from '@/lib/services/case';
import { getStatementById, parseStatementContent } from '@/lib/services/statement';

import { StatementSubmissionForm } from '../../statement-form';

import type { Metadata } from 'next';

export const metadata: Metadata = {
  title: 'Edit Statement',
  description: 'Edit your statement',
};

interface PageProps {
  params: { id: string; statementId: string };
}

export default async function EditStatementPage({ params }: PageProps) {
  const user = await getAuthUser();

  if (!user) {
    redirect('/sign-in');
  }

  const access = await userHasAccessToCase(user.id, params.id);
  if (!access.hasAccess) {
    notFound();
  }

  const [caseData, statement] = await Promise.all([
    getCaseWithDetails(params.id),
    getStatementById(params.statementId),
  ]);

  if (!caseData || !statement || statement.caseId !== params.id) {
    notFound();
  }

  // Verify ownership
  if (statement.submittedById !== user.id) {
    notFound();
  }

  // Verify case status allows editing
  if (caseData.status !== CaseStatus.EVIDENCE_SUBMISSION) {
    redirect(`/dashboard/cases/${params.id}/statement`);
  }

  const content = parseStatementContent(statement);
  const userRole = access.role as 'claimant' | 'respondent';

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="space-y-1">
        <div className="flex items-center gap-2">
          <Link
            href={`/dashboard/cases/${params.id}/statement`}
            className="text-muted-foreground hover:text-foreground"
          >
            <ArrowLeft className="h-4 w-4" />
          </Link>
          <h1 className="text-2xl font-bold tracking-tight">
            Edit {statement.type === StatementType.INITIAL ? 'Initial' : 'Rebuttal'} Statement
          </h1>
        </div>
        <p className="text-muted-foreground">
          Case {caseData.referenceNumber} - Version {statement.version}
        </p>
      </div>

      {/* Statement Form */}
      <StatementSubmissionForm
        caseId={params.id}
        caseReference={caseData.referenceNumber}
        userRole={userRole}
        type={statement.type}
        claimAmount={Number(caseData.amount)}
        existingContent={{
          narrative: content.narrative,
          timeline: content.timeline,
          claimItems: content.claimItems,
        }}
        statementId={statement.id}
      />
    </div>
  );
}
