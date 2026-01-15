import { UserRole, KYCStatus } from '@prisma/client';
import { z } from 'zod';

import { paginatedResponse } from '@/lib/api/response';
import { withAdmin, type AuthenticatedRequest } from '@/lib/api/with-auth';
import { prisma } from '@/lib/db';
import { validateQuery } from '@/lib/validations';

const listUsersSchema = z.object({
  page: z.coerce.number().int().min(1).default(1),
  perPage: z.coerce.number().int().min(1).max(100).default(20),
  search: z.string().optional(),
  role: z.nativeEnum(UserRole).optional(),
  kycStatus: z.nativeEnum(KYCStatus).optional(),
  sortBy: z.enum(['createdAt', 'email', 'name', 'lastLoginAt']).default('createdAt'),
  sortOrder: z.enum(['asc', 'desc']).default('desc'),
});

async function handleGet(request: AuthenticatedRequest) {
  const { searchParams } = request.nextUrl;
  const params = validateQuery(listUsersSchema, searchParams);

  const where: Record<string, unknown> = {};

  // Search filter
  if (params.search) {
    where.OR = [
      { email: { contains: params.search, mode: 'insensitive' } },
      { name: { contains: params.search, mode: 'insensitive' } },
    ];
  }

  // Role filter
  if (params.role) {
    where.role = params.role;
  }

  // KYC status filter
  if (params.kycStatus) {
    where.identityVerification = {
      status: params.kycStatus,
    };
  }

  const page = params.page ?? 1;
  const perPage = params.perPage ?? 20;
  const sortBy = params.sortBy ?? 'createdAt';
  const sortOrder = params.sortOrder ?? 'desc';

  const [users, total] = await Promise.all([
    prisma.user.findMany({
      where,
      include: {
        identityVerification: {
          select: {
            status: true,
            verifiedAt: true,
          },
        },
        _count: {
          select: {
            casesAsClaimant: true,
            casesAsRespondent: true,
          },
        },
      },
      orderBy: { [sortBy]: sortOrder },
      skip: (page - 1) * perPage,
      take: perPage,
    }),
    prisma.user.count({ where }),
  ]);

  const formattedUsers = users.map((user) => ({
    id: user.id,
    email: user.email,
    name: user.name,
    phone: user.phone,
    role: user.role,
    kycStatus: user.identityVerification?.status ?? 'NOT_STARTED',
    kycVerifiedAt: user.identityVerification?.verifiedAt?.toISOString() ?? null,
    casesCount: user._count.casesAsClaimant + user._count.casesAsRespondent,
    createdAt: user.createdAt.toISOString(),
    lastLoginAt: user.lastLoginAt?.toISOString() ?? null,
  }));

  return paginatedResponse(formattedUsers, page, perPage, total);
}

export const GET = withAdmin(handleGet);
