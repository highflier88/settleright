/**
 * Legal Document Ingestion Pipeline
 *
 * Ingests legal documents from various sources into Pinecone
 * for semantic search. Handles chunking, embedding, and storage.
 */

import { prisma } from '@/lib/db';

import {
  generateEmbeddings,
  prepareDocumentForEmbedding,
} from './embeddings';
import {
  upsertVectors,
  getNamespaceForDocument,
} from './pinecone';
import { getAllSectionsForIngestion } from './sources/california-leginfo';
import { fetchCaliforniaCaseLaw } from './sources/courtlistener';

import type { DocumentForEmbedding } from './embeddings';
import type { LegalVectorMetadata } from './pinecone';
import type { DisputeType, JurisdictionLevel, LegalSourceType } from '@prisma/client';

// Types
export interface IngestionResult {
  success: boolean;
  documentId?: string;
  chunkCount?: number;
  error?: string;
}

export interface BatchIngestionResult {
  total: number;
  successful: number;
  failed: number;
  results: IngestionResult[];
}

/**
 * Ingest a single legal document
 */
export async function ingestDocument(params: {
  sourceType: LegalSourceType;
  jurisdiction: string;
  jurisdictionLevel: JurisdictionLevel;
  citation: string;
  title: string;
  fullText: string;
  summary?: string;
  codeSection?: string;
  disputeTypes?: DisputeType[];
  topics?: string[];
  effectiveDate?: Date;
}): Promise<IngestionResult> {
  try {
    // Check if document already exists
    const existing = await prisma.legalDocument.findUnique({
      where: {
        citation_jurisdiction: {
          citation: params.citation,
          jurisdiction: params.jurisdiction,
        },
      },
    });

    let documentId: string;

    if (existing) {
      // Update existing document
      await prisma.legalDocument.update({
        where: { id: existing.id },
        data: {
          title: params.title,
          fullText: params.fullText,
          summary: params.summary,
          codeSection: params.codeSection,
          disputeTypes: params.disputeTypes || [],
          topics: params.topics || [],
          effectiveDate: params.effectiveDate,
          ingestionStatus: 'PROCESSING',
        },
      });
      documentId = existing.id;

      // Delete existing chunks
      await prisma.legalDocumentChunk.deleteMany({
        where: { documentId },
      });
    } else {
      // Create new document
      const doc = await prisma.legalDocument.create({
        data: {
          sourceType: params.sourceType,
          jurisdiction: params.jurisdiction,
          jurisdictionLevel: params.jurisdictionLevel,
          citation: params.citation,
          title: params.title,
          fullText: params.fullText,
          summary: params.summary,
          codeSection: params.codeSection,
          disputeTypes: params.disputeTypes || [],
          topics: params.topics || [],
          effectiveDate: params.effectiveDate,
          ingestionStatus: 'PROCESSING',
        },
      });
      documentId = doc.id;
    }

    // Prepare document for embedding
    const docForEmbedding: DocumentForEmbedding = {
      id: documentId,
      citation: params.citation,
      title: params.title,
      fullText: params.fullText,
      sourceType: params.sourceType,
      jurisdiction: params.jurisdiction,
      jurisdictionLevel: params.jurisdictionLevel,
      codeSection: params.codeSection,
      disputeTypes: params.disputeTypes?.map(String),
      topics: params.topics,
      effectiveDate: params.effectiveDate,
    };

    const preparedChunks = prepareDocumentForEmbedding(docForEmbedding);

    // Generate embeddings for all chunks
    const texts = preparedChunks.map((c) => c.text);
    const embeddings = await generateEmbeddings(texts);

    // Prepare vectors for Pinecone
    const vectors = preparedChunks.map((chunk, i) => {
      const embedding = embeddings[i];
      if (!embedding) {
        throw new Error(`Missing embedding for chunk ${i}`);
      }
      return {
        id: chunk.id,
        values: embedding,
        metadata: {
        documentId: chunk.documentId,
        citation: chunk.metadata.citation,
        title: chunk.metadata.title,
        sourceType: chunk.metadata.sourceType,
        jurisdiction: chunk.metadata.jurisdiction,
        jurisdictionLevel: chunk.metadata.jurisdictionLevel,
        chunkIndex: chunk.chunkIndex,
        totalChunks: chunk.totalChunks,
        textPreview: chunk.textPreview,
        codeSection: chunk.metadata.codeSection,
        disputeTypes: chunk.metadata.disputeTypes,
        topics: chunk.metadata.topics,
        effectiveDate: chunk.metadata.effectiveDate,
      } as LegalVectorMetadata,
    };
    });

    // Upsert to Pinecone
    const namespace = getNamespaceForDocument(params.jurisdiction, params.sourceType);
    await upsertVectors(namespace, vectors);

    // Store chunk records in database
    await prisma.legalDocumentChunk.createMany({
      data: preparedChunks.map((chunk) => ({
        documentId,
        chunkIndex: chunk.chunkIndex,
        pineconeId: chunk.id,
        textPreview: chunk.textPreview,
      })),
    });

    // Update document status
    await prisma.legalDocument.update({
      where: { id: documentId },
      data: {
        ingestionStatus: 'COMPLETED',
        ingestedAt: new Date(),
        pineconeNamespace: namespace,
        chunkCount: preparedChunks.length,
      },
    });

    return {
      success: true,
      documentId,
      chunkCount: preparedChunks.length,
    };
  } catch (error) {
    console.error('Document ingestion failed:', error);

    return {
      success: false,
      error: error instanceof Error ? error.message : 'Unknown error',
    };
  }
}

