/**
 * Shared types that can be used in both server and client components.
 * These mirror the Prisma types but are safe for client-side use.
 *
 * IMPORTANT: Keep these in sync with prisma/schema.prisma
 */

// =============================================================================
// JSON VALUE TYPE (compatible with Prisma's JsonValue)
// =============================================================================

// JSON type compatible with Prisma's JsonValue
// Using a recursive type that TypeScript can handle in JSX contexts
export type JsonValue =
  | string
  | number
  | boolean
  | null
  | JsonValue[]
  | { [key: string]: JsonValue };

// =============================================================================
// ENUMS
// =============================================================================

export type UserRole = 'USER' | 'ARBITRATOR' | 'ADMIN';

export type KYCStatus = 'NOT_STARTED' | 'PENDING' | 'VERIFIED' | 'FAILED' | 'EXPIRED';

export type CaseStatus =
  | 'DRAFT'
  | 'PENDING_RESPONDENT'
  | 'PENDING_AGREEMENT'
  | 'EVIDENCE_SUBMISSION'
  | 'ANALYSIS_PENDING'
  | 'ANALYSIS_IN_PROGRESS'
  | 'ARBITRATOR_REVIEW'
  | 'DECIDED'
  | 'CLOSED';

export type CaseRole = 'CLAIMANT' | 'RESPONDENT';

export type DisputeType = 'CONTRACT' | 'PAYMENT' | 'SERVICE' | 'GOODS' | 'OTHER';

export type InvitationStatus = 'PENDING' | 'VIEWED' | 'ACCEPTED' | 'EXPIRED' | 'CANCELLED';

export type AgreementStatus = 'PENDING_CLAIMANT' | 'PENDING_RESPONDENT' | 'COMPLETE';

export type StatementType = 'INITIAL' | 'REBUTTAL';

export type AnalysisStatus = 'PENDING' | 'QUEUED' | 'PROCESSING' | 'COMPLETED' | 'FAILED';

export type ReviewDecision = 'APPROVE' | 'MODIFY' | 'REJECT' | 'ESCALATE';

export type PrevailingParty = 'CLAIMANT' | 'RESPONDENT' | 'SPLIT';

export type NotificationType = 'EMAIL' | 'SMS' | 'IN_APP';

export type PaymentStatus = 'PENDING' | 'PROCESSING' | 'COMPLETED' | 'FAILED' | 'REFUNDED';

export type ProcessingStatus =
  | 'PENDING'
  | 'QUEUED'
  | 'EXTRACTING'
  | 'OCR_PROCESSING'
  | 'CLASSIFYING'
  | 'EXTRACTING_ENTITIES'
  | 'SUMMARIZING'
  | 'COMPLETED'
  | 'FAILED';

export type DocumentType =
  | 'CONTRACT'
  | 'INVOICE'
  | 'RECEIPT'
  | 'CORRESPONDENCE'
  | 'LEGAL_NOTICE'
  | 'BANK_STATEMENT'
  | 'PHOTO_EVIDENCE'
  | 'OTHER';

export type AuditAction =
  | 'USER_REGISTERED'
  | 'USER_LOGIN'
  | 'USER_LOGOUT'
  | 'USER_PROFILE_UPDATED'
  | 'KYC_INITIATED'
  | 'KYC_COMPLETED'
  | 'KYC_FAILED'
  | 'CASE_CREATED'
  | 'CASE_UPDATED'
  | 'CASE_STATUS_CHANGED'
  | 'CASE_CLOSED'
  | 'INVITATION_SENT'
  | 'INVITATION_VIEWED'
  | 'INVITATION_ACCEPTED'
  | 'INVITATION_EXPIRED'
  | 'AGREEMENT_VIEWED'
  | 'AGREEMENT_SIGNED'
  | 'EVIDENCE_UPLOADED'
  | 'EVIDENCE_VIEWED'
  | 'EVIDENCE_DELETED'
  | 'STATEMENT_SUBMITTED'
  | 'STATEMENT_UPDATED'
  | 'ANALYSIS_INITIATED'
  | 'ANALYSIS_COMPLETED'
  | 'ANALYSIS_FAILED'
  | 'CASE_ASSIGNED'
  | 'REVIEW_STARTED'
  | 'REVIEW_COMPLETED'
  | 'DRAFT_AWARD_GENERATED'
  | 'DRAFT_AWARD_MODIFIED'
  | 'DRAFT_AWARD_APPROVED'
  | 'DRAFT_AWARD_REJECTED'
  | 'DRAFT_AWARD_ESCALATED'
  | 'ESCALATION_RESOLVED'
  | 'AWARD_SIGNED'
  | 'AWARD_ISSUED'
  | 'AWARD_DOWNLOADED'
  | 'ENFORCEMENT_PACKAGE_DOWNLOADED'
  | 'ARBITRATOR_ONBOARDED'
  | 'ARBITRATOR_CREDENTIALS_SUBMITTED'
  | 'ARBITRATOR_CREDENTIALS_VERIFIED'
  | 'ARBITRATOR_CREDENTIALS_REJECTED'
  | 'ARBITRATOR_ACTIVATED'
  | 'ARBITRATOR_DEACTIVATED'
  | 'COMPENSATION_CALCULATED'
  | 'COMPENSATION_APPROVED'
  | 'COMPENSATION_PAID'
  | 'COMPENSATION_DISPUTED'
  | 'PAYMENT_INITIATED'
  | 'PAYMENT_COMPLETED'
  | 'PAYMENT_FAILED'
  | 'REFUND_ISSUED'
  | 'AUDIT_LOG_EXPORTED'
  | 'AUDIT_LOG_VERIFIED'
  | 'COMPLIANCE_REPORT_GENERATED';

