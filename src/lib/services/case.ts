import { randomBytes } from 'crypto';

import { prisma } from '@/lib/db';
import { createAuditLog } from '@/lib/services/audit';
import { CaseStatus, DisputeType, AuditAction, InvitationStatus } from '@prisma/client';

import type { Case } from '@prisma/client';

// Generate a unique case reference number
// Format: SR-YYYY-XXXXXX (e.g., SR-2024-A3B9F2)
export function generateCaseReference(): string {
  const year = new Date().getFullYear();
  const randomPart = randomBytes(3).toString('hex').toUpperCase();
  return `SR-${year}-${randomPart}`;
}

// Generate a secure invitation token
export function generateInvitationToken(): string {
  return randomBytes(32).toString('hex');
}

export interface CreateCaseInput {
  claimantId: string;
  disputeType: DisputeType;
  jurisdiction: string;
  description: string;
  amount: number;
  respondent: {
    email: string;
    name?: string;
    phone?: string;
  };
}

export interface CreateCaseResult {
  success: boolean;
  case?: Case;
  invitationToken?: string;
  error?: string;
}

// Create a new case with invitation for respondent
export async function createCase(input: CreateCaseInput): Promise<CreateCaseResult> {
  try {
    // Generate unique reference number (retry if collision)
    let referenceNumber: string;
    let attempts = 0;
    const maxAttempts = 5;

    do {
      referenceNumber = generateCaseReference();
      const existing = await prisma.case.findUnique({
        where: { referenceNumber },
      });
      if (!existing) break;
      attempts++;
    } while (attempts < maxAttempts);

    if (attempts >= maxAttempts) {
      return { success: false, error: 'Failed to generate unique reference number' };
    }

    // Generate invitation token
    const invitationToken = generateInvitationToken();

    // Calculate expiration (14 days from now)
    const expiresAt = new Date();
    expiresAt.setDate(expiresAt.getDate() + 14);

    // Create case with invitation in a transaction
    const newCase = await prisma.$transaction(async (tx) => {
      // Create the case
      const caseRecord = await tx.case.create({
        data: {
          referenceNumber,
          status: CaseStatus.PENDING_RESPONDENT,
          disputeType: input.disputeType,
          jurisdiction: input.jurisdiction,
          description: input.description,
          amount: input.amount,
          claimantId: input.claimantId,
          // Set initial deadlines
          responseDeadline: new Date(Date.now() + 14 * 24 * 60 * 60 * 1000), // 14 days
        },
      });

      // Create the invitation
      await tx.invitation.create({
        data: {
          caseId: caseRecord.id,
          token: invitationToken,
          email: input.respondent.email,
          name: input.respondent.name,
          phone: input.respondent.phone,
          status: InvitationStatus.PENDING,
          expiresAt,
        },
      });

      return caseRecord;
    });

    // Log audit event
    await createAuditLog({
      action: AuditAction.CASE_CREATED,
      userId: input.claimantId,
      caseId: newCase.id,
      metadata: {
        referenceNumber,
        disputeType: input.disputeType,
        jurisdiction: input.jurisdiction,
        amount: input.amount,
        respondentEmail: input.respondent.email,
      },
    });

    return {
      success: true,
      case: newCase,
      invitationToken,
    };
  } catch (error) {
    console.error('Failed to create case:', error);
    return {
      success: false,
      error: error instanceof Error ? error.message : 'Failed to create case',
    };
  }
}

// Get a case by ID (excludes soft-deleted cases by default)
export async function getCaseById(
  caseId: string,
  includeDeleted = false
): Promise<Case | null> {
  return prisma.case.findFirst({
    where: {
      id: caseId,
      ...(includeDeleted ? {} : { deletedAt: null }),
    },
  });
}

// Get case with full details
export async function getCaseWithDetails(caseId: string) {
  return prisma.case.findFirst({
    where: {
      id: caseId,
      deletedAt: null,
    },
    include: {
      claimant: {
        select: {
          id: true,
          name: true,
          email: true,
        },
      },
      respondent: {
        select: {
          id: true,
          name: true,
          email: true,
        },
      },
      invitation: true,
      agreement: {
        include: {
          signatures: true,
        },
      },
      evidence: {
        where: { deletedAt: null },
        orderBy: { submittedAt: 'desc' },
      },
      statements: {
        orderBy: { submittedAt: 'desc' },
      },
    },
  });
}

