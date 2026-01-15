import { notFound, redirect } from 'next/navigation';
import Link from 'next/link';
import { ArrowLeft, FileText, Edit, Clock, CheckCircle } from 'lucide-react';

import { getAuthUser } from '@/lib/auth';
import { userHasAccessToCase, getCaseWithDetails } from '@/lib/services/case';
import { getCaseStatements, canSubmitStatement, parseStatementContent, getStatementStatusInfo } from '@/lib/services/statement';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { StatementSubmissionForm } from './statement-form';

import type { Metadata } from 'next';
import { CaseStatus, StatementType } from '@prisma/client';

export const metadata: Metadata = {
  title: 'Statement',
  description: 'View and submit your statement for this case',
};

interface PageProps {
  params: { id: string };
}

export default async function StatementPage({ params }: PageProps) {
  const user = await getAuthUser();

  if (!user) {
    redirect('/sign-in');
  }

  const access = await userHasAccessToCase(user.id, params.id);
  if (!access.hasAccess) {
    notFound();
  }

  const [caseData, statements] = await Promise.all([
    getCaseWithDetails(params.id),
    getCaseStatements(params.id, user.id),
  ]);

  if (!caseData) {
    notFound();
  }

  const userRole = access.role as 'claimant' | 'respondent';

  // Get user's statements
  const userStatements = statements.filter((s) => s.submittedById === user.id);
  const initialStatement = userStatements.find((s) => s.type === StatementType.INITIAL);
  const rebuttalStatement = userStatements.find((s) => s.type === StatementType.REBUTTAL);

  // Other party's statements
  const otherStatements = statements.filter((s) => s.submittedById !== user.id);
  const otherInitial = otherStatements.find((s) => s.type === StatementType.INITIAL);
  const otherRebuttal = otherStatements.find((s) => s.type === StatementType.REBUTTAL);

  // Check submission eligibility
  const [canSubmitInitial, canSubmitRebuttal] = await Promise.all([
    canSubmitStatement(params.id, user.id, StatementType.INITIAL),
    canSubmitStatement(params.id, user.id, StatementType.REBUTTAL),
  ]);

  const _statusInfo = getStatementStatusInfo(statements, user.id, userRole);

  // Determine if we should show the submission form
  const showInitialForm = canSubmitInitial.canSubmit;
  const showRebuttalForm = canSubmitRebuttal.canSubmit && !showInitialForm;
  const canSubmitAny = showInitialForm || showRebuttalForm;

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-start justify-between">
        <div className="space-y-1">
          <div className="flex items-center gap-2">
            <Link
              href={`/dashboard/cases/${params.id}`}
              className="text-muted-foreground hover:text-foreground"
            >
              <ArrowLeft className="h-4 w-4" />
            </Link>
            <h1 className="text-2xl font-bold tracking-tight">Statement</h1>
          </div>
          <p className="text-muted-foreground">
            Case {caseData.referenceNumber}
          </p>
        </div>
      </div>

      {/* Status Overview */}
      <div className="grid gap-4 md:grid-cols-2">
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium">Your Statements</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-2">
              <div className="flex items-center justify-between">
                <span className="text-sm">Initial Statement</span>
                {initialStatement ? (
                  <Badge variant="default" className="bg-green-600">
                    <CheckCircle className="mr-1 h-3 w-3" />
                    Submitted (v{initialStatement.version})
                  </Badge>
                ) : canSubmitInitial.canSubmit ? (
                  <Badge variant="secondary">Pending</Badge>
                ) : (
                  <Badge variant="outline">Not Available</Badge>
                )}
              </div>
              <div className="flex items-center justify-between">
                <span className="text-sm">Rebuttal Statement</span>
                {rebuttalStatement ? (
                  <Badge variant="default" className="bg-green-600">
                    <CheckCircle className="mr-1 h-3 w-3" />
                    Submitted (v{rebuttalStatement.version})
                  </Badge>
                ) : canSubmitRebuttal.canSubmit ? (
                  <Badge variant="secondary">Available</Badge>
                ) : (
                  <Badge variant="outline">
                    {!initialStatement ? 'Submit initial first' : 'Not Available'}
                  </Badge>
                )}
              </div>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium">Other Party's Statements</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-2">
              <div className="flex items-center justify-between">
                <span className="text-sm">Initial Statement</span>
                {otherInitial ? (
                  <Badge variant="default">Submitted</Badge>
                ) : (
                  <Badge variant="outline">Not Yet Submitted</Badge>
                )}
              </div>
              <div className="flex items-center justify-between">
                <span className="text-sm">Rebuttal Statement</span>
                {otherRebuttal ? (
                  <Badge variant="default">Submitted</Badge>
                ) : (
                  <Badge variant="outline">Not Yet Submitted</Badge>
                )}
              </div>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Deadlines */}
      {(caseData.evidenceDeadline || caseData.rebuttalDeadline) && (
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium flex items-center gap-2">
              <Clock className="h-4 w-4" />
              Deadlines
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="grid gap-4 md:grid-cols-2">
              {caseData.evidenceDeadline && (
                <div>
                  <p className="text-sm font-medium">Initial Statement & Evidence</p>
                  <p className="text-sm text-muted-foreground">
                    {new Date(caseData.evidenceDeadline).toLocaleDateString()} at{' '}
                    {new Date(caseData.evidenceDeadline).toLocaleTimeString()}
                  </p>
                </div>
              )}
              {caseData.rebuttalDeadline && (
                <div>
                  <p className="text-sm font-medium">Rebuttal Statement</p>
                  <p className="text-sm text-muted-foreground">
                    {new Date(caseData.rebuttalDeadline).toLocaleDateString()} at{' '}
                    {new Date(caseData.rebuttalDeadline).toLocaleTimeString()}
                  </p>
                </div>
              )}
            </div>
          </CardContent>
        </Card>
      )}

      {/* Statement Submission Form */}
      {canSubmitAny && (
        <StatementSubmissionForm
          caseId={params.id}
          caseReference={caseData.referenceNumber}
          userRole={userRole}
          type={showInitialForm ? 'INITIAL' : 'REBUTTAL'}
          claimAmount={Number(caseData.amount)}
        />
      )}

      {/* Edit existing statements */}
      {initialStatement && (
        <Card>
          <CardHeader>
            <div className="flex items-center justify-between">
              <div>
                <CardTitle className="flex items-center gap-2">
                  <FileText className="h-5 w-5" />
                  Your Initial Statement
                </CardTitle>
                <CardDescription>
                  Version {initialStatement.version} - Last updated{' '}
                  {new Date(initialStatement.updatedAt).toLocaleDateString()}
                </CardDescription>
              </div>
              {canSubmitInitial.canSubmit === false &&
                caseData.status === CaseStatus.EVIDENCE_SUBMISSION && (
                <Button variant="outline" size="sm" asChild>
                  <Link href={`/dashboard/cases/${params.id}/statement/edit/${initialStatement.id}`}>
                    <Edit className="mr-2 h-4 w-4" />
                    Edit
                  </Link>
                </Button>
              )}
            </div>
          </CardHeader>
          <CardContent>
            <div className="prose prose-sm max-w-none dark:prose-invert">
              {parseStatementContent(initialStatement).narrative.substring(0, 500)}
              {parseStatementContent(initialStatement).narrative.length > 500 && '...'}
            </div>
            <Button variant="link" className="px-0 mt-2" asChild>
              <Link href={`/dashboard/cases/${params.id}/statement/view/${initialStatement.id}`}>
                View Full Statement
              </Link>
            </Button>
          </CardContent>
        </Card>
      )}

      {rebuttalStatement && (
        <Card>
          <CardHeader>
            <div className="flex items-center justify-between">
              <div>
                <CardTitle className="flex items-center gap-2">
                  <FileText className="h-5 w-5" />
                  Your Rebuttal Statement
                </CardTitle>
                <CardDescription>
                  Version {rebuttalStatement.version} - Last updated{' '}
                  {new Date(rebuttalStatement.updatedAt).toLocaleDateString()}
                </CardDescription>
              </div>
              {caseData.status === CaseStatus.EVIDENCE_SUBMISSION && (
                <Button variant="outline" size="sm" asChild>
                  <Link href={`/dashboard/cases/${params.id}/statement/edit/${rebuttalStatement.id}`}>
                    <Edit className="mr-2 h-4 w-4" />
                    Edit
                  </Link>
                </Button>
              )}
            </div>
          </CardHeader>
          <CardContent>
            <div className="prose prose-sm max-w-none dark:prose-invert">
              {parseStatementContent(rebuttalStatement).narrative.substring(0, 500)}
              {parseStatementContent(rebuttalStatement).narrative.length > 500 && '...'}
            </div>
            <Button variant="link" className="px-0 mt-2" asChild>
              <Link href={`/dashboard/cases/${params.id}/statement/view/${rebuttalStatement.id}`}>
                View Full Statement
              </Link>
            </Button>
          </CardContent>
        </Card>
      )}

      {/* Help Card */}
      <Card>
        <CardHeader>
          <CardTitle>Statement Guidelines</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4 text-sm text-muted-foreground">
          <p>
            <strong>Initial Statement:</strong> Present your position on the dispute,
            including the facts as you understand them, relevant timeline of events,
            and the specific claims or defenses you're making.
          </p>
          <p>
            <strong>Rebuttal Statement:</strong> After reviewing the other party's
            initial statement, you may submit a rebuttal to address their claims,
            clarify any misunderstandings, and provide additional context.
          </p>
          <p>
            <strong>Tips:</strong>
          </p>
          <ul className="list-disc pl-5 space-y-1">
            <li>Be clear and concise in your narrative</li>
            <li>Reference specific evidence you've uploaded</li>
            <li>Include a timeline of key events with dates</li>
            <li>Itemize your claims with specific amounts and categories</li>
            <li>Keep a professional tone throughout</li>
          </ul>
        </CardContent>
      </Card>
    </div>
  );
}
