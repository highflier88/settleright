/**
 * Fact Analysis Engine Types
 *
 * TypeScript interfaces for the fact analysis pipeline including
 * fact extraction, comparison, timeline, contradictions, and credibility.
 */

/**
 * Category of an extracted fact
 */
export type FactCategory = 'event' | 'claim' | 'admission' | 'denial' | 'allegation';

/**
 * Source party for a fact or event
 */
export type PartySource = 'claimant' | 'respondent';

/**
 * Severity level for contradictions
 */
export type ContradictionSeverity = 'minor' | 'moderate' | 'major';

/**
 * Analysis phase status
 */
export type AnalysisPhase =
  | 'queued'
  | 'extracting_facts'
  | 'comparing_facts'
  | 'building_timeline'
  | 'detecting_contradictions'
  | 'scoring_credibility'
  | 'completed'
  | 'failed';

/**
 * A single extracted fact from a party's statement
 */
export interface ExtractedFact {
  /** Unique identifier for this fact */
  id: string;
  /** The factual statement */
  statement: string;
  /** Category of the fact */
  category: FactCategory;
  /** Date mentioned in or associated with this fact */
  date?: string;
  /** Monetary amount if applicable */
  amount?: number;
  /** IDs of evidence that support this fact */
  supportingEvidence?: string[];
  /** Confidence score (0-1) */
  confidence: number;
  /** Additional context or explanation */
  context?: string;
}

/**
 * Extracted facts grouped by party
 */
export interface ExtractedFactsResult {
  claimant: ExtractedFact[];
  respondent: ExtractedFact[];
  /** Total tokens used for extraction */
  tokensUsed?: number;
}

/**
 * A parsed claim item from a statement
 */
export interface ParsedClaim {
  /** Unique identifier */
  id: string;
  /** Type of claim */
  type: 'damages' | 'breach' | 'performance' | 'refund' | 'compensation' | 'other';
  /** Description of the claim */
  description: string;
  /** Amount claimed if monetary */
  amount?: number;
  /** Basis for the claim */
  basis?: string;
  /** Supporting facts by ID */
  supportingFactIds?: string[];
}

/**
 * A disputed fact between parties
 */
export interface DisputedFact {
  /** Unique identifier */
  id: string;
  /** The topic or subject of dispute */
  topic: string;
  /** Claimant's position on this fact */
  claimantPosition: string;
  /** Respondent's position on this fact */
  respondentPosition: string;
  /** IDs of relevant evidence */
  relevantEvidence: string[];
  /** How material this fact is to the case (0-1) */
  materialityScore: number;
  /** Analysis of the dispute */
  analysis?: string;
}

/**
 * An undisputed/agreed fact
 */
export interface UndisputedFact {
  /** Unique identifier */
  id: string;
  /** The agreed fact statement */
  fact: string;
  /** Which parties agree */
  agreedBy: PartySource[];
  /** Supporting evidence IDs */
  supportingEvidence?: string[];
  /** How material this fact is (0-1) */
  materialityScore: number;
}

/**
 * Result of fact comparison analysis
 */
export interface FactComparisonResult {
  disputed: DisputedFact[];
  undisputed: UndisputedFact[];
  /** Total tokens used */
  tokensUsed?: number;
}

/**
 * A single event in the timeline
 */
export interface TimelineEvent {
  /** Unique identifier */
  id: string;
  /** Date of the event (ISO format or descriptive) */
  date: string;
  /** Parsed date for sorting (if parseable) */
  parsedDate?: Date;
  /** Description of the event */
  event: string;
  /** Source of this event */
  source: PartySource | 'evidence';
  /** ID of the source statement or evidence */
  sourceId: string;
  /** Whether this event is disputed */
  disputed: boolean;
  /** Additional details */
  details?: string;
}

/**
 * Reconstructed timeline result
 */
export interface TimelineResult {
  events: TimelineEvent[];
  /** Earliest event date */
  startDate?: string;
  /** Latest event date */
  endDate?: string;
  /** Events that couldn't be dated */
  undatedEvents: TimelineEvent[];
}

/**
 * A detected contradiction between parties
 */
export interface Contradiction {
  /** Unique identifier */
  id: string;
  /** Topic of the contradiction */
  topic: string;
  /** What the claimant claims */
  claimantClaim: string;
  /** What the respondent claims */
  respondentClaim: string;
  /** Severity of the contradiction */
  severity: ContradictionSeverity;
  /** Analysis explaining the contradiction */
  analysis: string;
  /** Related fact IDs */
  relatedFactIds?: string[];
  /** Impact on case outcome assessment */
  caseImpact?: string;
}

