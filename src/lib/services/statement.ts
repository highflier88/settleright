import { AuditAction, CaseStatus, StatementType } from '@prisma/client';

import { prisma } from '@/lib/db';
import { createAuditLog } from '@/lib/services/audit';

import type { Statement } from '@prisma/client';

// Claim item structure
export interface ClaimItem {
  id: string;
  description: string;
  amount: number;
  category: 'damages' | 'fees' | 'costs' | 'interest' | 'other';
  supportingEvidenceIds?: string[];
}

// Timeline entry structure
export interface TimelineEntry {
  id: string;
  date: string; // ISO date string
  title: string;
  description: string;
  evidenceIds?: string[];
}

// Statement content structure
export interface StatementContent {
  narrative: string;
  timeline?: TimelineEntry[];
  claimItems?: ClaimItem[];
}

export interface CreateStatementInput {
  caseId: string;
  userId: string;
  type: StatementType;
  content: StatementContent;
}

export interface UpdateStatementInput {
  statementId: string;
  userId: string;
  content: StatementContent;
}

export interface StatementResult {
  success: boolean;
  statement?: Statement;
  error?: string;
}

// Maximum content length
export const MAX_NARRATIVE_LENGTH = 50000; // 50k characters
export const MAX_TIMELINE_ENTRIES = 100;
export const MAX_CLAIM_ITEMS = 50;

// Get allowed statuses for statement submission
const STATEMENT_ALLOWED_STATUSES: CaseStatus[] = [
  CaseStatus.EVIDENCE_SUBMISSION,
  CaseStatus.ANALYSIS_PENDING,
];

// Validate statement content
export function validateStatementContent(content: StatementContent): string | null {
  // Validate narrative
  if (!content.narrative || content.narrative.trim().length === 0) {
    return 'Statement narrative is required';
  }

  if (content.narrative.length > MAX_NARRATIVE_LENGTH) {
    return `Statement narrative exceeds maximum length of ${MAX_NARRATIVE_LENGTH} characters`;
  }

  // Validate timeline entries
  if (content.timeline) {
    if (content.timeline.length > MAX_TIMELINE_ENTRIES) {
      return `Maximum of ${MAX_TIMELINE_ENTRIES} timeline entries allowed`;
    }

    for (const entry of content.timeline) {
      if (!entry.date || !entry.title) {
        return 'Timeline entries must have a date and title';
      }
      // Validate date format
      if (isNaN(Date.parse(entry.date))) {
        return `Invalid date in timeline entry: ${entry.date}`;
      }
    }
  }

  // Validate claim items
  if (content.claimItems) {
    if (content.claimItems.length > MAX_CLAIM_ITEMS) {
      return `Maximum of ${MAX_CLAIM_ITEMS} claim items allowed`;
    }

    for (const item of content.claimItems) {
      if (!item.description || item.amount === undefined) {
        return 'Claim items must have a description and amount';
      }
      if (typeof item.amount !== 'number' || item.amount < 0) {
        return 'Claim amounts must be non-negative numbers';
      }
    }
  }

  return null;
}

// Calculate total claimed amount
export function calculateTotalClaim(claimItems: ClaimItem[]): number {
  return claimItems.reduce((sum, item) => sum + item.amount, 0);
}

