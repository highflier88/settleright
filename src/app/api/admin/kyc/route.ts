import { z } from 'zod';

import { paginatedResponse } from '@/lib/api/response';
import { withAdmin, type AuthenticatedRequest } from '@/lib/api/with-auth';
import { getKYCVerifications } from '@/lib/services/kyc-admin';
import { validateQuery } from '@/lib/validations';

const KYC_STATUSES = ['NOT_STARTED', 'PENDING', 'VERIFIED', 'FAILED', 'EXPIRED'] as const;

const listKYCSchema = z.object({
  page: z.coerce.number().int().min(1).default(1),
  perPage: z.coerce.number().int().min(1).max(100).default(20),
  search: z.string().optional(),
  status: z.enum(KYC_STATUSES).optional(),
  dateFrom: z.coerce.date().optional(),
  dateTo: z.coerce.date().optional(),
});

async function handleGet(request: AuthenticatedRequest) {
  const { searchParams } = request.nextUrl;
  const params = validateQuery(listKYCSchema, searchParams);

  const page = params.page ?? 1;
  const perPage = params.perPage ?? 20;

  const { items, total } = await getKYCVerifications(
    {
      status: params.status,
      search: params.search,
      dateFrom: params.dateFrom,
      dateTo: params.dateTo,
    },
    {
      page,
      perPage,
    }
  );

  const formattedItems = items.map((item) => ({
    id: item.id,
    userId: item.userId,
    userEmail: item.user.email,
    userName: item.user.name,
    status: item.status,
    documentType: item.documentType,
    verifiedName: item.verifiedName,
    verifiedAt: item.verifiedAt?.toISOString() ?? null,
    expiresAt: item.expiresAt?.toISOString() ?? null,
    failedAt: item.failedAt?.toISOString() ?? null,
    failureReason: item.failureReason,
    failureCount: item.failureCount,
    lastFailureCode: item.lastFailureCode,
    adminActionCount: item._count.adminActions,
    createdAt: item.createdAt.toISOString(),
    updatedAt: item.updatedAt.toISOString(),
  }));

  return paginatedResponse(formattedItems, page, perPage, total);
}

export const GET = withAdmin(handleGet);
