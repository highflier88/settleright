/**
 * Award Factory
 *
 * Creates mock Award and DraftAward objects for testing.
 */

import { generateId, generateReferenceNumber, mockDecimal } from './utils';

export interface DraftAwardFactoryOptions {
  id?: string;
  caseId?: string;
  reviewStatus?: 'APPROVE' | 'MODIFY' | 'REJECT' | null;
  awardAmount?: number;
  prevailingParty?: 'CLAIMANT' | 'RESPONDENT' | 'SPLIT';
  confidence?: number;
  createdAt?: Date;
}

export interface AwardFactoryOptions {
  id?: string;
  caseId?: string;
  arbitratorId?: string;
  awardAmount?: number;
  prevailingParty?: 'CLAIMANT' | 'RESPONDENT' | 'SPLIT';
  issuedAt?: Date;
  signedAt?: Date;
}

export interface AnalysisJobFactoryOptions {
  id?: string;
  caseId?: string;
  status?: 'PENDING' | 'PROCESSING' | 'COMPLETED' | 'FAILED';
  progress?: number;
}

/**
 * Create a mock DraftAward
 */
export function createDraftAward(options: DraftAwardFactoryOptions = {}) {
  const id = options.id ?? generateId();
  const caseId = options.caseId ?? generateId();
  const createdAt = options.createdAt ?? new Date();

  const findings = [
    {
      id: generateId(),
      number: 1,
      finding: 'The parties entered into a valid contract on January 1, 2026.',
      supportingEvidence: ['contract.pdf'],
      credibilityAssessment: 'High credibility based on documentary evidence.',
    },
    {
      id: generateId(),
      number: 2,
      finding: 'Claimant performed all obligations under the contract.',
      supportingEvidence: ['invoice-001.pdf', 'delivery-confirmation.pdf'],
      credibilityAssessment: 'Supported by contemporaneous documentation.',
    },
    {
      id: generateId(),
      number: 3,
      finding: 'Respondent failed to make payment as required by the contract.',
      supportingEvidence: ['payment-records.pdf'],
      credibilityAssessment: 'Undisputed by Respondent.',
    },
  ];

  const conclusions = [
    {
      id: generateId(),
      number: 1,
      conclusion: 'A valid and enforceable contract existed between the parties.',
      legalBasis: 'Cal. Civ. Code § 1550 (elements of a contract)',
      applicableLaw: 'California Civil Code',
    },
    {
      id: generateId(),
      number: 2,
      conclusion: "Respondent's failure to pay constitutes material breach.",
      legalBasis: 'Restatement (Second) of Contracts § 241',
      applicableLaw: 'Common Law',
    },
    {
      id: generateId(),
      number: 3,
      conclusion: 'Claimant is entitled to recover damages in the amount of $5,000.',
      legalBasis: 'Cal. Civ. Code § 3300 (contract damages)',
      applicableLaw: 'California Civil Code',
    },
  ];

  return {
    id,
    caseId,
    findingsOfFact: JSON.stringify(findings),
    conclusionsOfLaw: JSON.stringify(conclusions),
    decision: 'AWARD in favor of Claimant. Respondent shall pay Claimant the sum of $5,000.',
    awardAmount: mockDecimal(options.awardAmount ?? 5000),
    prevailingParty: options.prevailingParty ?? 'CLAIMANT',
    reasoning:
      'Based on the evidence presented and applicable law, the Arbitrator finds that Respondent breached the contract by failing to make payment as required. Claimant has proven damages in the amount of $5,000.',
    confidence: mockDecimal(options.confidence ?? 0.85),
    citationsVerified: true,
    modelUsed: 'claude-3-opus-20240229',
    tokensUsed: 15000,
    generatedAt: createdAt,
    reviewStatus: options.reviewStatus ?? null,
    reviewedAt: options.reviewStatus ? new Date() : null,
    reviewNotes: null,
    createdAt,
    updatedAt: createdAt,
  };
}

