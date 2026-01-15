/**
 * Case Factory
 *
 * Creates mock Case objects and related entities for testing.
 */

import { createClaimant, createRespondent } from './user';
import { generateId, generateReferenceNumber, randomIp, randomUserAgent } from './utils';

export interface CaseFactoryOptions {
  id?: string;
  status?: string;
  disputeType?: string;
  jurisdiction?: string;
  amount?: number;
  description?: string;
  claimantId?: string;
  respondentId?: string | null;
  createdAt?: Date;
}

/**
 * Create a mock Case
 */
export function createCase(options: CaseFactoryOptions = {}) {
  const id = options.id ?? generateId();
  const createdAt = options.createdAt ?? new Date();

  return {
    id,
    referenceNumber: generateReferenceNumber('ARB'),
    status: options.status ?? 'DRAFT',
    jurisdiction: options.jurisdiction ?? 'US-CA',
    disputeType: options.disputeType ?? 'CONTRACTS',
    description: options.description ?? 'Test dispute regarding contract breach',
    amount: options.amount ?? 5000,
    claimantId: options.claimantId ?? generateId(),
    respondentId: options.respondentId ?? null,
    responseDeadline: new Date(createdAt.getTime() + 14 * 24 * 60 * 60 * 1000),
    evidenceDeadline: new Date(createdAt.getTime() + 21 * 24 * 60 * 60 * 1000),
    rebuttalDeadline: new Date(createdAt.getTime() + 28 * 24 * 60 * 60 * 1000),
    createdAt,
    updatedAt: createdAt,
    closedAt: null,
    deletedAt: null,
  };
}

export const createDraftCase = (options = {}) => createCase({ ...options, status: 'DRAFT' });
export const createPendingRespondentCase = (options = {}) =>
  createCase({ ...options, status: 'PENDING_RESPONDENT' });
export const createEvidenceGatheringCase = (options: CaseFactoryOptions = {}) =>
  createCase({
    ...options,
    status: 'EVIDENCE_GATHERING',
    respondentId: options.respondentId ?? generateId(),
  });
export const createAnalysisCase = (options: CaseFactoryOptions = {}) =>
  createCase({
    ...options,
    status: 'ANALYSIS',
    respondentId: options.respondentId ?? generateId(),
  });
export const createArbitratorReviewCase = (options: CaseFactoryOptions = {}) =>
  createCase({
    ...options,
    status: 'ARBITRATOR_REVIEW',
    respondentId: options.respondentId ?? generateId(),
  });
export const createDecidedCase = (options: CaseFactoryOptions = {}) => ({
  ...createCase({
    ...options,
    status: 'DECIDED',
    respondentId: options.respondentId ?? generateId(),
  }),
  closedAt: new Date(),
});

/**
 * Create a mock Invitation
 */
export function createInvitation(
  options: { caseId?: string; status?: string; email?: string; expiresAt?: Date } = {}
) {
  const caseId = options.caseId ?? generateId();
  const createdAt = new Date();

  return {
    id: generateId(),
    caseId,
    token: generateId('inv'),
    email: options.email ?? 'respondent@test.example.com',
    status: options.status ?? 'SENT',
    expiresAt: options.expiresAt ?? new Date(Date.now() + 7 * 24 * 60 * 60 * 1000),
    sentAt: createdAt,
    viewedAt: null,
    acceptedAt: null,
    createdAt,
    updatedAt: createdAt,
  };
}

/**
 * Create a mock Agreement
 */
export function createAgreement(
  options: { caseId?: string; version?: string; content?: string } = {}
) {
  const caseId = options.caseId ?? generateId();
  const createdAt = new Date();

  return {
    id: generateId(),
    caseId,
    version: options.version ?? '1.0',
    content: options.content ?? 'ARBITRATION SUBMISSION AGREEMENT...',
    documentHash: generateId('hash'),
    createdAt,
    updatedAt: createdAt,
  };
}

/**
 * Create a mock Signature
 */
export function createSignature(
  options: { agreementId?: string; userId?: string; signedAt?: Date } = {}
) {
  const signedAt = options.signedAt ?? new Date();

  return {
    id: generateId(),
    agreementId: options.agreementId ?? generateId(),
    userId: options.userId ?? generateId(),
    signedAt,
    ipAddress: randomIp(),
    userAgent: randomUserAgent(),
    deviceFingerprint: generateId('fp'),
    createdAt: signedAt,
  };
}

/**
 * Create a complete case with all related entities
 */
export function createCompleteCase(options: CaseFactoryOptions = {}) {
  const claimant = createClaimant();
  const respondent = createRespondent();
  const caseData = createCase({
    ...options,
    claimantId: claimant.id,
    respondentId: respondent.id,
    status: options.status ?? 'EVIDENCE_GATHERING',
  });
  const invitation = createInvitation({
    caseId: caseData.id,
    email: respondent.email,
    status: 'ACCEPTED',
  });
  const agreement = createAgreement({ caseId: caseData.id });
  const signatures = [
    createSignature({ agreementId: agreement.id, userId: claimant.id }),
    createSignature({ agreementId: agreement.id, userId: respondent.id }),
  ];

  return { case: caseData, claimant, respondent, invitation, agreement, signatures };
}
