/**
 * API Contract Schemas
 *
 * JSON Schema definitions for API response validation.
 * These ensure API responses match expected contracts.
 */

import { z } from 'zod';

// ============================================================================
// Common Schemas
// ============================================================================

export const SuccessResponseSchema = z.object({
  success: z.literal(true),
  data: z.unknown().refine((val) => val !== undefined, {
    message: 'data is required',
  }),
  message: z.string().optional(),
});

export const ErrorResponseSchema = z.object({
  success: z.literal(false),
  error: z.object({
    message: z.string(),
    code: z.string().optional(),
    details: z.unknown().optional(),
  }),
});

export const PaginationSchema = z.object({
  page: z.number(),
  limit: z.number(),
  total: z.number(),
  totalPages: z.number(),
  hasMore: z.boolean(),
});

// ============================================================================
// User Schemas
// ============================================================================

export const UserSchema = z.object({
  id: z.string(),
  email: z.string().email(),
  name: z.string().nullable(),
  role: z.enum(['USER', 'ARBITRATOR', 'ADMIN']),
  emailVerified: z.boolean(),
  createdAt: z.string().datetime(),
});

export const UserResponseSchema = SuccessResponseSchema.extend({
  data: UserSchema,
});

// ============================================================================
// Case Schemas
// ============================================================================

export const CaseStatusSchema = z.enum([
  'DRAFT',
  'PENDING_RESPONDENT',
  'EVIDENCE_GATHERING',
  'ANALYSIS',
  'ARBITRATOR_REVIEW',
  'DECIDED',
  'CLOSED',
  'DISMISSED',
]);

export const DisputeTypeSchema = z.enum([
  'CONTRACTS',
  'PROPERTY',
  'CONSUMER',
  'EMPLOYMENT',
  'LANDLORD_TENANT',
  'OTHER',
]);

export const CaseSchema = z.object({
  id: z.string(),
  referenceNumber: z.string(),
  status: CaseStatusSchema,
  jurisdiction: z.string(),
  disputeType: DisputeTypeSchema,
  description: z.string(),
  amount: z.number(),
  claimantId: z.string(),
  respondentId: z.string().nullable(),
  responseDeadline: z.string().datetime().nullable(),
  evidenceDeadline: z.string().datetime().nullable(),
  createdAt: z.string().datetime(),
  updatedAt: z.string().datetime(),
});

export const CaseResponseSchema = SuccessResponseSchema.extend({
  data: CaseSchema,
});

export const CaseListResponseSchema = SuccessResponseSchema.extend({
  data: z.object({
    cases: z.array(CaseSchema),
    pagination: PaginationSchema,
  }),
});

// ============================================================================
// Evidence Schemas
// ============================================================================

export const EvidenceTypeSchema = z.enum([
  'DOCUMENT',
  'IMAGE',
  'VIDEO',
  'AUDIO',
  'COMMUNICATION',
  'FINANCIAL',
  'OTHER',
]);

export const EvidenceStatusSchema = z.enum(['UPLOADED', 'PROCESSING', 'READY', 'FAILED']);

export const EvidenceSchema = z.object({
  id: z.string(),
  caseId: z.string(),
  uploadedById: z.string(),
  type: EvidenceTypeSchema,
  status: EvidenceStatusSchema,
  title: z.string(),
  description: z.string().nullable(),
  fileName: z.string(),
  mimeType: z.string(),
  fileSize: z.number(),
  fileUrl: z.string().url(),
  createdAt: z.string().datetime(),
});

export const EvidenceResponseSchema = SuccessResponseSchema.extend({
  data: EvidenceSchema,
});

export const EvidenceListResponseSchema = SuccessResponseSchema.extend({
  data: z.array(EvidenceSchema),
});

// ============================================================================
// Statement Schemas
// ============================================================================

export const StatementTypeSchema = z.enum(['CLAIMANT', 'RESPONDENT']);

export const StatementSchema = z.object({
  id: z.string(),
  caseId: z.string(),
  userId: z.string(),
  type: StatementTypeSchema,
  content: z.string(),
  isRebuttal: z.boolean(),
  version: z.number(),
  createdAt: z.string().datetime(),
});

