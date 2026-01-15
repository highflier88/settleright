import { type NextRequest } from 'next/server';

import { z } from 'zod';

import { BadRequestError } from '@/lib/api/errors';
import { successResponse, errorResponse } from '@/lib/api/response';
import { requireAuth } from '@/lib/auth';
import { prisma } from '@/lib/db';
import { checkRateLimit } from '@/lib/rate-limit';
import { sendPhoneVerification, checkPhoneVerification } from '@/lib/services/twilio';
import { validateBody } from '@/lib/validations';

const sendCodeSchema = z.object({
  phone: z
    .string()
    .regex(/^\+[1-9]\d{1,14}$/, 'Please enter a valid phone number with country code'),
});

const verifyCodeSchema = z.object({
  phone: z.string().regex(/^\+[1-9]\d{1,14}$/, 'Please enter a valid phone number'),
  code: z.string().length(6, 'Verification code must be 6 digits'),
});

// POST: Send verification code
export async function POST(request: NextRequest) {
  try {
    const user = await requireAuth();

    // Rate limit: 3 requests per minute
    await checkRateLimit(`phone_verify:${user.id}`, { limit: 3, window: 60 });

    const body: unknown = await request.json();
    const { phone } = validateBody(sendCodeSchema, body);

    // Check if phone is already verified by another user
    const existingUser = await prisma.user.findFirst({
      where: {
        phone,
        id: { not: user.id },
      },
    });

    if (existingUser) {
      throw new BadRequestError('This phone number is already in use');
    }

    const result = await sendPhoneVerification(phone);

    if (!result.success) {
      throw new BadRequestError(result.error ?? 'Failed to send verification code');
    }

    return successResponse({
      message: 'Verification code sent',
      status: result.status,
    });
  } catch (error) {
    return errorResponse(error as Error);
  }
}

// PUT: Verify the code
export async function PUT(request: NextRequest) {
  try {
    const user = await requireAuth();

    // Rate limit: 5 attempts per minute
    await checkRateLimit(`phone_check:${user.id}`, { limit: 5, window: 60 });

    const body: unknown = await request.json();
    const { phone, code } = validateBody(verifyCodeSchema, body);

    const result = await checkPhoneVerification(phone, code);

    if (!result.success) {
      throw new BadRequestError(result.error ?? 'Verification failed');
    }

    if (!result.valid) {
      throw new BadRequestError('Invalid verification code');
    }

    // Update user's phone number
    await prisma.user.update({
      where: { id: user.id },
      data: { phone },
    });

    // Create audit log
    const hash = Buffer.from(
      JSON.stringify({
        action: 'USER_PROFILE_UPDATED',
        userId: user.id,
        timestamp: Date.now(),
      })
    ).toString('base64');

    await prisma.auditLog.create({
      data: {
        action: 'USER_PROFILE_UPDATED',
        userId: user.id,
        metadata: {
          field: 'phone',
          verified: true,
        },
        hash,
      },
    });

    return successResponse({
      message: 'Phone number verified successfully',
      phone,
    });
  } catch (error) {
    return errorResponse(error as Error);
  }
}
