
import { NotFoundError, ForbiddenError, BadRequestError } from '@/lib/api/errors';
import { successResponse, errorResponse } from '@/lib/api/response';
import { withAuth, type AuthenticatedRequest } from '@/lib/api/with-auth';
import { userHasAccessToCase } from '@/lib/services/case';
import {
  calculateCaseDeadlines,
  requestExtension,
  DEADLINE_CONFIG,
  type DeadlineType,
} from '@/lib/services/deadline';

// GET /api/cases/[id]/extension - Get extension eligibility info
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

      const deadlines = await calculateCaseDeadlines(caseId);

      return successResponse({
        deadlines,
        limits: {
          maxExtensionDays: DEADLINE_CONFIG.MAX_EXTENSION_DAYS,
          maxExtensionsPerDeadline: DEADLINE_CONFIG.MAX_EXTENSIONS_PER_DEADLINE,
        },
      });
    } catch (error) {
      return errorResponse(error as Error);
    }
  }
);

// POST /api/cases/[id]/extension - Request an extension
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

      // Parse request body
      const body = (await request.json()) as {
        deadlineType?: string;
        requestedDays?: number;
        reason?: string;
      };
      const { deadlineType, requestedDays, reason } = body;

      // Validate deadline type
      if (!deadlineType || !['evidence', 'rebuttal'].includes(deadlineType)) {
        throw new BadRequestError('Invalid deadline type');
      }

      // Validate requested days
      if (
        typeof requestedDays !== 'number' ||
        requestedDays < 1 ||
        requestedDays > DEADLINE_CONFIG.MAX_EXTENSION_DAYS
      ) {
        throw new BadRequestError(
          `Extension must be between 1 and ${DEADLINE_CONFIG.MAX_EXTENSION_DAYS} days`
        );
      }

      // Validate reason
      if (!reason || typeof reason !== 'string' || reason.length < 10) {
        throw new BadRequestError('Please provide a reason for the extension (minimum 10 characters)');
      }

      const result = await requestExtension({
        caseId,
        userId: request.user.id,
        deadlineType: deadlineType as DeadlineType,
        requestedDays,
        reason,
      });

      if (!result.success) {
        throw new BadRequestError(result.error ?? 'Failed to process extension request');
      }

      return successResponse({
        message: 'Extension granted successfully',
        newDeadline: result.newDeadline,
      });
    } catch (error) {
      return errorResponse(error as Error);
    }
  },
  {
    rateLimit: { limit: 5, window: 60 * 60 * 1000 }, // 5 requests per hour
  }
);
