/**
 * Arbitrator Credentials Service
 *
 * Handles credential verification for arbitrators:
 * - Bar license validation
 * - Status tracking
 * - Expiration monitoring
 * - Admin verification workflow
 */

import { prisma } from '@/lib/db';

import type { CredentialVerificationStatus } from '@prisma/client';

// ============================================================================
// TYPES
// ============================================================================

export interface CredentialVerificationResult {
  status: CredentialVerificationStatus;
  verifiedAt: Date | null;
  expiresAt: Date | null;
  notes: string | null;
  verifiedBy: string | null;
}

export interface CredentialSubmission {
  arbitratorProfileId: string;
  barNumber: string;
  barState: string;
  isRetiredJudge?: boolean;
  additionalDocuments?: string[];
}

export interface AdminVerificationInput {
  arbitratorProfileId: string;
  adminUserId: string;
  status: CredentialVerificationStatus;
  notes?: string;
  expiresAt?: Date;
}

// Bar association data (simplified - in production, integrate with bar APIs)
const BAR_VERIFICATION_URLS: Record<string, string> = {
  CA: 'https://apps.calbar.ca.gov/attorney/Licensee/QuickSearch',
  NY: 'https://iapps.courts.state.ny.us/attorney/AttorneySearch',
  TX: 'https://www.texasbar.com/AM/Template.cfm?Section=Find_A_Lawyer',
  FL: 'https://www.floridabar.org/directories/find-mbr/',
  IL: 'https://www.iardc.org/lawyersearch.asp',
  // Add more states as needed
};

// ============================================================================
// CREDENTIAL VERIFICATION
// ============================================================================

/**
 * Submit credentials for verification
 */
export async function submitCredentials(
  submission: CredentialSubmission
): Promise<{ success: boolean; message: string }> {
  const profile = await prisma.arbitratorProfile.findUnique({
    where: { id: submission.arbitratorProfileId },
  });

  if (!profile) {
    throw new Error('Arbitrator profile not found');
  }

  // Update profile with credential information
  await prisma.arbitratorProfile.update({
    where: { id: submission.arbitratorProfileId },
    data: {
      barNumber: submission.barNumber,
      barState: submission.barState,
      isRetiredJudge: submission.isRetiredJudge ?? profile.isRetiredJudge,
      credentialStatus: 'PENDING',
      credentialVerifiedAt: null,
      credentialExpiresAt: null,
      credentialNotes: null,
    },
  });

  return {
    success: true,
    message: 'Credentials submitted for verification. You will be notified once reviewed.',
  };
}

/**
 * Admin: Verify arbitrator credentials
 */
export async function verifyCredentials(
  input: AdminVerificationInput
): Promise<CredentialVerificationResult> {
  const profile = await prisma.arbitratorProfile.findUnique({
    where: { id: input.arbitratorProfileId },
  });

  if (!profile) {
    throw new Error('Arbitrator profile not found');
  }

  const now = new Date();
  const verifiedAt = input.status === 'VERIFIED' ? now : null;

  // Default expiration to 1 year from now if verified and not specified
  const expiresAt =
    input.status === 'VERIFIED'
      ? input.expiresAt || new Date(now.getFullYear() + 1, now.getMonth(), now.getDate())
      : null;

  const updatedProfile = await prisma.arbitratorProfile.update({
    where: { id: input.arbitratorProfileId },
    data: {
      credentialStatus: input.status,
      credentialVerifiedAt: verifiedAt,
      credentialExpiresAt: expiresAt,
      credentialNotes: input.notes,
      verifiedById: input.adminUserId,
      // Activate the arbitrator if verified and has Stripe Connect set up
      ...(input.status === 'VERIFIED' && profile.stripeConnectStatus === 'ACTIVE'
        ? { isActive: true }
        : {}),
    },
  });

  return {
    status: updatedProfile.credentialStatus,
    verifiedAt: updatedProfile.credentialVerifiedAt,
    expiresAt: updatedProfile.credentialExpiresAt,
    notes: updatedProfile.credentialNotes,
    verifiedBy: input.adminUserId,
  };
}

/**
 * Get credential status for an arbitrator
 */
