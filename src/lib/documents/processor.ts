/**
 * Document Processor
 *
 * Main orchestrator for the document processing pipeline.
 * Coordinates text extraction, OCR, classification, entity extraction,
 * and summarization.
 */

import { prisma } from '@/lib/db';
import type {
  DocumentProcessingResult,
  ProcessorOptions,
  ProcessingProgress,
} from '@/types/documents';

import { classifyDocument, classifyByFilename } from './classifier';
import { extractEntities } from './entities';
import { extractText, needsOCR, cleanExtractedText } from './extractor';
import { performOCR, isOCRSupported, requiresOCRProcessing } from './ocr';
import { summarizeDocument } from './summarizer';

import type { ProcessingStatus } from '@prisma/client';

// Default processor options
const DEFAULT_OPTIONS: ProcessorOptions = {
  skipOCR: false,
  skipClassification: false,
  skipEntities: false,
  skipSummarization: false,
  ocrConfidenceThreshold: 0.5,
  maxTextLength: 50000,
};

/**
 * Progress callback type
 */
type ProgressCallback = (progress: ProcessingProgress) => Promise<void>;

/**
 * Process a single evidence document
 */
export async function processDocument(
  evidenceId: string,
  options: ProcessorOptions = {},
  onProgress?: ProgressCallback
): Promise<DocumentProcessingResult> {
  const opts = { ...DEFAULT_OPTIONS, ...options };
  const startTime = Date.now();

  // Get evidence record with file info
  const evidence = await prisma.evidence.findUnique({
    where: { id: evidenceId },
    include: { case: true },
  });

  if (!evidence) {
    throw new Error(`Evidence not found: ${evidenceId}`);
  }

  // Create or get processing job
  const existingJob = await prisma.documentProcessingJob.findFirst({
    where: {
      evidenceId,
      status: { in: ['PENDING', 'QUEUED'] },
    },
    orderBy: { createdAt: 'desc' },
  });

  const job = existingJob
    ? await prisma.documentProcessingJob.update({
        where: { id: existingJob.id },
        data: { status: 'QUEUED', startedAt: new Date(), errorMessage: null },
      })
    : await prisma.documentProcessingJob.create({
        data: { evidenceId, status: 'QUEUED', startedAt: new Date() },
      });

  const updateProgress = async (
    step: ProcessingProgress['step'],
    progress: number,
    message?: string
  ) => {
    const status = stepToStatus(step);

    await Promise.all([
      // Update job record
      prisma.documentProcessingJob.update({
        where: { id: job.id },
        data: { status, currentStep: step, progress },
      }),
      // Update evidence status
      prisma.evidence.update({
        where: { id: evidenceId },
        data: { processingStatus: status },
      }),
      // Call progress callback
      onProgress?.({
        evidenceId,
        jobId: job.id,
        step,
        progress,
        message,
      }),
    ]);
  };

  try {
    // Step 1: Fetch file from storage
    await updateProgress('extracting', 10, 'Fetching document');
    const fileBuffer = await fetchFileFromStorage(evidence.storageKey);

    // Step 2: Extract text
    await updateProgress('extracting', 20, 'Extracting text');
    const extractionResult = await extractText(fileBuffer, evidence.fileType, evidence.fileName);
    let extractedText = cleanExtractedText(extractionResult.text);

    // Step 3: OCR if needed
    let ocrResult = null;
    const needsOCRProcessing =
      !opts.skipOCR &&
      isOCRSupported(evidence.fileType) &&
      (requiresOCRProcessing(evidence.fileType) || needsOCR(extractionResult));

    if (needsOCRProcessing) {
      await updateProgress('ocr_processing', 30, 'Performing OCR');
      try {
        ocrResult = await performOCR(fileBuffer);
        // Use OCR text if it's better
        if (ocrResult.text.length > extractedText.length) {
          extractedText = cleanExtractedText(ocrResult.text);
        }
      } catch (error) {
        console.error('OCR failed:', error);
        // Continue without OCR
      }
    }

    // Truncate text if too long
    const maxLen = opts.maxTextLength || 50000;
    if (extractedText.length > maxLen) {
      extractedText = extractedText.slice(0, maxLen);
    }

    // Step 4: Classification
    let classificationResult = null;
    if (!opts.skipClassification && extractedText.length > 50) {
      await updateProgress('classifying', 50, 'Classifying document');

      // Try filename-based classification first
      const filenameType = classifyByFilename(evidence.fileName);
      if (filenameType) {
        classificationResult = {
          documentType: filenameType,
          confidence: 0.7,
          reasoning: 'Classified based on filename',
        };
      } else {
        classificationResult = await classifyDocument(extractedText);
      }
    }

    // Step 5: Entity extraction
    let entitiesResult = null;
    if (!opts.skipEntities && extractedText.length > 50) {
      await updateProgress('extracting_entities', 70, 'Extracting entities');
      entitiesResult = await extractEntities(extractedText);
    }

    // Step 6: Summarization
    let summarizationResult = null;
    if (!opts.skipSummarization && extractedText.length > 100) {
      await updateProgress('summarizing', 85, 'Generating summary');
      summarizationResult = await summarizeDocument(
        extractedText,
        classificationResult?.documentType
      );
    }

    // Step 7: Save results
    await updateProgress('completed', 100, 'Processing complete');

    await prisma.evidence.update({
      where: { id: evidenceId },
      data: {
        processingStatus: 'COMPLETED',
        processedAt: new Date(),
        extractedText,
        ocrText: ocrResult?.text,
        ocrProcessedAt: ocrResult ? new Date() : null,
        ocrConfidence: ocrResult?.confidence,
        documentType: classificationResult?.documentType,
        classificationConfidence: classificationResult?.confidence,
        // eslint-disable-next-line @typescript-eslint/no-unsafe-assignment
        extractedEntities: entitiesResult ? JSON.parse(JSON.stringify(entitiesResult)) : undefined,
        summary: summarizationResult?.summary,
        keyPoints: summarizationResult?.keyPoints || [],
        processingError: null,
      },
    });

    await prisma.documentProcessingJob.update({
      where: { id: job.id },
      data: {
        status: 'COMPLETED',
        progress: 100,
        completedAt: new Date(),
        metadata: {
          extractionMethod: extractionResult.method,
          textLength: extractedText.length,
          ocrUsed: !!ocrResult,
          processingTimeMs: Date.now() - startTime,
        },
      },
    });

    return {
      evidenceId,
      status: 'COMPLETED',
      extraction: extractionResult,
      ocr: ocrResult || undefined,
      classification: classificationResult || undefined,
      entities: entitiesResult || undefined,
      summarization: summarizationResult || undefined,
      processingTimeMs: Date.now() - startTime,
    };
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : 'Unknown error';

    await Promise.all([
      prisma.evidence.update({
        where: { id: evidenceId },
        data: {
          processingStatus: 'FAILED',
          processingError: errorMessage,
        },
      }),
      prisma.documentProcessingJob.update({
        where: { id: job.id },
        data: {
          status: 'FAILED',
          errorMessage,
          completedAt: new Date(),
        },
      }),
    ]);

    return {
      evidenceId,
      status: 'FAILED',
      error: errorMessage,
      processingTimeMs: Date.now() - startTime,
    };
  }
}

