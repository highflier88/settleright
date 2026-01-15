import { AuditAction, CaseStatus } from '@prisma/client';

import { prisma } from '@/lib/db';
import { createAuditLog } from '@/lib/services/audit';

// Deadline configuration (in days)
export const DEADLINE_CONFIG = {
  // How many days respondent has to accept invitation
  INVITATION_EXPIRY_DAYS: 14,

  // How many days after agreement to submit evidence
  EVIDENCE_SUBMISSION_DAYS: 14,

  // How many days after evidence deadline for rebuttal
  REBUTTAL_DAYS: 7,

  // Extension limits
  MAX_EXTENSION_DAYS: 7,
  MAX_EXTENSIONS_PER_DEADLINE: 1,

  // Reminder intervals (hours before deadline)
  REMINDER_INTERVALS: [72, 24], // 3 days, 1 day
};

// Deadline types
export type DeadlineType = 'response' | 'evidence' | 'rebuttal';

export interface DeadlineInfo {
  type: DeadlineType;
  deadline: Date;
  isPassed: boolean;
  hoursRemaining: number;
  daysRemaining: number;
  canExtend: boolean;
  extensionsUsed: number;
}

export interface CaseDeadlines {
  response?: DeadlineInfo;
  evidence?: DeadlineInfo;
  rebuttal?: DeadlineInfo;
}

// Calculate hours between two dates
function hoursBetween(date1: Date, date2: Date): number {
  return Math.floor((date2.getTime() - date1.getTime()) / (1000 * 60 * 60));
}

// Calculate days between two dates
function daysBetween(date1: Date, date2: Date): number {
  return Math.floor((date2.getTime() - date1.getTime()) / (1000 * 60 * 60 * 24));
}

// Add days to a date
export function addDays(date: Date, days: number): Date {
  const result = new Date(date);
  result.setDate(result.getDate() + days);
  return result;
}

// Add hours to a date
export function addHours(date: Date, hours: number): Date {
  const result = new Date(date);
  result.setHours(result.getHours() + hours);
  return result;
}

// Calculate deadlines for a case based on its current state
export async function calculateCaseDeadlines(caseId: string): Promise<CaseDeadlines> {
  const caseRecord = await prisma.case.findUnique({
    where: { id: caseId },
    select: {
      status: true,
      responseDeadline: true,
      evidenceDeadline: true,
      rebuttalDeadline: true,
      agreement: {
        select: {
          status: true,
          updatedAt: true,
        },
      },
    },
  });

  if (!caseRecord) {
    return {};
  }

  const now = new Date();
  const deadlines: CaseDeadlines = {};

  // Response deadline
  if (caseRecord.responseDeadline) {
    const deadline = new Date(caseRecord.responseDeadline);
    deadlines.response = {
      type: 'response',
      deadline,
      isPassed: now > deadline,
      hoursRemaining: Math.max(0, hoursBetween(now, deadline)),
      daysRemaining: Math.max(0, daysBetween(now, deadline)),
      canExtend: false, // Response deadline can't be extended
      extensionsUsed: 0,
    };
  }

  // Evidence deadline
  if (caseRecord.evidenceDeadline) {
    const deadline = new Date(caseRecord.evidenceDeadline);
    // Check extensions used (would need to track in a separate table)
    deadlines.evidence = {
      type: 'evidence',
      deadline,
      isPassed: now > deadline,
      hoursRemaining: Math.max(0, hoursBetween(now, deadline)),
      daysRemaining: Math.max(0, daysBetween(now, deadline)),
      canExtend: now < deadline && caseRecord.status === CaseStatus.EVIDENCE_SUBMISSION,
      extensionsUsed: 0, // Would need to track this
    };
  }

  // Rebuttal deadline
  if (caseRecord.rebuttalDeadline) {
    const deadline = new Date(caseRecord.rebuttalDeadline);
    deadlines.rebuttal = {
      type: 'rebuttal',
      deadline,
      isPassed: now > deadline,
      hoursRemaining: Math.max(0, hoursBetween(now, deadline)),
      daysRemaining: Math.max(0, daysBetween(now, deadline)),
      canExtend: now < deadline && caseRecord.status === CaseStatus.EVIDENCE_SUBMISSION,
      extensionsUsed: 0,
    };
  }

  return deadlines;
}

