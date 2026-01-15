import { NotFoundError, ForbiddenError, BadRequestError } from '@/lib/api/errors';
import { successResponse, errorResponse } from '@/lib/api/response';
import { withAuth, type AuthenticatedRequest } from '@/lib/api/with-auth';
import { userHasAccessToCase } from '@/lib/services/case';
import {
  getStatementById,
  updateStatement,
  parseStatementContent,
  type StatementContent,
} from '@/lib/services/statement';

// GET /api/cases/[id]/statements/[statementId] - Get statement details
export const GET = withAuth(
  async (request: AuthenticatedRequest, context?: { params: Record<string, string> }) => {
    try {
      const caseId = context?.params.id;
      const statementId = context?.params.statementId;

      if (!caseId || !statementId) {
        throw new NotFoundError('Statement not found');
      }

      // Check case access
      const access = await userHasAccessToCase(request.user.id, caseId);
      if (!access.hasAccess) {
        throw new ForbiddenError('You do not have access to this case');
      }

      // Get statement
      const statement = await getStatementById(statementId);
      if (!statement || statement.caseId !== caseId) {
        throw new NotFoundError('Statement not found');
      }

      return successResponse({
        statement: {
          ...statement,
          parsedContent: parseStatementContent(statement),
          isOwn: statement.submittedById === request.user.id,
          canEdit: statement.submittedById === request.user.id,
        },
      });
    } catch (error) {
      return errorResponse(error as Error);
    }
  }
);

// PUT /api/cases/[id]/statements/[statementId] - Update statement
export const PUT = withAuth(
  async (request: AuthenticatedRequest, context?: { params: Record<string, string> }) => {
    try {
      const caseId = context?.params.id;
      const statementId = context?.params.statementId;

      if (!caseId || !statementId) {
        throw new NotFoundError('Statement not found');
      }

      // Check case access
      const access = await userHasAccessToCase(request.user.id, caseId);
      if (!access.hasAccess) {
        throw new ForbiddenError('You do not have access to this case');
      }

      // Verify statement exists and belongs to case
      const existingStatement = await getStatementById(statementId);
      if (!existingStatement || existingStatement.caseId !== caseId) {
        throw new NotFoundError('Statement not found');
      }

      // Parse request body
      const body = (await request.json()) as { content: StatementContent };
      const { content } = body;

      // Validate content
      if (!content || !content.narrative) {
        throw new BadRequestError('Statement content with narrative is required');
      }

      const result = await updateStatement({
        statementId,
        userId: request.user.id,
        content,
      });

      if (!result.success) {
        throw new BadRequestError(result.error ?? 'Failed to update statement');
      }

      return successResponse({
        statement: {
          ...result.statement!,
          parsedContent: content,
          isOwn: true,
          canEdit: true,
        },
        message: 'Statement updated successfully',
      });
    } catch (error) {
      return errorResponse(error as Error);
    }
  },
  {
    rateLimit: { limit: 30, window: 60 * 60 * 1000 }, // 30 updates per hour
  }
);
