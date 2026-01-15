/**
 * Award Review Workflow Service
 *
 * Manages the full award review lifecycle including:
 * - Modification tracking with revision history
 * - Edit and approve workflow
 * - Rejection with structured feedback
 * - Escalation to senior arbitrators
 */

import { randomUUID } from 'crypto';

import { NotificationType } from '@prisma/client';

import { prisma } from '@/lib/db';
import { createInAppNotification, NotificationTemplates } from '@/lib/services/notification';

import type { AwardConclusionOfLaw, FindingOfFact } from './types';
import type {
  ChangeType,
  EscalationReason,
  EscalationStatus,
  EscalationUrgency,
  PrevailingParty,
  Prisma,
} from '@prisma/client';

// ============================================================================
// TYPES
// ============================================================================

export interface AwardModification {
  findingsOfFact?: FindingOfFact[];
  conclusionsOfLaw?: AwardConclusionOfLaw[];
  decision?: string;
  awardAmount?: number;
  prevailingParty?: 'claimant' | 'respondent' | 'split';
  reasoning?: string;
}

export interface ModificationResult {
  draftAwardId: string;
  version: number;
  changedFields: string[];
  changeSummary: string;
  modifiedAt: Date;
}

export interface EscalationInput {
  reason: EscalationReason;
  reasonDetails?: string;
  urgency?: EscalationUrgency;
}

export interface EscalationResult {
  escalationId: string;
  status: EscalationStatus;
  escalatedAt: Date;
  assignedToId?: string;
  assignedToName?: string;
}

export interface RejectionFeedback {
  category: 'legal_error' | 'factual_error' | 'procedural_error' | 'calculation_error' | 'other';
  description: string;
  affectedSections: string[];
  suggestedCorrections?: string;
  severity: 'minor' | 'moderate' | 'major';
}

export interface RevisionInfo {
  version: number;
  changeType: ChangeType;
  changeSummary: string | null;
  changedFields: string[];
  modifiedById: string;
  modifiedByName: string;
  createdAt: Date;
}

// ============================================================================
// REVISION TRACKING
// ============================================================================

/**
 * Create the initial revision when a draft award is generated
 */
export async function createInitialRevision(draftAwardId: string, userId: string): Promise<void> {
  const draftAward = await prisma.draftAward.findUnique({
    where: { id: draftAwardId },
  });

  if (!draftAward) {
    throw new Error('Draft award not found');
  }

  // Check if initial revision already exists
  const existing = await prisma.draftAwardRevision.findFirst({
    where: {
      draftAwardId,
      version: 1,
    },
  });

  if (existing) {
    return; // Initial revision already created
  }

  await prisma.draftAwardRevision.create({
    data: {
      id: randomUUID(),
      draftAwardId,
      version: 1,
      findingsOfFact: draftAward.findingsOfFact as Prisma.InputJsonValue,
      conclusionsOfLaw: draftAward.conclusionsOfLaw as Prisma.InputJsonValue,
      decision: draftAward.decision,
      awardAmount: draftAward.awardAmount,
      prevailingParty: draftAward.prevailingParty,
      reasoning: draftAward.reasoning,
      changeType: 'INITIAL',
      changeSummary: 'Initial AI-generated draft award',
      changedFields: [],
      modifiedById: userId,
    },
  });
}

/**
 * Get the current version number for a draft award
 */
async function getCurrentVersion(draftAwardId: string): Promise<number> {
  const latest = await prisma.draftAwardRevision.findFirst({
    where: { draftAwardId },
    orderBy: { version: 'desc' },
    select: { version: true },
  });

  return latest?.version || 0;
}

/**
 * Get revision history for a draft award
 */
export async function getRevisionHistory(draftAwardId: string): Promise<RevisionInfo[]> {
  const revisions = await prisma.draftAwardRevision.findMany({
    where: { draftAwardId },
    orderBy: { version: 'desc' },
    include: {
      modifiedBy: {
        select: { id: true, name: true },
      },
    },
  });

  return revisions.map((r) => ({
    version: r.version,
    changeType: r.changeType,
    changeSummary: r.changeSummary,
    changedFields: r.changedFields,
    modifiedById: r.modifiedById,
    modifiedByName: r.modifiedBy.name || 'Unknown',
    createdAt: r.createdAt,
  }));
}

