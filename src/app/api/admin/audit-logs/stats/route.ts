import { successResponse, errorResponse } from '@/lib/api/response';
import { withAdmin, type AuthenticatedRequest } from '@/lib/api/with-auth';
import { getAuditStats } from '@/lib/services/audit';

// GET /api/admin/audit-logs/stats - Get audit statistics
export const GET = withAdmin(async (request: AuthenticatedRequest) => {
  try {
    const { searchParams } = new URL(request.url);

    // Parse days parameter (default 30)
    const days = parseInt(searchParams.get('days') ?? '30', 10);
    const validDays = Math.min(Math.max(days, 1), 365); // Limit between 1 and 365 days

    const stats = await getAuditStats(validDays);

    return successResponse(stats);
  } catch (error) {
    return errorResponse(error as Error);
  }
});
