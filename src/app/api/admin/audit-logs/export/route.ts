import { NextResponse } from 'next/server';

import { AuditAction } from '@prisma/client';

import { errorResponse } from '@/lib/api/response';
import { withAdmin, type AuthenticatedRequest } from '@/lib/api/with-auth';
import { exportAuditLogs, type AuditLogFilters } from '@/lib/services/audit';
import { logAuditEvent } from '@/lib/services/audit';

// GET /api/admin/audit-logs/export - Export audit logs
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

    // Parse format (default JSON)
    const format = (searchParams.get('format') ?? 'json') as 'json' | 'csv';

    const exportData = await exportAuditLogs(filters, format);

    // Log the export action
    logAuditEvent({
      action: AuditAction.EVIDENCE_VIEWED, // Using closest available action
      userId: request.user.id,
      metadata: {
        type: 'audit_log_export',
        format,
        filters,
      },
    });

    // Return the export data with appropriate headers
    const contentType = format === 'csv' ? 'text/csv' : 'application/json';
    const filename = `audit-logs-${new Date().toISOString().split('T')[0]}.${format}`;

    return new NextResponse(exportData, {
      headers: {
        'Content-Type': contentType,
        'Content-Disposition': `attachment; filename="${filename}"`,
      },
    });
  } catch (error) {
    return errorResponse(error as Error);
  }
});