/**
 * Get a specific revision
 */
export async function getRevision(
  draftAwardId: string,
  version: number
): Promise<{
  findingsOfFact: FindingOfFact[];
  conclusionsOfLaw: AwardConclusionOfLaw[];
  decision: string;
  awardAmount: number | null;
  prevailingParty: PrevailingParty | null;
  reasoning: string;
} | null> {
  const revision = await prisma.draftAwardRevision.findFirst({
    where: {
      draftAwardId,
      version,
    },
  });

  if (!revision) return null;

  return {
    findingsOfFact: revision.findingsOfFact as unknown as FindingOfFact[],
    conclusionsOfLaw: revision.conclusionsOfLaw as unknown as AwardConclusionOfLaw[],
    decision: revision.decision,
    awardAmount: revision.awardAmount ? Number(revision.awardAmount) : null,
    prevailingParty: revision.prevailingParty,
    reasoning: revision.reasoning,
  };
}

// ============================================================================
// MODIFICATION WORKFLOW
// ============================================================================

/**
 * Apply modifications to a draft award
 */
export async function modifyDraftAward(
  caseId: string,
  userId: string,
  modifications: AwardModification,
  changeSummary?: string
): Promise<ModificationResult> {
  const draftAward = await prisma.draftAward.findUnique({
    where: { caseId },
  });

  if (!draftAward) {
    throw new Error('Draft award not found');
  }

  // Determine which fields are being changed
  const changedFields: string[] = [];
  const updateData: Prisma.DraftAwardUpdateInput = {};

  if (modifications.findingsOfFact) {
    changedFields.push('findingsOfFact');
    updateData.findingsOfFact = modifications.findingsOfFact as unknown as Prisma.JsonArray;
  }

  if (modifications.conclusionsOfLaw) {
    changedFields.push('conclusionsOfLaw');
    updateData.conclusionsOfLaw = modifications.conclusionsOfLaw as unknown as Prisma.JsonArray;
  }

  if (modifications.decision !== undefined) {
    changedFields.push('decision');
    updateData.decision = modifications.decision;
  }

  if (modifications.awardAmount !== undefined) {
    changedFields.push('awardAmount');
    updateData.awardAmount = modifications.awardAmount;
  }

  if (modifications.prevailingParty !== undefined) {
    changedFields.push('prevailingParty');
    updateData.prevailingParty =
      modifications.prevailingParty === 'claimant'
        ? 'CLAIMANT'
        : modifications.prevailingParty === 'respondent'
          ? 'RESPONDENT'
          : 'SPLIT';
  }

  if (modifications.reasoning !== undefined) {
    changedFields.push('reasoning');
    updateData.reasoning = modifications.reasoning;
  }

  if (changedFields.length === 0) {
    throw new Error('No modifications provided');
  }

  // Get current version
  const currentVersion = await getCurrentVersion(draftAward.id);
  const newVersion = currentVersion + 1;

  // Update the draft award and create revision in a transaction
  await prisma.$transaction(async (tx) => {
    // Update draft award
    await tx.draftAward.update({
      where: { id: draftAward.id },
      data: {
        ...updateData,
        reviewStatus: 'MODIFY',
        reviewedAt: new Date(),
      },
    });

    // Get the updated draft award for revision snapshot
    const updated = await tx.draftAward.findUnique({
      where: { id: draftAward.id },
    });

    if (!updated) {
      throw new Error('Failed to retrieve updated draft award');
    }

    // Create revision record
    await tx.draftAwardRevision.create({
      data: {
        id: randomUUID(),
        draftAwardId: draftAward.id,
        version: newVersion,
        findingsOfFact: updated.findingsOfFact as Prisma.InputJsonValue,
        conclusionsOfLaw: updated.conclusionsOfLaw as Prisma.InputJsonValue,
        decision: updated.decision,
        awardAmount: updated.awardAmount,
        prevailingParty: updated.prevailingParty,
        reasoning: updated.reasoning,
        changeType: 'ARBITRATOR_EDIT',
        changeSummary: changeSummary || `Modified: ${changedFields.join(', ')}`,
        changedFields,
        modifiedById: userId,
      },
    });
  });

  console.log('[AwardWorkflow] Modification applied:', {
    caseId,
    draftAwardId: draftAward.id,
    version: newVersion,
    changedFields,
  });

  return {
    draftAwardId: draftAward.id,
    version: newVersion,
    changedFields,
    changeSummary: changeSummary || `Modified: ${changedFields.join(', ')}`,
    modifiedAt: new Date(),
  };
}

