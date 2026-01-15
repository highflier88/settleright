'use client';

import { useState } from 'react';

import { format } from 'date-fns';
import {
  FileText,
  File,
  Eye,
  Download,
  Calendar,
  Hash,
  ChevronRight,
  FileImage,
  FileVideo,
  FileArchive,
} from 'lucide-react';

import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { ScrollArea } from '@/components/ui/scroll-area';

import { EvidenceViewer } from './evidence-viewer';

import type { Evidence } from '@prisma/client';

type EvidenceWithSubmitter = Evidence & {
  submittedBy: { id: string; name: string | null };
};

interface EvidenceComparisonProps {
  caseId: string;
  claimantName: string;
  respondentName: string;
  claimantEvidence: EvidenceWithSubmitter[];
  respondentEvidence: EvidenceWithSubmitter[];
}

function getFileIcon(fileType: string) {
  if (fileType.startsWith('image/')) return FileImage;
  if (fileType.startsWith('video/')) return FileVideo;
  if (fileType === 'application/pdf') return FileText;
  if (fileType.includes('zip') || fileType.includes('archive')) return FileArchive;
  return File;
}

function formatFileSize(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

function getProcessingStatusBadge(status: string) {
  switch (status) {
    case 'COMPLETED':
      return (
        <Badge variant="default" className="bg-green-600">
          Processed
        </Badge>
      );
    case 'FAILED':
      return <Badge variant="destructive">Failed</Badge>;
    case 'PENDING':
    case 'QUEUED':
      return <Badge variant="secondary">Pending</Badge>;
    default:
      return <Badge variant="outline">Processing</Badge>;
  }
}

interface EvidenceCardProps {
  evidence: EvidenceWithSubmitter;
  onSelect: (evidence: EvidenceWithSubmitter) => void;
  isSelected: boolean;
}

function EvidenceCard({ evidence, onSelect, isSelected }: EvidenceCardProps) {
  const Icon = getFileIcon(evidence.fileType);

  return (
    <button
      type="button"
      className={`w-full cursor-pointer rounded-lg border p-3 text-left transition-all hover:shadow-md ${
        isSelected
          ? 'border-primary bg-primary/5 ring-1 ring-primary'
          : 'hover:border-muted-foreground/30'
      }`}
      onClick={() => onSelect(evidence)}
    >
      <div className="flex items-start gap-3">
        <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-muted">
          <Icon className="h-5 w-5 text-muted-foreground" />
        </div>
        <div className="min-w-0 flex-1">
          <p className="truncate text-sm font-medium">{evidence.fileName}</p>
          <div className="mt-1 flex items-center gap-2 text-xs text-muted-foreground">
            <span>{formatFileSize(evidence.fileSize)}</span>
            <span>|</span>
            <span>{format(new Date(evidence.submittedAt), 'MMM d, yyyy')}</span>
          </div>
          {evidence.description && (
            <p className="mt-1 line-clamp-1 text-xs text-muted-foreground">
              {evidence.description}
            </p>
          )}
        </div>
        {getProcessingStatusBadge(evidence.processingStatus)}
      </div>
    </button>
  );
}

interface EvidenceDetailProps {
  evidence: EvidenceWithSubmitter | null;
  partyName: string;
  onOpenViewer?: (evidence: EvidenceWithSubmitter, party: string) => void;
}

function EvidenceDetail({ evidence, partyName, onOpenViewer }: EvidenceDetailProps) {
  if (!evidence) {
    return (
      <div className="flex h-64 flex-col items-center justify-center text-muted-foreground">
        <FileText className="mb-4 h-12 w-12 opacity-50" />
        <p>Select an evidence item to view details</p>
      </div>
    );
  }

  const Icon = getFileIcon(evidence.fileType);

  return (
    <div className="space-y-4">
      {/* Header */}
      <div className="flex items-start gap-4">
        <div className="flex h-16 w-16 items-center justify-center rounded-lg bg-muted">
          <Icon className="h-8 w-8 text-muted-foreground" />
        </div>
        <div className="flex-1">
          <h3 className="font-semibold">{evidence.fileName}</h3>
          <p className="text-sm text-muted-foreground">Submitted by {partyName}</p>
          <div className="mt-2 flex items-center gap-2">
            {getProcessingStatusBadge(evidence.processingStatus)}
            {evidence.documentType && <Badge variant="outline">{evidence.documentType}</Badge>}
          </div>
        </div>
      </div>

      {/* Metadata */}
      <div className="grid gap-3 text-sm">
        <div className="flex items-center gap-2">
          <Calendar className="h-4 w-4 text-muted-foreground" />
          <span className="text-muted-foreground">Submitted:</span>
          <span>{format(new Date(evidence.submittedAt), 'MMMM d, yyyy h:mm a')}</span>
        </div>
        <div className="flex items-center gap-2">
          <File className="h-4 w-4 text-muted-foreground" />
          <span className="text-muted-foreground">Size:</span>
          <span>{formatFileSize(evidence.fileSize)}</span>
        </div>
        <div className="flex items-center gap-2">
          <Hash className="h-4 w-4 text-muted-foreground" />
          <span className="text-muted-foreground">Hash:</span>
          <span className="font-mono text-xs">{evidence.fileHash.substring(0, 16)}...</span>
        </div>
      </div>

      {/* Description */}
      {evidence.description && (
        <div>
          <h4 className="mb-1 text-sm font-medium">Description</h4>
          <p className="text-sm text-muted-foreground">{evidence.description}</p>
        </div>
      )}

      {/* AI Summary */}
      {evidence.summary && (
        <div className="rounded-lg border bg-muted/30 p-3">
          <h4 className="mb-1 flex items-center gap-2 text-sm font-medium">
            AI Summary
            {evidence.classificationConfidence && (
              <Badge variant="outline" className="text-xs">
                {Math.round(evidence.classificationConfidence * 100)}% confidence
              </Badge>
            )}
          </h4>
          <p className="text-sm">{evidence.summary}</p>
        </div>
      )}

      {/* Key Points */}
      {evidence.keyPoints && evidence.keyPoints.length > 0 && (
        <div>
          <h4 className="mb-2 text-sm font-medium">Key Points</h4>
          <ul className="space-y-1">
            {evidence.keyPoints.map((point, index) => (
              <li key={index} className="flex items-start gap-2 text-sm">
                <ChevronRight className="mt-0.5 h-4 w-4 flex-shrink-0 text-primary" />
                <span>{point}</span>
              </li>
            ))}
          </ul>
        </div>
      )}

      {/* Extracted Entities */}
      {evidence.extractedEntities && typeof evidence.extractedEntities === 'object' && (
        <div>
          <h4 className="mb-2 text-sm font-medium">Extracted Entities</h4>
          <div className="flex flex-wrap gap-2">
            {Object.entries(evidence.extractedEntities as Record<string, unknown[]>).map(
              ([type, values]) =>
                values &&
                Array.isArray(values) &&
                values.length > 0 && (
                  <div key={type} className="flex flex-wrap gap-1">
                    {values.slice(0, 5).map((value, index) => (
                      <Badge key={index} variant="secondary" className="text-xs">
                        {type}:{' '}
                        {String(
                          typeof value === 'object' && value !== null && 'value' in value
                            ? value.value
                            : value
                        )}
                      </Badge>
                    ))}
                  </div>
                )
            )}
          </div>
        </div>
      )}

      {/* Actions */}
      <div className="flex gap-2 pt-2">
        <Button size="sm" variant="default" onClick={() => onOpenViewer?.(evidence, partyName)}>
          <Eye className="mr-2 h-4 w-4" />
          Deep Dive
        </Button>
        <Button size="sm" variant="outline">
          <Download className="mr-2 h-4 w-4" />
          Download
        </Button>
      </div>
    </div>
  );
}

export function EvidenceComparison({
  caseId: _caseId,
  claimantName,
  respondentName,
  claimantEvidence,
  respondentEvidence,
}: EvidenceComparisonProps) {
  const [selectedClaimant, setSelectedClaimant] = useState<EvidenceWithSubmitter | null>(null);
  const [selectedRespondent, setSelectedRespondent] = useState<EvidenceWithSubmitter | null>(null);
  const [detailEvidence, setDetailEvidence] = useState<{
    evidence: EvidenceWithSubmitter;
    party: string;
  } | null>(null);
  const [viewerOpen, setViewerOpen] = useState(false);
  const [viewerEvidence, setViewerEvidence] = useState<{
    evidence: EvidenceWithSubmitter;
    party: string;
  } | null>(null);

  const totalEvidence = claimantEvidence.length + respondentEvidence.length;

  const openViewer = (evidence: EvidenceWithSubmitter, party: string) => {
    setViewerEvidence({ evidence, party });
    setViewerOpen(true);
  };

  return (
    <>
      <div className="space-y-4">
        {/* Summary */}
        <div className="grid gap-4 md:grid-cols-3">
          <Card>
            <CardContent className="pt-4">
              <div className="text-2xl font-bold">{totalEvidence}</div>
              <p className="text-sm text-muted-foreground">Total Evidence Items</p>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="pt-4">
              <div className="text-2xl font-bold">{claimantEvidence.length}</div>
              <p className="text-sm text-muted-foreground">From {claimantName}</p>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="pt-4">
              <div className="text-2xl font-bold">{respondentEvidence.length}</div>
              <p className="text-sm text-muted-foreground">From {respondentName}</p>
            </CardContent>
          </Card>
        </div>

        {/* Split View */}
        <div className="grid gap-4 md:grid-cols-2">
          {/* Claimant Evidence */}
          <Card>
            <CardHeader className="pb-3">
              <CardTitle className="flex items-center gap-2 text-lg">
                <Badge variant="default">{claimantName}</Badge>
                Evidence ({claimantEvidence.length})
              </CardTitle>
              <CardDescription>Evidence submitted by the claimant</CardDescription>
            </CardHeader>
            <CardContent>
              <ScrollArea className="h-[400px] pr-4">
                {claimantEvidence.length === 0 ? (
                  <div className="flex h-32 flex-col items-center justify-center text-muted-foreground">
                    <FileText className="mb-2 h-8 w-8 opacity-50" />
                    <p className="text-sm">No evidence submitted</p>
                  </div>
                ) : (
                  <div className="space-y-2">
                    {claimantEvidence.map((evidence) => (
                      <EvidenceCard
                        key={evidence.id}
                        evidence={evidence}
                        onSelect={(e) => {
                          setSelectedClaimant(e);
                          setDetailEvidence({ evidence: e, party: claimantName });
                        }}
                        isSelected={selectedClaimant?.id === evidence.id}
                      />
                    ))}
                  </div>
                )}
              </ScrollArea>
            </CardContent>
          </Card>

          {/* Respondent Evidence */}
          <Card>
            <CardHeader className="pb-3">
              <CardTitle className="flex items-center gap-2 text-lg">
                <Badge variant="secondary">{respondentName}</Badge>
                Evidence ({respondentEvidence.length})
              </CardTitle>
              <CardDescription>Evidence submitted by the respondent</CardDescription>
            </CardHeader>
            <CardContent>
              <ScrollArea className="h-[400px] pr-4">
                {respondentEvidence.length === 0 ? (
                  <div className="flex h-32 flex-col items-center justify-center text-muted-foreground">
                    <FileText className="mb-2 h-8 w-8 opacity-50" />
                    <p className="text-sm">No evidence submitted</p>
                  </div>
                ) : (
                  <div className="space-y-2">
                    {respondentEvidence.map((evidence) => (
                      <EvidenceCard
                        key={evidence.id}
                        evidence={evidence}
                        onSelect={(e) => {
                          setSelectedRespondent(e);
                          setDetailEvidence({ evidence: e, party: respondentName });
                        }}
                        isSelected={selectedRespondent?.id === evidence.id}
                      />
                    ))}
                  </div>
                )}
              </ScrollArea>
            </CardContent>
          </Card>
        </div>

        {/* Evidence Detail Panel */}
        {detailEvidence && (
          <Card>
            <CardHeader className="pb-3">
              <CardTitle className="text-lg">Evidence Details</CardTitle>
              <CardDescription>
                Detailed view of selected evidence from {detailEvidence.party}
              </CardDescription>
            </CardHeader>
            <CardContent>
              <EvidenceDetail
                evidence={detailEvidence.evidence}
                partyName={detailEvidence.party}
                onOpenViewer={openViewer}
              />
            </CardContent>
          </Card>
        )}
      </div>

      {/* Evidence Deep Dive Viewer */}
      <EvidenceViewer
        evidence={viewerEvidence?.evidence || null}
        partyName={viewerEvidence?.party || ''}
        isOpen={viewerOpen}
        onClose={() => {
          setViewerOpen(false);
          setViewerEvidence(null);
        }}
      />
    </>
  );
}
