/**
 * Evidence Factory
 *
 * Creates mock Evidence objects for testing.
 */

import { generateId } from './utils';

export interface EvidenceFactoryOptions {
  id?: string;
  caseId?: string;
  uploadedById?: string;
  type?: string;
  status?: string;
  title?: string;
  description?: string;
  fileName?: string;
  mimeType?: string;
  fileSize?: number;
  fileUrl?: string;
  createdAt?: Date;
}

/**
 * Create a mock Evidence
 */
export function createEvidence(options: EvidenceFactoryOptions = {}) {
  const id = options.id ?? generateId();
  const createdAt = options.createdAt ?? new Date();

  return {
    id,
    caseId: options.caseId ?? generateId(),
    uploadedById: options.uploadedById ?? generateId(),
    type: options.type ?? 'DOCUMENT',
    status: options.status ?? 'UPLOADED',
    title: options.title ?? 'Test Evidence Document',
    description: options.description ?? 'Evidence document for testing purposes',
    fileName: options.fileName ?? 'test-document.pdf',
    mimeType: options.mimeType ?? 'application/pdf',
    fileSize: options.fileSize ?? 1024 * 100,
    fileUrl: options.fileUrl ?? `https://storage.example.com/evidence/${id}`,
    fileHash: generateId('hash'),
    createdAt,
    updatedAt: createdAt,
    deletedAt: null,
  };
}

export const createDocumentEvidence = (options: EvidenceFactoryOptions = {}) =>
  createEvidence({ ...options, type: 'DOCUMENT', fileName: options.fileName ?? 'contract.pdf' });

export const createImageEvidence = (options: EvidenceFactoryOptions = {}) =>
  createEvidence({
    ...options,
    type: 'IMAGE',
    fileName: options.fileName ?? 'photo.jpg',
    mimeType: 'image/jpeg',
  });

export const createVideoEvidence = (options: EvidenceFactoryOptions = {}) =>
  createEvidence({
    ...options,
    type: 'VIDEO',
    fileName: options.fileName ?? 'video.mp4',
    mimeType: 'video/mp4',
    fileSize: 1024 * 1024 * 50,
  });

export const createAudioEvidence = (options: EvidenceFactoryOptions = {}) =>
  createEvidence({
    ...options,
    type: 'AUDIO',
    fileName: options.fileName ?? 'audio.mp3',
    mimeType: 'audio/mpeg',
  });

export const createCommunicationEvidence = (options: EvidenceFactoryOptions = {}) =>
  createEvidence({
    ...options,
    type: 'COMMUNICATION',
    title: options.title ?? 'Email Correspondence',
  });

export const createFinancialEvidence = (options: EvidenceFactoryOptions = {}) =>
  createEvidence({ ...options, type: 'FINANCIAL', title: options.title ?? 'Bank Statements' });

/**
 * Create multiple evidence items for a case
 */
export function createEvidenceSet(caseId: string, uploadedById: string, count = 5) {
  const types = ['DOCUMENT', 'IMAGE', 'COMMUNICATION', 'FINANCIAL', 'OTHER'];
  return Array.from({ length: count }, (_, i) =>
    createEvidence({
      caseId,
      uploadedById,
      type: types[i % types.length],
      title: `Evidence Item ${i + 1}`,
    })
  );
}
