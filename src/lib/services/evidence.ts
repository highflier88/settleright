import { createHash } from 'crypto';

import { AuditAction, CaseStatus } from '@prisma/client';
import { put, del } from '@vercel/blob';

import { prisma } from '@/lib/db';
import { createAuditLog } from '@/lib/services/audit';

import type { Evidence } from '@prisma/client';

// Allowed file types
export const ALLOWED_FILE_TYPES = {
  // Documents
  'application/pdf': { ext: 'pdf', category: 'document' },
  'application/msword': { ext: 'doc', category: 'document' },
  'application/vnd.openxmlformats-officedocument.wordprocessingml.document': {
    ext: 'docx',
    category: 'document',
  },
  'text/plain': { ext: 'txt', category: 'document' },

  // Images
  'image/jpeg': { ext: 'jpg', category: 'image' },
  'image/png': { ext: 'png', category: 'image' },
  'image/gif': { ext: 'gif', category: 'image' },
  'image/webp': { ext: 'webp', category: 'image' },

  // Spreadsheets
  'application/vnd.ms-excel': { ext: 'xls', category: 'spreadsheet' },
  'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet': {
    ext: 'xlsx',
    category: 'spreadsheet',
  },
  'text/csv': { ext: 'csv', category: 'spreadsheet' },
} as const;

export type AllowedMimeType = keyof typeof ALLOWED_FILE_TYPES;

// File size limits
export const MAX_FILE_SIZE = 25 * 1024 * 1024; // 25MB per file
export const MAX_TOTAL_SIZE_PER_CASE = 100 * 1024 * 1024; // 100MB total per case
export const MAX_FILES_PER_CASE = 50;

// Generate file hash
export function generateFileHash(buffer: Buffer): string {
  return createHash('sha256').update(buffer).digest('hex');
}

// Validate file type
export function validateFileType(mimeType: string): boolean {
  return mimeType in ALLOWED_FILE_TYPES;
}

// Get file category
export function getFileCategory(mimeType: string): string {
  return ALLOWED_FILE_TYPES[mimeType as AllowedMimeType]?.category ?? 'unknown';
}

// Format file size for display
export function formatFileSize(bytes: number): string {
  if (bytes === 0) return '0 Bytes';
  const k = 1024;
  const sizes = ['Bytes', 'KB', 'MB', 'GB'];
  const i = Math.floor(Math.log(bytes) / Math.log(k));
  return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i];
}

export interface UploadEvidenceInput {
  caseId: string;
  userId: string;
  file: File;
  description?: string;
}

export interface UploadEvidenceResult {
  success: boolean;
  evidence?: Evidence;
  error?: string;
}

// Upload evidence file
export async function uploadEvidence(
  input: UploadEvidenceInput
): Promise<UploadEvidenceResult> {
  try {
    const { caseId, userId, file, description } = input;

    // Validate file type
    if (!validateFileType(file.type)) {
      return {
        success: false,
        error: `File type ${file.type} is not allowed. Allowed types: PDF, DOC, DOCX, TXT, JPG, PNG, GIF, WEBP, XLS, XLSX, CSV`,
      };
    }

    // Validate file size
    if (file.size > MAX_FILE_SIZE) {
      return {
        success: false,
        error: `File size exceeds maximum of ${formatFileSize(MAX_FILE_SIZE)}`,
      };
    }

    // Check case status
    const caseRecord = await prisma.case.findUnique({
      where: { id: caseId },
      select: {
        status: true,
        claimantId: true,
        respondentId: true,
      },
    });

    if (!caseRecord) {
      return { success: false, error: 'Case not found' };
    }

    // Verify case is in evidence submission phase
    if (caseRecord.status !== CaseStatus.EVIDENCE_SUBMISSION) {
      return { success: false, error: 'Case is not accepting evidence submissions' };
    }

    // Verify user is a party to the case
    if (caseRecord.claimantId !== userId && caseRecord.respondentId !== userId) {
      return { success: false, error: 'You are not a party to this case' };
    }

    // Check file count and size limits for the case
    const existingEvidence = await prisma.evidence.findMany({
      where: { caseId, deletedAt: null },
      select: { fileSize: true },
    });

    if (existingEvidence.length >= MAX_FILES_PER_CASE) {
      return {
        success: false,
        error: `Maximum of ${MAX_FILES_PER_CASE} files per case exceeded`,
      };
    }

    const totalSize = existingEvidence.reduce((sum, e) => sum + e.fileSize, 0);
    if (totalSize + file.size > MAX_TOTAL_SIZE_PER_CASE) {
      return {
        success: false,
        error: `Total evidence size would exceed ${formatFileSize(MAX_TOTAL_SIZE_PER_CASE)}`,
      };
    }

    // Read file and generate hash
    const buffer = Buffer.from(await file.arrayBuffer());
    const fileHash = generateFileHash(buffer);

    // Check for duplicate files
    const duplicate = await prisma.evidence.findFirst({
      where: { caseId, fileHash, deletedAt: null },
    });

    if (duplicate) {
      return { success: false, error: 'This file has already been uploaded' };
    }

    // Upload to Vercel Blob
    const storageKey = `evidence/${caseId}/${Date.now()}-${file.name}`;
    const _blob = await put(storageKey, buffer, {
      access: 'public',
      contentType: file.type,
    });

    // Create evidence record
    const evidence = await prisma.evidence.create({
      data: {
        caseId,
        submittedById: userId,
        fileName: file.name,
        fileType: file.type,
        fileSize: file.size,
        fileHash,
        storageKey,
        storageBucket: 'vercel-blob',
        description,
      },
    });

    // Log the upload
    await createAuditLog({
      action: AuditAction.EVIDENCE_UPLOADED,
      userId,
      caseId,
      metadata: {
        evidenceId: evidence.id,
        fileName: file.name,
        fileSize: file.size,
        fileType: file.type,
      },
    });

    return { success: true, evidence };
  } catch (error) {
    console.error('Failed to upload evidence:', error);
    return {
      success: false,
      error: error instanceof Error ? error.message : 'Failed to upload evidence',
    };
  }
}

