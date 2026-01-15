import { AuditAction, CaseStatus } from '@prisma/client';

import { NotFoundError, ForbiddenError } from '@/lib/api/errors';
import { successResponse, errorResponse } from '@/lib/api/response';
import { withAuth, type AuthenticatedRequest } from '@/lib/api/with-auth';
import { prisma } from '@/lib/db';
import { createAuditLog } from '@/lib/services/audit';
import {
  getCaseWithDetails,
  userHasAccessToCase,
  softDeleteCase,
  getCaseDeadlines,
  CASE_STATUS_LABELS,
  DISPUTE_TYPE_LABELS,
} from '@/lib/services/case';
import { validateBody } from '@/lib/validations';
import { updateCaseSchema } from '@/lib/validations/case';

// GET /api/cases/[id] - Get case details
export const GET = withAuth(
  async (request: AuthenticatedRequest, context?: { params: Record<string, string> }) => {
    try {
      const caseId = context?.params.id;
      if (!caseId) {
        throw new NotFoundError('Case not found');
      }

      // Check access
      const access = await userHasAccessToCase(request.user.id, caseId);
      if (!access.hasAccess) {
        throw new ForbiddenError('You do not have access to this case');
      }

      // Get case with full details
      const caseRecord = await getCaseWithDetails(caseId);
      if (!caseRecord) {
        throw new NotFoundError('Case not found');
      }

      // Get deadlines
      const deadlines = getCaseDeadlines(caseRecord);

      return successResponse({
        case: {
          ...caseRecord,
          statusLabel: CASE_STATUS_LABELS[caseRecord.status],
          disputeTypeLabel: DISPUTE_TYPE_LABELS[caseRecord.disputeType],
          deadlines,
          userRole: access.role,
        },
      });
    } catch (error) {
      return errorResponse(error as Error);
    }
  },
  {
    auditAction: AuditAction.CASE_UPDATED,
    getCaseId: (_, context) => context?.params.id ?? null,
  }
);

// PATCH /api/cases/[id] - Update case
export const PATCH = withAuth(
  async (request: AuthenticatedRequest, context?: { params: Record<string, string> }) => {
    try {
      const caseId = context?.params.id;
      if (!caseId) {
        throw new NotFoundError('Case not found');
      }

      // Check access - only claimant can update
      const access = await userHasAccessToCase(request.user.id, caseId);
      if (!access.hasAccess) {
        throw new ForbiddenError('You do not have access to this case');
      }

      if (access.role !== 'claimant') {
        throw new ForbiddenError('Only the claimant can update case details');
      }

      // Check case status - can only update in certain states
      const existingCase = await prisma.case.findUnique({
        where: { id: caseId },
        select: { status: true },
      });

      if (!existingCase) {
        throw new NotFoundError('Case not found');
      }

      const editableStatuses: CaseStatus[] = [CaseStatus.DRAFT, CaseStatus.PENDING_RESPONDENT];
      if (!editableStatuses.includes(existingCase.status)) {
        throw new ForbiddenError('Case can no longer be edited');
      }

      const body: unknown = await request.json();
      const data = validateBody(updateCaseSchema, body);

      // Update the case
      const updatedCase = await prisma.case.update({
        where: { id: caseId },
        data: {
          ...(data.description && { description: data.description }),
          ...(data.amount && { amount: data.amount }),
        },
      });

      // Log update
      await createAuditLog({
        action: AuditAction.CASE_UPDATED,
        userId: request.user.id,
        caseId,
        metadata: {
          updatedFields: Object.keys(data),
        },
      });

      return successResponse({
        case: updatedCase,
      });
    } catch (error) {
      return errorResponse(error as Error);
    }
  }
);

// DELETE /api/cases/[id] - Soft delete case
export const DELETE = withAuth(
  async (request: AuthenticatedRequest, context?: { params: Record<string, string> }) => {
    try {
      const caseId = context?.params.id;
      if (!caseId) {
        throw new NotFoundError('Case not found');
      }

      // Check access - only claimant can delete
      const access = await userHasAccessToCase(request.user.id, caseId);
      if (!access.hasAccess) {
        throw new ForbiddenError('You do not have access to this case');
      }

      if (access.role !== 'claimant') {
        throw new ForbiddenError('Only the claimant can withdraw a case');
      }

      // Check case status - can only delete in certain states
      const existingCase = await prisma.case.findUnique({
        where: { id: caseId },
        select: { status: true },
      });

      if (!existingCase) {
        throw new NotFoundError('Case not found');
      }

      const deletableStatuses: CaseStatus[] = [
        CaseStatus.DRAFT,
        CaseStatus.PENDING_RESPONDENT,
        CaseStatus.PENDING_AGREEMENT,
      ];
      if (!deletableStatuses.includes(existingCase.status)) {
        throw new ForbiddenError('Case cannot be withdrawn after agreement has been signed');
      }

      // Soft delete
      const success = await softDeleteCase(caseId, request.user.id);

      if (!success) {
        throw new Error('Failed to withdraw case');
      }

      return successResponse({
        message: 'Case withdrawn successfully',
      });
    } catch (error) {
      return errorResponse(error as Error);
    }
  }
);