/**
 * Convert processing step to status enum
 */
function stepToStatus(step: ProcessingProgress['step']): ProcessingStatus {
  const mapping: Record<ProcessingProgress['step'], ProcessingStatus> = {
    queued: 'QUEUED',
    extracting: 'EXTRACTING',
    ocr_processing: 'OCR_PROCESSING',
    classifying: 'CLASSIFYING',
    extracting_entities: 'EXTRACTING_ENTITIES',
    summarizing: 'SUMMARIZING',
    completed: 'COMPLETED',
    failed: 'FAILED',
  };
  return mapping[step];
}

/**
 * Fetch file from Vercel Blob storage
 */
async function fetchFileFromStorage(storageKey: string): Promise<Buffer> {
  // Construct the blob URL
  const blobStoreId = process.env.VERCEL_BLOB_STORE_ID;
  const url = blobStoreId
    ? `https://${blobStoreId}.public.blob.vercel-storage.com/${storageKey}`
    : storageKey;

  const response = await fetch(url);
  if (!response.ok) {
    throw new Error(`Failed to fetch file: ${response.status} ${response.statusText}`);
  }

  const arrayBuffer = await response.arrayBuffer();
  return Buffer.from(arrayBuffer);
}

/**
 * Get processing status for an evidence item
 */
export async function getProcessingStatus(evidenceId: string) {
  const evidence = await prisma.evidence.findUnique({
    where: { id: evidenceId },
    select: {
      processingStatus: true,
      processedAt: true,
      processingError: true,
      extractedText: true,
      documentType: true,
      extractedEntities: true,
      summary: true,
      keyPoints: true,
    },
  });

  if (!evidence) {
    return null;
  }

  const latestJob = await prisma.documentProcessingJob.findFirst({
    where: { evidenceId },
    orderBy: { createdAt: 'desc' },
  });

  return {
    ...evidence,
    currentJob: latestJob,
  };
}