// ============================================================================
// REJECTION WORKFLOW
// ============================================================================

/**
 * Reject a draft award with structured feedback
 */
export async function rejectDraftAward(
  caseId: string,
  userId: string,
  feedback: RejectionFeedback
): Promise<{ success: boolean; message: string }> {
  const draftAward = await prisma.draftAward.findUnique({
    where: { caseId },
  });

  if (!draftAward) {
    throw new Error('Draft award not found');
  }

  // Format rejection notes from structured feedback
  const rejectionNotes = formatRejectionNotes(feedback);

  // Update draft award status
  await prisma.draftAward.update({
    where: { id: draftAward.id },
    data: {
      reviewStatus: 'REJECT',
      reviewNotes: rejectionNotes,
      reviewedAt: new Date(),
    },
  });

  // Update case status back to analysis
  await prisma.case.update({
    where: { id: caseId },
    data: { status: 'ANALYSIS_IN_PROGRESS' },
  });

  console.log('[AwardWorkflow] Draft award rejected:', {
    caseId,
    draftAwardId: draftAward.id,
    category: feedback.category,
    severity: feedback.severity,
  });

  return {
    success: true,
    message: 'Draft award rejected. The case will be re-analyzed based on your feedback.',
  };
}

/**
 * Format rejection feedback into notes string
 */
function formatRejectionNotes(feedback: RejectionFeedback): string {
  const lines = [
    `**Rejection Category:** ${feedback.category.replace(/_/g, ' ')}`,
    `**Severity:** ${feedback.severity}`,
    '',
    '**Description:**',
    feedback.description,
    '',
    `**Affected Sections:** ${feedback.affectedSections.join(', ')}`,
  ];

  if (feedback.suggestedCorrections) {
    lines.push('', '**Suggested Corrections:**', feedback.suggestedCorrections);
  }

  return lines.join('\n');
}

// ============================================================================
// ESCALATION WORKFLOW
// ============================================================================

/**
 * Escalate a draft award to a senior arbitrator
 */
