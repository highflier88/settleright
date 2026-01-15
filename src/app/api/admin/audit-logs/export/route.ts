import { NextResponse } from 'next/server';

import { errorResponse } from '@/lib/api/response';
import { withAdmin, type AuthenticatedRequest } from '@/lib/api/with-auth';
import { exportAuditLogs, type AuditLogFilters } from '@/lib/services/audit';
import { logAuditEvent } from '@/lib/services/audit';
import type { AuditAction } from '@/types/shared';

const VALID_AUDIT_ACTIONS: AuditAction[] = [
  'USER_REGISTERED', 'USER_LOGIN', 'USER_LOGOUT', 'USER_PROFILE_UPDATED',
  'KYC_INITIATED', 'KYC_COMPLETED', 'KYC_FAILED',
  'CASE_CREATED', 'CASE_UPDATED', 'CASE_STATUS_CHANGED', 'CASE_CLOSED',
  'INVITATION_SENT', 'INVITATION_VIEWED', 'INVITATION_ACCEPTED', 'INVITATION_EXPIRED',
  'AGREEMENT_VIEWED', 'AGREEMENT_SIGNED',
  'EVIDENCE_UPLOADED', 'EVIDENCE_VIEWED', 'EVIDENCE_DELETED',
  'STATEMENT_SUBMITTED', 'STATEMENT_UPDATED',
  'ANALYSIS_INITIATED', 'ANALYSIS_COMPLETED', 'ANALYSIS_FAILED',
  'CASE_ASSIGNED', 'REVIEW_STARTED', 'REVIEW_COMPLETED',
  'DRAFT_AWARD_GENERATED', 'DRAFT_AWARD_MODIFIED', 'DRAFT_AWARD_APPROVED',
  'DRAFT_AWARD_REJECTED', 'DRAFT_AWARD_ESCALATED', 'ESCALATION_RESOLVED',
  'AWARD_SIGNED', 'AWARD_ISSUED', 'AWARD_DOWNLOADED',
  'ENFORCEMENT_PACKAGE_DOWNLOADED', 'ARBITRATOR_ONBOARDED', 'ARBITRATOR_CREDENTIALS_SUBMITTED',
];

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
    if (action && VALID_AUDIT_ACTIONS.includes(action as AuditAction)) {
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
      action: 'EVIDENCE_VIEWED', // Using closest available action
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
