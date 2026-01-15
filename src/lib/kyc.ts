import { KYCStatus } from '@prisma/client';

import { ForbiddenError } from './api/errors';
import { prisma } from './db';
import { isVerificationValid } from './services/stripe-identity';

export interface KYCCheckResult {
  isVerified: boolean;
  status: KYCStatus;
  expiresAt: Date | null;
  requiresAction: boolean;
  message: string;
}

// Check a user's KYC status
export async function checkKYCStatus(userId: string): Promise<KYCCheckResult> {
  const verification = await prisma.identityVerification.findUnique({
    where: { userId },
    select: {
      status: true,
      expiresAt: true,
      verifiedAt: true,
    },
  });

  if (!verification) {
    return {
      isVerified: false,
      status: KYCStatus.NOT_STARTED,
      expiresAt: null,
      requiresAction: true,
      message: 'Identity verification has not been started',
    };
  }

  // Check if expired
  if (
    verification.status === KYCStatus.VERIFIED &&
    verification.expiresAt &&
    verification.expiresAt < new Date()
  ) {
    // Update to expired status
    await prisma.identityVerification.update({
      where: { userId },
      data: { status: KYCStatus.EXPIRED },
    });

    return {
      isVerified: false,
      status: KYCStatus.EXPIRED,
      expiresAt: verification.expiresAt,
      requiresAction: true,
      message: 'Identity verification has expired',
    };
  }

  switch (verification.status) {
    case KYCStatus.VERIFIED:
      return {
        isVerified: true,
        status: KYCStatus.VERIFIED,
        expiresAt: verification.expiresAt,
        requiresAction: false,
        message: 'Identity is verified',
      };

    case KYCStatus.PENDING:
      return {
        isVerified: false,
        status: KYCStatus.PENDING,
        expiresAt: null,
        requiresAction: false,
        message: 'Identity verification is in progress',
      };

    case KYCStatus.FAILED:
      return {
        isVerified: false,
        status: KYCStatus.FAILED,
        expiresAt: null,
        requiresAction: true,
        message: 'Identity verification failed - please try again',
      };

    case KYCStatus.EXPIRED:
      return {
        isVerified: false,
        status: KYCStatus.EXPIRED,
        expiresAt: verification.expiresAt,
        requiresAction: true,
        message: 'Identity verification has expired',
      };

    default:
      return {
        isVerified: false,
        status: KYCStatus.NOT_STARTED,
        expiresAt: null,
        requiresAction: true,
        message: 'Identity verification has not been started',
      };
  }
}

// Require verified KYC for an action (throws if not verified)
export async function requireKYC(userId: string): Promise<void> {
  const isValid = await isVerificationValid(userId);

  if (!isValid) {
    throw new ForbiddenError(
      'Identity verification required. Please verify your identity before proceeding.'
    );
  }
}

// Check if a user can participate in a case (needs verified KYC)
export async function canParticipateInCase(userId: string): Promise<{
  canParticipate: boolean;
  reason?: string;
}> {
  const kycStatus = await checkKYCStatus(userId);

  if (!kycStatus.isVerified) {
    return {
      canParticipate: false,
      reason: kycStatus.message,
    };
  }

  return { canParticipate: true };
}

// Check if both parties in a case have verified KYC
export async function bothPartiesVerified(
  claimantId: string,
  respondentId: string | null
): Promise<{
  bothVerified: boolean;
  claimantVerified: boolean;
  respondentVerified: boolean;
}> {
  const claimantStatus = await checkKYCStatus(claimantId);
  const respondentStatus = respondentId
    ? await checkKYCStatus(respondentId)
    : { isVerified: false };

  return {
    bothVerified: claimantStatus.isVerified && respondentStatus.isVerified,
    claimantVerified: claimantStatus.isVerified,
    respondentVerified: respondentStatus.isVerified,
  };
}