/**
 * Result of contradiction detection
 */
export interface ContradictionResult {
  contradictions: Contradiction[];
  /** Summary of contradictions */
  summary: string;
  /** Total tokens used */
  tokensUsed?: number;
}

/**
 * Individual credibility factors
 */
export interface CredibilityFactors {
  /** How well supported by evidence (0-1) */
  evidenceSupport: number;
  /** Internal consistency of statements (0-1) */
  internalConsistency: number;
  /** Consistency with external facts (0-1) */
  externalConsistency: number;
  /** Level of detail and specificity (0-1) */
  specificity: number;
  /** General plausibility (0-1) */
  plausibility: number;
}

/**
 * Credibility score for a party
 */
export interface PartyCredibilityScore {
  /** Overall credibility score (0-1) */
  overall: number;
  /** Individual factor scores */
  factors: CredibilityFactors;
  /** Explanation of the score */
  reasoning: string;
  /** Key strengths */
  strengths: string[];
  /** Key weaknesses */
  weaknesses: string[];
}

/**
 * Result of credibility analysis
 */
export interface CredibilityResult {
  claimant: PartyCredibilityScore;
  respondent: PartyCredibilityScore;
  /** Comparative analysis */
  comparison: string;
  /** Total tokens used */
  tokensUsed?: number;
}

/**
 * Complete analysis result
 */
export interface AnalysisResult {
  /** Case ID */
  caseId: string;
  /** Analysis job ID */
  jobId: string;
  /** Current status */
  status: 'completed' | 'failed';
  /** Extracted facts */
  extractedFacts?: ExtractedFactsResult;
  /** Disputed facts */
  disputedFacts?: DisputedFact[];
  /** Undisputed facts */
  undisputedFacts?: UndisputedFact[];
  /** Reconstructed timeline */
  timeline?: TimelineEvent[];
  /** Detected contradictions */
  contradictions?: Contradiction[];
  /** Credibility scores */
  credibilityScores?: CredibilityResult;
  /** Error message if failed */
  error?: string;
  /** Total processing time in ms */
  processingTimeMs?: number;
  /** Total tokens used */
  totalTokensUsed?: number;
  /** Estimated cost */
  estimatedCost?: number;
}

/**
 * Analysis progress update
 */
export interface AnalysisProgress {
  /** Case ID */
  caseId: string;
  /** Job ID */
  jobId: string;
  /** Current phase */
  phase: AnalysisPhase;
  /** Progress percentage (0-100) */
  progress: number;
  /** Status message */
  message?: string;
}

/**
 * Options for running analysis
 */
export interface AnalysisOptions {
  /** Skip fact extraction */
  skipFactExtraction?: boolean;
  /** Skip fact comparison */
  skipFactComparison?: boolean;
  /** Skip timeline reconstruction */
  skipTimeline?: boolean;
  /** Skip contradiction detection */
  skipContradictions?: boolean;
  /** Skip credibility scoring */
  skipCredibility?: boolean;
  /** Force re-analysis even if already completed */
  force?: boolean;
}

/**
 * Input data for analysis
 */
export interface AnalysisInput {
  /** Case ID */
  caseId: string;
  /** Case description/summary */
  caseDescription: string;
  /** Dispute type */
  disputeType: string;
  /** Claimed amount */
  claimedAmount?: number;
  /** Claimant's statement content */
  claimantStatement: string;
  /** Claimant's claim items (JSON) */
  claimantClaimItems?: unknown;
  /** Respondent's statement content */
  respondentStatement?: string;
  /** Respondent's claim items (JSON) */
  respondentClaimItems?: unknown;
  /** Evidence summaries */
  evidenceSummaries: EvidenceSummary[];
}

/**
 * Evidence summary for analysis
 */
export interface EvidenceSummary {
  /** Evidence ID */
  id: string;
  /** File name */
  fileName: string;
  /** Document type */
  documentType?: string;
  /** Extracted text (truncated) */
  extractedText?: string;
  /** Summary */
  summary?: string;
  /** Key points */
  keyPoints?: string[];
  /** Extracted entities */
  entities?: {
    dates?: string[];
    amounts?: number[];
    parties?: string[];
  };
  /** Submitted by party */
  submittedBy: PartySource;
}
