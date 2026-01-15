/**
 * Draft Award Types
 *
 * TypeScript interfaces for draft award generation including
 * findings of fact, conclusions of law, and award decisions.
 */

// =========================================
// FINDINGS OF FACT
// =========================================

/**
 * Basis for a finding of fact
 */
export type FindingBasis = 'undisputed' | 'proven' | 'credibility';

/**
 * A single finding of fact in the award
 */
export interface FindingOfFact {
  /** Unique identifier */
  id: string;
  /** Sequential number for reference (1, 2, 3...) */
  number: number;
  /** The factual finding statement */
  finding: string;
  /** Basis for the finding */
  basis: FindingBasis;
  /** Evidence IDs supporting this finding */
  supportingEvidence: string[];
  /** Note if based on credibility determination */
  credibilityNote?: string;
  /** Date associated with the fact, if any */
  date?: string;
  /** Amount associated with the fact, if any */
  amount?: number;
}

// =========================================
// CONCLUSIONS OF LAW
// =========================================

/**
 * A single conclusion of law in the award
 */
export interface AwardConclusionOfLaw {
  /** Unique identifier */
  id: string;
  /** Sequential number for reference */
  number: number;
  /** Legal issue addressed */
  issue: string;
  /** Formal legal conclusion */
  conclusion: string;
  /** Legal citations (statutes, case law) */
  legalBasis: string[];
  /** Finding numbers this conclusion references */
  supportingFindings: number[];
}

// =========================================
// AWARD DECISION
// =========================================

/**
 * The award decision
 */
export interface AwardDecision {
  /** Which party prevails */
  prevailingParty: 'claimant' | 'respondent' | 'split';
  /** Base damages amount */
  awardAmount: number;
  /** Prejudgment interest amount */
  interestAmount: number;
  /** Total award (damages + interest) */
  totalAward: number;
  /** Reasoning for the decision */
  reasoning: string;
  /** Formal order language */
  orderText: string;
  /** Interest calculation details */
  interestDetails?: {
    rate: number;
    startDate: string;
    endDate: string;
    days: number;
    statutoryBasis: string;
  };
}

// =========================================
// SIMPLIFIED INPUT TYPES (matching DB storage)
// =========================================

/**
 * Simplified extracted fact from database storage
 */
export interface StoredExtractedFact {
  fact: string;
  source: string;
  confidence: number;
}

/**
 * Simplified disputed fact from database storage
 */
export interface StoredDisputedFact {
  topic: string;
  claimantPosition: string;
  respondentPosition: string;
  materialityScore: number;
}

/**
 * Simplified undisputed fact from database storage
 */
export interface StoredUndisputedFact {
  fact: string;
  agreedByBoth: boolean;
  materialityScore: number;
}

/**
 * Simplified credibility scores from database storage
 */
export interface StoredCredibilityScores {
  claimantScore: number;
  respondentScore: number;
  summary: string;
}

/**
 * Simplified legal issue from database storage
 */
export interface StoredLegalIssue {
  category: string;
  description: string;
  elements: Array<{ description: string; isSatisfied: boolean | null }>;
  applicableStatutes: string[];
  applicableCaseLaw?: string[];
}

/**
 * Simplified burden of proof from database storage
 */
export interface StoredBurdenOfProof {
  overallBurdenMet: boolean;
  analyses: Array<{
    issue: string;
    probability: number;
    reasoning: string;
  }>;
}

/**
 * Simplified damages item from database storage
 */
export interface StoredDamagesItem {
  type: string;
  description: string;
  claimedAmount: number;
  supportedAmount: number;
  supported: boolean;
  basis: string;
}

/**
 * Simplified damages calculation from database storage
 */
export interface StoredDamagesCalculation {
  claimedTotal: number;
  supportedTotal: number;
  recommendedTotal: number;
  items: StoredDamagesItem[];
  interestCalculation?: {
    rate: number;
    startDate: string;
    endDate: string;
    days: number;
    amount: number;
    statutoryBasis: string;
  };
}

/**
 * Simplified conclusion of law from database storage
 */
export interface StoredConclusionOfLaw {
  issue: string;
  conclusion: string;
  confidence: number;
}

/**
 * Simplified award recommendation from database storage
 */
export interface StoredAwardRecommendation {
  prevailingParty: 'claimant' | 'respondent' | 'split';
  awardAmount: number;
  reasoning: string;
}

/**
 * Simplified citation from database storage
 */
