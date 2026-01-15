import { put, del, list, head } from '@vercel/blob';
import { createHash } from 'crypto';

// Folder structure for blob storage
const FOLDERS = {
  evidence: 'evidence',
  agreements: 'agreements',
  awards: 'awards',
  signatures: 'signatures',
} as const;

type FolderType = keyof typeof FOLDERS;

// Allowed MIME types for evidence
const ALLOWED_EVIDENCE_TYPES = [
  'application/pdf',
  'image/jpeg',
  'image/png',
  'image/gif',
  'image/webp',
  'text/plain',
  'application/msword',
  'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
  'application/vnd.ms-excel',
  'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
];

// Max file size (10MB)
const MAX_FILE_SIZE = 10 * 1024 * 1024;

export interface UploadResult {
  url: string;
  pathname: string;
  contentType: string;
  size: number;
  hash: string;
}

export interface UploadOptions {
  folder: FolderType;
  caseId: string;
  fileName: string;
  contentType: string;
  userId: string;
}

function generateStoragePath(options: UploadOptions): string {
  const timestamp = Date.now();
  const sanitizedFileName = options.fileName.replace(/[^a-zA-Z0-9.-]/g, '_');
  return `${FOLDERS[options.folder]}/${options.caseId}/${timestamp}-${sanitizedFileName}`;
}

function calculateHash(buffer: Buffer): string {
  return createHash('sha256').update(buffer).digest('hex');
}

export async function uploadFile(
  file: Buffer | Blob | File,
  options: UploadOptions
): Promise<UploadResult> {
  // Validate content type for evidence
  if (options.folder === 'evidence' && !ALLOWED_EVIDENCE_TYPES.includes(options.contentType)) {
    throw new Error(`File type ${options.contentType} is not allowed`);
  }

  // Get buffer for hash calculation
  let buffer: Buffer;
  let size: number;

  if (file instanceof Buffer) {
    buffer = file;
    size = buffer.length;
  } else if (file instanceof Blob || file instanceof File) {
    const arrayBuffer = await file.arrayBuffer();
    buffer = Buffer.from(arrayBuffer);
    size = buffer.length;
  } else {
    throw new Error('Invalid file type');
  }

  // Validate file size
  if (size > MAX_FILE_SIZE) {
    throw new Error(`File size exceeds maximum allowed size of ${MAX_FILE_SIZE / 1024 / 1024}MB`);
  }

  const pathname = generateStoragePath(options);
  const hash = calculateHash(buffer);

  const blob = await put(pathname, buffer, {
    access: 'public',
    contentType: options.contentType,
    addRandomSuffix: false,
  });

  return {
    url: blob.url,
    pathname: blob.pathname,
    contentType: options.contentType,
    size,
    hash,
  };
}

export async function deleteFile(pathname: string): Promise<void> {
  await del(pathname);
}

export async function deleteFilesForCase(
  folder: FolderType,
  caseId: string
): Promise<number> {
  const prefix = `${FOLDERS[folder]}/${caseId}/`;
  const { blobs } = await list({ prefix });

  if (blobs.length === 0) {
    return 0;
  }

  await Promise.all(blobs.map((blob) => del(blob.url)));
  return blobs.length;
}

export async function getFileMetadata(pathname: string) {
  try {
    return await head(pathname);
  } catch {
    return null;
  }
}

export async function listCaseFiles(folder: FolderType, caseId: string) {
  const prefix = `${FOLDERS[folder]}/${caseId}/`;
  const { blobs } = await list({ prefix });
  return blobs;
}

// Generate a signed URL for time-limited access (if needed)
// Note: Vercel Blob doesn't support signed URLs natively,
// so we implement access control at the application level
export function getPublicUrl(pathname: string): string {
  const blobUrl = process.env.BLOB_READ_WRITE_TOKEN
    ? `https://${process.env.VERCEL_BLOB_STORE_ID}.public.blob.vercel-storage.com/${pathname}`
    : pathname;
  return blobUrl;
}

// Export constants for use elsewhere
export { FOLDERS, ALLOWED_EVIDENCE_TYPES, MAX_FILE_SIZE };
