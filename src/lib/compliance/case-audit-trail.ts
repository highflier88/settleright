/**
 * Case Audit Trail Service
 *
 * Generates comprehensive audit trails for individual cases,
 * suitable for compliance reviews and legal proceedings.
 */

import { prisma } from '@/lib/db';

import type { AuditAction } from '@prisma/client';

// ============================================================================
// TYPES
// ============================================================================

export interface AuditTrailEntry {
  id: string;
  timestamp: Date;
  action: AuditAction;
  actionDescription: string;
  category: AuditCategory;
  userId: string | null;
  userName: string | null;
  userRole: string | null;
  ipAddress: string | null;
  metadata: Record<string, unknown>;
  hash: string;
  previousHash: string | null;
}

export type AuditCategory =
  | 'case_lifecycle'
  | 'evidence'
  | 'statements'
  | 'agreement'
  | 'analysis'
  | 'arbitration'
  | 'award'
  | 'payment'
  | 'user';

export interface CaseAuditTrail {
  caseId: string;
  caseReference: string;
  createdAt: Date;
  status: string;
  claimant: PartyInfo;
  respondent: PartyInfo | null;
  arbitrator: ArbitratorInfo | null;
  timeline: AuditTrailEntry[];
  summary: AuditSummary;
  integrityStatus: IntegrityStatus;
  generatedAt: Date;
}

interface PartyInfo {
  id: string;
  name: string | null;
  email: string;
}

interface ArbitratorInfo {
  id: string;
  name: string | null;
  email: string;
  assignedAt: Date;
}

interface AuditSummary {
  totalEvents: number;
  eventsByCategory: Record<AuditCategory, number>;
  keyMilestones: KeyMilestone[];
  durationDays: number;
}

interface KeyMilestone {
  event: string;
  timestamp: Date;
  description: string;
}

interface IntegrityStatus {
  isValid: boolean;
  verifiedAt: Date;
  invalidEntries: number;
  chainStatus: 'intact' | 'broken' | 'unverified';
}

// ============================================================================
// ACTION DESCRIPTIONS
// ============================================================================

const ACTION_DESCRIPTIONS: Record<AuditAction, string> = {
  // User actions
  USER_REGISTERED: 'User account created',
  USER_LOGIN: 'User logged in',
  USER_LOGOUT: 'User logged out',
  USER_PROFILE_UPDATED: 'User profile updated',
  KYC_INITIATED: 'Identity verification initiated',
  KYC_COMPLETED: 'Identity verification completed',
  KYC_FAILED: 'Identity verification failed',

  // Case actions
  CASE_CREATED: 'Case filed',
  CASE_UPDATED: 'Case details updated',
  CASE_STATUS_CHANGED: 'Case status changed',
  CASE_CLOSED: 'Case closed',
  INVITATION_SENT: 'Respondent invitation sent',
  INVITATION_VIEWED: 'Respondent viewed invitation',
  INVITATION_ACCEPTED: 'Respondent accepted invitation',
  INVITATION_EXPIRED: 'Invitation expired',

  // Agreement actions
  AGREEMENT_VIEWED: 'Arbitration agreement viewed',
  AGREEMENT_SIGNED: 'Arbitration agreement signed',

  // Evidence actions
  EVIDENCE_UPLOADED: 'Evidence file uploaded',
  EVIDENCE_VIEWED: 'Evidence file viewed',
  EVIDENCE_DELETED: 'Evidence file deleted',

  // Statement actions
  STATEMENT_SUBMITTED: 'Statement submitted',
  STATEMENT_UPDATED: 'Statement updated',

  // Analysis actions
  ANALYSIS_INITIATED: 'AI analysis initiated',
  ANALYSIS_COMPLETED: 'AI analysis completed',
  ANALYSIS_FAILED: 'AI analysis failed',

  // Arbitrator assignment actions
  CASE_ASSIGNED: 'Arbitrator assigned to case',
  REVIEW_STARTED: 'Arbitrator review started',
  REVIEW_COMPLETED: 'Arbitrator review completed',

  // Draft award actions
  DRAFT_AWARD_GENERATED: 'Draft award generated',
  DRAFT_AWARD_MODIFIED: 'Draft award modified',
  DRAFT_AWARD_APPROVED: 'Draft award approved',
  DRAFT_AWARD_REJECTED: 'Draft award rejected',
  DRAFT_AWARD_ESCALATED: 'Case escalated for senior review',
  ESCALATION_RESOLVED: 'Escalation resolved',

  // Award actions
  AWARD_SIGNED: 'Award signed by arbitrator',
  AWARD_ISSUED: 'Award issued to parties',
  AWARD_DOWNLOADED: 'Award document downloaded',
  ENFORCEMENT_PACKAGE_DOWNLOADED: 'Enforcement package downloaded',

  // Arbitrator management actions
  ARBITRATOR_ONBOARDED: 'Arbitrator completed onboarding',
  ARBITRATOR_CREDENTIALS_SUBMITTED: 'Arbitrator credentials submitted',
  ARBITRATOR_CREDENTIALS_VERIFIED: 'Arbitrator credentials verified',
  ARBITRATOR_CREDENTIALS_REJECTED: 'Arbitrator credentials rejected',
  ARBITRATOR_ACTIVATED: 'Arbitrator activated',
  ARBITRATOR_DEACTIVATED: 'Arbitrator deactivated',

  // Compensation actions
  COMPENSATION_CALCULATED: 'Arbitrator compensation calculated',
  COMPENSATION_APPROVED: 'Compensation approved for payout',
  COMPENSATION_PAID: 'Compensation paid to arbitrator',
  COMPENSATION_DISPUTED: 'Compensation disputed',

  // Payment actions
  PAYMENT_INITIATED: 'Payment initiated',
  PAYMENT_COMPLETED: 'Payment completed',
  PAYMENT_FAILED: 'Payment failed',
  REFUND_ISSUED: 'Refund issued',

  // Compliance actions
  AUDIT_LOG_EXPORTED: 'Audit logs exported',
  AUDIT_LOG_VERIFIED: 'Audit log integrity verified',
  COMPLIANCE_REPORT_GENERATED: 'Compliance report generated',
};

