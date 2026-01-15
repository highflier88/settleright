/**
 * Shared types that can be used in both server and client components.
 * These mirror the Prisma types but are safe for client-side use.
 *
 * IMPORTANT: Keep these in sync with prisma/schema.prisma
 */

// =============================================================================
// JSON VALUE TYPE (mirrors Prisma's JsonValue)
// =============================================================================

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
// INTERFACE TYPES (simplified for client use)
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
  sessionId: string | null;
  verifiedAt: Date | null;
  verifiedName: string | null;
  documentType: string | null;
  failureReason: string | null;
  expiresAt: Date | null;
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
  description: string | null;
  documentType: string | null;
  summary: string | null;
  keyPoints: string[] | null;
  extractedEntities: JsonValue | null;
  classificationConfidence: number | null;
  processingStatus: string;
  processedAt: Date | null;
  submittedAt: Date;
  viewedByOpposingParty: boolean;
}

export interface Statement {
  id: string;
  caseId: string;
  submittedById: string;
  statementType: StatementType;
  type: StatementType;
  version: number;
  content: string;
  claimItems: JsonValue | null;
  submittedAt: Date;
  updatedAt: Date;
}

export interface DraftAward {
  id: string;
  caseId: string;
  version: number;
  content: string;
  summary: string | null;
  decision: string | null;
  reasoning: string | null;
  findingsOfFact: JsonValue | null;
  conclusionsOfLaw: JsonValue | null;
  prevailingParty: PrevailingParty | null;
  awardedAmount: number | null;
  awardAmount: number | null;
  confidence: number | null;
  generatedAt: Date;
  reviewStatus: ReviewDecision | null;
  reviewedBy: string | null;
  reviewedAt: Date | null;
  reviewNotes: string | null;
}

export interface AnalysisJob {
  id: string;
  caseId: string;
  status: AnalysisStatus;
  legalAnalysisStatus: AnalysisStatus | null;
  legalIssues: JsonValue | null;
  burdenOfProof: JsonValue | null;
  damagesCalculation: JsonValue | null;
  conclusionsOfLaw: JsonValue | null;
  startedAt: Date | null;
  completedAt: Date | null;
  errorMessage: string | null;
  result: Record<string, unknown> | null;
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
  createdAt: Date;
  updatedAt: Date;
}
