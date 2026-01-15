/**
 * Stripe Connect Integration for Arbitrator Payouts
 *
 * Handles:
 * - Connected account creation (Express accounts)
 * - Onboarding flow generation
 * - Account status tracking
 * - Transfers and payouts
 */

import Stripe from 'stripe';

import { prisma } from '@/lib/db';

import type { StripeConnectStatus } from '@prisma/client';

// Initialize Stripe
const stripe = new Stripe(process.env.STRIPE_SECRET_KEY || '');

// ============================================================================
// TYPES
// ============================================================================

export interface ConnectAccountResult {
  accountId: string;
  status: StripeConnectStatus;
  onboardingUrl?: string;
  dashboardUrl?: string;
}

export interface AccountStatus {
  status: StripeConnectStatus;
  detailsSubmitted: boolean;
  chargesEnabled: boolean;
  payoutsEnabled: boolean;
  requirements?: {
    currentlyDue: string[];
    eventuallyDue: string[];
    pastDue: string[];
  };
}

export interface TransferResult {
  transferId: string;
  amount: number;
  currency: string;
  status: string;
}

// ============================================================================
// CONNECTED ACCOUNT MANAGEMENT
// ============================================================================

/**
 * Create a Stripe Connect Express account for an arbitrator
 */
export async function createConnectAccount(
  arbitratorProfileId: string
): Promise<ConnectAccountResult> {
  // Get arbitrator profile
  const profile = await prisma.arbitratorProfile.findUnique({
    where: { id: arbitratorProfileId },
    include: {
      user: { select: { email: true, name: true } },
    },
  });

  if (!profile) {
    throw new Error('Arbitrator profile not found');
  }

  // Check if already has an account
  if (profile.stripeConnectId) {
    return getAccountStatus(arbitratorProfileId);
  }

  // Create Express connected account
  const account = await stripe.accounts.create({
    type: 'express',
    country: 'US',
    email: profile.user.email,
    capabilities: {
      transfers: { requested: true },
    },
    business_type: 'individual',
    metadata: {
      arbitratorProfileId,
      userId: profile.userId,
    },
  });

  // Update profile with Stripe account ID
  await prisma.arbitratorProfile.update({
    where: { id: arbitratorProfileId },
    data: {
      stripeConnectId: account.id,
      stripeConnectStatus: 'PENDING',
      stripeAccountType: 'express',
    },
  });

  // Generate onboarding link
  const onboardingUrl = await generateOnboardingLink(account.id, arbitratorProfileId);

  return {
    accountId: account.id,
    status: 'PENDING',
    onboardingUrl,
  };
}

/**
 * Generate onboarding link for Stripe Connect
 */
export async function generateOnboardingLink(
  accountId: string,
  _arbitratorProfileId: string
): Promise<string> {
  const baseUrl = process.env.NEXT_PUBLIC_APP_URL || 'http://localhost:3000';

  const accountLink = await stripe.accountLinks.create({
    account: accountId,
    refresh_url: `${baseUrl}/arbitrator/settings/payments?refresh=true`,
    return_url: `${baseUrl}/arbitrator/settings/payments?success=true`,
    type: 'account_onboarding',
    collection_options: {
      fields: 'eventually_due',
    },
  });

  return accountLink.url;
}

/**
 * Generate dashboard login link for connected account
 */
export async function generateDashboardLink(accountId: string): Promise<string> {
  const loginLink = await stripe.accounts.createLoginLink(accountId);
  return loginLink.url;
}

/**
 * Get current account status
 */