/**
 * Create a draft award pending review
 */
export function createPendingDraftAward(
  options: Omit<DraftAwardFactoryOptions, 'reviewStatus'> = {}
) {
  return createDraftAward({ ...options, reviewStatus: null });
}

/**
 * Create an approved draft award
 */
export function createApprovedDraftAward(
  options: Omit<DraftAwardFactoryOptions, 'reviewStatus'> = {}
) {
  return createDraftAward({ ...options, reviewStatus: 'APPROVE' });
}

/**
 * Create a mock Award (final, issued)
 */
export function createAward(options: AwardFactoryOptions = {}) {
  const id = options.id ?? generateId();
  const caseId = options.caseId ?? generateId();
  const signedAt = options.signedAt ?? new Date();
  const issuedAt = options.issuedAt ?? signedAt;

  return {
    id,
    caseId,
    arbitratorId: options.arbitratorId ?? generateId(),
    referenceNumber: generateReferenceNumber('AWD'),
    awardAmount: mockDecimal(options.awardAmount ?? 5000),
    prevailingParty: options.prevailingParty ?? 'CLAIMANT',
    feeAllocation: { claimantPercentage: 0, respondentPercentage: 100 },
    documentUrl: `https://storage.example.com/awards/${id}.pdf`,
    documentHash: generateId('hash'),
    signedAt,
    signatureData: {
      timestamp: signedAt.toISOString(),
      ipAddress: '192.168.1.1',
      userAgent: 'Mozilla/5.0',
    },
    signatureAlgorithm: 'RSA-SHA256',
    certificateFingerprint: generateId('cert'),
    timestampGranted: true,
    timestampTime: signedAt,
    timestampAuthority: 'RFC3161 TSA',
    timestampToken: generateId('tst'),
    issuedAt,
    claimantNotifiedAt: issuedAt,
    respondentNotifiedAt: issuedAt,
    createdAt: signedAt,
    updatedAt: signedAt,
  };
}

/**
 * Create a mock AnalysisJob
 */
export function createAnalysisJob(options: AnalysisJobFactoryOptions = {}) {
  const id = options.id ?? generateId();
  const caseId = options.caseId ?? generateId();
  const createdAt = new Date();

  const status = options.status ?? 'COMPLETED';
  const progress = options.progress ?? (status === 'COMPLETED' ? 100 : 50);

  return {
    id,
    caseId,
    status,
    progress,
    currentPhase: status === 'COMPLETED' ? 'COMPLETE' : 'LEGAL_ANALYSIS',
    phases: {
      DOCUMENT_PROCESSING: 'completed',
      FACT_EXTRACTION: 'completed',
      LEGAL_ANALYSIS: status === 'COMPLETED' ? 'completed' : 'in_progress',
      AWARD_GENERATION: status === 'COMPLETED' ? 'completed' : 'pending',
    },
    startedAt: createdAt,
    completedAt: status === 'COMPLETED' ? new Date() : null,
    failedAt: status === 'FAILED' ? new Date() : null,
    errorMessage: status === 'FAILED' ? 'Analysis failed due to insufficient evidence' : null,
    totalTokensUsed: status === 'COMPLETED' ? 25000 : 10000,
    estimatedCost: mockDecimal(status === 'COMPLETED' ? 2.5 : 1.0),
    createdAt,
    updatedAt: createdAt,
  };
}

/**
 * Create a completed analysis job
 */
export function createCompletedAnalysisJob(
  options: Omit<AnalysisJobFactoryOptions, 'status' | 'progress'> = {}
) {
  return createAnalysisJob({ ...options, status: 'COMPLETED', progress: 100 });
}

/**
 * Create an in-progress analysis job
 */
export function createInProgressAnalysisJob(
  options: Omit<AnalysisJobFactoryOptions, 'status'> = {}
) {
  return createAnalysisJob({ ...options, status: 'PROCESSING', progress: options.progress ?? 50 });
}
