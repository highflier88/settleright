import { successResponse, errorResponse } from '@/lib/api/response';
import { withAuth, type AuthenticatedRequest } from '@/lib/api/with-auth';
import { getUserNotifications, markAllNotificationsRead } from '@/lib/services/notification';

// GET /api/notifications - Get user's notifications
export const GET = withAuth(async (request: AuthenticatedRequest) => {
  try {
    const { searchParams } = new URL(request.url);
    const unreadOnly = searchParams.get('unreadOnly') === 'true';
    const limit = parseInt(searchParams.get('limit') || '50', 10);
    const offset = parseInt(searchParams.get('offset') || '0', 10);

    const result = await getUserNotifications(request.user.id, {
      unreadOnly,
      limit: Math.min(limit, 100), // Cap at 100
      offset,
    });

    return successResponse(result);
  } catch (error) {
    return errorResponse(error as Error);
  }
});

// POST /api/notifications - Mark all notifications as read
export const POST = withAuth(async (request: AuthenticatedRequest) => {
  try {
    const body = (await request.json()) as { action?: string };
    const { action } = body;

    if (action === 'markAllRead') {
      const count = await markAllNotificationsRead(request.user.id);
      return successResponse({
        message: `${count} notifications marked as read`,
        count,
      });
    }

    return errorResponse(new Error('Invalid action'));
  } catch (error) {
    return errorResponse(error as Error);
  }
});
