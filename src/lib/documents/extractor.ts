/**
 * Document Text Extractor
 *
 * Extracts text content from PDFs, DOCX files, and plain text.
 * Falls back to OCR when text extraction yields minimal results.
 */

import mammoth from 'mammoth';
// eslint-disable-next-line @typescript-eslint/no-require-imports, @typescript-eslint/no-var-requires
const pdfParse = require('pdf-parse') as (buffer: Buffer) => Promise<{
  text: string;
  numpages: number;
  info?: Record<string, unknown>;
}>;

import type { ExtractionResult } from '@/types/documents';

// Minimum text length to consider extraction successful
const MIN_TEXT_LENGTH = 100;

/**
 * Extract text from a PDF buffer
 */
export async function extractFromPDF(buffer: Buffer): Promise<ExtractionResult> {
  try {
    const data = await pdfParse(buffer);

    return {
      text: data.text.trim(),
      method: 'pdf-parse',
      pageCount: data.numpages,
      metadata: {
        author: data.info?.Author as string | undefined,
        title: data.info?.Title as string | undefined,
        createdDate: data.info?.CreationDate as string | undefined,
      },
    };
  } catch (error) {
    console.error('PDF extraction failed:', error);
    return {
      text: '',
      method: 'pdf-parse',
      confidence: 0,
    };
  }
}

/**
 * Extract text from a DOCX buffer
 */
export async function extractFromDOCX(buffer: Buffer): Promise<ExtractionResult> {
  try {
    const result = await mammoth.extractRawText({ buffer });

    return {
      text: result.value.trim(),
      method: 'mammoth',
    };
  } catch (error) {
    console.error('DOCX extraction failed:', error);
    return {
      text: '',
      method: 'mammoth',
      confidence: 0,
    };
  }
}

/**
 * Extract text from a plain text buffer
 */
export function extractFromText(buffer: Buffer): ExtractionResult {
  return {
    text: buffer.toString('utf-8').trim(),
    method: 'text',
    confidence: 1,
  };
}

/**
 * Main extraction function - routes to appropriate extractor based on mime type
 */
export async function extractText(
  buffer: Buffer,
  mimeType: string,
  fileName?: string
): Promise<ExtractionResult> {
  // Determine file type
  const fileExt = fileName?.split('.').pop()?.toLowerCase();

  // Route to appropriate extractor
  if (mimeType === 'application/pdf' || fileExt === 'pdf') {
    return extractFromPDF(buffer);
  }

  if (
    mimeType === 'application/vnd.openxmlformats-officedocument.wordprocessingml.document' ||
    fileExt === 'docx'
  ) {
    return extractFromDOCX(buffer);
  }

  if (mimeType === 'application/msword' || fileExt === 'doc') {
    // Note: mammoth doesn't support .doc files well
    // For now, return empty and let OCR handle it
    console.warn('Legacy .doc files not fully supported, will attempt OCR');
    return {
      text: '',
      method: 'mammoth',
      confidence: 0,
    };
  }

  if (mimeType === 'text/plain' || fileExt === 'txt') {
    return extractFromText(buffer);
  }

  // Unknown file type - return empty result
  console.warn(`Unsupported file type for extraction: ${mimeType}`);
  return {
    text: '',
    method: 'text',
    confidence: 0,
  };
}

/**
 * Check if extraction result needs OCR fallback
 */
export function needsOCR(result: ExtractionResult): boolean {
  // If text is too short, likely a scanned document
  if (result.text.length < MIN_TEXT_LENGTH) {
    return true;
  }

  // Check for garbled text (high ratio of non-printable chars)
  const printableRatio = countPrintableChars(result.text) / result.text.length;
  if (printableRatio < 0.9) {
    return true;
  }

  return false;
}

/**
 * Count printable ASCII characters in text
 */
function countPrintableChars(text: string): number {
  let count = 0;
  for (const char of text) {
    const code = char.charCodeAt(0);
    // Printable ASCII: space (32) through tilde (126), plus common Unicode
    if ((code >= 32 && code <= 126) || code === 9 || code === 10 || code === 13) {
      count++;
    }
  }
  return count;
}

/**
 * Clean extracted text for better processing
 */
export function cleanExtractedText(text: string): string {
  return (
    text
      // Normalize whitespace
      .replace(/\r\n/g, '\n')
      .replace(/\r/g, '\n')
      // Remove excessive newlines
      .replace(/\n{3,}/g, '\n\n')
      // Remove excessive spaces
      .replace(/ {2,}/g, ' ')
      // Trim each line
      .split('\n')
      .map((line) => line.trim())
      .join('\n')
      // Final trim
      .trim()
  );
}
