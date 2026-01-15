import { NextRequest } from 'next/server';
import { z } from 'zod';

import { requireAuth } from '@/lib/auth';
import { prisma } from '@/lib/db';
import { successResponse, errorResponse } from '@/lib/api/response';
import { BadRequestError } from '@/lib/api/errors';
import { validateBody } from '@/lib/validations';
import { checkRateLimit } from '@/lib/rate-limit';
import { createVerificationSession } from '@/lib/services/stripe-identity';
import { AuditAction, KYCStatus } from '@prisma/client';

const startVerificationSchema = z.object({
  returnUrl: z.string().url('Invalid return URL'),
});

export async function POST(request: NextRequest) {
  try {
    const user = await requireAuth();

    // Rate limit: 3 attempts per hour
    await checkRateLimit(`kyc_start:${user.id}`, { limit: 3, window: 3600 });

    const body = await request.json();
    const { returnUrl } = validateBody(startVerificationSchema, body);

    // Check if user already has a pending or verified status
    const existing = await prisma.identityVerification.findUnique({
      where: { userId: user.id },
    });

    if (existing?.status === KYCStatus.VERIFIED) {
      // Check if not expired
      if (!existing.expiresAt || existing.expiresAt > new Date()) {
        throw new BadRequestError('Your identity is already verified');
      }
      // If expired, allow re-verification
    }

    if (existing?.status === KYCStatus.PENDING) {
      throw new BadRequestError(
        'You have a pending verification. Please complete or wait for it to finish.'
      );
    }

    // Create Stripe Identity verification session
    const result = await createVerificationSession(user.id, returnUrl, {
      email: user.email,
    });

    if (!result.success || !result.sessionId) {
      throw new BadRequestError(result.error ?? 'Failed to create verification session');
    }

    // Create or update the verification record
    await prisma.identityVerification.upsert({
      where: { userId: user.id },
      create: {
        userId: user.id,
        status: KYCStatus.PENDING,
        provider: 'stripe_identity',
        providerSessionId: result.sessionId,
        initiatedAt: new Date(),
      },
      update: {
        status: KYCStatus.PENDING,
        provider: 'stripe_identity',
        providerSessionId: result.sessionId,
        initiatedAt: new Date(),
        failedAt: null,
        failureReason: null,
        verifiedAt: null,
        expiresAt: null,
      },
    });

    // Create audit log
    const hash = Buffer.from(
      JSON.stringify({
        action: AuditAction.KYC_INITIATED,
        userId: user.id,
        sessionId: result.sessionId,
        timestamp: Date.now(),
      })
    ).toString('base64');

    await prisma.auditLog.create({
      data: {
        action: AuditAction.KYC_INITIATED,
        userId: user.id,
        metadata: {
          sessionId: result.sessionId,
          provider: 'stripe_identity',
        },
        hash,
      },
    });

    return successResponse({
      sessionId: result.sessionId,
      url: result.url,
      status: 'pending',
    });
  } catch (error) {
    return errorResponse(error as Error);
  }
}