export async function getCredentialStatus(
  arbitratorProfileId: string
): Promise<CredentialVerificationResult | null> {
  const profile = await prisma.arbitratorProfile.findUnique({
    where: { id: arbitratorProfileId },
    select: {
      credentialStatus: true,
      credentialVerifiedAt: true,
      credentialExpiresAt: true,
      credentialNotes: true,
      verifiedById: true,
    },
  });

  if (!profile) {
    return null;
  }

  return {
    status: profile.credentialStatus,
    verifiedAt: profile.credentialVerifiedAt,
    expiresAt: profile.credentialExpiresAt,
    notes: profile.credentialNotes,
    verifiedBy: profile.verifiedById,
  };
}

/**
 * Check if credentials are valid and not expired
 */
export async function areCredentialsValid(
  arbitratorProfileId: string
): Promise<{ valid: boolean; reason?: string }> {
  const profile = await prisma.arbitratorProfile.findUnique({
    where: { id: arbitratorProfileId },
    select: {
      credentialStatus: true,
      credentialExpiresAt: true,
    },
  });

  if (!profile) {
    return { valid: false, reason: 'Profile not found' };
  }

  if (profile.credentialStatus !== 'VERIFIED') {
    return { valid: false, reason: `Credentials are ${profile.credentialStatus.toLowerCase()}` };
  }

  if (profile.credentialExpiresAt && profile.credentialExpiresAt < new Date()) {
    // Update status to EXPIRED
    await prisma.arbitratorProfile.update({
      where: { id: arbitratorProfileId },
      data: { credentialStatus: 'EXPIRED', isActive: false },
    });
    return { valid: false, reason: 'Credentials have expired' };
  }

  return { valid: true };
}

/**
 * Get all arbitrators pending credential verification
 */
export async function getPendingVerifications(
  options: { limit?: number; offset?: number } = {}
): Promise<
  Array<{
    id: string;
    userId: string;
    userName: string | null;
    userEmail: string;
    barNumber: string | null;
    barState: string | null;
    isRetiredJudge: boolean;
    yearsExperience: number | null;
    submittedAt: Date;
  }>
> {
  const { limit = 50, offset = 0 } = options;

  const profiles = await prisma.arbitratorProfile.findMany({
    where: {
      credentialStatus: 'PENDING',
      onboardingStatus: 'COMPLETED',
    },
    include: {
      user: {
        select: {
          name: true,
          email: true,
        },
      },
    },
    orderBy: { updatedAt: 'asc' },
    take: limit,
    skip: offset,
  });

  return profiles.map((p) => ({
    id: p.id,
    userId: p.userId,
    userName: p.user.name,
    userEmail: p.user.email,
    barNumber: p.barNumber,
    barState: p.barState,
    isRetiredJudge: p.isRetiredJudge,
    yearsExperience: p.yearsExperience,
    submittedAt: p.updatedAt,
  }));
}

/**
 * Get expired credentials that need renewal
 */
export async function getExpiringCredentials(daysUntilExpiry: number = 30): Promise<
  Array<{
    id: string;
    userId: string;
    userName: string | null;
    userEmail: string;
    expiresAt: Date;
  }>
> {
  const expiryThreshold = new Date();
  expiryThreshold.setDate(expiryThreshold.getDate() + daysUntilExpiry);

  const profiles = await prisma.arbitratorProfile.findMany({
    where: {
      credentialStatus: 'VERIFIED',
      credentialExpiresAt: {
        lte: expiryThreshold,
        gte: new Date(), // Not yet expired
      },
    },
    include: {
      user: {
        select: {
          name: true,
          email: true,
        },
      },
    },
    orderBy: { credentialExpiresAt: 'asc' },
  });

  return profiles.map((p) => ({
    id: p.id,
    userId: p.userId,
    userName: p.user.name,
    userEmail: p.user.email,
    expiresAt: p.credentialExpiresAt!,
  }));
}

/**
 * Get bar verification URL for a state
 */
export function getBarVerificationUrl(state: string): string | null {
  return BAR_VERIFICATION_URLS[state] || null;
}

/**
 * Mark credentials as expired (for cron job)
 */
export async function expireCredentials(): Promise<number> {
  const result = await prisma.arbitratorProfile.updateMany({
    where: {
      credentialStatus: 'VERIFIED',
      credentialExpiresAt: {
        lt: new Date(),
      },
    },
    data: {
      credentialStatus: 'EXPIRED',
      isActive: false,
    },
  });

  return result.count;
}
