
import { withAuth, AuthenticatedRequest } from '@/lib/api/with-auth';
import { successResponse, errorResponse } from '@/lib/api/response';
import {
  getUserNotificationPreferences,
  updateNotificationPreferences,
} from '@/lib/services/notification';
import { BadRequestError } from '@/lib/api/errors';

// GET /api/notifications/preferences - Get notification preferences
export const GET = withAuth(
  async (request: AuthenticatedRequest) => {
    try {
      const preferences = await getUserNotificationPreferences(request.user.id);
      return successResponse({ preferences });
    } catch (error) {
      return errorResponse(error as Error);
    }
  }
);

// PUT /api/notifications/preferences - Update notification preferences
export const PUT = withAuth(
  async (request: AuthenticatedRequest) => {
    try {
      const body = await request.json();

      // Validate allowed fields
      const allowedFields = [
        'emailEnabled',
        'smsEnabled',
        'inAppEnabled',
        'caseUpdates',
        'deadlineReminders',
        'evidenceUploads',
        'awardNotifications',
        'marketingEmails',
      ];

      const updates: Record<string, boolean> = {};

      for (const field of allowedFields) {
        if (typeof body[field] === 'boolean') {
          updates[field] = body[field];
        }
      }

      if (Object.keys(updates).length === 0) {
        throw new BadRequestError('No valid preference updates provided');
      }

      const preferences = await updateNotificationPreferences(request.user.id, updates);

      return successResponse({
        preferences,
        message: 'Preferences updated successfully',
      });
    } catch (error) {
      return errorResponse(error as Error);
    }
  }
);
