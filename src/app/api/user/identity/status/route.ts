import { successResponse, errorResponse } from '@/lib/api/response';

type KYCStatus = 'NOT_STARTED' | 'PENDING' | 'VERIFIED' | 'FAILED' | 'EXPIRED';
import { requireAuth } from '@/lib/auth';
import { prisma } from '@/lib/db';
import { getVerificationSession, isVerificationValid } from '@/lib/services/stripe-identity';

export async function GET() {
  try {
    const user = await requireAuth();

    const verification = await prisma.identityVerification.findUnique({
      where: { userId: user.id },
    });

    if (!verification) {
      return successResponse({
        status: 'NOT_STARTED',
        isValid: false,
        canStartVerification: true,
      });
    }

    // Check if we need to sync status from Stripe
    if (verification.status === 'PENDING' && verification.providerSessionId) {
      const session = await getVerificationSession(verification.providerSessionId);
      if (session) {
        // Map Stripe status to our status
        let newStatus: KYCStatus = verification.status;
        if (session.status === 'verified') {
          newStatus = 'VERIFIED';
        } else if (session.status === 'canceled' && session.lastError) {
          newStatus = 'FAILED';
        }

        // If status changed, update the database
        if (newStatus !== verification.status) {
          await prisma.identityVerification.update({
            where: { userId: user.id },
            data: {
              status: newStatus,
              ...(newStatus === 'VERIFIED' && {
                verifiedAt: new Date(),
                expiresAt: new Date(Date.now() + 2 * 365 * 24 * 60 * 60 * 1000),
              }),
              ...(newStatus === 'FAILED' && {
                failedAt: new Date(),
                failureReason: session.lastError?.reason,
              }),
            },
          });
          verification.status = newStatus;
        }
      }
    }

    // Check if verification is still valid (not expired)
    const isValid = await isVerificationValid(user.id);

    // Determine if user can start a new verification
    const canStartVerification =
      verification.status === 'NOT_STARTED' ||
      verification.status === 'FAILED' ||
      verification.status === 'EXPIRED';

    return successResponse({
      status: verification.status,
      isValid,
      canStartVerification,
      verifiedAt: verification.verifiedAt?.toISOString() ?? null,
      expiresAt: verification.expiresAt?.toISOString() ?? null,
      verifiedName: verification.verifiedName ?? null,
      documentType: verification.documentType ?? null,
      failureReason: verification.failureReason ?? null,
      initiatedAt: verification.initiatedAt?.toISOString() ?? null,
    });
  } catch (error) {
    return errorResponse(error as Error);
  }
}
