'use client';

import { useState, useCallback, useRef } from 'react';

import { useRouter } from 'next/navigation';

import {
  Upload,
  X,
  FileText,
  Image as ImageIcon,
  Table,
  File,
  CheckCircle,
  AlertCircle,
  Loader2,
} from 'lucide-react';
import { toast } from 'sonner';

import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Progress } from '@/components/ui/progress';
import { formatFileSize, MAX_FILE_SIZE, ALLOWED_FILE_TYPES } from '@/lib/services/evidence-utils';

interface EvidenceUploadFormProps {
  caseId: string;
  remainingFiles: number;
  remainingSize: number;
  allowedExtensions: string[];
}

interface FileToUpload {
  file: File;
  description: string;
  status: 'pending' | 'uploading' | 'success' | 'error';
  error?: string;
  progress: number;
}

function getFileIcon(file: File) {
  if (file.type.startsWith('image/')) {
    return <ImageIcon className="h-5 w-5" aria-hidden="true" />;
  }
  if (
    file.type.includes('spreadsheet') ||
    file.type === 'text/csv' ||
    file.type.includes('excel')
  ) {
    return <Table className="h-5 w-5" />;
  }
  if (file.type === 'application/pdf' || file.type.includes('word') || file.type === 'text/plain') {
    return <FileText className="h-5 w-5" />;
  }
  return <File className="h-5 w-5" />;
}

function validateFile(
  file: File,
  remainingFiles: number,
  remainingSize: number,
  currentFiles: FileToUpload[]
): string | null {
  // Check file type
  if (!(file.type in ALLOWED_FILE_TYPES)) {
    return `File type "${file.type || 'unknown'}" is not allowed`;
  }

  // Check file size
  if (file.size > MAX_FILE_SIZE) {
    return `File size exceeds maximum of ${formatFileSize(MAX_FILE_SIZE)}`;
  }

  // Check remaining capacity
  const pendingSize = currentFiles.reduce((sum, f) => sum + f.file.size, 0);
  if (currentFiles.length + 1 > remainingFiles) {
    return `Would exceed remaining file limit of ${remainingFiles}`;
  }
  if (pendingSize + file.size > remainingSize) {
    return `Would exceed remaining size limit of ${formatFileSize(remainingSize)}`;
  }

  // Check for duplicates in current queue
  if (currentFiles.some((f) => f.file.name === file.name && f.file.size === file.size)) {
    return 'This file is already in the upload queue';
  }

  return null;
}

