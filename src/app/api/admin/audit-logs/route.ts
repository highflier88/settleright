import { successResponse, errorResponse } from '@/lib/api/response';
import { withAdmin, type AuthenticatedRequest } from '@/lib/api/with-auth';
import { getAuditLogs, type AuditLogFilters } from '@/lib/services/audit';
import type { AuditAction } from '@/types/shared';

const VALID_AUDIT_ACTIONS: AuditAction[] = [
  'USER_REGISTERED',
  'USER_LOGIN',
  'USER_LOGOUT',
  'USER_PROFILE_UPDATED',
  'KYC_INITIATED',
  'KYC_COMPLETED',
  'KYC_FAILED',
  'CASE_CREATED',
  'CASE_UPDATED',
  'CASE_STATUS_CHANGED',
  'CASE_CLOSED',
  'INVITATION_SENT',
  'INVITATION_VIEWED',
  'INVITATION_ACCEPTED',
  'INVITATION_EXPIRED',
  'AGREEMENT_VIEWED',
  'AGREEMENT_SIGNED',
  'EVIDENCE_UPLOADED',
  'EVIDENCE_VIEWED',
  'EVIDENCE_DELETED',
  'STATEMENT_SUBMITTED',
  'STATEMENT_UPDATED',
  'ANALYSIS_INITIATED',
  'ANALYSIS_COMPLETED',
  'ANALYSIS_FAILED',
  'CASE_ASSIGNED',
  'REVIEW_STARTED',
  'REVIEW_COMPLETED',
  'DRAFT_AWARD_GENERATED',
  'DRAFT_AWARD_MODIFIED',
  'DRAFT_AWARD_APPROVED',
  'DRAFT_AWARD_REJECTED',
  'DRAFT_AWARD_ESCALATED',
  'ESCALATION_RESOLVED',
  'AWARD_SIGNED',
  'AWARD_ISSUED',
  'AWARD_DOWNLOADED',
  'ENFORCEMENT_PACKAGE_DOWNLOADED',
  'ARBITRATOR_ONBOARDED',
  'ARBITRATOR_CREDENTIALS_SUBMITTED',
];

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
    if (action && VALID_AUDIT_ACTIONS.includes(action as AuditAction)) {
      filters.action = action as AuditAction;
    }

    const actions = searchParams.get('actions');
    if (actions) {
      const actionList = actions
        .split(',')
        .filter((a) => VALID_AUDIT_ACTIONS.includes(a as AuditAction)) as AuditAction[];
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
