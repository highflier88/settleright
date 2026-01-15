import Link from 'next/link';
import { notFound, redirect } from 'next/navigation';

import { ArrowLeft, FileText, CheckCircle, Clock } from 'lucide-react';

import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { getAuthUser } from '@/lib/auth';
import {
  getAgreementForCase,
  getAgreementStatusInfo,
  generateAgreementContent,
} from '@/lib/services/agreement';
import { userHasAccessToCase } from '@/lib/services/case';

import { AgreementSigningForm } from './agreement-signing-form';

import type { Metadata } from 'next';

interface SignatureItem {
  id: string;
  userId: string;
}

export const metadata: Metadata = {
  title: 'Submission Agreement',
  description: 'Review and sign the submission agreement',
};

interface PageProps {
  params: { id: string };
}

export default async function AgreementPage({ params }: PageProps) {
  const user = await getAuthUser();

  if (!user) {
    redirect('/sign-in');
  }

  const access = await userHasAccessToCase(user.id, params.id);
  if (!access.hasAccess) {
    notFound();
  }

  const agreement = await getAgreementForCase(params.id);
  if (!agreement) {
    notFound();
  }

  const statusInfo = getAgreementStatusInfo(agreement);
  const isClaimant = access.role === 'claimant';
  const userHasSigned = (agreement.signatures as SignatureItem[]).some((s) => s.userId === user.id);

  // Generate agreement content
  const agreementContent = generateAgreementContent(
    {
      referenceNumber: agreement.case.referenceNumber,
      jurisdiction: agreement.case.jurisdiction,
      disputeType: agreement.case.disputeType,
      amount: Number(agreement.case.amount),
      description: agreement.case.description,
    },
    agreement.case.claimant,
    agreement.case.respondent!
  );

  return (
    <div className="mx-auto max-w-4xl space-y-6">
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
            <h1 className="text-2xl font-bold tracking-tight">Submission Agreement</h1>
          </div>
          <p className="text-muted-foreground">Case {agreement.case.referenceNumber}</p>
        </div>
        <Badge variant={statusInfo.isComplete ? 'default' : 'secondary'} className="text-sm">
          {statusInfo.label}
        </Badge>
      </div>

      {/* Status Card */}
      <Card className={statusInfo.isComplete ? 'border-green-500' : ''}>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            {statusInfo.isComplete ? (
              <CheckCircle className="h-5 w-5 text-green-600" />
            ) : (
              <Clock className="h-5 w-5 text-amber-600" />
            )}
            Agreement Status
          </CardTitle>
          <CardDescription>{statusInfo.description}</CardDescription>
        </CardHeader>
        <CardContent>
          <div className="flex gap-6">
            <div className="flex items-center gap-2">
              {statusInfo.claimantSigned ? (
                <CheckCircle className="h-4 w-4 text-green-600" />
              ) : (
                <Clock className="h-4 w-4 text-muted-foreground" />
              )}
              <span
                className={statusInfo.claimantSigned ? 'text-green-600' : 'text-muted-foreground'}
              >
                Claimant {statusInfo.claimantSigned ? 'Signed' : 'Pending'}
              </span>
            </div>
            <div className="flex items-center gap-2">
              {statusInfo.respondentSigned ? (
                <CheckCircle className="h-4 w-4 text-green-600" />
              ) : (
                <Clock className="h-4 w-4 text-muted-foreground" />
              )}
              <span
                className={statusInfo.respondentSigned ? 'text-green-600' : 'text-muted-foreground'}
              >
                Respondent {statusInfo.respondentSigned ? 'Signed' : 'Pending'}
              </span>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Agreement Document */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <FileText className="h-5 w-5" />
            Agreement Document
          </CardTitle>
          <CardDescription>
            Version {agreement.templateVersion} | Procedural Rules Version {agreement.rulesVersion}
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div className="max-h-[500px] overflow-y-auto whitespace-pre-wrap rounded-lg bg-muted/50 p-6 font-mono text-sm">
            {agreementContent}
          </div>
        </CardContent>
      </Card>

      {/* Signing Section */}
      {!statusInfo.isComplete && (
        <AgreementSigningForm
          caseId={params.id}
          caseReference={agreement.case.referenceNumber}
          userRole={isClaimant ? 'CLAIMANT' : 'RESPONDENT'}
          userHasSigned={userHasSigned}
        />
      )}

      {/* Already Complete */}
      {statusInfo.isComplete && (
        <Card className="border-green-500 bg-green-50 dark:bg-green-950">
          <CardContent className="py-6">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-3">
                <CheckCircle className="h-6 w-6 text-green-600" />
                <div>
                  <p className="font-medium text-green-800 dark:text-green-200">
                    Agreement Complete
                  </p>
                  <p className="text-sm text-green-700 dark:text-green-300">
                    Both parties have signed. You can now submit evidence.
                  </p>
                </div>
              </div>
              <Button asChild>
                <Link href={`/dashboard/cases/${params.id}/evidence/upload`}>Submit Evidence</Link>
              </Button>
            </div>
          </CardContent>
        </Card>
      )}

      {/* Legal Notice */}
      <Card>
        <CardContent className="py-4">
          <p className="text-xs text-muted-foreground">
            By signing this agreement, you acknowledge that you have read, understand, and agree to
            be bound by its terms. This agreement constitutes a legally binding contract for
            arbitration. If you have questions, please consult with a legal professional before
            signing.
          </p>
        </CardContent>
      </Card>
    </div>
  );
}
