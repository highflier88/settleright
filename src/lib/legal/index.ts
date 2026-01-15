/**
 * Legal Knowledge Base Module
 *
 * Provides semantic search and retrieval over legal documents
 * for the AI arbitration analysis engine.
 */

// Core services
export * from './pinecone';
export * from './embeddings';
export * from './citations';
export * from './retrieval';
export * from './ingestion';

// Sources
export * from './sources';
export {
  searchOpinions,
  getOpinion,
  getCluster,
  getCourt,
  getCaliforniaCourts,
  fetchCaliforniaCaseLaw,
  CA_COURT_IDS,
  // Note: formatCitation excluded to avoid conflict with citations.ts
} from './sources/courtlistener';
export * from './sources/california-leginfo';