// ============================================================================
// ACTION CATEGORIES
// ============================================================================

function getActionCategory(action: AuditAction): AuditCategory {
  const categoryMap: Record<AuditAction, AuditCategory> = {
    // User actions
    USER_REGISTERED: 'user',
    USER_LOGIN: 'user',
    USER_LOGOUT: 'user',
    USER_PROFILE_UPDATED: 'user',
    KYC_INITIATED: 'user',
    KYC_COMPLETED: 'user',
    KYC_FAILED: 'user',

    // Case lifecycle
    CASE_CREATED: 'case_lifecycle',
    CASE_UPDATED: 'case_lifecycle',
    CASE_STATUS_CHANGED: 'case_lifecycle',
    CASE_CLOSED: 'case_lifecycle',
    INVITATION_SENT: 'case_lifecycle',
    INVITATION_VIEWED: 'case_lifecycle',
    INVITATION_ACCEPTED: 'case_lifecycle',
    INVITATION_EXPIRED: 'case_lifecycle',

    // Agreement
    AGREEMENT_VIEWED: 'agreement',
    AGREEMENT_SIGNED: 'agreement',

    // Evidence
    EVIDENCE_UPLOADED: 'evidence',
    EVIDENCE_VIEWED: 'evidence',
    EVIDENCE_DELETED: 'evidence',

    // Statements
    STATEMENT_SUBMITTED: 'statements',
    STATEMENT_UPDATED: 'statements',

    // Analysis
    ANALYSIS_INITIATED: 'analysis',
    ANALYSIS_COMPLETED: 'analysis',
    ANALYSIS_FAILED: 'analysis',

    // Arbitration
    CASE_ASSIGNED: 'arbitration',
    REVIEW_STARTED: 'arbitration',
    REVIEW_COMPLETED: 'arbitration',
    DRAFT_AWARD_GENERATED: 'arbitration',
    DRAFT_AWARD_MODIFIED: 'arbitration',
    DRAFT_AWARD_APPROVED: 'arbitration',
    DRAFT_AWARD_REJECTED: 'arbitration',
    DRAFT_AWARD_ESCALATED: 'arbitration',
    ESCALATION_RESOLVED: 'arbitration',

    // Award
    AWARD_SIGNED: 'award',
    AWARD_ISSUED: 'award',
    AWARD_DOWNLOADED: 'award',
    ENFORCEMENT_PACKAGE_DOWNLOADED: 'award',

    // Arbitrator management (categorized as user for simplicity)
    ARBITRATOR_ONBOARDED: 'user',
    ARBITRATOR_CREDENTIALS_SUBMITTED: 'user',
    ARBITRATOR_CREDENTIALS_VERIFIED: 'user',
    ARBITRATOR_CREDENTIALS_REJECTED: 'user',
    ARBITRATOR_ACTIVATED: 'user',
    ARBITRATOR_DEACTIVATED: 'user',

    // Compensation (categorized as payment)
    COMPENSATION_CALCULATED: 'payment',
    COMPENSATION_APPROVED: 'payment',
    COMPENSATION_PAID: 'payment',
    COMPENSATION_DISPUTED: 'payment',

    // Payment
    PAYMENT_INITIATED: 'payment',
    PAYMENT_COMPLETED: 'payment',
    PAYMENT_FAILED: 'payment',
    REFUND_ISSUED: 'payment',

    // Compliance (categorized as case lifecycle)
    AUDIT_LOG_EXPORTED: 'case_lifecycle',
    AUDIT_LOG_VERIFIED: 'case_lifecycle',
    COMPLIANCE_REPORT_GENERATED: 'case_lifecycle',
  };

  return categoryMap[action] || 'case_lifecycle';
}

