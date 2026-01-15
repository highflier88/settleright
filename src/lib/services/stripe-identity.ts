import Stripe from 'stripe';

import { prisma } from '@/lib/db';
import { createAuditLog } from '@/lib/services/audit';
import { KYCStatus, AuditAction } from '@prisma/client';

// Initialize Stripe
const stripeSecretKey = process.env.STRIPE_SECRET_KEY;
const stripe = stripeSecretKey ? new Stripe(stripeSecretKey) : null;

export interface CreateVerificationSessionResult {
  success: boolean;
  sessionId?: string;
  url?: string;
  error?: string;
}

export interface VerificationSessionStatus {
  id: string;
  status: 'requires_input' | 'processing' | 'verified' | 'canceled';
  lastError?: {
    code: string;
    reason: string;
  };
  verifiedOutputs?: {
    firstName?: string;
    lastName?: string;
    dob?: {
      day: number;
      month: number;
      year: number;
    };
    idNumber?: string;
    address?: {
      city?: string;
      country?: string;
      line1?: string;
      line2?: string;
      postalCode?: string;
      state?: string;
    };
  };
}

// Create a new Stripe Identity verification session
export async function createVerificationSession(
  userId: string,
  returnUrl: string,
  metadata?: Record<string, string>
): Promise<CreateVerificationSessionResult> {
  if (!stripe) {
    console.error('Stripe not configured');
    return { success: false, error: 'Identity verification service not configured' };
  }

  try {
    // Get user info for pre-filling
    const user = await prisma.user.findUnique({
      where: { id: userId },
      select: {
        email: true,
        name: true,
        phone: true,
      },
    });

    if (!user) {
      return { success: false, error: 'User not found' };
    }

    // Create the verification session
    const session = await stripe.identity.verificationSessions.create({
      type: 'document',
      metadata: {
        user_id: userId,
        ...metadata,
      },
      options: {
        document: {
          // Accept these document types
          allowed_types: ['driving_license', 'passport', 'id_card'],
          // Require a live selfie to match document photo
          require_live_capture: true,
          require_matching_selfie: true,
        },
      },
      return_url: returnUrl,
    });

    return {
      success: true,
      sessionId: session.id,
      url: session.url ?? undefined,
    };
  } catch (error) {
    console.error('Failed to create verification session:', error);
    return {
      success: false,
      error: error instanceof Error ? error.message : 'Failed to create verification session',
    };
  }
}

// Retrieve a verification session's status
export async function getVerificationSession(
  sessionId: string
): Promise<VerificationSessionStatus | null> {
  if (!stripe) {
    console.error('Stripe not configured');
    return null;
  }

  try {
    const session = await stripe.identity.verificationSessions.retrieve(sessionId, {
      expand: ['verified_outputs'],
    });

    const result: VerificationSessionStatus = {
      id: session.id,
      status: session.status as VerificationSessionStatus['status'],
    };

    if (session.last_error) {
      result.lastError = {
        code: session.last_error.code ?? 'unknown',
        reason: session.last_error.reason ?? 'Unknown error',
      };
    }

    if (session.verified_outputs) {
      const outputs = session.verified_outputs;
      result.verifiedOutputs = {
        firstName: outputs.first_name ?? undefined,
        lastName: outputs.last_name ?? undefined,
        dob: outputs.dob
          ? {
              day: outputs.dob.day ?? 0,
              month: outputs.dob.month ?? 0,
              year: outputs.dob.year ?? 0,
            }
          : undefined,
        idNumber: outputs.id_number ?? undefined,
        address: outputs.address
          ? {
              city: outputs.address.city ?? undefined,
              country: outputs.address.country ?? undefined,
              line1: outputs.address.line1 ?? undefined,
              line2: outputs.address.line2 ?? undefined,
              postalCode: outputs.address.postal_code ?? undefined,
              state: outputs.address.state ?? undefined,
            }
          : undefined,
      };
    }

    return result;
  } catch (error) {
    console.error('Failed to retrieve verification session:', error);
    return null;
  }
}

