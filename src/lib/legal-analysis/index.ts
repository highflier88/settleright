/**
 * Legal Analysis Engine
 *
 * Phase 3.4: AI-powered legal analysis including issue classification,
 * burden of proof analysis, damages calculation, and conclusions of law.
 */

// Main orchestrator
export { getLegalAnalysisStatus, loadLegalAnalysisInput, runLegalAnalysis } from './orchestrator';

// Issue classification
export { classifyLegalIssues } from './issue-classifier';

// Burden of proof
export {
  analyzeBurdenOfProof,
  getApplicableBurdenStandard,
  isElementBurdenMet,
  summarizePartyBurden,
} from './burden-analyzer';

// Damages calculation
export { applyClraMinimum, applyDamagesCaps, calculateDamages } from './damages-calculator';

// Confidence scoring
export {
  aggregateCitations,
  getConfidenceLevel,
  getConfidenceRecommendations,
  scoreConfidence,
  trackCitation,
} from './confidence-scorer';

// Rules engine
export {
  calculateInterest,
  CALIFORNIA_RULES,
  checkStatuteOfLimitations,
  formatCitation,
  getApplicableStatutes,
  getBurdenStandard,
  getDamagesCaps,
  getPrejudgmentInterestRate,
  getRules,
  getSmallClaimsLimit,
  getSpecialRules,
  getSupportedJurisdictions,
  isJurisdictionSupported,
  ruleEngine,
} from './rules';

// Types
export type {
  AwardRecommendation,
  BurdenAnalysis,
  BurdenOfProofResult,
  BurdenOfProofStandard,
  CitationUsage,
  ConclusionOfLaw,
  ConclusionsResult,
  ConfidenceFactors,
  ContradictionInput,
  CredibilityInput,
  DamagesAdjustment,
  DamagesCalculation,
  DamagesItem,
  DamagesType,
  DisputedFactInput,
  ExtractedFactInput,
  InterestCalculation,
  IssueClassificationResult,
  LegalAnalysisInput,
  LegalAnalysisOptions,
  LegalAnalysisPhase,
  LegalAnalysisProgress,
  LegalAnalysisResult,
  LegalElement,
  LegalEvidenceSummary,
  LegalIssue,
  LegalIssueCategory,
  MitigationAnalysis,
  ShiftingBurden,
  UndisputedFactInput,
} from './types';

// Rule types
export type {
  DamagesCap,
  InterestParams,
  InterestResult,
  JurisdictionRules,
  RuleEngine,
  SpecialRule,
} from './rules';
