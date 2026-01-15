import { NotFoundError, ForbiddenError, BadRequestError } from '@/lib/api/errors';
import { successResponse, errorResponse } from '@/lib/api/response';
import { withAuth, type AuthenticatedRequest } from '@/lib/api/with-auth';
import { userHasAccessToCase } from '@/lib/services/case';
import {
  getCaseEvidence,
  uploadEvidence,
  getEvidenceStats,
  formatFileSize,
  MAX_FILE_SIZE,
  MAX_TOTAL_SIZE_PER_CASE,
  MAX_FILES_PER_CASE,
  ALLOWED_FILE_TYPES,
} from '@/lib/services/evidence';

// GET /api/cases/[id]/evidence - List evidence for a case
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

      const [evidence, stats] = await Promise.all([
        getCaseEvidence(caseId, request.user.id),
        getEvidenceStats(caseId),
      ]);

      return successResponse({
        evidence: evidence.map((e) => ({
          ...e,
          fileSizeFormatted: formatFileSize(e.fileSize),
          isOwn: e.submittedById === request.user.id,
        })),
        stats: {
          ...stats,
          totalSizeFormatted: formatFileSize(stats.totalSize),
          remainingSizeFormatted: formatFileSize(stats.remainingSize),
        },
        limits: {
          maxFileSize: MAX_FILE_SIZE,
          maxFileSizeFormatted: formatFileSize(MAX_FILE_SIZE),
          maxTotalSize: MAX_TOTAL_SIZE_PER_CASE,
          maxTotalSizeFormatted: formatFileSize(MAX_TOTAL_SIZE_PER_CASE),
          maxFiles: MAX_FILES_PER_CASE,
        },
        allowedTypes: Object.keys(ALLOWED_FILE_TYPES),
      });
    } catch (error) {
      return errorResponse(error as Error);
    }
  }
);

// POST /api/cases/[id]/evidence - Upload evidence
export const POST = withAuth(
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

      // Parse multipart form data
      const formData = await request.formData();
      const file = formData.get('file') as File | null;
      const description = formData.get('description') as string | null;

      if (!file) {
        throw new BadRequestError('No file provided');
      }

      const result = await uploadEvidence({
        caseId,
        userId: request.user.id,
        file,
        description: description ?? undefined,
      });

      if (!result.success) {
        throw new BadRequestError(result.error ?? 'Failed to upload evidence');
      }

      return successResponse(
        {
          evidence: {
            ...result.evidence!,
            fileSizeFormatted: formatFileSize(result.evidence!.fileSize),
            isOwn: true,
          },
          message: 'Evidence uploaded successfully',
        },
        201
      );
    } catch (error) {
      return errorResponse(error as Error);
    }
  },
  {
    rateLimit: { limit: 20, window: 60 * 60 * 1000 }, // 20 uploads per hour
  }
);
