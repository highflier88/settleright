/**
 * Legal Document Retrieval Service
 *
 * Provides semantic search over legal documents using Pinecone
 * and OpenAI embeddings. Supports filtering by jurisdiction,
 * dispute type, and source type.
 */

import { prisma } from '@/lib/db';

import { getCitationUrl, parseCitation } from './citations';
import { generateEmbedding } from './embeddings';
import { queryMultipleNamespaces, PINECONE_NAMESPACES } from './pinecone';

import type { LegalSearchResult, PineconeNamespace } from './pinecone';
import type { DisputeType, LegalSourceType } from '@prisma/client';

// Search parameters
export interface LegalSearchParams {
  query: string;
  jurisdiction: string;
  disputeType?: DisputeType;
  disputeAmount?: number;
  sourceTypes?: LegalSourceType[];
  topK?: number;
  includeFullText?: boolean;
}

// Search result
export interface LegalDocumentResult {
  documentId: string;
  citation: string;
  title: string;
  sourceType: LegalSourceType;
  relevanceScore: number;
  textExcerpt: string;
  fullText?: string;
  metadata: {
    codeSection?: string;
    effectiveDate?: string;
    disputeTypes?: string[];
    topics?: string[];
  };
  url?: string;
}

export interface LegalSearchResponse {
  documents: LegalDocumentResult[];
  totalFound: number;
  query: string;
  searchTimeMs: number;
}

/**
 * Get namespaces to search based on jurisdiction and source types
 */
function getSearchNamespaces(
  jurisdiction: string,
  sourceTypes?: LegalSourceType[]
): PineconeNamespace[] {
  const namespaces: PineconeNamespace[] = [];
  const isCalifornia = jurisdiction === 'US-CA';

  if (!sourceTypes || sourceTypes.length === 0) {
    // Search all relevant namespaces for the jurisdiction
    if (isCalifornia) {
      namespaces.push(
        PINECONE_NAMESPACES.CA_STATUTES,
        PINECONE_NAMESPACES.CA_CASE_LAW,
        PINECONE_NAMESPACES.CA_REGULATIONS
      );
    }
    // Always include federal
    namespaces.push(PINECONE_NAMESPACES.FEDERAL_STATUTES, PINECONE_NAMESPACES.FEDERAL_REGULATIONS);
  } else {
    // Filter to requested source types
    for (const type of sourceTypes) {
      if (type === 'STATUTE') {
        if (isCalifornia) namespaces.push(PINECONE_NAMESPACES.CA_STATUTES);
        namespaces.push(PINECONE_NAMESPACES.FEDERAL_STATUTES);
      } else if (type === 'CASE_LAW') {
        namespaces.push(PINECONE_NAMESPACES.CA_CASE_LAW);
      } else if (type === 'REGULATION' || type === 'COURT_RULE') {
        if (isCalifornia) namespaces.push(PINECONE_NAMESPACES.CA_REGULATIONS);
        namespaces.push(PINECONE_NAMESPACES.FEDERAL_REGULATIONS);
      }
    }
  }

  // Remove duplicates
  return [...new Set(namespaces)];
}

/**
 * Build Pinecone filter from search params
 */
function buildFilter(params: LegalSearchParams): Record<string, unknown> | undefined {
  const filter: Record<string, unknown> = {};

  if (params.disputeType) {
    filter.disputeTypes = { $in: [params.disputeType] };
  }

  // Only add filter if we have conditions
  return Object.keys(filter).length > 0 ? filter : undefined;
}

/**
 * Search for relevant legal documents
 */
export async function searchLegalDocuments(
  params: LegalSearchParams
): Promise<LegalSearchResponse> {
  const startTime = Date.now();
  const topK = params.topK || 10;

  // Generate embedding for query
  const embedding = await generateEmbedding(params.query);

  // Get namespaces to search
  const namespaces = getSearchNamespaces(params.jurisdiction, params.sourceTypes);

  // Build filter
  const filter = buildFilter(params);

  // Query Pinecone
  const results = await queryMultipleNamespaces(namespaces, embedding, topK * 2, filter);

  // Deduplicate by document ID (multiple chunks from same doc)
  const seenDocuments = new Set<string>();
  const uniqueResults: LegalSearchResult[] = [];

  for (const result of results) {
    if (!seenDocuments.has(result.metadata.documentId)) {
      seenDocuments.add(result.metadata.documentId);
      uniqueResults.push(result);
    }
    if (uniqueResults.length >= topK) break;
  }

  // Fetch full documents if requested
  let documentsWithFullText: Map<string, string> | undefined;
  if (params.includeFullText) {
    const docs = await prisma.legalDocument.findMany({
      where: {
        id: { in: uniqueResults.map((r) => r.metadata.documentId) },
      },
      select: { id: true, fullText: true },
    });
    documentsWithFullText = new Map(docs.map((d) => [d.id, d.fullText]));
  }

  // Transform results
  const documents: LegalDocumentResult[] = uniqueResults.map((result) => {
    const parsed = parseCitation(result.metadata.citation);
    return {
      documentId: result.metadata.documentId,
      citation: result.metadata.citation,
      title: result.metadata.title,
      sourceType: result.metadata.sourceType as LegalSourceType,
      relevanceScore: result.score,
      textExcerpt: result.metadata.textPreview,
      fullText: documentsWithFullText?.get(result.metadata.documentId),
      metadata: {
        codeSection: result.metadata.codeSection,
        effectiveDate: result.metadata.effectiveDate,
        disputeTypes: result.metadata.disputeTypes,
        topics: result.metadata.topics,
      },
      url: parsed.isValid ? getCitationUrl(parsed) || undefined : undefined,
    };
  });

  return {
    documents,
    totalFound: results.length,
    query: params.query,
    searchTimeMs: Date.now() - startTime,
  };
}