export async function escalateDraftAward(
  caseId: string,
  userId: string,
  input: EscalationInput
): Promise<EscalationResult> {
  const draftAward = await prisma.draftAward.findUnique({
    where: { caseId },
  });

  if (!draftAward) {
    throw new Error('Draft award not found');
  }

  // Check if already escalated
  const existing = await prisma.awardEscalation.findUnique({
    where: { draftAwardId: draftAward.id },
  });

  if (existing && existing.status !== 'RESOLVED' && existing.status !== 'RETURNED') {
    throw new Error('This award is already escalated and pending review');
  }

  // Find an available senior arbitrator
  const seniorArbitrator = await findAvailableSeniorArbitrator(caseId);

  // Create or update escalation
  const escalation = await prisma.awardEscalation.upsert({
    where: { draftAwardId: draftAward.id },
    create: {
      id: randomUUID(),
      draftAwardId: draftAward.id,
      reason: input.reason,
      reasonDetails: input.reasonDetails,
      urgency: input.urgency || 'NORMAL',
      escalatedById: userId,
      escalatedAt: new Date(),
      assignedToId: seniorArbitrator?.id,
      assignedAt: seniorArbitrator ? new Date() : undefined,
      status: seniorArbitrator ? 'ASSIGNED' : 'PENDING',
    },
    update: {
      reason: input.reason,
      reasonDetails: input.reasonDetails,
      urgency: input.urgency || 'NORMAL',
      escalatedById: userId,
      escalatedAt: new Date(),
      assignedToId: seniorArbitrator?.id,
      assignedAt: seniorArbitrator ? new Date() : undefined,
      status: seniorArbitrator ? 'ASSIGNED' : 'PENDING',
      resolvedAt: null,
      resolution: null,
    },
  });

  // Update draft award status
  await prisma.draftAward.update({
    where: { id: draftAward.id },
    data: {
      reviewStatus: 'ESCALATE',
      reviewedAt: new Date(),
    },
  });

  // Notify senior arbitrator if assigned
  if (seniorArbitrator) {
    const caseData = await prisma.case.findUnique({
      where: { id: caseId },
      select: { referenceNumber: true },
    });

    await createInAppNotification({
      userId: seniorArbitrator.id,
      type: NotificationType.IN_APP,
      templateId: NotificationTemplates.DRAFT_AWARD_READY, // Using existing template
      subject: 'Case Escalated for Review',
      body: `Case ${caseData?.referenceNumber || caseId} has been escalated and requires your review. Reason: ${input.reason.replace(/_/g, ' ')}`,
      metadata: {
        caseId,
        escalationId: escalation.id,
        urgency: input.urgency || 'NORMAL',
        actionUrl: `/arbitrator/cases/${caseId}/award`,
      },
    });
  }

  console.log('[AwardWorkflow] Award escalated:', {
    caseId,
    escalationId: escalation.id,
    reason: input.reason,
    assignedTo: seniorArbitrator?.id,
  });

  return {
    escalationId: escalation.id,
    status: escalation.status,
    escalatedAt: escalation.escalatedAt,
    assignedToId: seniorArbitrator?.id,
    assignedToName: seniorArbitrator?.name || undefined,
  };
}

/**
 * Find an available senior arbitrator for escalation
 */
async function findAvailableSeniorArbitrator(
  excludeCaseId: string
): Promise<{ id: string; name: string | null } | null> {
  // Find arbitrators with high experience who are active
  const seniorArbitrators = await prisma.user.findMany({
    where: {
      role: 'ARBITRATOR',
      arbitratorProfile: {
        isActive: true,
        yearsExperience: { gte: 10 },
      },
      // Exclude if already assigned to this case
      NOT: {
        assignedCases: {
          some: {
            caseId: excludeCaseId,
          },
        },
      },
    },
    include: {
      arbitratorProfile: {
        select: {
          casesCompleted: true,
          maxCasesPerWeek: true,
        },
      },
      assignedCases: {
        where: {
          reviewCompletedAt: null,
        },
      },
    },
    orderBy: {
      arbitratorProfile: {
        casesCompleted: 'desc',
      },
    },
    take: 1,
  });

  const firstArbitrator = seniorArbitrators[0];
  if (!firstArbitrator) {
    return null;
  }

  return {
    id: firstArbitrator.id,
    name: firstArbitrator.name,
  };
}

/**
 * Resolve an escalation
 */
export async function resolveEscalation(
  escalationId: string,
  userId: string,
  resolution: string
): Promise<void> {
  const escalation = await prisma.awardEscalation.findUnique({
    where: { id: escalationId },
  });

  if (!escalation) {
    throw new Error('Escalation not found');
  }

  if (escalation.assignedToId !== userId) {
    throw new Error('Only the assigned arbitrator can resolve this escalation');
  }

  await prisma.awardEscalation.update({
    where: { id: escalationId },
    data: {
      status: 'RESOLVED',
      resolvedAt: new Date(),
      resolution,
    },
  });

  // Notify the original escalator
  const caseData = await prisma.draftAward.findUnique({
    where: { id: escalation.draftAwardId },
    select: {
      case: {
        select: { id: true, referenceNumber: true },
      },
    },
  });

  if (caseData) {
    await createInAppNotification({
      userId: escalation.escalatedById,
      type: NotificationType.IN_APP,
      templateId: NotificationTemplates.DRAFT_AWARD_READY, // Using existing template
      subject: 'Escalation Resolved',
      body: `The escalation for case ${caseData.case.referenceNumber} has been resolved.`,
      metadata: {
        caseId: caseData.case.id,
        escalationId,
        actionUrl: `/arbitrator/cases/${caseData.case.id}/award`,
      },
    });
  }

  console.log('[AwardWorkflow] Escalation resolved:', {
    escalationId,
    resolvedBy: userId,
  });
}

