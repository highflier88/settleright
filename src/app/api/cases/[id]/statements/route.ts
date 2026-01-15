
import { StatementType } from '@prisma/client';

import { NotFoundError, ForbiddenError, BadRequestError } from '@/lib/api/errors';
import { successResponse, errorResponse } from '@/lib/api/response';
import { withAuth, type AuthenticatedRequest } from '@/lib/api/with-auth';
import { userHasAccessToCase } from '@/lib/services/case';
import {
  getCaseStatements,
  createStatement,
  canSubmitStatement,
  parseStatementContent,
  type StatementContent,
  MAX_NARRATIVE_LENGTH,
  MAX_TIMELINE_ENTRIES,
  MAX_CLAIM_ITEMS,
} from '@/lib/services/statement';


// GET /api/cases/[id]/statements - List statements for a case
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

      const statements = await getCaseStatements(caseId, request.user.id);

      // Check submission eligibility
      const [canSubmitInitial, canSubmitRebuttal] = await Promise.all([
        canSubmitStatement(caseId, request.user.id, StatementType.INITIAL),
        canSubmitStatement(caseId, request.user.id, StatementType.REBUTTAL),
      ]);

      return successResponse({
        statements: statements.map((s) => ({
          ...s,
          parsedContent: parseStatementContent(s),
          isOwn: s.submittedById === request.user.id,
        })),
        permissions: {
          canSubmitInitial: canSubmitInitial.canSubmit,
          canSubmitInitialReason: canSubmitInitial.reason,
          canSubmitRebuttal: canSubmitRebuttal.canSubmit,
          canSubmitRebuttalReason: canSubmitRebuttal.reason,
        },
        limits: {
          maxNarrativeLength: MAX_NARRATIVE_LENGTH,
          maxTimelineEntries: MAX_TIMELINE_ENTRIES,
          maxClaimItems: MAX_CLAIM_ITEMS,
        },
      });
    } catch (error) {
      return errorResponse(error as Error);
    }
  }
);

// POST /api/cases/[id]/statements - Create a new statement
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
      const body = (await request.json()) as { type: string; content: StatementContent };
      const { type, content } = body;

      // Validate type
      if (!type || !['INITIAL', 'REBUTTAL'].includes(type)) {
        throw new BadRequestError('Invalid statement type. Must be INITIAL or REBUTTAL');
      }

      // Validate content
      if (!content || !content.narrative) {
        throw new BadRequestError('Statement content with narrative is required');
      }

      const result = await createStatement({
        caseId,
        userId: request.user.id,
        type: type as StatementType,
        content,
      });

      if (!result.success) {
        throw new BadRequestError(result.error ?? 'Failed to create statement');
      }

      return successResponse(
        {
          statement: {
            ...result.statement!,
            parsedContent: content,
            isOwn: true,
          },
          message: 'Statement submitted successfully',
        },
        201
      );
    } catch (error) {
      return errorResponse(error as Error);
    }
  },
  {
    rateLimit: { limit: 10, window: 60 * 60 * 1000 }, // 10 submissions per hour
  }
);