export function EvidenceUploadForm({
  caseId,
  remainingFiles,
  remainingSize,
  allowedExtensions,
}: EvidenceUploadFormProps) {
  const router = useRouter();
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [files, setFiles] = useState<FileToUpload[]>([]);
  const [isDragging, setIsDragging] = useState(false);
  const [isUploading, setIsUploading] = useState(false);

  const addFiles = useCallback(
    (newFiles: FileList | File[]) => {
      const fileArray = Array.from(newFiles);
      const validFiles: FileToUpload[] = [];

      for (const file of fileArray) {
        const error = validateFile(file, remainingFiles, remainingSize, [...files, ...validFiles]);
        if (error) {
          toast.error(`${file.name}: ${error}`);
        } else {
          validFiles.push({
            file,
            description: '',
            status: 'pending',
            progress: 0,
          });
        }
      }

      if (validFiles.length > 0) {
        setFiles((prev) => [...prev, ...validFiles]);
      }
    },
    [files, remainingFiles, remainingSize]
  );

  const removeFile = (index: number) => {
    setFiles((prev) => prev.filter((_, i) => i !== index));
  };

  const updateDescription = (index: number, description: string) => {
    setFiles((prev) => prev.map((f, i) => (i === index ? { ...f, description } : f)));
  };

  const handleDragEnter = (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setIsDragging(true);
  };

  const handleDragLeave = (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setIsDragging(false);
  };

  const handleDragOver = (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
  };

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setIsDragging(false);

    const droppedFiles = e.dataTransfer.files;
    if (droppedFiles.length > 0) {
      addFiles(droppedFiles);
    }
  };

  const handleFileSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    const selectedFiles = e.target.files;
    if (selectedFiles && selectedFiles.length > 0) {
      addFiles(selectedFiles);
    }
    // Reset input so same file can be selected again
    if (fileInputRef.current) {
      fileInputRef.current.value = '';
    }
  };

  const uploadFiles = async () => {
    if (files.length === 0 || isUploading) return;

    setIsUploading(true);
    let successCount = 0;
    let errorCount = 0;

    for (let i = 0; i < files.length; i++) {
      const fileToUpload = files[i];
      if (!fileToUpload || fileToUpload.status === 'success') continue;

      // Update status to uploading
      setFiles((prev) =>
        prev.map((f, idx) => (idx === i ? { ...f, status: 'uploading', progress: 0 } : f))
      );

      try {
        const formData = new FormData();
        formData.append('file', fileToUpload.file);
        if (fileToUpload.description) {
          formData.append('description', fileToUpload.description);
        }

        const response = await fetch(`/api/cases/${caseId}/evidence`, {
          method: 'POST',
          body: formData,
        });

        if (!response.ok) {
          const error = (await response.json()) as { error?: { message?: string } };
          throw new Error(error.error?.message || 'Upload failed');
        }

        // Update status to success
        setFiles((prev) =>
          prev.map((f, idx) => (idx === i ? { ...f, status: 'success', progress: 100 } : f))
        );
        successCount++;
      } catch (error) {
        // Update status to error
        setFiles((prev) =>
          prev.map((f, idx) =>
            idx === i
              ? {
                  ...f,
                  status: 'error',
                  error: error instanceof Error ? error.message : 'Upload failed',
                  progress: 0,
                }
              : f
          )
        );
        errorCount++;
      }
    }

    setIsUploading(false);

    if (successCount > 0) {
      toast.success(`${successCount} file(s) uploaded successfully`);
    }
    if (errorCount > 0) {
      toast.error(`${errorCount} file(s) failed to upload`);
    }

    // If all succeeded, redirect back
    if (errorCount === 0 && successCount > 0) {
      setTimeout(() => {
        router.push(`/dashboard/cases/${caseId}/evidence`);
        router.refresh();
      }, 1500);
    }
  };

  const pendingFiles = files.filter((f) => f.status !== 'success');
  const hasErrors = files.some((f) => f.status === 'error');

  return (
    <div className="space-y-6">
      {/* Drag & Drop Zone */}
      <Card>
        <CardHeader>
          <CardTitle>Select Files</CardTitle>
          <CardDescription>
            Drag and drop files or click to browse. Accepted formats:{' '}
            {allowedExtensions.join(', ').toUpperCase()}
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div
            role="button"
            tabIndex={0}
            onDragEnter={handleDragEnter}
            onDragLeave={handleDragLeave}
            onDragOver={handleDragOver}
            onDrop={handleDrop}
            onClick={() => fileInputRef.current?.click()}
            onKeyDown={(e) => {
              if (e.key === 'Enter' || e.key === ' ') {
                e.preventDefault();
                fileInputRef.current?.click();
              }
            }}
            className={`
              relative flex h-48 w-full cursor-pointer flex-col items-center
              justify-center rounded-lg border-2 border-dashed transition-colors
              ${
                isDragging
                  ? 'border-primary bg-primary/5'
                  : 'border-muted-foreground/25 hover:border-primary/50 hover:bg-muted/50'
              }
            `}
          >
            <Upload
              className={`mb-3 h-10 w-10 ${isDragging ? 'text-primary' : 'text-muted-foreground'}`}
            />
            <p className="text-sm font-medium">
              {isDragging ? 'Drop files here' : 'Drag & drop files here'}
            </p>
            <p className="mt-1 text-xs text-muted-foreground">or click to browse</p>
            <input
              ref={fileInputRef}
              type="file"
              multiple
              accept={Object.keys(ALLOWED_FILE_TYPES).join(',')}
              onChange={handleFileSelect}
              className="hidden"
            />
          </div>
        </CardContent>
      </Card>

      {/* File Queue */}
      {files.length > 0 && (
        <Card>
          <CardHeader>
            <CardTitle>Upload Queue ({files.length})</CardTitle>
            <CardDescription>Add optional descriptions before uploading</CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            {files.map((fileToUpload, index) => (
              <div
                key={`${fileToUpload.file.name}-${index}`}
                className={`rounded-lg border p-4 ${
                  fileToUpload.status === 'success'
                    ? 'border-green-500 bg-green-50 dark:bg-green-950'
                    : fileToUpload.status === 'error'
                      ? 'border-destructive bg-destructive/10'
                      : 'border-border'
                }`}
              >
                <div className="flex items-start gap-3">
                  {/* File Icon */}
                  <div className="flex-shrink-0 rounded bg-muted p-2">
                    {getFileIcon(fileToUpload.file)}
                  </div>

                  {/* File Info */}
                  <div className="min-w-0 flex-1 space-y-2">
                    <div className="flex items-center justify-between">
                      <div className="min-w-0">
                        <p className="truncate font-medium">{fileToUpload.file.name}</p>
                        <p className="text-xs text-muted-foreground">
                          {formatFileSize(fileToUpload.file.size)}
                        </p>
                      </div>

                      {/* Status Indicator / Remove Button */}
                      <div className="ml-2 flex-shrink-0">
                        {fileToUpload.status === 'success' ? (
                          <CheckCircle className="h-5 w-5 text-green-600" />
                        ) : fileToUpload.status === 'error' ? (
                          <AlertCircle className="h-5 w-5 text-destructive" />
                        ) : fileToUpload.status === 'uploading' ? (
                          <Loader2 className="h-5 w-5 animate-spin text-primary" />
                        ) : (
                          <Button
                            variant="ghost"
                            size="sm"
                            onClick={() => removeFile(index)}
                            className="h-8 w-8 p-0"
                          >
                            <X className="h-4 w-4" />
                          </Button>
                        )}
                      </div>
                    </div>

                    {/* Description Input (only for pending files) */}
                    {fileToUpload.status === 'pending' && (
                      <div>
                        <Label htmlFor={`desc-${index}`} className="sr-only">
                          Description
                        </Label>
                        <Input
                          id={`desc-${index}`}
                          placeholder="Add description (optional)"
                          value={fileToUpload.description}
                          onChange={(e) => updateDescription(index, e.target.value)}
                          className="h-8 text-sm"
                        />
                      </div>
                    )}

                    {/* Progress Bar */}
                    {fileToUpload.status === 'uploading' && (
                      <Progress value={fileToUpload.progress} className="h-1" />
                    )}

                    {/* Error Message */}
                    {fileToUpload.status === 'error' && fileToUpload.error && (
                      <p className="text-xs text-destructive">{fileToUpload.error}</p>
                    )}
                  </div>
                </div>
              </div>
            ))}

            {/* Upload Button */}
            <div className="flex items-center justify-between border-t pt-4">
              <p className="text-sm text-muted-foreground">
                {pendingFiles.length} file(s) ready to upload
              </p>
              <div className="flex gap-2">
                {hasErrors && (
                  <Button
                    variant="outline"
                    onClick={() => setFiles((prev) => prev.filter((f) => f.status !== 'error'))}
                  >
                    Clear Errors
                  </Button>
                )}
                <Button onClick={uploadFiles} disabled={pendingFiles.length === 0 || isUploading}>
                  {isUploading ? (
                    <>
                      <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                      Uploading...
                    </>
                  ) : (
                    <>
                      <Upload className="mr-2 h-4 w-4" />
                      Upload {pendingFiles.length} File(s)
                    </>
                  )}
                </Button>
              </div>
            </div>
          </CardContent>
        </Card>
      )}

      {/* Help Text */}
      <Card>
        <CardContent className="py-4">
          <p className="text-sm text-muted-foreground">
            <strong>Tips:</strong> You can select multiple files at once. Each file can have an
            optional description to help identify its contents. Files are automatically checked for
            duplicates and validated against size limits.
          </p>
        </CardContent>
      </Card>
    </div>
  );
}
