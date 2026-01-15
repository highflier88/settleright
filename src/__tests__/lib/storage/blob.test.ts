/**
 * Blob Storage Service Tests
 *
 * Tests for file upload, deletion, and retrieval.
 */

import { put, del, list, head } from '@vercel/blob';
import {
  uploadFile,
  deleteFile,
  deleteFilesForCase,
  getFileMetadata,
  listCaseFiles,
  getPublicUrl,
  FOLDERS,
  ALLOWED_EVIDENCE_TYPES,
  MAX_FILE_SIZE,
} from '@/lib/storage/blob';

// Mock dependencies
jest.mock('@vercel/blob', () => ({
  put: jest.fn(),
  del: jest.fn(),
  list: jest.fn(),
  head: jest.fn(),
}));

const mockPut = put as jest.Mock;
const mockDel = del as jest.Mock;
const mockList = list as jest.Mock;
const mockHead = head as jest.Mock;

describe('Blob Storage Service', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  // ==========================================================================
  // Constants
  // ==========================================================================

  describe('Constants', () => {
    it('should define storage folders', () => {
      expect(FOLDERS.evidence).toBe('evidence');
      expect(FOLDERS.agreements).toBe('agreements');
      expect(FOLDERS.awards).toBe('awards');
      expect(FOLDERS.signatures).toBe('signatures');
    });

    it('should define allowed evidence types', () => {
      expect(ALLOWED_EVIDENCE_TYPES).toContain('application/pdf');
      expect(ALLOWED_EVIDENCE_TYPES).toContain('image/jpeg');
      expect(ALLOWED_EVIDENCE_TYPES).toContain('image/png');
      expect(ALLOWED_EVIDENCE_TYPES).toContain('text/plain');
    });

    it('should define max file size as 10MB', () => {
      expect(MAX_FILE_SIZE).toBe(10 * 1024 * 1024);
    });
  });

  // ==========================================================================
  // Upload File
  // ==========================================================================

  describe('uploadFile', () => {
    const defaultOptions = {
      folder: 'evidence' as const,
      caseId: 'case-123',
      fileName: 'document.pdf',
      contentType: 'application/pdf',
      userId: 'user-123',
    };

    it('should upload a buffer file successfully', async () => {
      const buffer = Buffer.from('test content');
      mockPut.mockResolvedValue({
        url: 'https://blob.vercel-storage.com/evidence/case-123/document.pdf',
        pathname: 'evidence/case-123/123456-document.pdf',
      });

      const result = await uploadFile(buffer, defaultOptions);

      expect(result.url).toContain('blob.vercel-storage.com');
      expect(result.contentType).toBe('application/pdf');
      expect(result.size).toBe(buffer.length);
      expect(result.hash).toHaveLength(64); // SHA-256 hex
      expect(mockPut).toHaveBeenCalledWith(
        expect.stringContaining('evidence/case-123/'),
        buffer,
        expect.objectContaining({
          access: 'public',
          contentType: 'application/pdf',
        })
      );
    });

    it('should reject disallowed content types for evidence', async () => {
      const buffer = Buffer.from('test');
      const options = {
        ...defaultOptions,
        contentType: 'application/x-executable',
      };

      await expect(uploadFile(buffer, options)).rejects.toThrow(
        'File type application/x-executable is not allowed'
      );
    });

    it('should allow any content type for non-evidence folders', async () => {
      const buffer = Buffer.from('test');
      mockPut.mockResolvedValue({
        url: 'https://blob.vercel-storage.com/awards/test.bin',
        pathname: 'awards/test.bin',
      });

      const options = {
        ...defaultOptions,
        folder: 'awards' as const,
        contentType: 'application/octet-stream',
      };

      const result = await uploadFile(buffer, options);

      expect(result.contentType).toBe('application/octet-stream');
    });

    it('should reject files exceeding max size', async () => {
      const largeBuffer = Buffer.alloc(MAX_FILE_SIZE + 1);

      await expect(uploadFile(largeBuffer, defaultOptions)).rejects.toThrow(
        'File size exceeds maximum allowed size'
      );
    });

    it('should sanitize file names', async () => {
      const buffer = Buffer.from('test');
      mockPut.mockResolvedValue({
        url: 'https://blob.vercel-storage.com/test.pdf',
        pathname: 'evidence/case-123/test_file.pdf',
      });

      const options = {
        ...defaultOptions,
        fileName: 'test file (1).pdf',
      };

      await uploadFile(buffer, options);

      expect(mockPut).toHaveBeenCalledWith(
        expect.stringMatching(/test_file__1_.pdf$/),
        buffer,
        expect.any(Object)
      );
    });

    it('should throw error for invalid file type', async () => {
      await expect(uploadFile('invalid' as unknown as Buffer, defaultOptions)).rejects.toThrow(
        'Invalid file type'
      );
    });
  });

  // ==========================================================================
  // Delete File
  // ==========================================================================

  describe('deleteFile', () => {
    it('should delete a file by pathname', async () => {
      mockDel.mockResolvedValue(undefined);

      await deleteFile('evidence/case-123/document.pdf');

      expect(mockDel).toHaveBeenCalledWith('evidence/case-123/document.pdf');
    });
  });

  describe('deleteFilesForCase', () => {
    it('should delete all files for a case', async () => {
      mockList.mockResolvedValue({
        blobs: [
          { url: 'https://blob.com/evidence/case-123/doc1.pdf' },
          { url: 'https://blob.com/evidence/case-123/doc2.pdf' },
          { url: 'https://blob.com/evidence/case-123/img1.jpg' },
        ],
      });
      mockDel.mockResolvedValue(undefined);

      const count = await deleteFilesForCase('evidence', 'case-123');

      expect(count).toBe(3);
      expect(mockDel).toHaveBeenCalledTimes(3);
    });

    it('should return 0 if no files exist', async () => {
      mockList.mockResolvedValue({ blobs: [] });

      const count = await deleteFilesForCase('evidence', 'case-123');

      expect(count).toBe(0);
      expect(mockDel).not.toHaveBeenCalled();
    });

    it('should use correct prefix for folder and case', async () => {
      mockList.mockResolvedValue({ blobs: [] });

      await deleteFilesForCase('awards', 'case-456');

      expect(mockList).toHaveBeenCalledWith({ prefix: 'awards/case-456/' });
    });
  });

  // ==========================================================================
  // Get File Metadata
  // ==========================================================================

  describe('getFileMetadata', () => {
    it('should return metadata for existing file', async () => {
      const metadata = {
        url: 'https://blob.com/evidence/doc.pdf',
        pathname: 'evidence/doc.pdf',
        contentType: 'application/pdf',
        size: 1024,
        uploadedAt: new Date(),
      };
      mockHead.mockResolvedValue(metadata);

      const result = await getFileMetadata('evidence/doc.pdf');

      expect(result).toEqual(metadata);
      expect(mockHead).toHaveBeenCalledWith('evidence/doc.pdf');
    });

    it('should return null for non-existing file', async () => {
      mockHead.mockRejectedValue(new Error('Not found'));

      const result = await getFileMetadata('evidence/nonexistent.pdf');

      expect(result).toBeNull();
    });
  });

  // ==========================================================================
  // List Case Files
  // ==========================================================================

  describe('listCaseFiles', () => {
    it('should list all files for a case', async () => {
      const blobs = [
        {
          url: 'https://blob.com/evidence/case-123/doc1.pdf',
          pathname: 'evidence/case-123/doc1.pdf',
        },
        {
          url: 'https://blob.com/evidence/case-123/doc2.pdf',
          pathname: 'evidence/case-123/doc2.pdf',
        },
      ];
      mockList.mockResolvedValue({ blobs });

      const result = await listCaseFiles('evidence', 'case-123');

      expect(result).toEqual(blobs);
      expect(mockList).toHaveBeenCalledWith({ prefix: 'evidence/case-123/' });
    });

    it('should return empty array if no files', async () => {
      mockList.mockResolvedValue({ blobs: [] });

      const result = await listCaseFiles('signatures', 'case-123');

      expect(result).toEqual([]);
    });
  });

  // ==========================================================================
  // Get Public URL
  // ==========================================================================

  describe('getPublicUrl', () => {
    it('should return pathname when no blob store ID configured', () => {
      const originalEnv = process.env.BLOB_READ_WRITE_TOKEN;
      delete process.env.BLOB_READ_WRITE_TOKEN;

      const result = getPublicUrl('evidence/case-123/doc.pdf');

      expect(result).toBe('evidence/case-123/doc.pdf');

      process.env.BLOB_READ_WRITE_TOKEN = originalEnv;
    });

    it('should construct full URL when blob store configured', () => {
      const originalToken = process.env.BLOB_READ_WRITE_TOKEN;
      const originalStoreId = process.env.VERCEL_BLOB_STORE_ID;

      process.env.BLOB_READ_WRITE_TOKEN = 'test-token';
      process.env.VERCEL_BLOB_STORE_ID = 'store123';

      const result = getPublicUrl('evidence/case-123/doc.pdf');

      expect(result).toContain('public.blob.vercel-storage.com');
      expect(result).toContain('evidence/case-123/doc.pdf');

      process.env.BLOB_READ_WRITE_TOKEN = originalToken;
      process.env.VERCEL_BLOB_STORE_ID = originalStoreId;
    });
  });
});