// Get evidence for a case
export async function getCaseEvidence(
  caseId: string,
  userId: string
): Promise<Evidence[]> {
  // Verify user has access
  const caseRecord = await prisma.case.findUnique({
    where: { id: caseId },
    select: { claimantId: true, respondentId: true },
  });

  if (!caseRecord) {
    return [];
  }

  if (caseRecord.claimantId !== userId && caseRecord.respondentId !== userId) {
    return [];
  }

  return prisma.evidence.findMany({
    where: { caseId, deletedAt: null },
    orderBy: { submittedAt: 'desc' },
  });
}

// Get single evidence item
export async function getEvidenceById(evidenceId: string): Promise<Evidence | null> {
  return prisma.evidence.findFirst({
    where: { id: evidenceId, deletedAt: null },
  });
}

// Mark evidence as viewed by opposing party
export async function markEvidenceViewed(
  evidenceId: string,
  viewerId: string
): Promise<boolean> {
  try {
    const evidence = await prisma.evidence.findUnique({
      where: { id: evidenceId },
      include: {
        case: {
          select: { claimantId: true, respondentId: true },
        },
      },
    });

    if (!evidence) {
      return false;
    }

    // Check if viewer is the opposing party
    const isOpposingParty =
      (evidence.case.claimantId === viewerId &&
        evidence.submittedById === evidence.case.respondentId) ||
      (evidence.case.respondentId === viewerId &&
        evidence.submittedById === evidence.case.claimantId);

    if (isOpposingParty && !evidence.viewedByOpposingParty) {
      await prisma.evidence.update({
        where: { id: evidenceId },
        data: {
          viewedByOpposingParty: true,
          viewedAt: new Date(),
        },
      });

      await createAuditLog({
        action: AuditAction.EVIDENCE_VIEWED,
        userId: viewerId,
        caseId: evidence.caseId,
        metadata: {
          evidenceId,
          fileName: evidence.fileName,
        },
      });
    }

    return true;
  } catch (error) {
    console.error('Failed to mark evidence viewed:', error);
    return false;
  }
}

// Delete evidence (soft delete)
export async function deleteEvidence(
  evidenceId: string,
  userId: string
): Promise<{ success: boolean; error?: string }> {
  try {
    const evidence = await prisma.evidence.findUnique({
      where: { id: evidenceId },
      include: {
        case: {
          select: { status: true, claimantId: true, respondentId: true },
        },
      },
    });

    if (!evidence) {
      return { success: false, error: 'Evidence not found' };
    }

    // Only the uploader can delete
    if (evidence.submittedById !== userId) {
      return { success: false, error: 'You can only delete your own evidence' };
    }

    // Can only delete during evidence submission phase
    if (evidence.case.status !== CaseStatus.EVIDENCE_SUBMISSION) {
      return { success: false, error: 'Evidence can no longer be deleted' };
    }

    // Soft delete
    await prisma.evidence.update({
      where: { id: evidenceId },
      data: { deletedAt: new Date() },
    });

    // Delete from blob storage
    try {
      await del(evidence.storageKey);
    } catch (e) {
      console.error('Failed to delete blob:', e);
      // Don't fail the operation if blob deletion fails
    }

    await createAuditLog({
      action: AuditAction.EVIDENCE_DELETED,
      userId,
      caseId: evidence.caseId,
      metadata: {
        evidenceId,
        fileName: evidence.fileName,
      },
    });

    return { success: true };
  } catch (error) {
    console.error('Failed to delete evidence:', error);
    return {
      success: false,
      error: error instanceof Error ? error.message : 'Failed to delete evidence',
    };
  }
}

// Get evidence statistics for a case
export async function getEvidenceStats(caseId: string): Promise<{
  totalFiles: number;
  totalSize: number;
  byParty: {
    claimant: { count: number; size: number };
    respondent: { count: number; size: number };
  };
  remainingFiles: number;
  remainingSize: number;
}> {
  const caseRecord = await prisma.case.findUnique({
    where: { id: caseId },
    select: { claimantId: true, respondentId: true },
  });

  if (!caseRecord) {
    return {
      totalFiles: 0,
      totalSize: 0,
      byParty: {
        claimant: { count: 0, size: 0 },
        respondent: { count: 0, size: 0 },
      },
      remainingFiles: MAX_FILES_PER_CASE,
      remainingSize: MAX_TOTAL_SIZE_PER_CASE,
    };
  }

  const evidence = await prisma.evidence.findMany({
    where: { caseId, deletedAt: null },
    select: { fileSize: true, submittedById: true },
  });

  const claimantEvidence = evidence.filter(
    (e) => e.submittedById === caseRecord.claimantId
  );
  const respondentEvidence = evidence.filter(
    (e) => e.submittedById === caseRecord.respondentId
  );

  const totalSize = evidence.reduce((sum, e) => sum + e.fileSize, 0);

  return {
    totalFiles: evidence.length,
    totalSize,
    byParty: {
      claimant: {
        count: claimantEvidence.length,
        size: claimantEvidence.reduce((sum, e) => sum + e.fileSize, 0),
      },
      respondent: {
        count: respondentEvidence.length,
        size: respondentEvidence.reduce((sum, e) => sum + e.fileSize, 0),
      },
    },
    remainingFiles: MAX_FILES_PER_CASE - evidence.length,
    remainingSize: MAX_TOTAL_SIZE_PER_CASE - totalSize,
  };
}
