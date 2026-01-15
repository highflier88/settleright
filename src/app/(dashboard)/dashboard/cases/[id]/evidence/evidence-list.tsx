'use client';

import { useState } from 'react';

import { useRouter } from 'next/navigation';

import {
  Calendar,
  Download,
  Eye,
  EyeOff,
  File,
  FileText,
  Image as ImageIcon,
  MoreHorizontal,
  Table,
  Trash2,
  User,
} from 'lucide-react';
import { toast } from 'sonner';

import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from '@/components/ui/alert-dialog';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { formatFileSize } from '@/lib/services/evidence';
import type { Evidence } from '@/types/shared';

interface EvidenceListProps {
  caseId: string;
  evidence: Evidence[];
  userId: string;
  canDelete: boolean;
}

function getFileIcon(fileType: string) {
  if (fileType.startsWith('image/')) {
    return <ImageIcon className="h-5 w-5" aria-hidden="true" />;
  }
  if (fileType.includes('spreadsheet') || fileType === 'text/csv' || fileType.includes('excel')) {
    return <Table className="h-5 w-5" />;
  }
  if (fileType === 'application/pdf' || fileType.includes('word') || fileType === 'text/plain') {
    return <FileText className="h-5 w-5" />;
  }
  return <File className="h-5 w-5" />;
}

function getFileCategory(fileType: string): string {
  if (fileType.startsWith('image/')) return 'Image';
  if (fileType.includes('spreadsheet') || fileType === 'text/csv' || fileType.includes('excel')) {
    return 'Spreadsheet';
  }
  if (fileType === 'application/pdf' || fileType.includes('word') || fileType === 'text/plain') {
    return 'Document';
  }
  return 'File';
}

