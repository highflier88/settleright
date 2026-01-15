
import { NotFoundError, ForbiddenError, BadRequestError } from '@/lib/api/errors';
import { successResponse, errorResponse } from '@/lib/api/response';
import { withAuth, type AuthenticatedRequest } from '@/lib/api/with-auth';
import { userHasAccessToCase } from '@/lib/services/case';
import {
  getEvidenceById,
  markEvidenceViewed,
  deleteEvidence,
  formatFileSize,
} from '@/lib/services/evidence';

// GET /api/cases/[id]/evidence/[evidenceId] - Get evidence details
export const GET = withAuth(
  async (request: AuthenticatedRequest, context?: { params: Record<string, string> }) => {
    try {
      const caseId = context?.params.id;
      const evidenceId = context?.params.evidenceId;

      if (!caseId || !evidenceId) {
        throw new NotFoundError('Evidence not found');
      }

      // Check case access
      const access = await userHasAccessToCase(request.user.id, caseId);
      if (!access.hasAccess) {
        throw new ForbiddenError('You do not have access to this case');
      }

      // Get evidence
      const evidence = await getEvidenceById(evidenceId);
      if (!evidence || evidence.caseId !== caseId) {
        throw new NotFoundError('Evidence not found');
      }

      // Mark as viewed if viewer is opposing party
      await markEvidenceViewed(evidenceId, request.user.id);

      return successResponse({
        evidence: {
          ...evidence,
          fileSizeFormatted: formatFileSize(evidence.fileSize),
          isOwn: evidence.submittedById === request.user.id,
        },
      });
    } catch (error) {
      return errorResponse(error as Error);
    }
  }
);

// DELETE /api/cases/[id]/evidence/[evidenceId] - Delete evidence
export const DELETE = withAuth(
  async (request: AuthenticatedRequest, context?: { params: Record<string, string> }) => {
    try {
      const caseId = context?.params.id;
      const evidenceId = context?.params.evidenceId;

      if (!caseId || !evidenceId) {
        throw new NotFoundError('Evidence not found');
      }

      // Check case access
      const access = await userHasAccessToCase(request.user.id, caseId);
      if (!access.hasAccess) {
        throw new ForbiddenError('You do not have access to this case');
      }

      // Delete evidence
      const result = await deleteEvidence(evidenceId, request.user.id);

      if (!result.success) {
        throw new BadRequestError(result.error ?? 'Failed to delete evidence');
      }

      return successResponse({
        message: 'Evidence deleted successfully',
      });
    } catch (error) {
      return errorResponse(error as Error);
    }
  }
);
