import Link from 'next/link';
import { notFound, redirect } from 'next/navigation';

import { CaseStatus } from '@prisma/client';
import { ArrowLeft } from 'lucide-react';

import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { getAuthUser } from '@/lib/auth';
import { userHasAccessToCase, getCaseWithDetails } from '@/lib/services/case';
import {
  getEvidenceStats,
  formatFileSize,
  MAX_FILE_SIZE,
  MAX_TOTAL_SIZE_PER_CASE,
  MAX_FILES_PER_CASE,
  ALLOWED_FILE_TYPES,
} from '@/lib/services/evidence';

import { EvidenceUploadForm } from './evidence-upload-form';

import type { Metadata } from 'next';

export const metadata: Metadata = {
  title: 'Upload Evidence',
  description: 'Upload evidence files for your case',
};

interface PageProps {
  params: { id: string };
}

export default async function UploadEvidencePage({ params }: PageProps) {
  const user = await getAuthUser();

  if (!user) {
    redirect('/sign-in');
  }

  const access = await userHasAccessToCase(user.id, params.id);
  if (!access.hasAccess) {
    notFound();
  }

  const [caseData, stats] = await Promise.all([
    getCaseWithDetails(params.id),
    getEvidenceStats(params.id),
  ]);

  if (!caseData) {
    notFound();
  }

  // Check if uploads are allowed
  if (caseData.status !== CaseStatus.EVIDENCE_SUBMISSION) {
    redirect(`/dashboard/cases/${params.id}/evidence`);
  }

  const allowedExtensions = Object.values(ALLOWED_FILE_TYPES).map((t) => t.ext);

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="space-y-1">
        <div className="flex items-center gap-2">
          <Link
            href={`/dashboard/cases/${params.id}/evidence`}
            className="text-muted-foreground hover:text-foreground"
          >
            <ArrowLeft className="h-4 w-4" />
          </Link>
          <h1 className="text-2xl font-bold tracking-tight">Upload Evidence</h1>
        </div>
        <p className="text-muted-foreground">Case {caseData.referenceNumber}</p>
      </div>

      {/* Limits Info */}
      <Card>
        <CardHeader>
          <CardTitle>Upload Limits</CardTitle>
          <CardDescription>Current usage and remaining capacity for this case</CardDescription>
        </CardHeader>
        <CardContent>
          <div className="grid gap-4 md:grid-cols-3">
            <div>
              <p className="text-sm font-medium text-muted-foreground">Files</p>
              <p className="text-2xl font-bold">
                {stats.totalFiles} / {MAX_FILES_PER_CASE}
              </p>
              <p className="text-xs text-muted-foreground">{stats.remainingFiles} remaining</p>
            </div>
            <div>
              <p className="text-sm font-medium text-muted-foreground">Total Size</p>
              <p className="text-2xl font-bold">{formatFileSize(stats.totalSize)}</p>
              <p className="text-xs text-muted-foreground">
                {formatFileSize(stats.remainingSize)} remaining of{' '}
                {formatFileSize(MAX_TOTAL_SIZE_PER_CASE)}
              </p>
            </div>
            <div>
              <p className="text-sm font-medium text-muted-foreground">Max File Size</p>
              <p className="text-2xl font-bold">{formatFileSize(MAX_FILE_SIZE)}</p>
              <p className="text-xs text-muted-foreground">per file</p>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Upload Form */}
      <EvidenceUploadForm
        caseId={params.id}
        remainingFiles={stats.remainingFiles}
        remainingSize={stats.remainingSize}
        allowedExtensions={allowedExtensions}
      />
    </div>
  );
}