// Create a new statement
export async function createStatement(input: CreateStatementInput): Promise<StatementResult> {
  try {
    const { caseId, userId, type, content } = input;

    // Validate content
    const validationError = validateStatementContent(content);
    if (validationError) {
      return { success: false, error: validationError };
    }

    // Verify case exists and user is a party
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

    // Verify user is a party to the case
    if (caseRecord.claimantId !== userId && caseRecord.respondentId !== userId) {
      return { success: false, error: 'You are not a party to this case' };
    }

    // Check case status allows statements
    if (!STATEMENT_ALLOWED_STATUSES.includes(caseRecord.status)) {
      return { success: false, error: 'Case is not accepting statement submissions' };
    }

    // Check deadlines
    const now = new Date();
    if (type === StatementType.INITIAL && caseRecord.evidenceDeadline) {
      if (now > caseRecord.evidenceDeadline) {
        return { success: false, error: 'Initial statement deadline has passed' };
      }
    }
    if (type === StatementType.REBUTTAL && caseRecord.rebuttalDeadline) {
      if (now > caseRecord.rebuttalDeadline) {
        return { success: false, error: 'Rebuttal statement deadline has passed' };
      }
    }

    // Check for existing statement of same type by this user
    const existingStatement = await prisma.statement.findFirst({
      where: {
        caseId,
        submittedById: userId,
        type,
      },
    });

    if (existingStatement) {
      return {
        success: false,
        error: `You have already submitted a ${type.toLowerCase()} statement. Use the edit function to make changes.`,
      };
    }

    // Determine if rebuttal is allowed (initial statement must exist)
    if (type === StatementType.REBUTTAL) {
      const initialStatement = await prisma.statement.findFirst({
        where: {
          caseId,
          submittedById: userId,
          type: StatementType.INITIAL,
        },
      });

      if (!initialStatement) {
        return {
          success: false,
          error: 'You must submit an initial statement before a rebuttal',
        };
      }
    }

    // Create the statement
    const statement = await prisma.statement.create({
      data: {
        caseId,
        submittedById: userId,
        type,
        content: content.narrative,
        claimItems: content.claimItems
          ? (JSON.parse(JSON.stringify(content)) as object)
          : undefined,
        version: 1,
      },
    });

    // Log the submission
    await createAuditLog({
      action: AuditAction.STATEMENT_SUBMITTED,
      userId,
      caseId,
      metadata: {
        statementId: statement.id,
        type,
        version: 1,
        contentLength: content.narrative.length,
        claimItemsCount: content.claimItems?.length ?? 0,
        timelineEntriesCount: content.timeline?.length ?? 0,
      },
    });

    return { success: true, statement };
  } catch (error) {
    console.error('Failed to create statement:', error);
    return {
      success: false,
      error: error instanceof Error ? error.message : 'Failed to create statement',
    };
  }
}

// Update an existing statement (creates new version)
export async function updateStatement(input: UpdateStatementInput): Promise<StatementResult> {
  try {
    const { statementId, userId, content } = input;

    // Validate content
    const validationError = validateStatementContent(content);
    if (validationError) {
      return { success: false, error: validationError };
    }

    // Get existing statement
    const existingStatement = await prisma.statement.findUnique({
      where: { id: statementId },
      include: {
        case: {
          select: {
            id: true,
            status: true,
            claimantId: true,
            respondentId: true,
            evidenceDeadline: true,
            rebuttalDeadline: true,
          },
        },
      },
    });

    if (!existingStatement) {
      return { success: false, error: 'Statement not found' };
    }

    // Verify user owns the statement
    if (existingStatement.submittedById !== userId) {
      return { success: false, error: 'You can only edit your own statements' };
    }

    // Check case status allows updates
    if (!STATEMENT_ALLOWED_STATUSES.includes(existingStatement.case.status)) {
      return { success: false, error: 'Case is no longer accepting statement updates' };
    }

    // Check deadlines
    const now = new Date();
    if (
      existingStatement.type === StatementType.INITIAL &&
      existingStatement.case.evidenceDeadline
    ) {
      if (now > existingStatement.case.evidenceDeadline) {
        return { success: false, error: 'Initial statement deadline has passed' };
      }
    }
    if (
      existingStatement.type === StatementType.REBUTTAL &&
      existingStatement.case.rebuttalDeadline
    ) {
      if (now > existingStatement.case.rebuttalDeadline) {
        return { success: false, error: 'Rebuttal statement deadline has passed' };
      }
    }

    // Update with new version
    const newVersion = existingStatement.version + 1;
    const statement = await prisma.statement.update({
      where: { id: statementId },
      data: {
        content: content.narrative,
        claimItems: content.claimItems
          ? (JSON.parse(JSON.stringify(content)) as object)
          : undefined,
        version: newVersion,
        updatedAt: new Date(),
      },
    });

    // Log the update
    await createAuditLog({
      action: AuditAction.STATEMENT_UPDATED,
      userId,
      caseId: existingStatement.caseId,
      metadata: {
        statementId: statement.id,
        type: existingStatement.type,
        previousVersion: existingStatement.version,
        newVersion,
        contentLength: content.narrative.length,
        claimItemsCount: content.claimItems?.length ?? 0,
        timelineEntriesCount: content.timeline?.length ?? 0,
      },
    });

    return { success: true, statement };
  } catch (error) {
    console.error('Failed to update statement:', error);
    return {
      success: false,
      error: error instanceof Error ? error.message : 'Failed to update statement',
    };
  }
}

// Get a statement by ID
export async function getStatementById(statementId: string): Promise<Statement | null> {
  return prisma.statement.findUnique({
    where: { id: statementId },
  });
}

