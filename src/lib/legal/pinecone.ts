/**
 * Pinecone Vector Database Client
 *
 * Provides semantic search capabilities for legal documents.
 * Uses serverless deployment on AWS us-east-1.
 */

import { Pinecone, type Index } from '@pinecone-database/pinecone';

// Pinecone configuration
const PINECONE_INDEX_NAME = process.env.PINECONE_INDEX_NAME || 'settleright-legal';
const EMBEDDING_DIMENSION = 1536; // OpenAI text-embedding-3-small

// Namespace constants for organizing legal documents
export const PINECONE_NAMESPACES = {
  CA_STATUTES: 'ca-statutes',
  CA_CASE_LAW: 'ca-case-law',
  CA_REGULATIONS: 'ca-regulations',
  FEDERAL_STATUTES: 'federal-statutes',
  FEDERAL_REGULATIONS: 'federal-regulations',
} as const;

export type PineconeNamespace = (typeof PINECONE_NAMESPACES)[keyof typeof PINECONE_NAMESPACES];

// Metadata stored with each vector
export interface LegalVectorMetadata {
  documentId: string;
  citation: string;
  title: string;
  sourceType: 'STATUTE' | 'CASE_LAW' | 'REGULATION' | 'COURT_RULE';
  jurisdiction: string;
  jurisdictionLevel: 'FEDERAL' | 'STATE';
  chunkIndex: number;
  totalChunks: number;
  textPreview: string;
  codeSection?: string;
  disputeTypes?: string[];
  topics?: string[];
  effectiveDate?: string;
  // Index signature for Pinecone compatibility
  [key: string]: string | number | string[] | undefined;
}

// Query result from Pinecone
export interface LegalSearchResult {
  id: string;
  score: number;
  metadata: LegalVectorMetadata;
}

// Singleton Pinecone client
let pineconeClient: Pinecone | null = null;
let pineconeIndex: Index | null = null;

/**
 * Get the Pinecone client instance (singleton)
 */
export function getPineconeClient(): Pinecone {
  if (!pineconeClient) {
    const apiKey = process.env.PINECONE_API_KEY;
    if (!apiKey) {
      throw new Error('PINECONE_API_KEY environment variable is not set');
    }
    pineconeClient = new Pinecone({ apiKey });
  }
  return pineconeClient;
}

/**
 * Get the Pinecone index for legal documents
 */
export function getPineconeIndex(): Index {
  if (!pineconeIndex) {
    const client = getPineconeClient();
    pineconeIndex = client.index(PINECONE_INDEX_NAME);
  }
  return pineconeIndex;
}

/**
 * Upsert vectors into a specific namespace
 */
export async function upsertVectors(
  namespace: PineconeNamespace,
  vectors: Array<{
    id: string;
    values: number[];
    metadata: LegalVectorMetadata;
  }>
): Promise<void> {
  const index = getPineconeIndex();
  const ns = index.namespace(namespace);

  // Pinecone recommends batches of 100 vectors
  const BATCH_SIZE = 100;
  for (let i = 0; i < vectors.length; i += BATCH_SIZE) {
    const batch = vectors.slice(i, i + BATCH_SIZE);
    // Cast to any to handle metadata type compatibility
    await ns.upsert(batch as Parameters<typeof ns.upsert>[0]);
  }
}

/**
 * Query vectors in a namespace
 */
export async function queryVectors(
  namespace: PineconeNamespace,
  embedding: number[],
  topK: number = 10,
  filter?: Record<string, unknown>
): Promise<LegalSearchResult[]> {
  const index = getPineconeIndex();
  const ns = index.namespace(namespace);

  const results = await ns.query({
    vector: embedding,
    topK,
    includeMetadata: true,
    filter,
  });

  return (results.matches || []).map((match) => ({
    id: match.id,
    score: match.score ?? 0,
    metadata: match.metadata as unknown as LegalVectorMetadata,
  }));
}

/**
 * Query across multiple namespaces
 */
export async function queryMultipleNamespaces(
  namespaces: PineconeNamespace[],
  embedding: number[],
  topK: number = 10,
  filter?: Record<string, unknown>
): Promise<LegalSearchResult[]> {
  const results = await Promise.all(
    namespaces.map((ns) => queryVectors(ns, embedding, topK, filter))
  );

  // Merge and sort by score
  const merged = results.flat();
  merged.sort((a, b) => b.score - a.score);

  // Return top K across all namespaces
  return merged.slice(0, topK);
}

/**
 * Delete vectors by ID from a namespace
 */
export async function deleteVectors(namespace: PineconeNamespace, ids: string[]): Promise<void> {
  const index = getPineconeIndex();
  const ns = index.namespace(namespace);
  await ns.deleteMany(ids);
}

/**
 * Delete all vectors for a specific document
 */
export async function deleteDocumentVectors(
  namespace: PineconeNamespace,
  documentId: string
): Promise<void> {
  const index = getPineconeIndex();
  const ns = index.namespace(namespace);

  // Use filter to find and delete by documentId
  await ns.deleteMany({
    filter: { documentId: { $eq: documentId } },
  });
}

/**
 * Get namespace statistics
 */
export async function getNamespaceStats(namespace: PineconeNamespace): Promise<{
  vectorCount: number;
}> {
  const index = getPineconeIndex();
  const stats = await index.describeIndexStats();

  const namespaceStats = stats.namespaces?.[namespace];
  return {
    vectorCount: namespaceStats?.recordCount ?? 0,
  };
}

/**
 * Get the namespace for a jurisdiction and source type
 */
export function getNamespaceForDocument(
  jurisdiction: string,
  sourceType: 'STATUTE' | 'CASE_LAW' | 'REGULATION' | 'COURT_RULE'
): PineconeNamespace {
  const isCalifonia = jurisdiction === 'US-CA';

  if (sourceType === 'STATUTE') {
    return isCalifonia ? PINECONE_NAMESPACES.CA_STATUTES : PINECONE_NAMESPACES.FEDERAL_STATUTES;
  }

  if (sourceType === 'CASE_LAW') {
    return PINECONE_NAMESPACES.CA_CASE_LAW;
  }

  if (sourceType === 'REGULATION' || sourceType === 'COURT_RULE') {
    return isCalifonia
      ? PINECONE_NAMESPACES.CA_REGULATIONS
      : PINECONE_NAMESPACES.FEDERAL_REGULATIONS;
  }

  return PINECONE_NAMESPACES.CA_STATUTES;
}

/**
 * Index configuration for reference
 */
export const INDEX_CONFIG = {
  name: PINECONE_INDEX_NAME,
  dimension: EMBEDDING_DIMENSION,
  metric: 'cosine' as const,
  spec: {
    serverless: {
      cloud: 'aws' as const,
      region: 'us-east-1',
    },
  },
};
