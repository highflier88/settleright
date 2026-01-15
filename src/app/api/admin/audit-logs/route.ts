import { AuditAction } from '@prisma/client';

import { successResponse, errorResponse } from '@/lib/api/response';
import { withAdmin, type AuthenticatedRequest } from '@/lib/api/with-auth';
import { getAuditLogs, type AuditLogFilters } from '@/lib/services/audit';

// GET /api/admin/audit-logs - List audit logs with filters
export const GET = withAdmin(async (request: AuthenticatedRequest) => {
  try {
    const { searchParams } = new URL(request.url);

    // Parse filters
    const filters: AuditLogFilters = {};

    const userId = searchParams.get('userId');
    if (userId) filters.userId = userId;

    const caseId = searchParams.get('caseId');
    if (caseId) filters.caseId = caseId;

    const action = searchParams.get('action');
    if (action && Object.values(AuditAction).includes(action as AuditAction)) {
      filters.action = action as AuditAction;
    }

    const actions = searchParams.get('actions');
    if (actions) {
      const actionList = actions
        .split(',')
        .filter((a) => Object.values(AuditAction).includes(a as AuditAction)) as AuditAction[];
      if (actionList.length > 0) {
        filters.actions = actionList;
      }
    }

    const startDate = searchParams.get('startDate');
    if (startDate) {
      const date = new Date(startDate);
      if (!isNaN(date.getTime())) {
        filters.startDate = date;
      }
    }

    const endDate = searchParams.get('endDate');
    if (endDate) {
      const date = new Date(endDate);
      if (!isNaN(date.getTime())) {
        filters.endDate = date;
      }
    }

    const ipAddress = searchParams.get('ipAddress');
    if (ipAddress) filters.ipAddress = ipAddress;

    // Parse pagination
    const page = parseInt(searchParams.get('page') ?? '1', 10);
    const limit = parseInt(searchParams.get('limit') ?? '50', 10);

    const result = await getAuditLogs(filters, { page, limit });

    return successResponse(result);
  } catch (error) {
    return errorResponse(error as Error);
  }
});