/**
 * Get escalation details
 */
export async function getEscalation(draftAwardId: string): Promise<{
  id: string;
  reason: EscalationReason;
  reasonDetails: string | null;
  urgency: EscalationUrgency;
  status: EscalationStatus;
  escalatedById: string;
  escalatedByName: string;
  escalatedAt: Date;
  assignedToId: string | null;
  assignedToName: string | null;
  resolvedAt: Date | null;
  resolution: string | null;
} | null> {
  const escalation = await prisma.awardEscalation.findUnique({
    where: { draftAwardId },
    include: {
      escalatedBy: {
        select: { id: true, name: true },
      },
      assignedTo: {
        select: { id: true, name: true },
      },
    },
  });

  if (!escalation) return null;

  return {
    id: escalation.id,
    reason: escalation.reason,
    reasonDetails: escalation.reasonDetails,
    urgency: escalation.urgency,
    status: escalation.status,
    escalatedById: escalation.escalatedById,
    escalatedByName: escalation.escalatedBy.name || 'Unknown',
    escalatedAt: escalation.escalatedAt,
    assignedToId: escalation.assignedToId,
    assignedToName: escalation.assignedTo?.name || null,
    resolvedAt: escalation.resolvedAt,
    resolution: escalation.resolution,
  };
}

// ============================================================================
// APPROVE WORKFLOW
// ============================================================================

/**
 * Approve a draft award (final step before issuance)
 */
export async function approveDraftAward(
  caseId: string,
  userId: string,
  approvalNotes?: string
): Promise<{ success: boolean; message: string; nextStep: string }> {
  const draftAward = await prisma.draftAward.findUnique({
    where: { caseId },
  });

  if (!draftAward) {
    throw new Error('Draft award not found');
  }

  // Update draft award status
  await prisma.draftAward.update({
    where: { id: draftAward.id },
    data: {
      reviewStatus: 'APPROVE',
      reviewNotes: approvalNotes,
      reviewedAt: new Date(),
    },
  });

  // Update case status
  await prisma.case.update({
    where: { id: caseId },
    data: { status: 'DECIDED' },
  });

  // Create approval revision
  const currentVersion = await getCurrentVersion(draftAward.id);

  // Only create revision if this is a change from a previous state
  if (currentVersion > 0) {
    await prisma.draftAwardRevision.create({
      data: {
        id: randomUUID(),
        draftAwardId: draftAward.id,
        version: currentVersion + 1,
        findingsOfFact: draftAward.findingsOfFact as Prisma.InputJsonValue,
        conclusionsOfLaw: draftAward.conclusionsOfLaw as Prisma.InputJsonValue,
        decision: draftAward.decision,
        awardAmount: draftAward.awardAmount,
        prevailingParty: draftAward.prevailingParty,
        reasoning: draftAward.reasoning,
        changeType: 'ARBITRATOR_EDIT',
        changeSummary: 'Award approved by arbitrator',
        changedFields: ['reviewStatus'],
        modifiedById: userId,
      },
    });
  }

  console.log('[AwardWorkflow] Draft award approved:', {
    caseId,
    draftAwardId: draftAward.id,
    approvedBy: userId,
  });

  return {
    success: true,
    message: 'Draft award approved successfully',
    nextStep: 'Ready for final issuance',
  };
}
