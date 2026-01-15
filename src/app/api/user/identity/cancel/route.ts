import { KYCStatus } from '@prisma/client';

import { BadRequestError } from '@/lib/api/errors';
import { successResponse, errorResponse } from '@/lib/api/response';
import { requireAuth } from '@/lib/auth';
import { prisma } from '@/lib/db';
import { cancelVerificationSession } from '@/lib/services/stripe-identity';


export async function POST() {
  try {
    const user = await requireAuth();

    const verification = await prisma.identityVerification.findUnique({
      where: { userId: user.id },
    });

    if (!verification) {
      throw new BadRequestError('No verification found');
    }

    if (verification.status !== KYCStatus.PENDING) {
      throw new BadRequestError('Can only cancel pending verifications');
    }

    // Cancel the Stripe session if it exists
    if (verification.providerSessionId) {
      await cancelVerificationSession(verification.providerSessionId);
    }

    // Update the status to allow re-verification
    await prisma.identityVerification.update({
      where: { userId: user.id },
      data: {
        status: KYCStatus.NOT_STARTED,
        providerSessionId: null,
        initiatedAt: null,
      },
    });

    return successResponse({
      message: 'Verification cancelled',
      canStartVerification: true,
    });
  } catch (error) {
    return errorResponse(error as Error);
  }
}