/**
 * Ingest California statutes from static definitions
 */
export async function ingestCaliforniaStatutes(): Promise<BatchIngestionResult> {
  const sections = getAllSectionsForIngestion();
  const results: IngestionResult[] = [];
  let successful = 0;
  let failed = 0;

  // Create ingestion job
  const job = await prisma.legalIngestionJob.create({
    data: {
      source: 'ca-statutes',
      status: 'PROCESSING',
      totalDocuments: sections.length,
      startedAt: new Date(),
    },
  });

  for (const section of sections) {
    const result = await ingestDocument({
      sourceType: 'STATUTE',
      jurisdiction: 'US-CA',
      jurisdictionLevel: 'STATE',
      citation: section.citation,
      title: section.title,
      fullText: section.fullText,
      summary: section.summary,
      codeSection: section.codeSection,
      disputeTypes: section.disputeTypes,
      topics: section.topics,
    });

    results.push(result);

    if (result.success) {
      successful++;
    } else {
      failed++;
    }

    // Update job progress
    await prisma.legalIngestionJob.update({
      where: { id: job.id },
      data: {
        processedCount: successful + failed,
        failedCount: failed,
      },
    });
  }

  // Mark job complete
  await prisma.legalIngestionJob.update({
    where: { id: job.id },
    data: {
      status: failed === sections.length ? 'FAILED' : 'COMPLETED',
      completedAt: new Date(),
    },
  });

  return {
    total: sections.length,
    successful,
    failed,
    results,
  };
}

/**
 * Ingest California case law from CourtListener
 */
export async function ingestCaliforniaCaseLaw(params: {
  topic: string;
  limit?: number;
}): Promise<BatchIngestionResult> {
  const results: IngestionResult[] = [];
  let successful = 0;
  let failed = 0;

  // Fetch cases from CourtListener
  const cases = await fetchCaliforniaCaseLaw({
    topic: params.topic,
    limit: params.limit || 50,
  });

  // Create ingestion job
  const job = await prisma.legalIngestionJob.create({
    data: {
      source: 'courtlistener',
      status: 'PROCESSING',
      totalDocuments: cases.length,
      startedAt: new Date(),
    },
  });

  for (const caseDoc of cases) {
    // Skip if no text
    if (!caseDoc.text || caseDoc.text.length < 100) {
      results.push({
        success: false,
        error: 'Insufficient case text',
      });
      failed++;
      continue;
    }

    const result = await ingestDocument({
      sourceType: 'CASE_LAW',
      jurisdiction: 'US-CA',
      jurisdictionLevel: 'STATE',
      citation: caseDoc.citation,
      title: caseDoc.caseName,
      fullText: caseDoc.text,
      summary: caseDoc.summary,
      topics: [params.topic],
      effectiveDate: new Date(caseDoc.dateFiled),
    });

    results.push(result);

    if (result.success) {
      successful++;
    } else {
      failed++;
    }

    // Update job progress
    await prisma.legalIngestionJob.update({
      where: { id: job.id },
      data: {
        processedCount: successful + failed,
        failedCount: failed,
      },
    });
  }

  // Mark job complete
  await prisma.legalIngestionJob.update({
    where: { id: job.id },
    data: {
      status: failed === cases.length ? 'FAILED' : 'COMPLETED',
      completedAt: new Date(),
    },
  });

  return {
    total: cases.length,
    successful,
    failed,
    results,
  };
}

/**
 * Get ingestion job status
 */
export async function getIngestionJobStatus(jobId: string) {
  return prisma.legalIngestionJob.findUnique({
    where: { id: jobId },
  });
}

/**
 * Get recent ingestion jobs
 */
export async function getRecentIngestionJobs(limit = 10) {
  return prisma.legalIngestionJob.findMany({
    orderBy: { createdAt: 'desc' },
    take: limit,
  });
}

/**
 * Get ingestion statistics
 */
export async function getIngestionStats() {
  const [documentCount, chunkCount, bySourceType, byStatus] = await Promise.all([
    prisma.legalDocument.count(),
    prisma.legalDocumentChunk.count(),
    prisma.legalDocument.groupBy({
      by: ['sourceType'],
      _count: true,
    }),
    prisma.legalDocument.groupBy({
      by: ['ingestionStatus'],
      _count: true,
    }),
  ]);

  return {
    totalDocuments: documentCount,
    totalChunks: chunkCount,
    bySourceType: bySourceType.reduce(
      (acc, item) => {
        acc[item.sourceType] = item._count;
        return acc;
      },
      {} as Record<string, number>
    ),
    byStatus: byStatus.reduce(
      (acc, item) => {
        acc[item.ingestionStatus] = item._count;
        return acc;
      },
      {} as Record<string, number>
    ),
  };
}