// Cancel a verification session
export async function cancelVerificationSession(sessionId: string): Promise<boolean> {
  if (!stripe) {
    console.error('Stripe not configured');
    return false;
  }

  try {
    await stripe.identity.verificationSessions.cancel(sessionId);
    return true;
  } catch (error) {
    console.error('Failed to cancel verification session:', error);
    return false;
  }
}

// Redact a verification session (for privacy compliance)
export async function redactVerificationSession(sessionId: string): Promise<boolean> {
  if (!stripe) {
    console.error('Stripe not configured');
    return false;
  }

  try {
    await stripe.identity.verificationSessions.redact(sessionId);
    return true;
  } catch (error) {
    console.error('Failed to redact verification session:', error);
    return false;
  }
}

// Process a verification session update (called from webhook)
export async function processVerificationUpdate(
  sessionId: string,
  status: string
): Promise<void> {
  if (!stripe) {
    console.error('Stripe not configured');
    return;
  }

  // Get the full session details
  const session = await getVerificationSession(sessionId);
  if (!session) {
    console.error('Could not retrieve session:', sessionId);
    return;
  }

  // Get the session from Stripe to access metadata
  const stripeSession = await stripe.identity.verificationSessions.retrieve(sessionId);
  const userId = stripeSession.metadata?.user_id;

  if (!userId) {
    console.error('No user_id in session metadata:', sessionId);
    return;
  }

  // Map Stripe status to our KYC status
  let kycStatus: KYCStatus;
  let auditAction: AuditAction;

  switch (status) {
    case 'verified':
      kycStatus = KYCStatus.VERIFIED;
      auditAction = AuditAction.KYC_COMPLETED;
      break;
    case 'canceled':
    case 'requires_input':
      // If there was an error, mark as failed
      if (session.lastError) {
        kycStatus = KYCStatus.FAILED;
        auditAction = AuditAction.KYC_FAILED;
      } else {
        // Still in progress or needs user action
        kycStatus = KYCStatus.PENDING;
        auditAction = AuditAction.KYC_INITIATED;
      }
      break;
    case 'processing':
      kycStatus = KYCStatus.PENDING;
      auditAction = AuditAction.KYC_INITIATED;
      break;
    default:
      console.error('Unknown verification status:', status);
      return;
  }

  // Build update data
  const updateData: Record<string, unknown> = {
    status: kycStatus,
    providerSessionId: sessionId,
  };

  if (kycStatus === KYCStatus.VERIFIED) {
    updateData.verifiedAt = new Date();
    // Set expiration to 2 years from verification
    updateData.expiresAt = new Date(Date.now() + 2 * 365 * 24 * 60 * 60 * 1000);

    // Store verified name if available
    if (session.verifiedOutputs) {
      const { firstName, lastName, dob } = session.verifiedOutputs;
      if (firstName || lastName) {
        updateData.verifiedName = `${firstName ?? ''} ${lastName ?? ''}`.trim();
      }
      if (dob) {
        updateData.verifiedDob = new Date(dob.year, dob.month - 1, dob.day);
      }
    }

    // Determine document type
    updateData.documentType = 'government_id';
  }

  if (kycStatus === KYCStatus.FAILED) {
    updateData.failedAt = new Date();
    updateData.failureReason = session.lastError?.reason ?? 'Verification failed';
  }

  // Update the verification record
  await prisma.identityVerification.update({
    where: { userId },
    data: updateData,
  });

  // Create audit log with integrity chaining
  await createAuditLog({
    action: auditAction,
    userId,
    metadata: {
      sessionId,
      status: kycStatus,
      failureReason: session.lastError?.reason,
    },
  });
}

// Check if user's verification is valid (not expired)
export async function isVerificationValid(userId: string): Promise<boolean> {
  const verification = await prisma.identityVerification.findUnique({
    where: { userId },
    select: {
      status: true,
      expiresAt: true,
    },
  });

  if (!verification) {
    return false;
  }

  if (verification.status !== KYCStatus.VERIFIED) {
    return false;
  }

  if (verification.expiresAt && verification.expiresAt < new Date()) {
    // Mark as expired
    await prisma.identityVerification.update({
      where: { userId },
      data: { status: KYCStatus.EXPIRED },
    });
    return false;
  }

  return true;
}
