
import { NotFoundError } from '@/lib/api/errors';
import { successResponse, errorResponse } from '@/lib/api/response';
import { withAuth, type AuthenticatedRequest } from '@/lib/api/with-auth';
import { markNotificationRead } from '@/lib/services/notification';

// PATCH /api/notifications/[id] - Mark notification as read
export const PATCH = withAuth(
  async (request: AuthenticatedRequest, context?: { params: Record<string, string> }) => {
    try {
      const notificationId = context?.params.id;
      if (!notificationId) {
        throw new NotFoundError('Notification not found');
      }

      const success = await markNotificationRead(notificationId, request.user.id);

      if (!success) {
        throw new NotFoundError('Notification not found');
      }

      return successResponse({
        message: 'Notification marked as read',
      });
    } catch (error) {
      return errorResponse(error as Error);
    }
  }
);
