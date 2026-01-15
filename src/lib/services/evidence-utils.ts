/**
 * Client-safe evidence utilities.
 * These can be imported in both server and client components.
 */

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
