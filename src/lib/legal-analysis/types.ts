/**
 * Legal Analysis Engine Types
 *
 * TypeScript interfaces for legal issue classification, burden of proof,
 * damages calculation, and conclusions of law.
 */

// =========================================
// LEGAL ISSUE CLASSIFICATION
// =========================================

/**
 * Categories of legal issues
 */
export type LegalIssueCategory =
  | 'breach_of_contract'
  | 'consumer_protection'
  | 'warranty'
  | 'fraud'
  | 'negligence'
  | 'unjust_enrichment'
  | 'statutory_violation'
  | 'payment_dispute'
  | 'service_dispute'
  | 'property_damage';

/**
 * A single legal element that must be proven
 */
export interface LegalElement {
  /** Unique identifier */
  id: string;
  /** Element name (e.g., "Existence of Contract") */
  name: string;
  /** Description of what must be proven */
  description: string;
  /** Whether the element is satisfied */
  isSatisfied: boolean | null;
  /** Fact IDs supporting this element */
  supportingFacts: string[];
  /** Fact IDs opposing this element */
  opposingFacts: string[];
  /** Analysis of the element */
  analysis: string;
  /** Confidence in the assessment (0-1) */
  confidence: number;
}

/**
 * A legal issue identified in the case
 */
export interface LegalIssue {
  /** Unique identifier */
  id: string;
  /** Category of the issue */
  category: LegalIssueCategory;
  /** Description of the legal issue */
  description: string;
  /** Legal elements that must be proven */
  elements: LegalElement[];
  /** Applicable statute citations */
  applicableStatutes: string[];
  /** Applicable case law citations */
  applicableCaseLaw: string[];
  /** How central this issue is to the outcome (0-1) */
  materialityScore: number;
  /** Additional analysis notes */
  analysisNotes?: string;
}

/**
 * Result of issue classification
 */
export interface IssueClassificationResult {
  issues: LegalIssue[];
  tokensUsed: number;
}

// =========================================
// BURDEN OF PROOF ANALYSIS
// =========================================

/**
 * Legal standard for burden of proof
 */
export type BurdenOfProofStandard =
  | 'preponderance' // Civil standard - more likely than not (>50%)
  | 'clear_and_convincing' // Fraud, punitive damages
  | 'beyond_reasonable_doubt'; // Criminal (not used in arbitration)

/**
 * Analysis of whether a party met their burden
 */
export interface BurdenAnalysis {
  /** Party bearing the burden */
  party: 'claimant' | 'respondent';
  /** Standard applied */
  standard: BurdenOfProofStandard;
  /** Issue or element being analyzed */
  issue: string;
  /** Whether the burden was met */
  isMet: boolean | null;
  /** Probability assessment (0-1) */
  probability: number;
  /** Reasoning for the determination */
  reasoning: string;
  /** Key evidence IDs */
  keyEvidence: string[];
  /** Identified weaknesses */
  weaknesses: string[];
}

/**
 * When the burden of proof shifts between parties
 */
export interface ShiftingBurden {
  /** Party originally bearing burden */
  fromParty: 'claimant' | 'respondent';
  /** Party now bearing burden */
  toParty: 'claimant' | 'respondent';
  /** What triggered the shift */
  trigger: string;
  /** New burden that must be met */
  newBurden: string;
}

/**
 * Complete burden of proof analysis result
 */
export interface BurdenOfProofResult {
  /** Overall determination */
  overallBurdenMet: boolean;
  /** Individual analyses */
  analyses: BurdenAnalysis[];
  /** Any burden shifts */
  shiftingBurdens?: ShiftingBurden[];
  /** Summary of analysis */
  summary: string;
  /** Tokens used */
  tokensUsed?: number;
}

// =========================================
// DAMAGES CALCULATION
// =========================================

/**
 * Types of damages
 */
export type DamagesType =
  | 'compensatory' // Actual losses
  | 'consequential' // Foreseeable indirect damages
  | 'incidental' // Costs of dealing with breach
  | 'restitution' // Return of value conferred
  | 'statutory' // Fixed by statute
  | 'punitive'; // Punishment (rare in arbitration)

/**
 * Adjustment to a damages calculation
 */
