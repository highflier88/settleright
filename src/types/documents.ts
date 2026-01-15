/**
 * Document Processing Types
 *
 * Type definitions for the document processing pipeline.
 */

import type { DocumentType, ProcessingStatus } from '@prisma/client';

/**
 * Extracted entities from a document
 */
export interface ExtractedEntities {
  dates: ExtractedDate[];
  amounts: ExtractedAmount[];
  parties: ExtractedParty[];
  addresses: string[];
  emails: string[];
  phones: string[];
}

export interface ExtractedDate {
  value: string;
  normalized: string; // ISO format
  context?: string;
}

export interface ExtractedAmount {
  value: number;
  currency: string;
  raw: string;
  context?: string;
}

export interface ExtractedParty {
  name: string;
  type: 'person' | 'organization' | 'unknown';
  role?: string;
}

/**
 * Text extraction result
 */
export interface ExtractionResult {
  text: string;
  method: 'pdf-parse' | 'mammoth' | 'text' | 'ocr';
  confidence?: number;
  pageCount?: number;
  metadata?: {
    author?: string;
    title?: string;
    createdDate?: string;
  };
}

/**
 * OCR result from AWS Textract
 */
export interface OCRResult {
  text: string;
  confidence: number;
  blocks: OCRBlock[];
}

export interface OCRBlock {
  type: 'PAGE' | 'LINE' | 'WORD' | 'TABLE' | 'CELL' | 'KEY_VALUE_SET';
  text: string;
  confidence: number;
  boundingBox?: {
    width: number;
    height: number;
    left: number;
    top: number;
  };
}

/**
 * Document classification result
 */
export interface ClassificationResult {
  documentType: DocumentType;
  confidence: number;
  reasoning?: string;
}

/**
 * Summarization result
 */
export interface SummarizationResult {
  summary: string;
  keyPoints: string[];
}

/**
 * Full document processing result
 */
export interface DocumentProcessingResult {
  evidenceId: string;
  status: ProcessingStatus;
  extraction?: ExtractionResult;
  ocr?: OCRResult;
  classification?: ClassificationResult;
  entities?: ExtractedEntities;
  summarization?: SummarizationResult;
  error?: string;
  processingTimeMs: number;
}

/**
 * Processing step for progress tracking
 */
export type ProcessingStep =
  | 'queued'
  | 'extracting'
  | 'ocr_processing'
  | 'classifying'
  | 'extracting_entities'
  | 'summarizing'
  | 'completed'
  | 'failed';

/**
 * Processing progress update
 */
export interface ProcessingProgress {
  evidenceId: string;
  jobId: string;
  step: ProcessingStep;
  progress: number; // 0-100
  message?: string;
}

/**
 * Document processor options
 */
export interface ProcessorOptions {
  skipOCR?: boolean;
  skipClassification?: boolean;
  skipEntities?: boolean;
  skipSummarization?: boolean;
  ocrConfidenceThreshold?: number; // Minimum confidence to use OCR
  maxTextLength?: number; // Max chars to process
}

/**
 * Supported file types for processing
 */
export const SUPPORTED_MIME_TYPES = {
  pdf: 'application/pdf',
  docx: 'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
  doc: 'application/msword',
  txt: 'text/plain',
  png: 'image/png',
  jpg: 'image/jpeg',
  jpeg: 'image/jpeg',
  gif: 'image/gif',
  webp: 'image/webp',
  tiff: 'image/tiff',
} as const;

export type SupportedMimeType = (typeof SUPPORTED_MIME_TYPES)[keyof typeof SUPPORTED_MIME_TYPES];

/**
 * Check if a file type is supported for text extraction
 */
export function isTextExtractable(mimeType: string): boolean {
  return ['application/pdf', 'application/vnd.openxmlformats-officedocument.wordprocessingml.document', 'application/msword', 'text/plain'].includes(mimeType);
}

/**
 * Check if a file type requires OCR
 */
export function requiresOCR(mimeType: string): boolean {
  return mimeType.startsWith('image/');
}
