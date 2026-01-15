/**
 * Award Module
 *
 * Exports for draft award generation, PDF creation,
 * and final award issuance.
 */

// Core generator functions
export {
  generateDraftAward,
  getDraftAward,
  submitDraftAwardReview,
  loadDraftAwardInput,
} from './generator';

// Award issuance functions
export {
  finalizeAward,
  getIssuedAward,
  canIssueAward,
  getAwardDownloadUrl,
  type FinalizeAwardInput,
  type FinalizeAwardResult,
  type IssuedAward,
} from './issuance';

// PDF generation functions
export {
  generateAwardPdf,
  generateReferenceNumber,
  formatCurrency,
  type AwardPdfInput,
  type AwardPdfResult,
} from './pdf-generator';

// Types
export type {
  FindingBasis,
  FindingOfFact,
  AwardConclusionOfLaw,
  AwardDecision,
  DraftAwardInput,
  DraftAwardOutput,
  ReviewDecision,
  ReviewSubmission,
  ReviewResult,
  DraftAward,
  DraftAwardOptions,
} from './types';

// Award review workflow
export {
  createInitialRevision,
  getRevisionHistory,
  getRevision,
  modifyDraftAward,
  rejectDraftAward,
  escalateDraftAward,
  resolveEscalation,
  getEscalation,
  approveDraftAward,
  type AwardModification,
  type ModificationResult,
  type EscalationInput,
  type EscalationResult,
  type RejectionFeedback,
  type RevisionInfo,
} from './workflow';

// Prompts (for testing/customization)
export {
  AWARD_GENERATION_SYSTEM_PROMPT,
  buildFindingsOfFactPrompt,
  buildConclusionsOfLawPrompt,
  buildOrderPrompt,
  buildAwardNarrativePrompt,
  getAwardHeader,
  getAwardFooter,
} from './prompts';
