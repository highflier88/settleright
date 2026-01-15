/**
 * OpenAI Embeddings Service
 *
 * Generates embeddings for legal documents using OpenAI's text-embedding-3-small model.
 * Includes document chunking with overlap for better retrieval.
 */

import OpenAI from 'openai';

// Configuration
const EMBEDDING_MODEL = 'text-embedding-3-small';
const EMBEDDING_DIMENSION = 1536;
const MAX_TOKENS_PER_CHUNK = 512;
const OVERLAP_TOKENS = 50;
const BATCH_SIZE = 100; // OpenAI allows up to 2048 inputs per batch

// Singleton OpenAI client
let openaiClient: OpenAI | null = null;

/**
 * Get the OpenAI client instance (singleton)
 */
export function getOpenAIClient(): OpenAI {
  if (!openaiClient) {
    const apiKey = process.env.OPENAI_API_KEY;
    if (!apiKey) {
      throw new Error('OPENAI_API_KEY environment variable is not set');
    }
    openaiClient = new OpenAI({ apiKey });
  }
  return openaiClient;
}

/**
 * Generate embedding for a single text
 */
export async function generateEmbedding(text: string): Promise<number[]> {
  const client = getOpenAIClient();

  const response = await client.embeddings.create({
    model: EMBEDDING_MODEL,
    input: text.trim(),
    dimensions: EMBEDDING_DIMENSION,
  });

  const embedding = response.data[0]?.embedding;
  if (!embedding) {
    throw new Error('Failed to generate embedding');
  }
  return embedding;
}

/**
 * Generate embeddings for multiple texts in batches
 */
export async function generateEmbeddings(texts: string[]): Promise<number[][]> {
  const client = getOpenAIClient();
  const embeddings: number[][] = [];

  // Process in batches
  for (let i = 0; i < texts.length; i += BATCH_SIZE) {
    const batch = texts.slice(i, i + BATCH_SIZE).map((t) => t.trim());

    const response = await client.embeddings.create({
      model: EMBEDDING_MODEL,
      input: batch,
      dimensions: EMBEDDING_DIMENSION,
    });

    // Maintain order
    const batchEmbeddings = response.data
      .sort((a, b) => a.index - b.index)
      .map((d) => d.embedding);

    embeddings.push(...batchEmbeddings);
  }

  return embeddings;
}

/**
 * Chunk text with overlap for legal documents
 */
export interface TextChunk {
  index: number;
  text: string;
  startChar: number;
  endChar: number;
}

/**
 * Simple token estimation (4 chars ≈ 1 token for English text)
 */
function estimateTokens(text: string): number {
  return Math.ceil(text.length / 4);
}

/**
 * Find the best split point near a target position
 * Prefers splitting at: paragraph breaks > sentence ends > clause breaks > word boundaries
 */
function findSplitPoint(text: string, targetPos: number, maxPos: number): number {
  const searchStart = Math.max(0, targetPos - 100);
  const searchEnd = Math.min(text.length, maxPos);
  const searchRegion = text.slice(searchStart, searchEnd);

  // Try paragraph break first
  const paragraphBreak = searchRegion.lastIndexOf('\n\n');
  if (paragraphBreak !== -1 && paragraphBreak > searchRegion.length * 0.5) {
    return searchStart + paragraphBreak + 2;
  }

  // Try sentence end
  const sentenceEnd = searchRegion.search(/[.!?]\s+(?=[A-Z])/);
  if (sentenceEnd !== -1) {
    const lastSentenceEnd = searchRegion.lastIndexOf(
      searchRegion.match(/[.!?]\s+(?=[A-Z])/)?.[0] || ''
    );
    if (lastSentenceEnd !== -1 && lastSentenceEnd > searchRegion.length * 0.5) {
      return searchStart + lastSentenceEnd + 2;
    }
  }

  // Try clause break (semicolon, em-dash)
  const clauseBreak = searchRegion.lastIndexOf('; ');
  if (clauseBreak !== -1 && clauseBreak > searchRegion.length * 0.5) {
    return searchStart + clauseBreak + 2;
  }

  // Fall back to word boundary
  const wordBreak = searchRegion.lastIndexOf(' ');
  if (wordBreak !== -1) {
    return searchStart + wordBreak + 1;
  }

  return targetPos;
}

/**
 * Chunk a legal document text with overlap
 *
 * Legal-aware chunking that:
 * - Respects section boundaries where possible
 * - Maintains overlap for context continuity
 * - Handles legal citations and references
 */
export function chunkText(text: string): TextChunk[] {
  const chunks: TextChunk[] = [];
  const targetChunkChars = MAX_TOKENS_PER_CHUNK * 4; // ~512 tokens
  const overlapChars = OVERLAP_TOKENS * 4; // ~50 tokens

  let startPos = 0;
  let chunkIndex = 0;

  while (startPos < text.length) {
    // Calculate end position
    const targetEndPos = startPos + targetChunkChars;

    // If we're near the end, just take the rest
    if (targetEndPos >= text.length - overlapChars) {
      chunks.push({
        index: chunkIndex,
        text: text.slice(startPos).trim(),
        startChar: startPos,
        endChar: text.length,
      });
      break;
    }

    // Find optimal split point
    const splitPos = findSplitPoint(text, targetEndPos, targetEndPos + 200);
    const chunkText = text.slice(startPos, splitPos).trim();

    if (chunkText.length > 0) {
      chunks.push({
        index: chunkIndex,
        text: chunkText,
        startChar: startPos,
        endChar: splitPos,
      });
      chunkIndex++;
    }

    // Move start position with overlap
    startPos = splitPos - overlapChars;
  }

  return chunks;
}

