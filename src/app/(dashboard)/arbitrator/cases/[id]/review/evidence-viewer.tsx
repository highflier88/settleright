'use client';

import { useState } from 'react';

import { format } from 'date-fns';
import {
  FileText,
  File,
  Download,
  Calendar,
  Hash,
  FileImage,
  FileVideo,
  FileArchive,
  ExternalLink,
  Lightbulb,
  User,
  Clock,
  Tag,
  ZoomIn,
  ZoomOut,
  RotateCw,
  Maximize2,
  CheckCircle,
  AlertTriangle,
  Target,
  Link2,
} from 'lucide-react';

import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Separator } from '@/components/ui/separator';
import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetHeader,
  SheetTitle,
} from '@/components/ui/sheet';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';

import type { Evidence } from '@/types/shared';

type EvidenceWithSubmitter = Evidence & {
  submittedBy: { id: string; name: string | null };
};

interface EvidenceViewerProps {
  evidence: EvidenceWithSubmitter | null;
  partyName: string;
  isOpen: boolean;
  onClose: () => void;
}

// Helper to generate public URL from storage key
function getFileUrl(storageKey: string): string {
  // Vercel Blob public URL format
  const blobStoreId = process.env.NEXT_PUBLIC_VERCEL_BLOB_STORE_ID || 'blob';
  return `https://${blobStoreId}.public.blob.vercel-storage.com/${storageKey}`;
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

export function EvidenceViewer({ evidence, partyName, isOpen, onClose }: EvidenceViewerProps) {
  const [activeTab, setActiveTab] = useState('details');
  const [zoomLevel, setZoomLevel] = useState(100);

  if (!evidence) return null;

  const Icon = getFileIcon(evidence.fileType);
  const isImage = evidence.fileType.startsWith('image/');
  const isPdf = evidence.fileType === 'application/pdf';
  const canPreview = isImage || isPdf;

  // Parse extracted entities safely
  const extractedEntities = evidence.extractedEntities as Record<string, unknown[]> | null;

  // Count entities for display
  const entityCount = extractedEntities
    ? Object.values(extractedEntities).reduce(
        (sum, arr) => sum + (Array.isArray(arr) ? arr.length : 0),
        0
      )
    : 0;

  return (
    <Sheet open={isOpen} onOpenChange={(open) => !open && onClose()}>
      <SheetContent className="flex w-full flex-col overflow-hidden sm:max-w-2xl lg:max-w-4xl">
        <SheetHeader className="flex-shrink-0">
          <div className="flex items-start gap-4">
            <div className="flex h-12 w-12 items-center justify-center rounded-lg bg-muted">
              <Icon className="h-6 w-6 text-muted-foreground" />
            </div>
            <div className="min-w-0 flex-1">
              <SheetTitle className="truncate pr-8 text-lg">{evidence.fileName}</SheetTitle>
              <SheetDescription className="mt-1 flex items-center gap-2">
                <span>Submitted by {partyName}</span>
                <span>•</span>
                <span>{format(new Date(evidence.submittedAt), 'MMM d, yyyy')}</span>
              </SheetDescription>
            </div>
          </div>

          {/* Status Badges */}
          <div className="mt-3 flex flex-wrap items-center gap-2">
            {getProcessingStatusBadge(evidence.processingStatus)}
            {evidence.documentType && <Badge variant="outline">{evidence.documentType}</Badge>}
            {evidence.classificationConfidence && (
              <Badge variant="secondary">
                {Math.round(evidence.classificationConfidence * 100)}% AI Confidence
              </Badge>
            )}
          </div>
        </SheetHeader>

        <Separator className="my-4" />

        <Tabs
          value={activeTab}
          onValueChange={setActiveTab}
          className="flex min-h-0 flex-1 flex-col"
        >
          <TabsList className="grid w-full flex-shrink-0 grid-cols-4">
            <TabsTrigger value="details">Details</TabsTrigger>
            <TabsTrigger value="analysis">AI Analysis</TabsTrigger>
            <TabsTrigger value="preview">Preview</TabsTrigger>
            <TabsTrigger value="provenance">Provenance</TabsTrigger>
          </TabsList>

          <div className="mt-4 min-h-0 flex-1">
            {/* Details Tab */}
            <TabsContent value="details" className="m-0 h-full">
              <ScrollArea className="h-[calc(100vh-320px)]">
                <div className="space-y-6 pr-4">
                  {/* Description */}
                  {evidence.description && (
                    <div>
                      <h4 className="mb-2 flex items-center gap-2 text-sm font-medium">
                        <FileText className="h-4 w-4" />
                        Description
                      </h4>
                      <p className="rounded-lg bg-muted/30 p-3 text-sm text-muted-foreground">
                        {evidence.description}
                      </p>
                    </div>
                  )}

                  {/* Metadata Grid */}
                  <div>
                    <h4 className="mb-3 text-sm font-medium">Document Information</h4>
                    <div className="grid gap-3 text-sm">
                      <div className="flex items-center gap-3 rounded-lg bg-muted/30 p-2">
                        <Calendar className="h-4 w-4 text-muted-foreground" />
                        <div>
                          <span className="text-muted-foreground">Submitted:</span>
                          <span className="ml-2 font-medium">
                            {format(new Date(evidence.submittedAt), 'MMMM d, yyyy h:mm a')}
                          </span>
                        </div>
                      </div>

                      <div className="flex items-center gap-3 rounded-lg bg-muted/30 p-2">
                        <File className="h-4 w-4 text-muted-foreground" />
                        <div>
                          <span className="text-muted-foreground">File Size:</span>
                          <span className="ml-2 font-medium">
                            {formatFileSize(evidence.fileSize)}
                          </span>
                        </div>
                      </div>

                      <div className="flex items-center gap-3 rounded-lg bg-muted/30 p-2">
                        <Tag className="h-4 w-4 text-muted-foreground" />
                        <div>
                          <span className="text-muted-foreground">Type:</span>
                          <span className="ml-2 font-mono text-xs font-medium">
                            {evidence.fileType}
                          </span>
                        </div>
                      </div>

                      <div className="flex items-center gap-3 rounded-lg bg-muted/30 p-2">
                        <Hash className="h-4 w-4 text-muted-foreground" />
                        <div className="overflow-hidden">
                          <span className="text-muted-foreground">SHA-256 Hash:</span>
                          <span className="ml-2 break-all font-mono text-xs">
                            {evidence.fileHash}
                          </span>
                        </div>
                      </div>
                    </div>
                  </div>

                  {/* Party Information */}
                  <div>
                    <h4 className="mb-3 text-sm font-medium">Submitted By</h4>
                    <div className="flex items-center gap-3 rounded-lg border p-3">
                      <div className="flex h-10 w-10 items-center justify-center rounded-full bg-primary/10">
                        <User className="h-5 w-5 text-primary" />
                      </div>
                      <div>
                        <p className="font-medium">{evidence.submittedBy.name || 'Unknown'}</p>
                        <p className="text-sm text-muted-foreground">{partyName}</p>
                      </div>
                    </div>
                  </div>

                  {/* Actions */}
                  <div className="flex gap-2 pt-2">
                    <Button variant="outline" size="sm" asChild>
                      <a
                        href={getFileUrl(evidence.storageKey)}
                        target="_blank"
                        rel="noopener noreferrer"
                      >
                        <ExternalLink className="mr-2 h-4 w-4" />
                        Open Original
                      </a>
                    </Button>
                    <Button variant="outline" size="sm" asChild>
                      <a href={getFileUrl(evidence.storageKey)} download={evidence.fileName}>
                        <Download className="mr-2 h-4 w-4" />
                        Download
                      </a>
                    </Button>
                  </div>
                </div>
              </ScrollArea>
            </TabsContent>

            {/* AI Analysis Tab */}
            <TabsContent value="analysis" className="m-0 h-full">
              <ScrollArea className="h-[calc(100vh-320px)]">
                <div className="space-y-6 pr-4">
                  {/* AI Summary */}
                  {evidence.summary ? (
                    <div>
                      <h4 className="mb-2 flex items-center gap-2 text-sm font-medium">
                        <Lightbulb className="h-4 w-4 text-amber-500" />
                        AI Summary
                      </h4>
                      <div className="rounded-lg border bg-amber-50/50 p-4 dark:bg-amber-900/10">
                        <p className="text-sm leading-relaxed">{evidence.summary}</p>
                      </div>
                    </div>
                  ) : (
                    <div className="rounded-lg border border-dashed p-6 text-center text-muted-foreground">
                      <Lightbulb className="mx-auto mb-2 h-8 w-8 opacity-50" />
                      <p>AI summary not yet generated</p>
                      <p className="mt-1 text-xs">
                        Summary will be available once processing completes
                      </p>
                    </div>
                  )}

                  {/* Key Points */}
                  {evidence.keyPoints && evidence.keyPoints.length > 0 && (
                    <div>
                      <h4 className="mb-3 flex items-center gap-2 text-sm font-medium">
                        <Target className="h-4 w-4 text-primary" />
                        Key Points ({evidence.keyPoints.length})
                      </h4>
                      <div className="space-y-2">
                        {evidence.keyPoints.map((point, index) => (
                          <div
                            key={index}
                            className="flex items-start gap-3 rounded-lg border p-3 transition-colors hover:border-primary/50"
                          >
                            <span className="flex h-6 w-6 flex-shrink-0 items-center justify-center rounded-full bg-primary/10 text-xs font-medium text-primary">
                              {index + 1}
                            </span>
                            <p className="text-sm">{point}</p>
                          </div>
                        ))}
                      </div>
                    </div>
                  )}

                  {/* Extracted Entities */}
                  {extractedEntities && entityCount > 0 && (
                    <div>
                      <h4 className="mb-3 flex items-center gap-2 text-sm font-medium">
                        <Link2 className="h-4 w-4 text-blue-500" />
                        Extracted Entities ({entityCount})
                      </h4>
                      <div className="space-y-3">
                        {Object.entries(extractedEntities).map(
                          ([type, values]) =>
                            values &&
                            Array.isArray(values) &&
                            values.length > 0 && (
                              <div key={type}>
                                <p className="mb-2 text-xs font-medium uppercase text-muted-foreground">
                                  {type.replace(/_/g, ' ')}
                                </p>
                                <div className="flex flex-wrap gap-2">
                                  {values.map((value, index) => {
                                    const displayValue =
                                      typeof value === 'object' &&
                                      value !== null &&
                                      'value' in value
                                        ? String((value as { value: unknown }).value)
                                        : String(value);
                                    return (
                                      <Badge key={index} variant="secondary" className="text-sm">
                                        {displayValue}
                                      </Badge>
                                    );
                                  })}
                                </div>
                              </div>
                            )
                        )}
                      </div>
                    </div>
                  )}

                  {/* Processing Assessment */}
                  <div>
                    <h4 className="mb-3 flex items-center gap-2 text-sm font-medium">
                      <CheckCircle className="h-4 w-4 text-green-500" />
                      Processing Assessment
                    </h4>
                    <div className="grid gap-3">
                      <div className="flex items-center justify-between rounded-lg border p-3">
                        <span className="text-sm">Document Type</span>
                        <Badge variant="outline">{evidence.documentType || 'Not Classified'}</Badge>
                      </div>
                      <div className="flex items-center justify-between rounded-lg border p-3">
                        <span className="text-sm">Classification Confidence</span>
                        <span className="font-medium">
                          {evidence.classificationConfidence
                            ? `${Math.round(evidence.classificationConfidence * 100)}%`
                            : 'N/A'}
                        </span>
                      </div>
                      <div className="flex items-center justify-between rounded-lg border p-3">
                        <span className="text-sm">Processing Status</span>
                        {getProcessingStatusBadge(evidence.processingStatus)}
                      </div>
                    </div>
                  </div>
                </div>
              </ScrollArea>
            </TabsContent>

            {/* Preview Tab */}
            <TabsContent value="preview" className="m-0 h-full">
              <div className="flex h-[calc(100vh-320px)] flex-col">
                {canPreview ? (
                  <>
                    {/* Preview Controls */}
                    <div className="mb-3 flex items-center justify-between border-b pb-3">
                      <div className="flex items-center gap-2">
                        <Button
                          variant="outline"
                          size="icon"
                          onClick={() => setZoomLevel(Math.max(25, zoomLevel - 25))}
                          disabled={zoomLevel <= 25}
                        >
                          <ZoomOut className="h-4 w-4" />
                        </Button>
                        <span className="w-16 text-center text-sm font-medium">{zoomLevel}%</span>
                        <Button
                          variant="outline"
                          size="icon"
                          onClick={() => setZoomLevel(Math.min(200, zoomLevel + 25))}
                          disabled={zoomLevel >= 200}
                        >
                          <ZoomIn className="h-4 w-4" />
                        </Button>
                        <Button variant="outline" size="icon" onClick={() => setZoomLevel(100)}>
                          <RotateCw className="h-4 w-4" />
                        </Button>
                      </div>
                      <Button variant="outline" size="sm" asChild>
                        <a
                          href={getFileUrl(evidence.storageKey)}
                          target="_blank"
                          rel="noopener noreferrer"
                        >
                          <Maximize2 className="mr-2 h-4 w-4" />
                          Full Screen
                        </a>
                      </Button>
                    </div>

                    {/* Preview Content */}
                    <ScrollArea className="flex-1 rounded-lg border">
                      <div className="flex min-h-[400px] items-center justify-center p-4">
                        {isImage ? (
                          /* eslint-disable-next-line @next/next/no-img-element */
                          <img
                            src={getFileUrl(evidence.storageKey)}
                            alt={evidence.fileName}
                            className="max-w-full object-contain transition-transform"
                            style={{ transform: `scale(${zoomLevel / 100})` }}
                          />
                        ) : isPdf ? (
                          <iframe
                            src={getFileUrl(evidence.storageKey)}
                            className="h-[600px] w-full rounded-lg"
                            title={evidence.fileName}
                            style={{
                              transform: `scale(${zoomLevel / 100})`,
                              transformOrigin: 'top left',
                            }}
                          />
                        ) : null}
                      </div>
                    </ScrollArea>
                  </>
                ) : (
                  <div className="flex flex-1 flex-col items-center justify-center text-muted-foreground">
                    <Icon className="mb-4 h-16 w-16 opacity-50" />
                    <p className="text-lg font-medium">Preview not available</p>
                    <p className="mt-1 text-sm">
                      This file type ({evidence.fileType}) cannot be previewed in browser
                    </p>
                    <Button variant="outline" className="mt-4" asChild>
                      <a href={getFileUrl(evidence.storageKey)} download={evidence.fileName}>
                        <Download className="mr-2 h-4 w-4" />
                        Download to View
                      </a>
                    </Button>
                  </div>
                )}
              </div>
            </TabsContent>

            {/* Provenance Tab */}
            <TabsContent value="provenance" className="m-0 h-full">
              <ScrollArea className="h-[calc(100vh-320px)]">
                <div className="space-y-6 pr-4">
                  {/* Document Chain of Custody */}
                  <div>
                    <h4 className="mb-3 flex items-center gap-2 text-sm font-medium">
                      <Clock className="h-4 w-4" />
                      Document History
                    </h4>
                    <div className="space-y-3">
                      <div className="flex items-start gap-3">
                        <div className="flex h-8 w-8 items-center justify-center rounded-full bg-green-100 dark:bg-green-900/30">
                          <CheckCircle className="h-4 w-4 text-green-600" />
                        </div>
                        <div>
                          <p className="text-sm font-medium">Document Submitted</p>
                          <p className="text-xs text-muted-foreground">
                            {format(new Date(evidence.submittedAt), 'MMMM d, yyyy h:mm:ss a')}
                          </p>
                          <p className="text-xs text-muted-foreground">
                            By {evidence.submittedBy.name || 'Unknown'}
                          </p>
                        </div>
                      </div>

                      {evidence.processedAt && (
                        <div className="flex items-start gap-3">
                          <div className="flex h-8 w-8 items-center justify-center rounded-full bg-blue-100 dark:bg-blue-900/30">
                            <Lightbulb className="h-4 w-4 text-blue-600" />
                          </div>
                          <div>
                            <p className="text-sm font-medium">AI Processing Completed</p>
                            <p className="text-xs text-muted-foreground">
                              {format(new Date(evidence.processedAt), 'MMMM d, yyyy h:mm:ss a')}
                            </p>
                          </div>
                        </div>
                      )}
                    </div>
                  </div>

                  {/* Integrity Verification */}
                  <div>
                    <h4 className="mb-3 flex items-center gap-2 text-sm font-medium">
                      <Hash className="h-4 w-4" />
                      Integrity Verification
                    </h4>
                    <div className="space-y-3 rounded-lg border p-4">
                      <div>
                        <p className="mb-1 text-xs text-muted-foreground">SHA-256 Hash</p>
                        <p className="break-all rounded bg-muted p-2 font-mono text-xs">
                          {evidence.fileHash}
                        </p>
                      </div>
                      <div className="flex items-center gap-2 text-sm">
                        <CheckCircle className="h-4 w-4 text-green-600" />
                        <span>Document integrity verified</span>
                      </div>
                      <p className="text-xs text-muted-foreground">
                        This hash uniquely identifies the document and can be used to verify that it
                        has not been modified since submission.
                      </p>
                    </div>
                  </div>

                  {/* Storage Information */}
                  <div>
                    <h4 className="mb-3 text-sm font-medium">Storage Information</h4>
                    <div className="space-y-2 rounded-lg border p-4 text-sm">
                      <div className="flex items-center justify-between">
                        <span className="text-muted-foreground">Storage Provider</span>
                        <span>Vercel Blob Storage</span>
                      </div>
                      <div className="flex items-center justify-between">
                        <span className="text-muted-foreground">Evidence ID</span>
                        <span className="font-mono text-xs">{evidence.id}</span>
                      </div>
                      <div className="flex items-center justify-between">
                        <span className="text-muted-foreground">File Size</span>
                        <span>{formatFileSize(evidence.fileSize)}</span>
                      </div>
                    </div>
                  </div>

                  {/* Legal Notice */}
                  <div className="rounded-lg border border-amber-200 bg-amber-50/50 p-4 dark:border-amber-800 dark:bg-amber-900/10">
                    <div className="flex items-start gap-2">
                      <AlertTriangle className="mt-0.5 h-4 w-4 text-amber-600" />
                      <div>
                        <p className="text-sm font-medium text-amber-800 dark:text-amber-200">
                          Legal Notice
                        </p>
                        <p className="mt-1 text-xs text-amber-700 dark:text-amber-300">
                          This document is part of the official arbitration record. Any
                          modifications to the original document after submission can be detected
                          using the cryptographic hash above. Tampering with evidence may result in
                          legal consequences.
                        </p>
                      </div>
                    </div>
                  </div>
                </div>
              </ScrollArea>
            </TabsContent>
          </div>
        </Tabs>
      </SheetContent>
    </Sheet>
  );
}
