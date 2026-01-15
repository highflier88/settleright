import { NextRequest } from 'next/server';

import { requireAuth } from '@/lib/auth';
import { prisma } from '@/lib/db';
import { successResponse, errorResponse } from '@/lib/api';
import { validateBody } from '@/lib/validations';
import { updateProfileSchema } from '@/lib/validations/user';
import { AuditAction } from '@prisma/client';

export async function GET() {
  try {
    const user = await requireAuth();

    return successResponse({
      id: user.id,
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
      createdAt: user.createdAt.toISOString(),
      updatedAt: user.updatedAt.toISOString(),
    });
  } catch (error) {
    return errorResponse(error as Error);
  }
}

export async function PATCH(request: NextRequest) {
  try {
    const user = await requireAuth();
    const body = await request.json();
    const data = validateBody(updateProfileSchema, body);

    // Filter out undefined values
    const updateData: Record<string, unknown> = {};
    for (const [key, value] of Object.entries(data)) {
      if (value !== undefined) {
        updateData[key] = value;
      }
    }

    const updatedUser = await prisma.user.update({
      where: { id: user.id },
      data: updateData,
    });

    // Create audit log
    const hash = Buffer.from(
      JSON.stringify({
        action: AuditAction.USER_PROFILE_UPDATED,
        userId: user.id,
        timestamp: Date.now(),
      })
    ).toString('base64');

    await prisma.auditLog.create({
      data: {
        action: AuditAction.USER_PROFILE_UPDATED,
        userId: user.id,
        metadata: {
          updatedFields: Object.keys(updateData),
        },
        hash,
      },
    });

    return successResponse({
      id: updatedUser.id,
      email: updatedUser.email,
      name: updatedUser.name,
      phone: updatedUser.phone,
      role: updatedUser.role,
      address: {
        street: updatedUser.addressStreet,
        city: updatedUser.addressCity,
        state: updatedUser.addressState,
        postalCode: updatedUser.addressPostalCode,
        country: updatedUser.addressCountry,
      },
      updatedAt: updatedUser.updatedAt.toISOString(),
    });
  } catch (error) {
    return errorResponse(error as Error);
  }
}
