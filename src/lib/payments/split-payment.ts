/**
 * Split Payment Service
 *
 * Handles splitting payments between parties, typically used when
 * an award specifies cost allocation or when parties agree to split fees.
 */

import Stripe from 'stripe';

import { prisma } from '@/lib/db';
import { createAuditLog } from '@/lib/services/audit';

import type { PaymentType } from '@prisma/client';

// Initialize Stripe
const stripe = new Stripe(process.env.STRIPE_SECRET_KEY || '');

// ============================================================================
// TYPES
// ============================================================================

export interface SplitPaymentInput {
  caseId: string;
  type: PaymentType;
  totalAmount: number; // In dollars
  splits: Array<{
    userId: string;
    percentage: number; // 0-100
    email: string;
  }>;
  description?: string;
}

export interface SplitPaymentResult {
  totalAmount: number;
  payments: Array<{
    userId: string;
    amount: number;
    percentage: number;
    sessionId: string;
    sessionUrl: string;
    paymentId: string;
  }>;
}

export interface SplitStatus {
  totalAmount: number;
  paidAmount: number;
  pendingAmount: number;
  splits: Array<{
    userId: string;
    amount: number;
    status: string;
    paidAt: Date | null;
  }>;
  allPaid: boolean;
}

// ============================================================================
// SPLIT PAYMENT CREATION
// ============================================================================

/**
 * Create split payment sessions for multiple parties
 */
export async function createSplitPayment(input: SplitPaymentInput): Promise<SplitPaymentResult> {
  const { caseId, type, totalAmount, splits, description } = input;

  // Validate percentages sum to 100
  const totalPercentage = splits.reduce((sum, s) => sum + s.percentage, 0);
  if (Math.abs(totalPercentage - 100) > 0.01) {
    throw new Error('Split percentages must sum to 100');
  }

  // Get case reference
  const caseData = await prisma.case.findUnique({
    where: { id: caseId },
    select: { referenceNumber: true },
  });

  if (!caseData) {
    throw new Error('Case not found');
  }

  const baseUrl = process.env.NEXT_PUBLIC_APP_URL || 'http://localhost:3000';

  // Create payment sessions for each split
  const paymentResults: SplitPaymentResult['payments'] = [];

  for (const split of splits) {
    const amount = Math.round(((totalAmount * split.percentage) / 100) * 100) / 100; // Round to 2 decimals

    // Create payment record
    const payment = await prisma.payment.create({
      data: {
        caseId,
        userId: split.userId,
        type,
        amount,
        currency: 'USD',
        status: 'PENDING',
      },
    });

    // Create Stripe Checkout session
    const session = await stripe.checkout.sessions.create({
      mode: 'payment',
      customer_email: split.email,
      client_reference_id: payment.id,
      line_items: [
        {
          price_data: {
            currency: 'usd',
            product_data: {
              name: `${type.replace('_', ' ')} - Split Payment`,
              description:
                description || `Case ${caseData.referenceNumber} - ${split.percentage}% share`,
              metadata: {
                caseId,
                caseReference: caseData.referenceNumber,
                paymentType: type,
                splitPercentage: split.percentage.toString(),
              },
            },
            unit_amount: Math.round(amount * 100),
          },
          quantity: 1,
        },
      ],
      metadata: {
        paymentId: payment.id,
        caseId,
        caseReference: caseData.referenceNumber,
        paymentType: type,
        userId: split.userId,
        isSplitPayment: 'true',
        splitPercentage: split.percentage.toString(),
      },
      success_url: `${baseUrl}/dashboard/cases/${caseId}?payment=success&session_id={CHECKOUT_SESSION_ID}`,
      cancel_url: `${baseUrl}/dashboard/cases/${caseId}?payment=canceled`,
      expires_at: Math.floor(Date.now() / 1000) + 24 * 60 * 60, // 24 hours for split payments
    });

    // Update payment with session ID
    await prisma.payment.update({
      where: { id: payment.id },
      data: { stripeSessionId: session.id },
    });

    paymentResults.push({
      userId: split.userId,
      amount,
      percentage: split.percentage,
      sessionId: session.id,
      sessionUrl: session.url!,
      paymentId: payment.id,
    });
  }

  // Log the split payment creation
  await createAuditLog({
    action: 'PAYMENT_INITIATED',
    caseId,
    metadata: {
      type,
      totalAmount,
      splitCount: splits.length,
      splits: splits.map((s) => ({
        userId: s.userId,
        percentage: s.percentage,
      })),
    },
  });

  return {
    totalAmount,
    payments: paymentResults,
  };
}