export interface DamagesAdjustment {
  /** Type of adjustment */
  type: 'mitigation' | 'limitation' | 'offset' | 'statutory_cap' | 'interest';
  /** Description of the adjustment */
  description: string;
  /** Amount (positive = increase, negative = decrease) */
  amount: number;
  /** Legal basis for the adjustment */
  legalBasis?: string;
}

/**
 * A single damages item
 */
export interface DamagesItem {
  /** Unique identifier */
  id: string;
  /** Type of damages */
  type: DamagesType;
  /** Description */
  description: string;
  /** Amount claimed by claimant */
  claimedAmount: number;
  /** Amount supported by evidence */
  supportedAmount: number;
  /** Final calculated amount */
  calculatedAmount: number;
  /** Legal basis for the damages */
  basis: string;
  /** Evidence IDs supporting this item */
  evidenceSupport: string[];
  /** Adjustments applied */
  adjustments: DamagesAdjustment[];
  /** Confidence in calculation (0-1) */
  confidence: number;
}

/**
 * Analysis of mitigation efforts
 */
export interface MitigationAnalysis {
  /** Whether claimant mitigated damages */
  didClaimantMitigate: boolean;
  /** Mitigation efforts identified */
  mitigationEfforts: string[];
  /** Any failure to mitigate */
  failureToMitigate?: string;
  /** Reduction amount due to mitigation issues */
  reduction: number;
}

/**
 * Interest calculation
 */
export interface InterestCalculation {
  /** Principal amount */
  principal: number;
  /** Annual interest rate (decimal) */
  rate: number;
  /** Start date for interest */
  startDate: string;
  /** End date for interest */
  endDate: string;
  /** Number of days */
  days: number;
  /** Calculated interest amount */
  interestAmount: number;
  /** Statutory basis */
  statutoryBasis?: string;
}

/**
 * Complete damages calculation result
 */
export interface DamagesCalculation {
  /** Total amount claimed */
  claimedTotal: number;
  /** Total amount supported by evidence */
  supportedTotal: number;
  /** Recommended total award */
  recommendedTotal: number;
  /** Individual damages items */
  items: DamagesItem[];
  /** Mitigation analysis */
  mitigation: MitigationAnalysis;
  /** Interest calculation if applicable */
  interestCalculation?: InterestCalculation;
  /** Summary of damages analysis */
  summary: string;
  /** Tokens used */
  tokensUsed?: number;
}

// =========================================
// CONCLUSIONS OF LAW
// =========================================

/**
 * A single conclusion of law
 */
export interface ConclusionOfLaw {
  /** Unique identifier */
  id: string;
  /** Legal issue addressed */
  issue: string;
  /** The legal conclusion */
  conclusion: string;
  /** Citations supporting the conclusion */
  legalBasis: string[];
  /** Fact IDs supporting the conclusion */
  supportingFacts: string[];
  /** Confidence in the conclusion (0-1) */
  confidence: number;
}

/**
 * Award recommendation from conclusions
 */
export interface AwardRecommendation {
  /** Which party prevails */
  prevailingParty: 'claimant' | 'respondent' | 'split';
  /** Recommended award amount */
  awardAmount: number;
  /** Reasoning for the recommendation */
  reasoning: string;
}

/**
 * Result of conclusions generation
 */
export interface ConclusionsResult {
  /** Individual conclusions */
  conclusions: ConclusionOfLaw[];
  /** Overall determination */
  overallDetermination: string;
  /** Award recommendation */
  awardRecommendation: AwardRecommendation;
  /** Tokens used */
  tokensUsed?: number;
}

// =========================================
// CONFIDENCE SCORING
// =========================================

/**
 * Individual confidence factors
 */
export interface ConfidenceFactors {
  /** Quality of evidence (0-1) */
  evidenceQuality: number;
  /** Strength of legal precedent (0-1) */
  legalPrecedentStrength: number;
  /** Certainty of facts (0-1) */
  factualCertainty: number;
  /** Clarity of applicable law (0-1) */
  jurisdictionalClarity: number;
  /** Issue complexity (0-1, higher = simpler) */
  issueComplexity: number;
}

/**
 * Citation usage tracking
 */
export interface CitationUsage {
  /** The citation */
  citation: string;
  /** Normalized form */
  normalized: string;
  /** Type of citation */
  type: 'statute' | 'case_law' | 'regulation';
  /** What it was used for */
  usedFor: string;
  /** URL to source if available */
  url?: string;
  /** Whether citation was verified */
  verified?: boolean;
}