// Get cases for a user (as claimant or respondent)
export interface GetUserCasesOptions {
  page?: number;
  limit?: number;
  status?: CaseStatus;
  role?: 'claimant' | 'respondent' | 'all';
}

export async function getUserCases(
  userId: string,
  options: GetUserCasesOptions = {}
) {
  const { page = 1, limit = 20, status, role = 'all' } = options;
  const skip = (page - 1) * limit;

  const whereClause: Record<string, unknown> = {
    deletedAt: null,
  };

  // Filter by role
  if (role === 'claimant') {
    whereClause.claimantId = userId;
  } else if (role === 'respondent') {
    whereClause.respondentId = userId;
  } else {
    whereClause.OR = [{ claimantId: userId }, { respondentId: userId }];
  }

  // Filter by status
  if (status) {
    whereClause.status = status;
  }

  const [cases, total] = await Promise.all([
    prisma.case.findMany({
      where: whereClause,
      include: {
        claimant: {
          select: { id: true, name: true, email: true },
        },
        respondent: {
          select: { id: true, name: true, email: true },
        },
        invitation: {
          select: { status: true, email: true },
        },
      },
      orderBy: { createdAt: 'desc' },
      skip,
      take: limit,
    }),
    prisma.case.count({ where: whereClause }),
  ]);

  return {
    cases,
    total,
    page,
    limit,
    totalPages: Math.ceil(total / limit),
  };
}

// Update case status
export async function updateCaseStatus(
  caseId: string,
  newStatus: CaseStatus,
  userId: string
): Promise<Case | null> {
  const updatedCase = await prisma.case.update({
    where: { id: caseId },
    data: { status: newStatus },
  });

  await createAuditLog({
    action: AuditAction.CASE_STATUS_CHANGED,
    userId,
    caseId,
    metadata: {
      newStatus,
      previousStatus: updatedCase.status,
    },
  });

  return updatedCase;
}

// Soft delete a case
export async function softDeleteCase(
  caseId: string,
  userId: string
): Promise<boolean> {
  try {
    await prisma.case.update({
      where: { id: caseId },
      data: {
        deletedAt: new Date(),
        status: CaseStatus.CLOSED,
      },
    });

    await createAuditLog({
      action: AuditAction.CASE_STATUS_CHANGED,
      userId,
      caseId,
      metadata: {
        action: 'soft_delete',
      },
    });

    return true;
  } catch (error) {
    console.error('Failed to soft delete case:', error);
    return false;
  }
}

// Check if user has access to a case
export async function userHasAccessToCase(
  userId: string,
  caseId: string
): Promise<{ hasAccess: boolean; role?: 'claimant' | 'respondent' }> {
  const caseRecord = await prisma.case.findFirst({
    where: {
      id: caseId,
      deletedAt: null,
      OR: [{ claimantId: userId }, { respondentId: userId }],
    },
    select: {
      claimantId: true,
      respondentId: true,
    },
  });

  if (!caseRecord) {
    return { hasAccess: false };
  }

  return {
    hasAccess: true,
    role: caseRecord.claimantId === userId ? 'claimant' : 'respondent',
  };
}

// Get case statistics for a user
export async function getUserCaseStats(userId: string) {
  const [totalCases, activeCases, decidedCases, totalAmount] = await Promise.all([
    prisma.case.count({
      where: {
        OR: [{ claimantId: userId }, { respondentId: userId }],
        deletedAt: null,
      },
    }),
    prisma.case.count({
      where: {
        OR: [{ claimantId: userId }, { respondentId: userId }],
        deletedAt: null,
        status: {
          in: [
            CaseStatus.PENDING_RESPONDENT,
            CaseStatus.PENDING_AGREEMENT,
            CaseStatus.EVIDENCE_SUBMISSION,
            CaseStatus.ANALYSIS_PENDING,
            CaseStatus.ANALYSIS_IN_PROGRESS,
            CaseStatus.ARBITRATOR_REVIEW,
          ],
        },
      },
    }),
    prisma.case.count({
      where: {
        OR: [{ claimantId: userId }, { respondentId: userId }],
        deletedAt: null,
        status: CaseStatus.DECIDED,
      },
    }),
    prisma.case.aggregate({
      where: {
        claimantId: userId,
        deletedAt: null,
      },
      _sum: {
        amount: true,
      },
    }),
  ]);

  return {
    totalCases,
    activeCases,
    decidedCases,
    closedCases: totalCases - activeCases - decidedCases,
    totalAmountClaimed: totalAmount._sum.amount?.toNumber() ?? 0,
  };
}