/**
 * Get split payment status for a case
 */
export async function getSplitPaymentStatus(
  caseId: string,
  type: PaymentType
): Promise<SplitStatus> {
  const payments = await prisma.payment.findMany({
    where: {
      caseId,
      type,
    },
    orderBy: { createdAt: 'asc' },
  });

  const totalAmount = payments.reduce((sum, p) => sum + Number(p.amount), 0);
  const paidAmount = payments
    .filter((p) => p.status === 'COMPLETED')
    .reduce((sum, p) => sum + Number(p.amount), 0);
  const pendingAmount = payments
    .filter((p) => p.status === 'PENDING')
    .reduce((sum, p) => sum + Number(p.amount), 0);

  return {
    totalAmount,
    paidAmount,
    pendingAmount,
    splits: payments.map((p) => ({
      userId: p.userId,
      amount: Number(p.amount),
      status: p.status,
      paidAt: p.paidAt,
    })),
    allPaid: payments.every((p) => p.status === 'COMPLETED'),
  };
}

// ============================================================================
// AWARD-BASED COST ALLOCATION
// ============================================================================

/**
 * Create split payment based on award fee allocation
 */
export async function createAwardBasedSplitPayment(
  caseId: string,
  totalFee: number
): Promise<SplitPaymentResult | null> {
  // Get award with fee allocation
  const award = await prisma.award.findUnique({
    where: { caseId },
    select: {
      feeAllocation: true,
      case: {
        select: {
          claimantId: true,
          respondentId: true,
          claimant: { select: { email: true } },
          respondent: { select: { email: true } },
        },
      },
    },
  });

  if (!award || !award.feeAllocation) {
    return null;
  }

  const allocation = award.feeAllocation as {
    claimantPercentage?: number;
    respondentPercentage?: number;
  };

  // Default to 50/50 if not specified
  const claimantPct = allocation.claimantPercentage ?? 50;
  const respondentPct = allocation.respondentPercentage ?? 50;

  const splits: SplitPaymentInput['splits'] = [];

  if (claimantPct > 0 && award.case.claimantId && award.case.claimant?.email) {
    splits.push({
      userId: award.case.claimantId,
      percentage: claimantPct,
      email: award.case.claimant.email,
    });
  }

  if (respondentPct > 0 && award.case.respondentId && award.case.respondent?.email) {
    splits.push({
      userId: award.case.respondentId,
      percentage: respondentPct,
      email: award.case.respondent.email,
    });
  }

  if (splits.length === 0) {
    return null;
  }

  // Normalize percentages if only one party
  if (splits.length === 1) {
    splits[0]!.percentage = 100;
  }

  return createSplitPayment({
    caseId,
    type: 'FILING_FEE', // Could be a different type for award-based fees
    totalAmount: totalFee,
    splits,
    description: 'Fee allocation per arbitration award',
  });
}

// ============================================================================
// EQUAL SPLIT HELPER
// ============================================================================

/**
 * Create an equal split payment between two parties
 */
export async function createEqualSplitPayment(
  caseId: string,
  type: PaymentType,
  totalAmount: number
): Promise<SplitPaymentResult> {
  const caseData = await prisma.case.findUnique({
    where: { id: caseId },
    select: {
      claimantId: true,
      respondentId: true,
      claimant: { select: { email: true } },
      respondent: { select: { email: true } },
    },
  });

  if (!caseData) {
    throw new Error('Case not found');
  }

  if (!caseData.respondentId || !caseData.respondent?.email) {
    throw new Error('Respondent not set for this case');
  }

  return createSplitPayment({
    caseId,
    type,
    totalAmount,
    splits: [
      {
        userId: caseData.claimantId,
        percentage: 50,
        email: caseData.claimant?.email || '',
      },
      {
        userId: caseData.respondentId,
        percentage: 50,
        email: caseData.respondent.email,
      },
    ],
    description: 'Equal split between parties',
  });
}