// Set initial deadlines when agreement is signed
export async function setInitialDeadlines(caseId: string): Promise<boolean> {
  try {
    const now = new Date();
    const evidenceDeadline = addDays(now, DEADLINE_CONFIG.EVIDENCE_SUBMISSION_DAYS);
    const rebuttalDeadline = addDays(evidenceDeadline, DEADLINE_CONFIG.REBUTTAL_DAYS);

    await prisma.case.update({
      where: { id: caseId },
      data: {
        evidenceDeadline,
        rebuttalDeadline,
        status: CaseStatus.EVIDENCE_SUBMISSION,
      },
    });

    await createAuditLog({
      action: AuditAction.CASE_STATUS_CHANGED,
      caseId,
      metadata: {
        previousStatus: CaseStatus.PENDING_AGREEMENT,
        newStatus: CaseStatus.EVIDENCE_SUBMISSION,
        evidenceDeadline: evidenceDeadline.toISOString(),
        rebuttalDeadline: rebuttalDeadline.toISOString(),
      },
    });

    return true;
  } catch (error) {
    console.error('Failed to set initial deadlines:', error);
    return false;
  }
}

// Get cases with approaching deadlines
export async function getCasesWithApproachingDeadlines(
  hoursThreshold: number
): Promise<
  Array<{
    caseId: string;
    caseReference: string;
    claimantId: string;
    respondentId: string | null;
    deadlineType: DeadlineType;
    deadline: Date;
    hoursRemaining: number;
  }>
> {
  const now = new Date();
  const thresholdDate = addHours(now, hoursThreshold);

  const cases = await prisma.case.findMany({
    where: {
      status: CaseStatus.EVIDENCE_SUBMISSION,
      deletedAt: null,
      OR: [
        {
          evidenceDeadline: {
            gte: now,
            lte: thresholdDate,
          },
        },
        {
          rebuttalDeadline: {
            gte: now,
            lte: thresholdDate,
          },
        },
      ],
    },
    select: {
      id: true,
      referenceNumber: true,
      claimantId: true,
      respondentId: true,
      evidenceDeadline: true,
      rebuttalDeadline: true,
    },
  });

  const results: Array<{
    caseId: string;
    caseReference: string;
    claimantId: string;
    respondentId: string | null;
    deadlineType: DeadlineType;
    deadline: Date;
    hoursRemaining: number;
  }> = [];

  for (const c of cases) {
    if (c.evidenceDeadline && c.evidenceDeadline >= now && c.evidenceDeadline <= thresholdDate) {
      results.push({
        caseId: c.id,
        caseReference: c.referenceNumber,
        claimantId: c.claimantId,
        respondentId: c.respondentId,
        deadlineType: 'evidence',
        deadline: c.evidenceDeadline,
        hoursRemaining: hoursBetween(now, c.evidenceDeadline),
      });
    }
    if (c.rebuttalDeadline && c.rebuttalDeadline >= now && c.rebuttalDeadline <= thresholdDate) {
      results.push({
        caseId: c.id,
        caseReference: c.referenceNumber,
        claimantId: c.claimantId,
        respondentId: c.respondentId,
        deadlineType: 'rebuttal',
        deadline: c.rebuttalDeadline,
        hoursRemaining: hoursBetween(now, c.rebuttalDeadline),
      });
    }
  }

  return results;
}

// Get cases with passed deadlines that need status updates
export async function getCasesWithPassedDeadlines(): Promise<
  Array<{
    caseId: string;
    deadlineType: DeadlineType;
    deadline: Date;
  }>
> {
  const now = new Date();

  // Find cases where rebuttal deadline has passed but case is still in evidence submission
  const cases = await prisma.case.findMany({
    where: {
      status: CaseStatus.EVIDENCE_SUBMISSION,
      deletedAt: null,
      rebuttalDeadline: {
        lt: now,
      },
    },
    select: {
      id: true,
      rebuttalDeadline: true,
    },
  });

  return cases.map((c) => ({
    caseId: c.id,
    deadlineType: 'rebuttal' as DeadlineType,
    deadline: c.rebuttalDeadline!,
  }));
}

// Transition case to analysis pending after deadlines pass
export async function transitionToAnalysis(caseId: string): Promise<boolean> {
  try {
    await prisma.case.update({
      where: { id: caseId },
      data: {
        status: CaseStatus.ANALYSIS_PENDING,
      },
    });

    await createAuditLog({
      action: AuditAction.CASE_STATUS_CHANGED,
      caseId,
      metadata: {
        previousStatus: CaseStatus.EVIDENCE_SUBMISSION,
        newStatus: CaseStatus.ANALYSIS_PENDING,
        reason: 'Deadlines passed',
      },
    });

    return true;
  } catch (error) {
    console.error('Failed to transition to analysis:', error);
    return false;
  }
}