export const StatementResponseSchema = SuccessResponseSchema.extend({
  data: StatementSchema,
});

// ============================================================================
// Award Schemas
// ============================================================================

export const PrevailingPartySchema = z.enum(['CLAIMANT', 'RESPONDENT', 'SPLIT']);

export const AwardSchema = z.object({
  id: z.string(),
  caseId: z.string(),
  referenceNumber: z.string(),
  awardAmount: z.number().nullable(),
  prevailingParty: PrevailingPartySchema,
  documentUrl: z.string().url().nullable(),
  issuedAt: z.string().datetime().nullable(),
  signedAt: z.string().datetime().nullable(),
});

export const AwardResponseSchema = SuccessResponseSchema.extend({
  data: AwardSchema,
});

export const DraftAwardSchema = z.object({
  id: z.string(),
  caseId: z.string(),
  findingsOfFact: z.array(
    z.object({
      id: z.string(),
      number: z.number(),
      finding: z.string(),
    })
  ),
  conclusionsOfLaw: z.array(
    z.object({
      id: z.string(),
      number: z.number(),
      conclusion: z.string(),
    })
  ),
  decision: z.string(),
  awardAmount: z.number().nullable(),
  prevailingParty: PrevailingPartySchema,
  confidence: z.number(),
  reviewStatus: z.enum(['APPROVE', 'MODIFY', 'REJECT', 'ESCALATE']).nullable(),
  generatedAt: z.string().datetime(),
});

export const DraftAwardResponseSchema = SuccessResponseSchema.extend({
  data: DraftAwardSchema,
});

// ============================================================================
// Payment Schemas
// ============================================================================

export const PaymentTypeSchema = z.enum(['FILING_FEE', 'RESPONSE_FEE', 'EXPEDITED_FEE']);

export const PaymentStatusSchema = z.enum(['PENDING', 'COMPLETED', 'FAILED', 'REFUNDED']);

export const PaymentSchema = z.object({
  id: z.string(),
  caseId: z.string(),
  userId: z.string(),
  type: PaymentTypeSchema,
  status: PaymentStatusSchema,
  amount: z.number(),
  currency: z.string(),
  paidAt: z.string().datetime().nullable(),
  createdAt: z.string().datetime(),
});

export const PaymentResponseSchema = SuccessResponseSchema.extend({
  data: PaymentSchema,
});

export const PaymentListResponseSchema = SuccessResponseSchema.extend({
  data: z.object({
    payments: z.array(PaymentSchema),
    status: z.object({
      filingFeePaid: z.boolean(),
      responseFeePaid: z.boolean(),
      totalPaid: z.number(),
      pendingAmount: z.number(),
    }),
    fees: z.object({
      filingFee: z.number(),
      responseFee: z.number(),
      expeditedFee: z.number(),
    }),
  }),
});

export const CheckoutSessionResponseSchema = SuccessResponseSchema.extend({
  data: z.object({
    sessionId: z.string(),
    sessionUrl: z.string().url(),
    paymentId: z.string(),
    amount: z.number(),
  }),
});

// ============================================================================
// Notification Schemas
// ============================================================================

export const NotificationSchema = z.object({
  id: z.string(),
  userId: z.string(),
  type: z.string(),
  title: z.string(),
  message: z.string(),
  actionUrl: z.string().nullable(),
  read: z.boolean(),
  createdAt: z.string().datetime(),
});

export const NotificationListResponseSchema = SuccessResponseSchema.extend({
  data: z.array(NotificationSchema),
});

// ============================================================================
// Audit Log Schemas
// ============================================================================

export const AuditLogSchema = z.object({
  id: z.string(),
  userId: z.string().nullable(),
  action: z.string(),
  resourceType: z.string().nullable(),
  resourceId: z.string().nullable(),
  metadata: z.record(z.unknown()).nullable(),
  ipAddress: z.string().nullable(),
  createdAt: z.string().datetime(),
});

export const AuditLogListResponseSchema = SuccessResponseSchema.extend({
  data: z.object({
    logs: z.array(AuditLogSchema),
    pagination: PaginationSchema,
  }),
});