// =========================================
// COMPLETE LEGAL ANALYSIS RESULT
// =========================================

/**
 * Analysis phase status
 */
export type LegalAnalysisPhase =
  | 'queued'
  | 'classifying_issues'
  | 'analyzing_burden'
  | 'calculating_damages'
  | 'generating_conclusions'
  | 'scoring_confidence'
  | 'completed'
  | 'failed';

/**
 * Progress update for legal analysis
 */
export interface LegalAnalysisProgress {
  caseId: string;
  jobId: string;
  phase: LegalAnalysisPhase;
  progress: number;
  message?: string;
}

/**
 * Complete legal analysis result
 */
export interface LegalAnalysisResult {
  /** Case ID */
  caseId: string;
  /** Job ID */
  jobId: string;
  /** Status */
  status: 'completed' | 'failed';

  /** Legal issues identified */
  legalIssues?: LegalIssue[];
  /** Burden of proof analysis */
  burdenOfProof?: BurdenOfProofResult;
  /** Damages calculation */
  damagesCalculation?: DamagesCalculation;
  /** Conclusions of law */
  conclusionsOfLaw?: ConclusionOfLaw[];

  /** Overall confidence score (0-1) */
  overallConfidence?: number;
  /** Confidence factors */
  confidenceFactors?: ConfidenceFactors;

  /** Citations used */
  citationsUsed?: CitationUsage[];

  /** Award recommendation */
  awardRecommendation?: AwardRecommendation;

  /** Jurisdiction applied */
  jurisdictionApplied: string;
  /** Model used for analysis */
  modelUsed: string;
  /** Total tokens used */
  tokensUsed: number;
  /** Processing time in ms */
  processingTimeMs: number;
  /** Estimated cost */
  estimatedCost: number;

  /** Error message if failed */
  error?: string;
}

// =========================================
// INPUT TYPES
// =========================================

/**
 * Evidence summary for legal analysis
 */
export interface LegalEvidenceSummary {
  id: string;
  fileName: string;
  documentType?: string;
  summary?: string;
  keyPoints?: string[];
  submittedBy: 'claimant' | 'respondent';
}

/**
 * Extracted fact from Phase 3.3
 */
export interface ExtractedFactInput {
  id: string;
  statement: string;
  category: string;
  date?: string;
  amount?: number;
  confidence: number;
}

/**
 * Disputed fact from Phase 3.3
 */
export interface DisputedFactInput {
  id: string;
  topic: string;
  claimantPosition: string;
  respondentPosition: string;
  materialityScore: number;
}

/**
 * Undisputed fact from Phase 3.3
 */
export interface UndisputedFactInput {
  id: string;
  fact: string;
  materialityScore: number;
}

/**
 * Contradiction from Phase 3.3
 */
export interface ContradictionInput {
  id: string;
  topic: string;
  severity: string;
  analysis: string;
}

/**
 * Credibility scores from Phase 3.3
 */
export interface CredibilityInput {
  claimant: { overall: number };
  respondent: { overall: number };
}

/**
 * Complete input for legal analysis
 */
export interface LegalAnalysisInput {
  /** Case ID */
  caseId: string;
  /** Jurisdiction code (e.g., "US-CA") */
  jurisdiction: string;
  /** Dispute type */
  disputeType: string;
  /** Claimed amount */
  claimedAmount: number;
  /** Case description */
  caseDescription: string;

  /** Extracted facts from Phase 3.3 */
  extractedFacts: {
    claimant: ExtractedFactInput[];
    respondent: ExtractedFactInput[];
  };
  /** Disputed facts */
  disputedFacts: DisputedFactInput[];
  /** Undisputed facts */
  undisputedFacts: UndisputedFactInput[];
  /** Contradictions */
  contradictions: ContradictionInput[];
  /** Credibility scores */
  credibilityScores: CredibilityInput;

  /** Evidence summaries */
  evidenceSummaries: LegalEvidenceSummary[];
}

/**
 * Options for legal analysis
 */
export interface LegalAnalysisOptions {
  /** Skip issue classification */
  skipIssueClassification?: boolean;
  /** Skip burden analysis */
  skipBurdenAnalysis?: boolean;
  /** Skip damages calculation */
  skipDamagesCalculation?: boolean;
  /** Skip conclusions */
  skipConclusions?: boolean;
  /** Force re-analysis */
  force?: boolean;
}