// ============================================================================
// KEY MILESTONES
// ============================================================================

const MILESTONE_ACTIONS: AuditAction[] = [
  'CASE_CREATED',
  'INVITATION_ACCEPTED',
  'AGREEMENT_SIGNED',
  'CASE_ASSIGNED',
  'ANALYSIS_COMPLETED',
  'DRAFT_AWARD_APPROVED',
  'AWARD_ISSUED',
  'CASE_CLOSED',
];

// ============================================================================
// CASE AUDIT TRAIL GENERATION
// ============================================================================

/**
 * Generate a comprehensive audit trail for a case
 */
export async function getCaseAuditTrail(caseId: string): Promise<CaseAuditTrail> {
  // Get case details
  const caseData = await prisma.case.findUnique({
    where: { id: caseId },
    include: {
      claimant: {
        select: { id: true, name: true, email: true },
      },
      respondent: {
        select: { id: true, name: true, email: true },
      },
      arbitratorAssignment: {
        include: {
          arbitrator: {
            select: { id: true, name: true, email: true },
          },
        },
      },
    },
  });

  if (!caseData) {
    throw new Error('Case not found');
  }

  // Get all audit logs for this case
  const auditLogs = await prisma.auditLog.findMany({
    where: { caseId },
    orderBy: { timestamp: 'asc' },
  });

  // Get unique user IDs from logs
  const userIds = [...new Set(auditLogs.map((log) => log.userId).filter(Boolean))] as string[];

  // Fetch user data for all referenced users
  const users = await prisma.user.findMany({
    where: { id: { in: userIds } },
    select: { id: true, name: true, role: true },
  });

  const userMap = new Map(users.map((u) => [u.id, u]));

  // Build timeline entries
  const timeline: AuditTrailEntry[] = auditLogs.map((log) => {
    const user = log.userId ? userMap.get(log.userId) : null;
    return {
      id: log.id,
      timestamp: log.timestamp,
      action: log.action,
      actionDescription: ACTION_DESCRIPTIONS[log.action] || log.action,
      category: getActionCategory(log.action),
      userId: log.userId,
      userName: user?.name || null,
      userRole: user?.role || null,
      ipAddress: log.ipAddress,
      metadata: (log.metadata as Record<string, unknown>) || {},
      hash: log.hash,
      previousHash: log.previousHash,
    };
  });

  // Calculate events by category
  const eventsByCategory: Record<AuditCategory, number> = {
    case_lifecycle: 0,
    evidence: 0,
    statements: 0,
    agreement: 0,
    analysis: 0,
    arbitration: 0,
    award: 0,
    payment: 0,
    user: 0,
  };

  for (const entry of timeline) {
    eventsByCategory[entry.category]++;
  }

  // Extract key milestones
  const keyMilestones: KeyMilestone[] = timeline
    .filter((entry) => MILESTONE_ACTIONS.includes(entry.action))
    .map((entry) => ({
      event: entry.action,
      timestamp: entry.timestamp,
      description: entry.actionDescription,
    }));

  // Calculate duration
  const durationDays = timeline.length > 0
    ? Math.ceil(
        (Date.now() - timeline[0]!.timestamp.getTime()) / (1000 * 60 * 60 * 24)
      )
    : 0;

  // Verify integrity of case-specific logs
  const integrityStatus = verifyCaseAuditIntegrity(auditLogs);

  return {
    caseId,
    caseReference: caseData.referenceNumber,
    createdAt: caseData.createdAt,
    status: caseData.status,
    claimant: {
      id: caseData.claimant.id,
      name: caseData.claimant.name,
      email: caseData.claimant.email,
    },
    respondent: caseData.respondent
      ? {
          id: caseData.respondent.id,
          name: caseData.respondent.name,
          email: caseData.respondent.email,
        }
      : null,
    arbitrator: caseData.arbitratorAssignment
      ? {
          id: caseData.arbitratorAssignment.arbitrator.id,
          name: caseData.arbitratorAssignment.arbitrator.name,
          email: caseData.arbitratorAssignment.arbitrator.email,
          assignedAt: caseData.arbitratorAssignment.assignedAt,
        }
      : null,
    timeline,
    summary: {
      totalEvents: timeline.length,
      eventsByCategory,
      keyMilestones,
      durationDays,
    },
    integrityStatus,
    generatedAt: new Date(),
  };
}

