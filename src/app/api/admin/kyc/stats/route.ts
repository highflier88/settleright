import { z } from 'zod';

import { successResponse } from '@/lib/api/response';
import { withAdmin, type AuthenticatedRequest } from '@/lib/api/with-auth';
import { getKYCStats } from '@/lib/services/kyc-admin';
import { validateQuery } from '@/lib/validations';

const statsSchema = z.object({
  dateFrom: z.coerce.date().optional(),
  dateTo: z.coerce.date().optional(),
});

async function handleGet(request: AuthenticatedRequest) {
  const { searchParams } = request.nextUrl;
  const params = validateQuery(statsSchema, searchParams);

  const dateRange =
    params.dateFrom && params.dateTo
      ? { from: params.dateFrom, to: params.dateTo }
      : undefined;

  const stats = await getKYCStats(dateRange);

  return successResponse({
    total: stats.total,
    byStatus: stats.byStatus,
    expiringSoon: stats.expiringSoon,
    recentFailures: stats.recentFailures,
    averageVerificationTime: stats.averageVerificationTime,
  });
}

export const GET = withAdmin(handleGet);