// Extension request handling
export interface ExtensionRequest {
  caseId: string;
  userId: string;
  deadlineType: DeadlineType;
  requestedDays: number;
  reason: string;
}

export interface ExtensionResult {
  success: boolean;
  newDeadline?: Date;
  error?: string;
}

export async function requestExtension(request: ExtensionRequest): Promise<ExtensionResult> {
  try {
    const { caseId, userId, deadlineType, requestedDays, reason } = request;

    // Validate requested days
    if (requestedDays < 1 || requestedDays > DEADLINE_CONFIG.MAX_EXTENSION_DAYS) {
      return {
        success: false,
        error: `Extension must be between 1 and ${DEADLINE_CONFIG.MAX_EXTENSION_DAYS} days`,
      };
    }

    // Get case and verify user is a party
    const caseRecord = await prisma.case.findUnique({
      where: { id: caseId },
      select: {
        id: true,
        status: true,
        claimantId: true,
        respondentId: true,
        evidenceDeadline: true,
        rebuttalDeadline: true,
      },
    });

    if (!caseRecord) {
      return { success: false, error: 'Case not found' };
    }

    if (caseRecord.claimantId !== userId && caseRecord.respondentId !== userId) {
      return { success: false, error: 'You are not a party to this case' };
    }

    if (caseRecord.status !== CaseStatus.EVIDENCE_SUBMISSION) {
      return { success: false, error: 'Extensions are not available for this case status' };
    }

    // Determine which deadline to extend
    let currentDeadline: Date | null = null;
    let deadlineField: 'evidenceDeadline' | 'rebuttalDeadline';

    if (deadlineType === 'evidence') {
      currentDeadline = caseRecord.evidenceDeadline;
      deadlineField = 'evidenceDeadline';
    } else if (deadlineType === 'rebuttal') {
      currentDeadline = caseRecord.rebuttalDeadline;
      deadlineField = 'rebuttalDeadline';
    } else {
      return { success: false, error: 'Invalid deadline type' };
    }

    if (!currentDeadline) {
      return { success: false, error: 'Deadline not set' };
    }

    const now = new Date();
    if (now > currentDeadline) {
      return { success: false, error: 'This deadline has already passed' };
    }

    // Calculate new deadline
    const newDeadline = addDays(currentDeadline, requestedDays);

    // If extending evidence deadline, also extend rebuttal deadline
    const updates: Record<string, Date> = {
      [deadlineField]: newDeadline,
    };

    if (deadlineType === 'evidence' && caseRecord.rebuttalDeadline) {
      updates.rebuttalDeadline = addDays(caseRecord.rebuttalDeadline, requestedDays);
    }

    // Update deadlines
    await prisma.case.update({
      where: { id: caseId },
      data: updates,
    });

    // Log the extension
    await createAuditLog({
      action: AuditAction.CASE_UPDATED,
      userId,
      caseId,
      metadata: {
        action: 'extension_granted',
        deadlineType,
        previousDeadline: currentDeadline.toISOString(),
        newDeadline: newDeadline.toISOString(),
        extensionDays: requestedDays,
        reason,
      },
    });

    return { success: true, newDeadline };
  } catch (error) {
    console.error('Failed to process extension request:', error);
    return {
      success: false,
      error: error instanceof Error ? error.message : 'Failed to process extension',
    };
  }
}

// Format deadline for display
export function formatDeadline(deadline: Date): string {
  return deadline.toLocaleDateString('en-US', {
    weekday: 'long',
    year: 'numeric',
    month: 'long',
    day: 'numeric',
    hour: 'numeric',
    minute: '2-digit',
    timeZoneName: 'short',
  });
}

// Get deadline status text
export function getDeadlineStatus(deadlineInfo: DeadlineInfo): string {
  if (deadlineInfo.isPassed) {
    return 'Passed';
  }
  if (deadlineInfo.hoursRemaining <= 24) {
    return `${deadlineInfo.hoursRemaining} hours remaining`;
  }
  if (deadlineInfo.daysRemaining <= 7) {
    return `${deadlineInfo.daysRemaining} days remaining`;
  }
  return `Due ${formatDeadline(deadlineInfo.deadline)}`;
}

// Get deadline urgency level
export function getDeadlineUrgency(
  deadlineInfo: DeadlineInfo
): 'critical' | 'warning' | 'normal' | 'passed' {
  if (deadlineInfo.isPassed) return 'passed';
  if (deadlineInfo.hoursRemaining <= 24) return 'critical';
  if (deadlineInfo.daysRemaining <= 3) return 'warning';
  return 'normal';
}
