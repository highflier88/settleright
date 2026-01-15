import { successResponse, errorResponse } from '@/lib/api/response';
import { withAdmin, type AuthenticatedRequest } from '@/lib/api/with-auth';
import { verifyAuditLogIntegrity } from '@/lib/services/audit';

// GET /api/admin/audit-logs/verify - Verify audit log integrity
export const GET = withAdmin(async (request: AuthenticatedRequest) => {
  try {
    const { searchParams } = new URL(request.url);

    // Parse date range
    let startDate: Date | undefined;
    let endDate: Date | undefined;

    const startDateParam = searchParams.get('startDate');
    if (startDateParam) {
      const date = new Date(startDateParam);
      if (!isNaN(date.getTime())) {
        startDate = date;
      }
    }

    const endDateParam = searchParams.get('endDate');
    if (endDateParam) {
      const date = new Date(endDateParam);
      if (!isNaN(date.getTime())) {
        endDate = date;
      }
    }

    const result = await verifyAuditLogIntegrity(startDate, endDate);

    return successResponse({
      ...result,
      verifiedAt: new Date().toISOString(),
      dateRange: {
        startDate: startDate?.toISOString() ?? null,
        endDate: endDate?.toISOString() ?? null,
      },
    });
  } catch (error) {
    return errorResponse(error as Error);
  }
});