// Get all statements for a case
export async function getCaseStatements(caseId: string, userId: string): Promise<Statement[]> {
  // Verify user has access to the case
  const caseRecord = await prisma.case.findUnique({
    where: { id: caseId },
    select: { claimantId: true, respondentId: true },
  });

  if (!caseRecord) {
    return [];
  }

  if (caseRecord.claimantId !== userId && caseRecord.respondentId !== userId) {
    return [];
  }

  return prisma.statement.findMany({
    where: { caseId },
    orderBy: [
      { type: 'asc' }, // INITIAL before REBUTTAL
      { submittedAt: 'desc' },
    ],
  });
}

// Get user's statements for a case
export async function getUserStatements(caseId: string, userId: string): Promise<Statement[]> {
  return prisma.statement.findMany({
    where: {
      caseId,
      submittedById: userId,
    },
    orderBy: { submittedAt: 'desc' },
  });
}

// Check if user can submit a statement
export async function canSubmitStatement(
  caseId: string,
  userId: string,
  type: StatementType
): Promise<{ canSubmit: boolean; reason?: string }> {
  const caseRecord = await prisma.case.findUnique({
    where: { id: caseId },
    select: {
      status: true,
      claimantId: true,
      respondentId: true,
      evidenceDeadline: true,
      rebuttalDeadline: true,
    },
  });

  if (!caseRecord) {
    return { canSubmit: false, reason: 'Case not found' };
  }

  // Verify user is a party
  if (caseRecord.claimantId !== userId && caseRecord.respondentId !== userId) {
    return { canSubmit: false, reason: 'You are not a party to this case' };
  }

  // Check case status
  if (!STATEMENT_ALLOWED_STATUSES.includes(caseRecord.status)) {
    return { canSubmit: false, reason: 'Case is not accepting statements' };
  }

  // Check deadlines
  const now = new Date();
  if (type === StatementType.INITIAL && caseRecord.evidenceDeadline) {
    if (now > caseRecord.evidenceDeadline) {
      return { canSubmit: false, reason: 'Initial statement deadline has passed' };
    }
  }
  if (type === StatementType.REBUTTAL && caseRecord.rebuttalDeadline) {
    if (now > caseRecord.rebuttalDeadline) {
      return { canSubmit: false, reason: 'Rebuttal statement deadline has passed' };
    }
  }

  // Check for existing statement
  const existingStatement = await prisma.statement.findFirst({
    where: {
      caseId,
      submittedById: userId,
      type,
    },
  });

  if (existingStatement) {
    return { canSubmit: false, reason: 'You have already submitted this type of statement' };
  }

  // For rebuttals, check that initial exists
  if (type === StatementType.REBUTTAL) {
    const initialStatement = await prisma.statement.findFirst({
      where: {
        caseId,
        submittedById: userId,
        type: StatementType.INITIAL,
      },
    });

    if (!initialStatement) {
      return { canSubmit: false, reason: 'Submit an initial statement first' };
    }
  }

  return { canSubmit: true };
}

// Parse statement content from stored format
export function parseStatementContent(statement: Statement): StatementContent {
  try {
    if (statement.claimItems) {
      const parsed = (
        typeof statement.claimItems === 'string'
          ? JSON.parse(statement.claimItems)
          : statement.claimItems
      ) as { timeline?: TimelineEntry[]; claimItems?: ClaimItem[] };

      return {
        narrative: statement.content,
        timeline: parsed.timeline,
        claimItems: parsed.claimItems,
      };
    }
  } catch {
    // If parsing fails, return just the narrative
  }

  return {
    narrative: statement.content,
  };
}

// Get statement status for display
export function getStatementStatusInfo(
  statements: Statement[],
  userId: string,
  _userRole: 'claimant' | 'respondent'
): {
  hasInitial: boolean;
  hasRebuttal: boolean;
  initialVersion?: number;
  rebuttalVersion?: number;
  lastUpdated?: Date;
} {
  const userStatements = statements.filter((s) => s.submittedById === userId);
  const initial = userStatements.find((s) => s.type === StatementType.INITIAL);
  const rebuttal = userStatements.find((s) => s.type === StatementType.REBUTTAL);

  const dates = userStatements.map((s) => s.updatedAt);
  const lastUpdated =
    dates.length > 0 ? new Date(Math.max(...dates.map((d) => d.getTime()))) : undefined;

  return {
    hasInitial: !!initial,
    hasRebuttal: !!rebuttal,
    initialVersion: initial?.version,
    rebuttalVersion: rebuttal?.version,
    lastUpdated,
  };
}
