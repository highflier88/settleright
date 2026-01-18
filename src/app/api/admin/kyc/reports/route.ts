import { z } from 'zod';

import { successResponse, errorResponse } from '@/lib/api/response';
import { withAdmin, type AuthenticatedRequest } from '@/lib/api/with-auth';
import { generateKYCComplianceReport } from '@/lib/compliance/kyc-reports';
import { validateBody } from '@/lib/validations';

const generateReportSchema = z.object({
  startDate: z.coerce.date(),
  endDate: z.coerce.date(),
});

async function handlePost(request: AuthenticatedRequest) {
  const body = await request.json();
  const data = validateBody(generateReportSchema, body);

  // Validate date range
  if (data.startDate > data.endDate) {
    return errorResponse('Start date must be before end date', 400);
  }

  // Limit report range to 1 year
  const oneYearMs = 365 * 24 * 60 * 60 * 1000;
  if (data.endDate.getTime() - data.startDate.getTime() > oneYearMs) {
    return errorResponse('Report range cannot exceed 1 year', 400);
  }

  const report = await generateKYCComplianceReport({
    startDate: data.startDate,
    endDate: data.endDate,
  });

  return successResponse({
    period: {
      startDate: report.period.startDate.toISOString(),
      endDate: report.period.endDate.toISOString(),
    },
    summary: {
      ...report.summary,
      successRate: Number(report.summary.successRate.toFixed(2)),
      avgVerificationTimeHours: report.summary.avgVerificationTimeHours
        ? Number(report.summary.avgVerificationTimeHours.toFixed(2))
        : null,
    },
    byStatus: report.byStatus,
    byDocumentType: report.byDocumentType,
    failureReasons: report.failureReasons,
    dailyStats: report.dailyStats,
  });
}

export const POST = withAdmin(handlePost);