export async function getAccountStatus(arbitratorProfileId: string): Promise<ConnectAccountResult> {
  const profile = await prisma.arbitratorProfile.findUnique({
    where: { id: arbitratorProfileId },
  });

  if (!profile) {
    throw new Error('Arbitrator profile not found');
  }

  if (!profile.stripeConnectId) {
    return {
      accountId: '',
      status: 'NOT_STARTED',
    };
  }

  // Get account from Stripe
  const account = await stripe.accounts.retrieve(profile.stripeConnectId);

  // Determine status
  let status: StripeConnectStatus;
  if (account.charges_enabled && account.payouts_enabled) {
    status = 'ACTIVE';
  } else if (account.details_submitted) {
    status = 'RESTRICTED';
  } else {
    status = 'PENDING';
  }

  // Update status in database if changed
  if (status !== profile.stripeConnectStatus) {
    await prisma.arbitratorProfile.update({
      where: { id: arbitratorProfileId },
      data: {
        stripeConnectStatus: status,
        ...(status === 'ACTIVE' && {
          stripeConnectOnboardedAt: new Date(),
          // Activate if credentials are also verified
          isActive: profile.credentialStatus === 'VERIFIED',
        }),
      },
    });
  }

  const result: ConnectAccountResult = {
    accountId: profile.stripeConnectId,
    status,
  };

  // Add URLs if needed
  if (status === 'PENDING') {
    result.onboardingUrl = await generateOnboardingLink(
      profile.stripeConnectId,
      arbitratorProfileId
    );
  } else if (status === 'ACTIVE') {
    result.dashboardUrl = await generateDashboardLink(profile.stripeConnectId);
  }

  return result;
}

/**
 * Get detailed account status from Stripe
 */
export async function getDetailedAccountStatus(
  arbitratorProfileId: string
): Promise<AccountStatus> {
  const profile = await prisma.arbitratorProfile.findUnique({
    where: { id: arbitratorProfileId },
  });

  if (!profile || !profile.stripeConnectId) {
    return {
      status: 'NOT_STARTED',
      detailsSubmitted: false,
      chargesEnabled: false,
      payoutsEnabled: false,
    };
  }

  const account = await stripe.accounts.retrieve(profile.stripeConnectId);

  let status: StripeConnectStatus;
  if (account.charges_enabled && account.payouts_enabled) {
    status = 'ACTIVE';
  } else if (account.details_submitted) {
    status = 'RESTRICTED';
  } else {
    status = 'PENDING';
  }

  return {
    status,
    detailsSubmitted: account.details_submitted ?? false,
    chargesEnabled: account.charges_enabled ?? false,
    payoutsEnabled: account.payouts_enabled ?? false,
    requirements: {
      currentlyDue: account.requirements?.currently_due || [],
      eventuallyDue: account.requirements?.eventually_due || [],
      pastDue: account.requirements?.past_due || [],
    },
  };
}

// ============================================================================
// TRANSFERS & PAYOUTS
// ============================================================================

/**
 * Create a transfer to a connected account
 */
export async function createTransfer(
  compensationId: string,
  amount: number, // In cents
  description?: string
): Promise<TransferResult> {
  // Get compensation with arbitrator info
  const compensation = await prisma.arbitratorCompensation.findUnique({
    where: { id: compensationId },
    include: {
      arbitratorProfile: true,
      case: { select: { referenceNumber: true } },
    },
  });

  if (!compensation) {
    throw new Error('Compensation record not found');
  }

  if (!compensation.arbitratorProfile.stripeConnectId) {
    throw new Error('Arbitrator does not have a Stripe Connect account');
  }

  if (compensation.arbitratorProfile.stripeConnectStatus !== 'ACTIVE') {
    throw new Error('Stripe Connect account is not active');
  }

  // Create transfer
  const transfer = await stripe.transfers.create({
    amount: Math.round(amount), // Ensure integer cents
    currency: 'usd',
    destination: compensation.arbitratorProfile.stripeConnectId,
    description: description || `Arbitration fee for case ${compensation.case.referenceNumber}`,
    metadata: {
      compensationId,
      caseId: compensation.caseId,
      caseReference: compensation.case.referenceNumber,
    },
  });

  // Update compensation record
  await prisma.arbitratorCompensation.update({
    where: { id: compensationId },
    data: {
      stripeTransferId: transfer.id,
      status: 'PAID',
      paidAt: new Date(),
    },
  });

  return {
    transferId: transfer.id,
    amount: transfer.amount,
    currency: transfer.currency,
    status: transfer.object,
  };
}

/**
 * Process all pending payouts
 */
