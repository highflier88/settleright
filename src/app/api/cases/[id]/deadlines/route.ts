
import { withAuth, AuthenticatedRequest } from '@/lib/api/with-auth';
import { successResponse, errorResponse } from '@/lib/api/response';
import { userHasAccessToCase } from '@/lib/services/case';
import {
  calculateCaseDeadlines,
  formatDeadline,
  getDeadlineStatus,
  getDeadlineUrgency,
  DEADLINE_CONFIG,
} from '@/lib/services/deadline';
import { NotFoundError, ForbiddenError } from '@/lib/api/errors';

// GET /api/cases/[id]/deadlines - Get case deadlines
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

      // Enhance deadline info with formatted strings
      const enhancedDeadlines: Record<string, unknown> = {};

      for (const [key, deadline] of Object.entries(deadlines)) {
        if (deadline) {
          enhancedDeadlines[key] = {
            ...deadline,
            deadlineFormatted: formatDeadline(deadline.deadline),
            statusText: getDeadlineStatus(deadline),
            urgency: getDeadlineUrgency(deadline),
          };
        }
      }

      // Calculate overall status
      const allDeadlines = Object.values(deadlines).filter(Boolean);
      const passedCount = allDeadlines.filter((d) => d?.isPassed).length;
      const urgentCount = allDeadlines.filter(
        (d) => d && !d.isPassed && d.hoursRemaining <= 24
      ).length;
      const warningCount = allDeadlines.filter(
        (d) => d && !d.isPassed && d.hoursRemaining > 24 && d.daysRemaining <= 3
      ).length;

      return successResponse({
        deadlines: enhancedDeadlines,
        summary: {
          total: allDeadlines.length,
          passed: passedCount,
          urgent: urgentCount,
          warning: warningCount,
          upcoming: allDeadlines.length - passedCount - urgentCount - warningCount,
        },
        config: {
          maxExtensionDays: DEADLINE_CONFIG.MAX_EXTENSION_DAYS,
          reminderIntervals: DEADLINE_CONFIG.REMINDER_INTERVALS,
        },
      });
    } catch (error) {
      return errorResponse(error as Error);
    }
  }
);
