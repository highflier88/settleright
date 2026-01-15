/**
 * Fact Analysis Engine
 *
 * AI-powered analysis of party statements and evidence for dispute resolution.
 *
 * Main exports:
 * - runAnalysis: Run complete analysis pipeline
 * - queueAnalysis: Queue a case for analysis
 * - getAnalysisStatus: Get current analysis status
 * - loadAnalysisInput: Load case data for analysis
 */

// Main orchestrator functions
export {
  runAnalysis,
  queueAnalysis,
  getAnalysisStatus,
  loadAnalysisInput,
  processPendingAnalysis,
} from './orchestrator';

// Fact extraction
export {
  extractFacts,
  extractFactsFromStatement,
  formatFactsForPrompt,
  estimateFactExtractionCost,
} from './fact-extraction';

// Claim parsing
export { parseClaims, calculateTotalClaimedAmount, formatClaimsForPrompt } from './claim-parser';

// Fact comparison
export {
  compareFacts,
  formatDisputedFactsForPrompt,
  formatUndisputedFactsForPrompt,
  getHighMaterialityDisputes,
  calculateDisputeScore,
  estimateComparisonCost,
} from './fact-comparison';

// Timeline reconstruction
export {
  reconstructTimeline,
  extractEventsFromFacts,
  extractEventsFromEvidence,
  mergeTimelineEvents,
  formatTimelineForDisplay,
  getTimelineSpanDays,
} from './timeline';

// Contradiction detection
export {
  detectContradictions,
  getContradictionsBySeverity,
  getMajorContradictions,
  calculateContradictionScore,
  formatContradictionsForPrompt,
  analyzeContradictionPattern,
  estimateContradictionCost,
} from './contradictions';

// Credibility scoring
export {
  assessCredibility,
  calculateCredibilityAdjustments,
  formatCredibilityForDisplay,
  compareCredibility,
  estimateCredibilityCost,
} from './credibility';

// Types
export type {
  // Core types
  AnalysisInput,
  AnalysisOptions,
  AnalysisProgress,
  AnalysisResult,
  AnalysisPhase,
  EvidenceSummary,
  // Fact types
  ExtractedFact,
  ExtractedFactsResult,
  FactCategory,
  ParsedClaim,
  // Comparison types
  DisputedFact,
  UndisputedFact,
  FactComparisonResult,
  // Timeline types
  TimelineEvent,
  TimelineResult,
  // Contradiction types
  Contradiction,
  ContradictionResult,
  ContradictionSeverity,
  // Credibility types
  CredibilityFactors,
  CredibilityResult,
  PartyCredibilityScore,
  PartySource,
} from './types';