export function EvidenceList({ caseId, evidence, userId, canDelete }: EvidenceListProps) {
  const router = useRouter();
  const [deleteId, setDeleteId] = useState<string | null>(null);
  const [isDeleting, setIsDeleting] = useState(false);

  const handleDelete = async () => {
    if (!deleteId) return;

    setIsDeleting(true);

    try {
      const response = await fetch(`/api/cases/${caseId}/evidence/${deleteId}`, {
        method: 'DELETE',
      });

      if (!response.ok) {
        const error = (await response.json()) as { error?: { message?: string } };
        throw new Error(error.error?.message || 'Failed to delete evidence');
      }

      toast.success('Evidence deleted successfully');
      router.refresh();
    } catch (error) {
      toast.error(error instanceof Error ? error.message : 'Something went wrong');
    } finally {
      setIsDeleting(false);
      setDeleteId(null);
    }
  };

  if (evidence.length === 0) {
    return (
      <Card>
        <CardContent className="py-12">
          <div className="text-center">
            <File className="mx-auto h-12 w-12 text-muted-foreground" />
            <h3 className="mt-4 text-lg font-semibold">No evidence uploaded</h3>
            <p className="mt-2 text-sm text-muted-foreground">
              Upload documents, images, or spreadsheets to support your case.
            </p>
          </div>
        </CardContent>
      </Card>
    );
  }

  // Group evidence by submitter
  const myEvidence = evidence.filter((e) => e.submittedById === userId);
  const otherEvidence = evidence.filter((e) => e.submittedById !== userId);

  return (
    <>
      <div className="space-y-6">
        {/* My Evidence */}
        {myEvidence.length > 0 && (
          <div className="space-y-3">
            <h3 className="flex items-center gap-2 text-sm font-medium text-muted-foreground">
              <User className="h-4 w-4" />
              Your Evidence ({myEvidence.length})
            </h3>
            <div className="space-y-2">
              {myEvidence.map((item) => (
                <EvidenceItem
                  key={item.id}
                  item={item}
                  isOwn={true}
                  canDelete={canDelete}
                  onDelete={() => setDeleteId(item.id)}
                />
              ))}
            </div>
          </div>
        )}

        {/* Other Party's Evidence */}
        {otherEvidence.length > 0 && (
          <div className="space-y-3">
            <h3 className="flex items-center gap-2 text-sm font-medium text-muted-foreground">
              <User className="h-4 w-4" />
              Other Party&apos;s Evidence ({otherEvidence.length})
            </h3>
            <div className="space-y-2">
              {otherEvidence.map((item) => (
                <EvidenceItem
                  key={item.id}
                  item={item}
                  isOwn={false}
                  canDelete={false}
                  onDelete={() => {}}
                />
              ))}
            </div>
          </div>
        )}
      </div>

      {/* Delete Confirmation Dialog */}
      <AlertDialog open={!!deleteId} onOpenChange={() => setDeleteId(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete Evidence</AlertDialogTitle>
            <AlertDialogDescription>
              Are you sure you want to delete this evidence? This action cannot be undone.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={isDeleting}>Cancel</AlertDialogCancel>
            <AlertDialogAction
              onClick={handleDelete}
              disabled={isDeleting}
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
            >
              {isDeleting ? 'Deleting...' : 'Delete'}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  );
}

interface EvidenceItemProps {
  item: Evidence;
  isOwn: boolean;
  canDelete: boolean;
  onDelete: () => void;
}

function EvidenceItem({ item, isOwn, canDelete, onDelete }: EvidenceItemProps) {
  const category = getFileCategory(item.fileType);

  return (
    <Card>
      <CardContent className="p-4">
        <div className="flex items-start gap-4">
          {/* File Icon */}
          <div className="flex-shrink-0 rounded-lg bg-muted p-2">{getFileIcon(item.fileType)}</div>

          {/* File Info */}
          <div className="min-w-0 flex-1">
            <div className="flex items-start justify-between gap-2">
              <div className="min-w-0">
                <p className="truncate font-medium">{item.fileName}</p>
                <div className="mt-1 flex items-center gap-2 text-sm text-muted-foreground">
                  <Badge variant="outline" className="text-xs">
                    {category}
                  </Badge>
                  <span>{formatFileSize(item.fileSize)}</span>
                </div>
              </div>

              {/* Actions */}
              <DropdownMenu>
                <DropdownMenuTrigger asChild>
                  <Button variant="ghost" size="sm" className="h-8 w-8 p-0">
                    <MoreHorizontal className="h-4 w-4" />
                    <span className="sr-only">Open menu</span>
                  </Button>
                </DropdownMenuTrigger>
                <DropdownMenuContent align="end">
                  <DropdownMenuItem asChild>
                    <a href={item.storageKey} target="_blank" rel="noopener noreferrer">
                      <Eye className="mr-2 h-4 w-4" />
                      View
                    </a>
                  </DropdownMenuItem>
                  <DropdownMenuItem asChild>
                    <a href={item.storageKey} download={item.fileName}>
                      <Download className="mr-2 h-4 w-4" />
                      Download
                    </a>
                  </DropdownMenuItem>
                  {isOwn && canDelete && (
                    <>
                      <DropdownMenuSeparator />
                      <DropdownMenuItem
                        onClick={onDelete}
                        className="text-destructive focus:text-destructive"
                      >
                        <Trash2 className="mr-2 h-4 w-4" />
                        Delete
                      </DropdownMenuItem>
                    </>
                  )}
                </DropdownMenuContent>
              </DropdownMenu>
            </div>

            {/* Description */}
            {item.description && (
              <p className="mt-2 text-sm text-muted-foreground">{item.description}</p>
            )}

            {/* Meta Info */}
            <div className="mt-3 flex items-center gap-4 text-xs text-muted-foreground">
              <span className="flex items-center gap-1">
                <Calendar className="h-3 w-3" />
                {new Date(item.submittedAt).toLocaleDateString()}
              </span>
              {!isOwn && (
                <span className="flex items-center gap-1">
                  {item.viewedByOpposingParty ? (
                    <>
                      <Eye className="h-3 w-3" />
                      Viewed
                    </>
                  ) : (
                    <>
                      <EyeOff className="h-3 w-3" />
                      Not yet viewed
                    </>
                  )}
                </span>
              )}
            </div>
          </div>
        </div>
      </CardContent>
    </Card>
  );
}