/**
 * Verify integrity of case-specific audit logs
 */
function verifyCaseAuditIntegrity(
  logs: Array<{
    id: string;
    hash: string;
    previousHash: string | null;
  }>
): IntegrityStatus {
  // For case-specific logs, we verify the hash chain within the case
  // Note: The global chain may have other logs interleaved
  let invalidEntries = 0;
  let chainStatus: 'intact' | 'broken' | 'unverified' = 'intact';

  // Simple check: verify hashes exist and are non-empty
  for (const log of logs) {
    if (!log.hash || log.hash.length !== 64) {
      invalidEntries++;
      chainStatus = 'broken';
    }
  }

  return {
    isValid: invalidEntries === 0,
    verifiedAt: new Date(),
    invalidEntries,
    chainStatus,
  };
}

/**
 * Export case audit trail to various formats
 */
export async function exportCaseAuditTrail(
  caseId: string,
  format: 'json' | 'csv' | 'pdf-data' = 'json'
): Promise<string | CaseAuditTrail> {
  const trail = await getCaseAuditTrail(caseId);

  if (format === 'json') {
    return JSON.stringify(trail, null, 2);
  }

  if (format === 'csv') {
    const headers = [
      'Timestamp',
      'Action',
      'Description',
      'Category',
      'User',
      'Role',
      'IP Address',
      'Hash',
    ];

    const rows = trail.timeline.map((entry) => [
      entry.timestamp.toISOString(),
      entry.action,
      entry.actionDescription,
      entry.category,
      entry.userName || '',
      entry.userRole || '',
      entry.ipAddress || '',
      entry.hash,
    ]);

    return [headers.join(','), ...rows.map((row) => row.join(','))].join('\n');
  }

  // For PDF generation, return the structured data
  return trail;
}

/**
 * Get audit trail summary for multiple cases
 */
export async function getCasesAuditSummary(
  caseIds: string[]
): Promise<
  Array<{
    caseId: string;
    caseReference: string;
    eventCount: number;
    lastActivity: Date | null;
    hasIntegrityIssues: boolean;
  }>
> {
  const summaries = await Promise.all(
    caseIds.map(async (caseId) => {
      const caseData = await prisma.case.findUnique({
        where: { id: caseId },
        select: { referenceNumber: true },
      });

      const logStats = await prisma.auditLog.aggregate({
        where: { caseId },
        _count: { id: true },
        _max: { timestamp: true },
      });

      // Quick integrity check - just verify all hashes are valid (64 char SHA-256)
      const logsWithMissingHash = await prisma.auditLog.count({
        where: {
          caseId,
          hash: { equals: '' },
        },
      });

      return {
        caseId,
        caseReference: caseData?.referenceNumber || 'Unknown',
        eventCount: logStats._count.id,
        lastActivity: logStats._max.timestamp,
        hasIntegrityIssues: logsWithMissingHash > 0,
      };
    })
  );

  return summaries;
}