export interface StoredCitation {
  citation: string;
  type: 'statute' | 'case_law' | 'regulation';
  usedFor: string;
}

// =========================================
// DRAFT AWARD INPUT/OUTPUT
// =========================================

/**
 * Input for generating a draft award (using simplified stored types)
 */
export interface DraftAwardInput {
  /** Case ID */
  caseId: string;
  /** Case reference number */
  caseReference: string;
  /** Case description */
  caseDescription: string;
  /** Jurisdiction (e.g., "US-CA") */
  jurisdiction: string;
  /** Dispute type */
  disputeType: string;
  /** Claimed amount */
  claimedAmount: number;

  /** Claimant name */
  claimantName: string;
  /** Respondent name */
  respondentName: string;

  // From Phase 3.3 - Fact Analysis (simplified)
  /** Extracted facts from both parties */
  extractedFacts: {
    claimant: StoredExtractedFact[];
    respondent: StoredExtractedFact[];
  };
  /** Disputed facts */
  disputedFacts: StoredDisputedFact[];
  /** Undisputed facts */
  undisputedFacts: StoredUndisputedFact[];
  /** Credibility scores */
  credibilityScores: StoredCredibilityScores;

  // From Phase 3.4 - Legal Analysis (simplified)
  /** Legal issues identified */
  legalIssues: StoredLegalIssue[];
  /** Burden of proof analysis */
  burdenOfProof: StoredBurdenOfProof;
  /** Damages calculation */
  damagesCalculation: StoredDamagesCalculation;
  /** Conclusions of law from analysis */
  conclusionsOfLaw: StoredConclusionOfLaw[];
  /** Award recommendation */
  awardRecommendation: StoredAwardRecommendation;
  /** Citations used in analysis */
  citationsUsed: StoredCitation[];
}

/**
 * Output from draft award generation
 */
export interface DraftAwardOutput {
  /** Findings of fact */
  findingsOfFact: FindingOfFact[];
  /** Conclusions of law */
  conclusionsOfLaw: AwardConclusionOfLaw[];
  /** Award decision */
  decision: AwardDecision;
  /** Overall confidence score (0-1) */
  confidence: number;
  /** Model used for generation */
  modelUsed: string;
  /** Tokens used */
  tokensUsed: number;
  /** Generation timestamp */
  generatedAt: Date;
}

// =========================================
// REVIEW TYPES
// =========================================

/**
 * Review decision options
 */
export type ReviewDecision = 'APPROVE' | 'MODIFY' | 'REJECT' | 'ESCALATE';

/**
 * Review submission
 */
export interface ReviewSubmission {
  /** Review decision */
  reviewStatus: ReviewDecision;
  /** Optional notes from reviewer */
  reviewNotes?: string;
}

/**
 * Review result
 */
export interface ReviewResult {
  /** Draft award ID */
  id: string;
  /** Review status */
  reviewStatus: ReviewDecision;
  /** When reviewed */
  reviewedAt: Date;
  /** Next step description */
  nextStep: string;
}

// =========================================
// FULL DRAFT AWARD
// =========================================

/**
 * Complete draft award as stored in database
 */
export interface DraftAward {
  /** Unique identifier */
  id: string;
  /** Case ID */
  caseId: string;

  /** Findings of fact (JSON) */
  findingsOfFact: FindingOfFact[];
  /** Conclusions of law (JSON) */
  conclusionsOfLaw: AwardConclusionOfLaw[];

  /** Decision narrative */
  decision: string;
  /** Award amount */
  awardAmount: number | null;
  /** Prevailing party */
  prevailingParty: 'CLAIMANT' | 'RESPONDENT' | 'SPLIT' | null;

  /** Reasoning */
  reasoning: string;

  /** AI confidence score */
  confidence: number;
  /** Whether citations were verified */
  citationsVerified: boolean;

  /** Model used */
  modelUsed: string;
  /** Generation timestamp */
  generatedAt: Date;

  /** Review status */
  reviewStatus: ReviewDecision | null;
  /** Review timestamp */
  reviewedAt: Date | null;
  /** Review notes */
  reviewNotes: string | null;

  /** Record timestamps */
  createdAt: Date;
  updatedAt: Date;
}

// =========================================
// GENERATION OPTIONS
// =========================================

/**
 * Options for draft award generation
 */
export interface DraftAwardOptions {
  /** Force regeneration if exists */
  force?: boolean;
  /** Skip notification */
  skipNotification?: boolean;
}