/**
 * Chunk a legal document with special handling for legal structures
 */
export function chunkLegalDocument(
  text: string,
  options: {
    preserveSections?: boolean;
    includeHeader?: string;
  } = {}
): TextChunk[] {
  const { preserveSections = true, includeHeader } = options;

  let processedText = text;

  // Clean up common legal formatting issues
  processedText = processedText
    .replace(/\r\n/g, '\n')
    .replace(/\n{3,}/g, '\n\n')
    .replace(/\s+$/gm, '');

  // If preserving sections, try to split on legal section markers
  if (preserveSections) {
    const sectionPatterns = [
      /\n(?=§\s*\d)/g, // Section symbols
      /\n(?=\([a-z]\)\s)/g, // Subsection markers (a), (b), etc.
      /\n(?=\(\d+\)\s)/g, // Numbered subsections (1), (2), etc.
      /\n(?=Article\s+\d+)/gi, // Article headers
      /\n(?=Section\s+\d+)/gi, // Section headers
    ];

    // Find all section boundaries
    const boundaries: number[] = [0];
    for (const pattern of sectionPatterns) {
      let match;
      while ((match = pattern.exec(processedText)) !== null) {
        boundaries.push(match.index + 1); // +1 to skip the newline
      }
    }
    boundaries.push(processedText.length);

    // Remove duplicates and sort
    const uniqueBoundaries = [...new Set(boundaries)].sort((a, b) => a - b);

    // Try to create chunks at section boundaries
    const chunks: TextChunk[] = [];
    let currentStart = 0;
    let currentText = '';
    let chunkIndex = 0;

    for (let i = 1; i < uniqueBoundaries.length; i++) {
      const sectionText = processedText.slice(uniqueBoundaries[i - 1], uniqueBoundaries[i]);
      const combinedTokens = estimateTokens(currentText + sectionText);

      if (combinedTokens <= MAX_TOKENS_PER_CHUNK || currentText.length === 0) {
        // Add to current chunk
        currentText += sectionText;
      } else {
        // Save current chunk and start new one
        if (currentText.trim().length > 0) {
          const header = includeHeader ? `${includeHeader}\n\n` : '';
          const endBoundary = uniqueBoundaries[i - 1] ?? processedText.length;
          chunks.push({
            index: chunkIndex,
            text: (header + currentText).trim(),
            startChar: currentStart,
            endChar: endBoundary,
          });
          chunkIndex++;
        }
        currentStart = uniqueBoundaries[i - 1] ?? 0;
        currentText = sectionText;
      }
    }

    // Don't forget the last chunk
    if (currentText.trim().length > 0) {
      const header = includeHeader ? `${includeHeader}\n\n` : '';
      chunks.push({
        index: chunkIndex,
        text: (header + currentText).trim(),
        startChar: currentStart,
        endChar: processedText.length,
      });
    }

    // If we got reasonable chunks, return them
    if (chunks.length > 0 && chunks.every((c) => estimateTokens(c.text) <= MAX_TOKENS_PER_CHUNK * 1.5)) {
      return chunks;
    }
  }

  // Fall back to simple chunking with overlap
  return chunkText(processedText);
}

/**
 * Prepare document for embedding
 */
export interface DocumentForEmbedding {
  id: string;
  citation: string;
  title: string;
  fullText: string;
  sourceType: 'STATUTE' | 'CASE_LAW' | 'REGULATION' | 'COURT_RULE';
  jurisdiction: string;
  jurisdictionLevel: 'FEDERAL' | 'STATE';
  codeSection?: string;
  disputeTypes?: string[];
  topics?: string[];
  effectiveDate?: Date;
}

export interface PreparedChunk {
  id: string;
  documentId: string;
  chunkIndex: number;
  totalChunks: number;
  text: string;
  textPreview: string;
  metadata: {
    citation: string;
    title: string;
    sourceType: 'STATUTE' | 'CASE_LAW' | 'REGULATION' | 'COURT_RULE';
    jurisdiction: string;
    jurisdictionLevel: 'FEDERAL' | 'STATE';
    codeSection?: string;
    disputeTypes?: string[];
    topics?: string[];
    effectiveDate?: string;
  };
}

/**
 * Prepare a legal document for embedding by chunking and adding metadata
 */
export function prepareDocumentForEmbedding(doc: DocumentForEmbedding): PreparedChunk[] {
  // Create header with citation for context in each chunk
  const header = `${doc.citation}: ${doc.title}`;

  // Chunk the document
  const chunks = chunkLegalDocument(doc.fullText, {
    preserveSections: doc.sourceType === 'STATUTE' || doc.sourceType === 'REGULATION',
    includeHeader: header,
  });

  // Prepare chunks with metadata
  return chunks.map((chunk) => ({
    id: `${doc.id}-chunk-${chunk.index}`,
    documentId: doc.id,
    chunkIndex: chunk.index,
    totalChunks: chunks.length,
    text: chunk.text,
    textPreview: chunk.text.slice(0, 497) + (chunk.text.length > 497 ? '...' : ''),
    metadata: {
      citation: doc.citation,
      title: doc.title,
      sourceType: doc.sourceType,
      jurisdiction: doc.jurisdiction,
      jurisdictionLevel: doc.jurisdictionLevel,
      codeSection: doc.codeSection,
      disputeTypes: doc.disputeTypes,
      topics: doc.topics,
      effectiveDate: doc.effectiveDate?.toISOString(),
    },
  }));
}

// Export constants
export { EMBEDDING_MODEL, EMBEDDING_DIMENSION, MAX_TOKENS_PER_CHUNK };