export async function processPendingPayouts(): Promise<{
  processed: number;
  failed: number;
  errors: Array<{ compensationId: string; error: string }>;
}> {
  // Get approved compensations with active Stripe accounts
  const pendingPayouts = await prisma.arbitratorCompensation.findMany({
    where: {
      status: 'APPROVED',
      arbitratorProfile: {
        stripeConnectStatus: 'ACTIVE',
        stripeConnectId: { not: null },
      },
    },
    include: {
      arbitratorProfile: true,
      case: { select: { referenceNumber: true } },
    },
  });

  let processed = 0;
  let failed = 0;
  const errors: Array<{ compensationId: string; error: string }> = [];

  for (const compensation of pendingPayouts) {
    try {
      const amountInCents = Math.round(compensation.amount.toNumber() * 100);
      await createTransfer(
        compensation.id,
        amountInCents,
        `Arbitration fee for case ${compensation.case.referenceNumber}`
      );
      processed++;
    } catch (error) {
      failed++;
      errors.push({
        compensationId: compensation.id,
        error: error instanceof Error ? error.message : 'Unknown error',
      });
    }
  }

  return { processed, failed, errors };
}

// ============================================================================
// WEBHOOK HANDLERS
// ============================================================================

/**
 * Handle Stripe Connect webhook events
 */
export async function handleConnectWebhook(
  event: Stripe.Event
): Promise<{ handled: boolean; message?: string }> {
  const eventType = event.type as string;

  if (eventType === 'account.updated') {
    const account = event.data.object as Stripe.Account;
    return handleAccountUpdated(account);
  }

  if (
    eventType === 'transfer.created' ||
    eventType === 'transfer.paid' ||
    eventType === 'transfer.failed' ||
    eventType === 'transfer.reversed'
  ) {
    const transfer = event.data.object as Stripe.Transfer;
    return handleTransferEvent(eventType, transfer);
  }

  if (
    eventType === 'payout.created' ||
    eventType === 'payout.paid' ||
    eventType === 'payout.failed'
  ) {
    const payout = event.data.object as Stripe.Payout;
    // Payout events are logged for audit purposes
    return { handled: true, message: `Payout ${payout.id} ${eventType}` };
  }

  return { handled: false, message: `Unhandled event type: ${eventType}` };
}

/**
 * Handle account.updated webhook
 */
async function handleAccountUpdated(
  account: Stripe.Account
): Promise<{ handled: boolean; message: string }> {
  // Find profile by Stripe account ID
  const profile = await prisma.arbitratorProfile.findFirst({
    where: { stripeConnectId: account.id },
  });

  if (!profile) {
    return { handled: false, message: 'Profile not found for account' };
  }

  // Determine new status
  let newStatus: StripeConnectStatus;
  if (account.charges_enabled && account.payouts_enabled) {
    newStatus = 'ACTIVE';
  } else if (account.details_submitted) {
    newStatus = 'RESTRICTED';
  } else {
    newStatus = 'PENDING';
  }

  // Update profile
  await prisma.arbitratorProfile.update({
    where: { id: profile.id },
    data: {
      stripeConnectStatus: newStatus,
      ...(newStatus === 'ACTIVE' &&
        !profile.stripeConnectOnboardedAt && {
          stripeConnectOnboardedAt: new Date(),
        }),
      // Activate if credentials are also verified
      ...(newStatus === 'ACTIVE' &&
        profile.credentialStatus === 'VERIFIED' && {
          isActive: true,
        }),
    },
  });

  return {
    handled: true,
    message: `Account ${account.id} updated to status: ${newStatus}`,
  };
}

/**
 * Handle transfer events
 */
async function handleTransferEvent(
  eventType: string,
  transfer: Stripe.Transfer
): Promise<{ handled: boolean; message: string }> {
  const compensationId = transfer.metadata?.compensationId;

  if (!compensationId) {
    return { handled: false, message: 'No compensation ID in transfer metadata' };
  }

  if (eventType === 'transfer.failed' || eventType === 'transfer.reversed') {
    // Mark compensation as needing attention
    await prisma.arbitratorCompensation.update({
      where: { id: compensationId },
      data: {
        status: 'DISPUTED',
        disputeReason: `Transfer ${eventType.replace('transfer.', '')}`,
      },
    });
  }

  return {
    handled: true,
    message: `Transfer ${transfer.id} event ${eventType} processed`,
  };
}

/**
 * Check if Stripe Connect is properly configured
 */
export function isStripeConnectConfigured(): boolean {
  return !!(process.env.STRIPE_SECRET_KEY && process.env.STRIPE_CONNECT_CLIENT_ID);
}
