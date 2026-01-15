/**
 * OCR Service using AWS Textract
 *
 * Extracts text from images and scanned PDFs using AWS Textract.
 * Supports document detection with confidence scoring.
 */

import { TextractClient, DetectDocumentTextCommand, type Block } from '@aws-sdk/client-textract';

import type { OCRResult, OCRBlock } from '@/types/documents';

// Singleton Textract client
let textractClient: TextractClient | null = null;

/**
 * Get or create the Textract client
 */
function getTextractClient(): TextractClient {
  if (!textractClient) {
    const region = process.env.AWS_REGION || 'us-east-1';

    // Check for required credentials
    if (!process.env.AWS_ACCESS_KEY_ID || !process.env.AWS_SECRET_ACCESS_KEY) {
      throw new Error(
        'AWS credentials not configured. Set AWS_ACCESS_KEY_ID and AWS_SECRET_ACCESS_KEY.'
      );
    }

    textractClient = new TextractClient({
      region,
      credentials: {
        accessKeyId: process.env.AWS_ACCESS_KEY_ID,
        secretAccessKey: process.env.AWS_SECRET_ACCESS_KEY,
      },
    });
  }
  return textractClient;
}

/**
 * Perform OCR on an image buffer
 */
export async function performOCR(buffer: Buffer): Promise<OCRResult> {
  const client = getTextractClient();

  try {
    const command = new DetectDocumentTextCommand({
      Document: {
        Bytes: buffer,
      },
    });

    const response = await client.send(command);

    // Extract text and blocks from response
    const blocks = response.Blocks || [];
    const { text, ocrBlocks, avgConfidence } = processTextractBlocks(blocks);

    return {
      text,
      confidence: avgConfidence,
      blocks: ocrBlocks,
    };
  } catch (error) {
    console.error('Textract OCR failed:', error);
    throw new Error(
      `OCR processing failed: ${error instanceof Error ? error.message : 'Unknown error'}`
    );
  }
}

/**
 * Process Textract blocks into structured result
 */
function processTextractBlocks(blocks: Block[]): {
  text: string;
  ocrBlocks: OCRBlock[];
  avgConfidence: number;
} {
  const lines: string[] = [];
  const ocrBlocks: OCRBlock[] = [];
  let totalConfidence = 0;
  let confidenceCount = 0;

  for (const block of blocks) {
    // Only process LINE blocks for text extraction
    if (block.BlockType === 'LINE' && block.Text) {
      lines.push(block.Text);

      if (block.Confidence) {
        totalConfidence += block.Confidence;
        confidenceCount++;
      }
    }

    // Store all blocks for detailed analysis
    if (block.Text && block.BlockType) {
      ocrBlocks.push({
        type: block.BlockType as OCRBlock['type'],
        text: block.Text,
        confidence: block.Confidence || 0,
        boundingBox: block.Geometry?.BoundingBox
          ? {
              width: block.Geometry.BoundingBox.Width || 0,
              height: block.Geometry.BoundingBox.Height || 0,
              left: block.Geometry.BoundingBox.Left || 0,
              top: block.Geometry.BoundingBox.Top || 0,
            }
          : undefined,
      });
    }
  }

  const avgConfidence = confidenceCount > 0 ? totalConfidence / confidenceCount : 0;

  return {
    text: lines.join('\n'),
    ocrBlocks,
    avgConfidence: avgConfidence / 100, // Convert from percentage to 0-1
  };
}

/**
 * Check if OCR result meets quality threshold
 */
export function isOCRQualityAcceptable(result: OCRResult, threshold = 0.7): boolean {
  return result.confidence >= threshold && result.text.length > 50;
}

/**
 * Estimate OCR cost for a document
 * Textract pricing: $1.50 per 1000 pages for detect document text
 */
export function estimateOCRCost(pageCount: number): number {
  const costPer1000Pages = 1.5;
  return (pageCount / 1000) * costPer1000Pages;
}

/**
 * Check if a mime type requires OCR processing
 */
export function requiresOCRProcessing(mimeType: string): boolean {
  return mimeType.startsWith('image/');
}

/**
 * Get supported image formats for Textract
 */
export const SUPPORTED_OCR_FORMATS = [
  'image/jpeg',
  'image/png',
  'image/tiff',
  'application/pdf', // Textract also supports PDFs directly
] as const;

/**
 * Check if mime type is supported for OCR
 */
export function isOCRSupported(mimeType: string): boolean {
  return SUPPORTED_OCR_FORMATS.includes(mimeType as (typeof SUPPORTED_OCR_FORMATS)[number]);
}
