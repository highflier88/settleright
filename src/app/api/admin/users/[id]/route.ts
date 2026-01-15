import { z } from 'zod';

import { NotFoundError, BadRequestError } from '@/lib/api/errors';
import { successResponse } from '@/lib/api/response';
import { withAdmin, type AuthenticatedRequest } from '@/lib/api/with-auth';
import { prisma } from '@/lib/db';
import { validateBody } from '@/lib/validations';
import type { UserRole } from '@/types/shared';

const USER_ROLES = ['USER', 'ARBITRATOR', 'ADMIN'] as const;

const updateUserSchema = z.object({
  role: z.enum(USER_ROLES).optional(),
  name: z.string().min(2).max(100).optional(),
  phone: z.string().optional().nullable(),
});

async function handleGet(
  request: AuthenticatedRequest,
  context?: { params: Record<string, string> }
) {
  const id = context?.params.id;
  if (!id) {
    throw new NotFoundError('User not found');
  }

  const user = await prisma.user.findUnique({
    where: { id },
    include: {
      identityVerification: true,
      notificationPrefs: true,
      arbitratorProfile: true,
      _count: {
        select: {
          casesAsClaimant: true,
          casesAsRespondent: true,
          evidence: true,
          statements: true,
        },
      },
    },
  });

  if (!user) {
    throw new NotFoundError('User not found');
  }

  return successResponse({
    id: user.id,
    clerkId: user.clerkId,
    email: user.email,
    name: user.name,
    phone: user.phone,
    role: user.role,
    address: {
      street: user.addressStreet,
      city: user.addressCity,
      state: user.addressState,
      postalCode: user.addressPostalCode,
      country: user.addressCountry,
    },
    identityVerification: user.identityVerification
      ? {
          status: user.identityVerification.status,
          documentType: user.identityVerification.documentType,
          verifiedName: user.identityVerification.verifiedName,
          verifiedAt: user.identityVerification.verifiedAt?.toISOString(),
          expiresAt: user.identityVerification.expiresAt?.toISOString(),
        }
      : null,
    arbitratorProfile: user.arbitratorProfile
      ? {
          barNumber: user.arbitratorProfile.barNumber,
          barState: user.arbitratorProfile.barState,
          isRetiredJudge: user.arbitratorProfile.isRetiredJudge,
          yearsExperience: user.arbitratorProfile.yearsExperience,
          jurisdictions: user.arbitratorProfile.jurisdictions,
          specialties: user.arbitratorProfile.specialties,
          isActive: user.arbitratorProfile.isActive,
          casesCompleted: user.arbitratorProfile.casesCompleted,
        }
      : null,
    stats: {
      casesAsClaimant: user._count.casesAsClaimant,
      casesAsRespondent: user._count.casesAsRespondent,
      evidenceUploaded: user._count.evidence,
      statementsSubmitted: user._count.statements,
    },
    createdAt: user.createdAt.toISOString(),
    updatedAt: user.updatedAt.toISOString(),
    lastLoginAt: user.lastLoginAt?.toISOString(),
  });
}

async function handlePatch(
  request: AuthenticatedRequest,
  context?: { params: Record<string, string> }
) {
  const id = context?.params.id;
  if (!id) {
    throw new NotFoundError('User not found');
  }
  const body: unknown = await request.json();
  const data = validateBody(updateUserSchema, body);

  // Verify user exists
  const existingUser = await prisma.user.findUnique({
    where: { id },
    select: { id: true, role: true },
  });

  if (!existingUser) {
    throw new NotFoundError('User not found');
  }

  // Prevent demoting the last admin
  if (data.role && data.role !== 'ADMIN' && existingUser.role === 'ADMIN') {
    const adminCount = await prisma.user.count({
      where: { role: 'ADMIN' },
    });

    if (adminCount <= 1) {
      throw new BadRequestError('Cannot demote the last administrator');
    }
  }

  // If promoting to arbitrator, create arbitrator profile
  if (data.role === 'ARBITRATOR' && existingUser.role !== 'ARBITRATOR') {
    await prisma.arbitratorProfile.upsert({
      where: { userId: id },
      create: { userId: id },
      update: {},
    });
  }

  const updatedUser = await prisma.user.update({
    where: { id },
    data,
  });

  // Create audit log
  const hash = Buffer.from(
    JSON.stringify({
      action: 'USER_PROFILE_UPDATED',
      userId: id,
      adminId: request.user.id,
      timestamp: Date.now(),
    })
  ).toString('base64');

  await prisma.auditLog.create({
    data: {
      action: 'USER_PROFILE_UPDATED',
      userId: request.user.id,
      metadata: {
        targetUserId: id,
        updatedFields: Object.keys(data),
        previousRole: existingUser.role,
        newRole: data.role,
      },
      hash,
    },
  });

  return successResponse({
    id: updatedUser.id,
    email: updatedUser.email,
    name: updatedUser.name,
    role: updatedUser.role,
    updatedAt: updatedUser.updatedAt.toISOString(),
  });
}

export const GET = withAdmin(handleGet);
export const PATCH = withAdmin(handlePatch);