/**
 * Get relevant statutes for a dispute
 */
export async function getRelevantStatutes(params: {
  jurisdiction: string;
  disputeType: DisputeType;
  disputeDescription: string;
  amount?: number;
}): Promise<LegalDocumentResult[]> {
  // Build a query combining dispute type and description
  const query = `${params.disputeType} dispute: ${params.disputeDescription}`;

  const response = await searchLegalDocuments({
    query,
    jurisdiction: params.jurisdiction,
    disputeType: params.disputeType,
    disputeAmount: params.amount,
    sourceTypes: ['STATUTE'],
    topK: 5,
  });

  return response.documents;
}

/**
 * Get relevant case law for a dispute
 */
export async function getRelevantCaseLaw(params: {
  jurisdiction: string;
  disputeType: DisputeType;
  disputeDescription: string;
  issueKeywords?: string[];
}): Promise<LegalDocumentResult[]> {
  // Build query from description and keywords
  let query = `${params.disputeType} case: ${params.disputeDescription}`;
  if (params.issueKeywords && params.issueKeywords.length > 0) {
    query += ` ${params.issueKeywords.join(' ')}`;
  }

  const response = await searchLegalDocuments({
    query,
    jurisdiction: params.jurisdiction,
    disputeType: params.disputeType,
    sourceTypes: ['CASE_LAW'],
    topK: 5,
  });

  return response.documents;
}

/**
 * Get all legal context for AI analysis
 */
export async function getLegalContextForAnalysis(params: {
  jurisdiction: string;
  disputeType: DisputeType;
  disputeDescription: string;
  claimAmount: number;
  issues?: string[];
}): Promise<{
  statutes: LegalDocumentResult[];
  caseLaw: LegalDocumentResult[];
  regulations: LegalDocumentResult[];
}> {
  const [statutes, caseLaw, regulations] = await Promise.all([
    getRelevantStatutes({
      jurisdiction: params.jurisdiction,
      disputeType: params.disputeType,
      disputeDescription: params.disputeDescription,
      amount: params.claimAmount,
    }),
    getRelevantCaseLaw({
      jurisdiction: params.jurisdiction,
      disputeType: params.disputeType,
      disputeDescription: params.disputeDescription,
      issueKeywords: params.issues,
    }),
    searchLegalDocuments({
      query: `${params.disputeType} regulations: ${params.disputeDescription}`,
      jurisdiction: params.jurisdiction,
      disputeType: params.disputeType,
      sourceTypes: ['REGULATION'],
      topK: 3,
    }).then((r) => r.documents),
  ]);

  return { statutes, caseLaw, regulations };
}

/**
 * Format legal context for prompt injection
 */
export function formatLegalContextForPrompt(context: {
  statutes: LegalDocumentResult[];
  caseLaw: LegalDocumentResult[];
  regulations: LegalDocumentResult[];
}): string {
  const sections: string[] = [];

  if (context.statutes.length > 0) {
    sections.push('## Applicable Statutes\n');
    for (const statute of context.statutes) {
      sections.push(`### ${statute.citation}\n${statute.title}\n`);
      sections.push(`${statute.textExcerpt}\n`);
    }
  }

  if (context.caseLaw.length > 0) {
    sections.push('\n## Relevant Case Law\n');
    for (const caseDoc of context.caseLaw) {
      sections.push(`### ${caseDoc.citation}\n${caseDoc.title}\n`);
      sections.push(`${caseDoc.textExcerpt}\n`);
    }
  }

  if (context.regulations.length > 0) {
    sections.push('\n## Applicable Regulations\n');
    for (const reg of context.regulations) {
      sections.push(`### ${reg.citation}\n${reg.title}\n`);
      sections.push(`${reg.textExcerpt}\n`);
    }
  }

  return sections.join('\n');
}