// Get deadline information for a case
export function getCaseDeadlines(caseRecord: Case) {
  const now = new Date();

  return {
    response: caseRecord.responseDeadline
      ? {
          deadline: caseRecord.responseDeadline,
          isPast: caseRecord.responseDeadline < now,
          daysRemaining: Math.ceil(
            (caseRecord.responseDeadline.getTime() - now.getTime()) / (1000 * 60 * 60 * 24)
          ),
        }
      : null,
    evidence: caseRecord.evidenceDeadline
      ? {
          deadline: caseRecord.evidenceDeadline,
          isPast: caseRecord.evidenceDeadline < now,
          daysRemaining: Math.ceil(
            (caseRecord.evidenceDeadline.getTime() - now.getTime()) / (1000 * 60 * 60 * 24)
          ),
        }
      : null,
    rebuttal: caseRecord.rebuttalDeadline
      ? {
          deadline: caseRecord.rebuttalDeadline,
          isPast: caseRecord.rebuttalDeadline < now,
          daysRemaining: Math.ceil(
            (caseRecord.rebuttalDeadline.getTime() - now.getTime()) / (1000 * 60 * 60 * 24)
          ),
        }
      : null,
  };
}

// Status display helpers
export const CASE_STATUS_LABELS: Record<CaseStatus, string> = {
  [CaseStatus.DRAFT]: 'Draft',
  [CaseStatus.PENDING_RESPONDENT]: 'Awaiting Respondent',
  [CaseStatus.PENDING_AGREEMENT]: 'Pending Agreement',
  [CaseStatus.EVIDENCE_SUBMISSION]: 'Evidence Submission',
  [CaseStatus.ANALYSIS_PENDING]: 'Analysis Pending',
  [CaseStatus.ANALYSIS_IN_PROGRESS]: 'Analysis In Progress',
  [CaseStatus.ARBITRATOR_REVIEW]: 'Arbitrator Review',
  [CaseStatus.DECIDED]: 'Decided',
  [CaseStatus.CLOSED]: 'Closed',
};

export const DISPUTE_TYPE_LABELS: Record<DisputeType, string> = {
  [DisputeType.CONTRACT]: 'Contract Dispute',
  [DisputeType.PAYMENT]: 'Payment Dispute',
  [DisputeType.SERVICE]: 'Service Dispute',
  [DisputeType.GOODS]: 'Goods Dispute',
  [DisputeType.OTHER]: 'Other',
};

// Jurisdiction data
export const SUPPORTED_JURISDICTIONS = [
  { code: 'US-CA', name: 'California, United States', country: 'US' },
  { code: 'US-NY', name: 'New York, United States', country: 'US' },
  { code: 'US-TX', name: 'Texas, United States', country: 'US' },
  { code: 'US-FL', name: 'Florida, United States', country: 'US' },
  { code: 'US-WA', name: 'Washington, United States', country: 'US' },
  { code: 'US-IL', name: 'Illinois, United States', country: 'US' },
  { code: 'US-PA', name: 'Pennsylvania, United States', country: 'US' },
  { code: 'US-OH', name: 'Ohio, United States', country: 'US' },
  { code: 'US-GA', name: 'Georgia, United States', country: 'US' },
  { code: 'US-NC', name: 'North Carolina, United States', country: 'US' },
] as const;

// Fee calculation based on claim amount
export function calculateFilingFee(amount: number): number {
  if (amount <= 1000) return 49;
  if (amount <= 5000) return 99;
  if (amount <= 10000) return 149;
  if (amount <= 25000) return 249;
  return 349;
}
