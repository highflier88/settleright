import Link from 'next/link';
import { notFound, redirect } from 'next/navigation';

import { CaseStatus } from '@prisma/client';
import { ArrowLeft, Upload, FileText, Image as ImageIcon, Table } from 'lucide-react';

import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { getAuthUser } from '@/lib/auth';
import { userHasAccessToCase, getCaseWithDetails } from '@/lib/services/case';
import { getCaseEvidence, getEvidenceStats, formatFileSize } from '@/lib/services/evidence';

import { EvidenceList } from './evidence-list';

import type { Metadata } from 'next';


export const metadata: Metadata = {
  title: 'Evidence',
  description: 'View and manage case evidence',
};

interface PageProps {
  params: { id: string };
}

export default async function EvidencePage({ params }: PageProps) {
  const user = await getAuthUser();

  if (!user) {
    redirect('/sign-in');
  }

  const access = await userHasAccessToCase(user.id, params.id);
  if (!access.hasAccess) {
    notFound();
  }

  const [caseData, evidence, stats] = await Promise.all([
    getCaseWithDetails(params.id),
    getCaseEvidence(params.id, user.id),
    getEvidenceStats(params.id),
  ]);

  if (!caseData) {
    notFound();
  }

  const canUpload = caseData.status === CaseStatus.EVIDENCE_SUBMISSION;

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
            <h1 className="text-2xl font-bold tracking-tight">Evidence</h1>
          </div>
          <p className="text-muted-foreground">
            Case {caseData.referenceNumber}
          </p>
        </div>
        {canUpload && (
          <Button asChild>
            <Link href={`/dashboard/cases/${params.id}/evidence/upload`}>
              <Upload className="mr-2 h-4 w-4" />
              Upload Evidence
            </Link>
          </Button>
        )}
      </div>

      {/* Stats Cards */}
      <div className="grid gap-4 md:grid-cols-4">
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">
              Total Files
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{stats.totalFiles}</div>
            <p className="text-xs text-muted-foreground">
              {stats.remainingFiles} remaining
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">
              Total Size
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{formatFileSize(stats.totalSize)}</div>
            <p className="text-xs text-muted-foreground">
              {formatFileSize(stats.remainingSize)} remaining
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">
              Your Evidence
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">
              {access.role === 'claimant'
                ? stats.byParty.claimant.count
                : stats.byParty.respondent.count}
            </div>
            <p className="text-xs text-muted-foreground">
              {formatFileSize(
                access.role === 'claimant'
                  ? stats.byParty.claimant.size
                  : stats.byParty.respondent.size
              )}
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">
              Other Party
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">
              {access.role === 'claimant'
                ? stats.byParty.respondent.count
                : stats.byParty.claimant.count}
            </div>
            <p className="text-xs text-muted-foreground">
              {formatFileSize(
                access.role === 'claimant'
                  ? stats.byParty.respondent.size
                  : stats.byParty.claimant.size
              )}
            </p>
          </CardContent>
        </Card>
      </div>

      {/* Evidence List */}
      <EvidenceList
        caseId={params.id}
        evidence={evidence}
        userId={user.id}
        canDelete={canUpload}
      />

      {/* Help Card */}
      <Card>
        <CardHeader>
          <CardTitle>Evidence Guidelines</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="flex items-start gap-3">
            <FileText className="h-5 w-5 text-muted-foreground flex-shrink-0 mt-0.5" />
            <div>
              <p className="font-medium">Documents</p>
              <p className="text-sm text-muted-foreground">
                PDF, DOC, DOCX, TXT files for contracts, emails, receipts, and other written evidence.
              </p>
            </div>
          </div>
          <div className="flex items-start gap-3">
            <ImageIcon className="h-5 w-5 text-muted-foreground flex-shrink-0 mt-0.5" aria-hidden="true" />
            <div>
              <p className="font-medium">Images</p>
              <p className="text-sm text-muted-foreground">
                JPG, PNG, GIF, WEBP files for photos, screenshots, and visual evidence.
              </p>
            </div>
          </div>
          <div className="flex items-start gap-3">
            <Table className="h-5 w-5 text-muted-foreground flex-shrink-0 mt-0.5" />
            <div>
              <p className="font-medium">Spreadsheets</p>
              <p className="text-sm text-muted-foreground">
                XLS, XLSX, CSV files for financial records and data.
              </p>
            </div>
          </div>
          <p className="text-xs text-muted-foreground border-t pt-4 mt-4">
            Maximum file size: 25MB per file. Total limit: 100MB per case, 50 files maximum.
          </p>
        </CardContent>
      </Card>
    </div>
  );
}
