/**
 * Document Processing Module
 *
 * Exports all document processing functionality including
 * text extraction, OCR, classification, entity extraction,
 * summarization, and queue management.
 */

// Main processor
export { processDocument, getProcessingStatus } from './processor';

// Queue management
export {
  queueDocument,
  queueCaseDocuments,
  processPendingDocuments,
  getCachedProgress,
  getQueueStats,
  retryFailedDocuments,
  cancelProcessing,
  cleanupOldJobs,
} from './queue';

// Text extraction
export {
  extractText,
  extractFromPDF,
  extractFromDOCX,
  extractFromText,
  needsOCR,
  cleanExtractedText,
} from './extractor';

// OCR
export {
  performOCR,
  isOCRQualityAcceptable,
  estimateOCRCost,
  requiresOCRProcessing,
  isOCRSupported,
  SUPPORTED_OCR_FORMATS,
} from './ocr';

// Classification
export {
  classifyDocument,
  classifyByFilename,
  estimateClassificationCost,
} from './classifier';

// Entity extraction
export {
  extractEntities,
  extractDates,
  extractAmounts,
  extractEmails,
  extractPhones,
  extractParties,
  extractEntitiesQuick,
} from './entities';

// Summarization
export {
  summarizeDocument,
  generateQuickSummary,
  estimateSummarizationCost,
} from './summarizer';

// Re-export types
export type {
  ExtractedEntities,
  ExtractedDate,
  ExtractedAmount,
  ExtractedParty,
  ExtractionResult,
  OCRResult,
  OCRBlock,
  ClassificationResult,
  SummarizationResult,
  DocumentProcessingResult,
  ProcessingStep,
  ProcessingProgress,
  ProcessorOptions,
} from '@/types/documents';
