import { successResponse, errorResponse } from '@/lib/api/response';
import { withAuth, type AuthenticatedRequest } from '@/lib/api/with-auth';
import { getNotificationStats } from '@/lib/services/notification';

// GET /api/notifications/stats - Get notification statistics
export const GET = withAuth(async (request: AuthenticatedRequest) => {
  try {
    const stats = await getNotificationStats(request.user.id);
    return successResponse({ stats });
  } catch (error) {
    return errorResponse(error as Error);
  }
});