// =============================================================================
// INTERFACE TYPES (matching Prisma schema)
// =============================================================================

export interface User {
  id: string;
  clerkId: string;
  email: string;
  name: string | null;
  phone: string | null;
  role: UserRole;
  addressStreet: string | null;
  addressCity: string | null;
  addressState: string | null;
  addressPostalCode: string | null;
  addressCountry: string | null;
  createdAt: Date;
  updatedAt: Date;
  lastLoginAt: Date | null;
}

export interface IdentityVerification {
  id: string;
  userId: string;
  status: KYCStatus;
  provider: string | null;
  providerSessionId: string | null;
  documentType: string | null;
  verifiedName: string | null;
  verifiedDob: Date | null;
  initiatedAt: Date | null;
  verifiedAt: Date | null;
  expiresAt: Date | null;
  failedAt: Date | null;
  failureReason: string | null;
  failureCount: number;
  lastFailureCode: string | null;
  createdAt: Date;
  updatedAt: Date;
}

export interface Evidence {
  id: string;
  caseId: string;
  submittedById: string;
  fileName: string;
  fileType: string;
  fileSize: number;
  fileHash: string;
  storageKey: string;
  storageBucket: string;
  description: string | null;
  viewedByOpposingParty: boolean;
  viewedAt: Date | null;
  processingStatus: ProcessingStatus;
  processedAt: Date | null;
  processingError: string | null;
  extractedText: string | null;
  ocrText: string | null;
  ocrProcessedAt: Date | null;
  ocrConfidence: number | null;
  documentType: DocumentType | null;
  classificationConfidence: number | null;
  extractedEntities: JsonValue;
  summary: string | null;
  keyPoints: string[];
  submittedAt: Date;
  deletedAt: Date | null;
}

export interface Statement {
  id: string;
  caseId: string;
  submittedById: string;
  type: StatementType;
  content: string;
  claimItems: JsonValue;
  version: number;
  submittedAt: Date;
  updatedAt: Date;
}

export interface DraftAward {
  id: string;
  caseId: string;
  findingsOfFact: JsonValue;
  conclusionsOfLaw: JsonValue;
  decision: string;
  awardAmount: number | null;
  prevailingParty: PrevailingParty | null;
  reasoning: string;
  confidence: number;
  citationsVerified: boolean;
  modelUsed: string;
  generatedAt: Date;
  reviewStatus: ReviewDecision | null;
  reviewedAt: Date | null;
  reviewNotes: string | null;
  createdAt: Date;
  updatedAt: Date;
}

export interface AnalysisJob {
  id: string;
  caseId: string;
  status: AnalysisStatus;
  progress: number;
  queuedAt: Date | null;
  startedAt: Date | null;
  completedAt: Date | null;
  failedAt: Date | null;
  failureReason: string | null;
  modelUsed: string | null;
  tokensUsed: number | null;
  processingTimeMs: number | null;
  estimatedCost: number | null;
  extractedFacts: JsonValue;
  disputedFacts: JsonValue;
  undisputedFacts: JsonValue;
  timeline: JsonValue;
  contradictions: JsonValue;
  credibilityScores: JsonValue;
  legalIssues: JsonValue;
  burdenOfProof: JsonValue;
  damagesCalculation: JsonValue;
  conclusionsOfLaw: JsonValue;
  legalConfidence: number | null;
  citationsUsed: JsonValue;
  legalAnalysisStatus: AnalysisStatus | null;
  legalAnalysisStartedAt: Date | null;
  legalAnalysisCompletedAt: Date | null;
  legalAnalysisError: string | null;
  legalAnalysisTokens: number | null;
  createdAt: Date;
  updatedAt: Date;
}

export interface AuditLog {
  id: string;
  action: AuditAction;
  userId: string | null;
  caseId: string | null;
  ipAddress: string | null;
  userAgent: string | null;
  metadata: Record<string, unknown> | null;
  integrityHash: string | null;
  previousHash: string | null;
  timestamp: Date;
}

export interface NotificationPreference {
  id: string;
  userId: string;
  emailEnabled: boolean;
  smsEnabled: boolean;
  inAppEnabled: boolean;
  caseUpdates: boolean;
  deadlineReminders: boolean;
  evidenceUploads: boolean;
  awardNotifications: boolean;
  marketingEmails: boolean;
}
