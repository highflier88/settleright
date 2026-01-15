
import { NotFoundError, ForbiddenError, BadRequestError } from '@/lib/api/errors';
import { successResponse, errorResponse } from '@/lib/api/response';
import { withAuth, type AuthenticatedRequest } from '@/lib/api/with-auth';
import { userHasAccessToCase } from '@/lib/services/case';
import {
  getInvitationByCaseId,
  resendInvitation,
  cancelInvitation,
  getInvitationStatusLabel,
  getInvitationTimeRemaining,
} from '@/lib/services/invitation';

// GET /api/cases/[id]/invitation - Get invitation status
export const GET = withAuth(
  async (request: AuthenticatedRequest, context?: { params: Record<string, string> }) => {
    try {
      const caseId = context?.params.id;
      if (!caseId) {
        throw new NotFoundError('Case not found');
      }

      // Check access - only claimant can view invitation
      const access = await userHasAccessToCase(request.user.id, caseId);
      if (!access.hasAccess) {
        throw new ForbiddenError('You do not have access to this case');
      }

      if (access.role !== 'claimant') {
        throw new ForbiddenError('Only the claimant can view invitation details');
      }

      const invitation = await getInvitationByCaseId(caseId);
      if (!invitation) {
        throw new NotFoundError('Invitation not found');
      }

      const timeRemaining = getInvitationTimeRemaining(invitation.expiresAt);

      return successResponse({
        invitation: {
          id: invitation.id,
          email: invitation.email,
          name: invitation.name,
          phone: invitation.phone,
          status: invitation.status,
          statusLabel: getInvitationStatusLabel(invitation.status),
          sentAt: invitation.sentAt,
          viewedAt: invitation.viewedAt,
          acceptedAt: invitation.acceptedAt,
          expiresAt: invitation.expiresAt,
          timeRemaining,
          remindersSent: invitation.remindersSent,
          lastReminderAt: invitation.lastReminderAt,
        },
      });
    } catch (error) {
      return errorResponse(error as Error);
    }
  }
);

// POST /api/cases/[id]/invitation - Resend invitation
export const POST = withAuth(
  async (request: AuthenticatedRequest, context?: { params: Record<string, string> }) => {
    try {
      const caseId = context?.params.id;
      if (!caseId) {
        throw new NotFoundError('Case not found');
      }

      // Check access - only claimant can resend
      const access = await userHasAccessToCase(request.user.id, caseId);
      if (!access.hasAccess) {
        throw new ForbiddenError('You do not have access to this case');
      }

      if (access.role !== 'claimant') {
        throw new ForbiddenError('Only the claimant can resend invitations');
      }

      const result = await resendInvitation(caseId, request.user.id);

      if (!result.success) {
        throw new BadRequestError(result.error ?? 'Failed to resend invitation');
      }

      return successResponse({
        message: 'Invitation resent successfully',
      });
    } catch (error) {
      return errorResponse(error as Error);
    }
  },
  {
    rateLimit: { limit: 3, window: 60 * 60 * 1000 }, // 3 per hour
  }
);

// DELETE /api/cases/[id]/invitation - Cancel invitation
export const DELETE = withAuth(
  async (request: AuthenticatedRequest, context?: { params: Record<string, string> }) => {
    try {
      const caseId = context?.params.id;
      if (!caseId) {
        throw new NotFoundError('Case not found');
      }

      // Check access - only claimant can cancel
      const access = await userHasAccessToCase(request.user.id, caseId);
      if (!access.hasAccess) {
        throw new ForbiddenError('You do not have access to this case');
      }

      if (access.role !== 'claimant') {
        throw new ForbiddenError('Only the claimant can cancel invitations');
      }

      const success = await cancelInvitation(caseId, request.user.id);

      if (!success) {
        throw new BadRequestError('Failed to cancel invitation');
      }

      return successResponse({
        message: 'Invitation cancelled successfully',
      });
    } catch (error) {
      return errorResponse(error as Error);
    }
  }
);
