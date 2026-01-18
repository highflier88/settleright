import { NextResponse } from 'next/server';
import { z } from 'zod';

import { errorResponse } from '@/lib/api/response';
import { withAdmin, type AuthenticatedRequest } from '@/lib/api/with-auth';
import { exportKYCVerificationRecords } from '@/lib/compliance/kyc-reports';
import { validateQuery } from '@/lib/validations';

const KYC_STATUSES = ['NOT_STARTED', 'PENDING', 'VERIFIED', 'FAILED', 'EXPIRED'] as const;

const exportSchema = z.object({
  format: z.enum(['csv', 'json']).default('csv'),
  status: z.enum(KYC_STATUSES).optional(),
  startDate: z.coerce.date().optional(),
  endDate: z.coerce.date().optional(),
});

async function handleGet(request: AuthenticatedRequest) {
  const { searchParams } = request.nextUrl;
  const params = validateQuery(exportSchema, searchParams);

  // Validate date range if both provided
  if (params.startDate && params.endDate && params.startDate > params.endDate) {
    return errorResponse('Start date must be before end date', 400);
  }

  const format = params.format ?? 'csv';

  const data = await exportKYCVerificationRecords(
    {
      status: params.status,
      startDate: params.startDate,
      endDate: params.endDate,
    },
    format
  );

  const timestamp = new Date().toISOString().split('T')[0];
  const filename = `kyc-verifications-${timestamp}.${format}`;

  const contentType = format === 'json' ? 'application/json' : 'text/csv';

  return new NextResponse(data, {
    headers: {
      'Content-Type': contentType,
      'Content-Disposition': `attachment; filename="${filename}"`,
    },
  });
}

export const GET = withAdmin(handleGet);
