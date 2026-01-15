/**
 * Payment Service
 *
 * Handles payment processing for arbitration fees using Stripe:
 * - Checkout session creation
 * - Payment tracking
 * - Refund processing
 * - Receipt generation
 */

import Stripe from 'stripe';

import { prisma } from '@/lib/db';
import { createAuditLog } from '@/lib/services/audit';

import type { PaymentType, PaymentStatus } from '@prisma/client';

// Initialize Stripe
const stripe = new Stripe(process.env.STRIPE_SECRET_KEY || '');

// ============================================================================
// TYPES
// ============================================================================

export interface CreatePaymentInput {
  caseId: string;
  userId: string;
  type: PaymentType;
  amount: number; // In dollars
  description?: string;
  metadata?: Record<string, string>;
}

export interface CheckoutSessionResult {
  sessionId: string;
  sessionUrl: string;
  paymentId: string;
}

export interface PaymentDetails {
  id: string;
  caseId: string;
  userId: string;
  type: PaymentType;
  status: PaymentStatus;
  amount: number;
  currency: string;
  stripePaymentIntentId: string | null;
  stripeSessionId: string | null;
  createdAt: Date;
  paidAt: Date | null;
  failedAt: Date | null;
  refundedAt: Date | null;
  failureReason: string | null;
  receiptUrl: string | null;
}

export interface RefundResult {
  refundId: string;
  amount: number;
  status: string;
}

// ============================================================================
// FEE CONFIGURATION
// ============================================================================

/**
 * Fee structure based on claim amount and type
 */
export const FEE_STRUCTURE = {
  FILING_FEE: {
    // Base fees by claim amount tiers
    tiers: [
      { maxAmount: 1000, fee: 49 },
      { maxAmount: 5000, fee: 99 },
      { maxAmount: 10000, fee: 149 },
      { maxAmount: 25000, fee: 249 },
      { maxAmount: 50000, fee: 349 },
      { maxAmount: Infinity, fee: 499 },
    ],
  },
  RESPONSE_FEE: {
    // Response fee is typically lower than filing fee
    tiers: [
      { maxAmount: 1000, fee: 29 },
      { maxAmount: 5000, fee: 49 },
      { maxAmount: 10000, fee: 99 },
      { maxAmount: 25000, fee: 149 },
      { maxAmount: 50000, fee: 199 },
      { maxAmount: Infinity, fee: 299 },
    ],
  },
  EXPEDITED_FEE: {
    // Flat fee for expedited processing
    flat: 199,
  },
};

/**
 * Calculate fee based on claim amount and payment type
 */
export function calculateFee(claimAmount: number, type: PaymentType): number {
  if (type === 'EXPEDITED_FEE') {
    return FEE_STRUCTURE.EXPEDITED_FEE.flat;
  }

  const feeStructure = FEE_STRUCTURE[type];
  if (!feeStructure || !('tiers' in feeStructure)) {
    throw new Error(`Invalid payment type: ${type}`);
  }

  for (const tier of feeStructure.tiers) {
    if (claimAmount <= tier.maxAmount) {
      return tier.fee;
    }
  }

  // Should never reach here due to Infinity tier
  return feeStructure.tiers[feeStructure.tiers.length - 1]!.fee;
}

// ============================================================================
// CHECKOUT SESSION
// ============================================================================

/**
 * Create a Stripe Checkout session for payment
 */
export async function createCheckoutSession(
  input: CreatePaymentInput
): Promise<CheckoutSessionResult> {
  const { caseId, userId, type, amount, description, metadata } = input;

  // Get case reference for display
  const caseData = await prisma.case.findUnique({
    where: { id: caseId },
    select: { referenceNumber: true },
  });

  if (!caseData) {
    throw new Error('Case not found');
  }

  // Get user email
  const user = await prisma.user.findUnique({
    where: { id: userId },
    select: { email: true, name: true },
  });

  if (!user) {
    throw new Error('User not found');
  }

  // Create payment record first
  const payment = await prisma.payment.create({
    data: {
      caseId,
      userId,
      type,
      amount,
      currency: 'USD',
      status: 'PENDING',
    },
  });

  // Create line item description
  const typeDescriptions: Record<PaymentType, string> = {
    FILING_FEE: 'Arbitration Filing Fee',
    RESPONSE_FEE: 'Arbitration Response Fee',
    EXPEDITED_FEE: 'Expedited Processing Fee',
  };

  const baseUrl = process.env.NEXT_PUBLIC_APP_URL || 'http://localhost:3000';

  // Create Stripe Checkout session
  const session = await stripe.checkout.sessions.create({
    mode: 'payment',
    customer_email: user.email,
    client_reference_id: payment.id,
    line_items: [
      {
        price_data: {
          currency: 'usd',
          product_data: {
            name: typeDescriptions[type] || 'Arbitration Fee',
            description: description || `Case ${caseData.referenceNumber}`,
            metadata: {
              caseId,
              caseReference: caseData.referenceNumber,
              paymentType: type,
            },
          },
          unit_amount: Math.round(amount * 100), // Convert to cents
        },
        quantity: 1,
      },
    ],
    metadata: {
      paymentId: payment.id,
      caseId,
      caseReference: caseData.referenceNumber,
      paymentType: type,
      userId,
      ...metadata,
    },
    success_url: `${baseUrl}/dashboard/cases/${caseId}?payment=success&session_id={CHECKOUT_SESSION_ID}`,
    cancel_url: `${baseUrl}/dashboard/cases/${caseId}?payment=canceled`,
    expires_at: Math.floor(Date.now() / 1000) + 30 * 60, // 30 minutes
  });

  // Update payment with session ID
  await prisma.payment.update({
    where: { id: payment.id },
    data: { stripeSessionId: session.id },
  });

  return {
    sessionId: session.id,
    sessionUrl: session.url!,
    paymentId: payment.id,
  };
}

/**
 * Get Checkout session status
 */
export async function getCheckoutSessionStatus(sessionId: string): Promise<{
  status: 'open' | 'complete' | 'expired';
  paymentStatus: string | null;
}> {
  const session = await stripe.checkout.sessions.retrieve(sessionId);

  return {
    status: session.status!,
    paymentStatus: session.payment_status,
  };
}

// ============================================================================
// PAYMENT PROCESSING
// ============================================================================

/**
 * Handle successful payment from webhook
 */
export async function handlePaymentSuccess(
  sessionId: string,
  paymentIntentId: string
): Promise<void> {
  // Find payment by session ID
  const payment = await prisma.payment.findFirst({
    where: { stripeSessionId: sessionId },
    include: {
      case: { select: { referenceNumber: true } },
    },
  });

  if (!payment) {
    console.error('Payment not found for session:', sessionId);
    return;
  }

  // Update payment status
  await prisma.payment.update({
    where: { id: payment.id },
    data: {
      status: 'COMPLETED',
      stripePaymentIntentId: paymentIntentId,
      paidAt: new Date(),
    },
  });

  // Create audit log
  await createAuditLog({
    userId: payment.userId,
    action: 'PAYMENT_COMPLETED',
    caseId: payment.caseId,
    metadata: {
      paymentId: payment.id,
      type: payment.type,
      amount: Number(payment.amount),
      stripePaymentIntentId: paymentIntentId,
    },
  });

  // Update case status if needed (e.g., after filing fee is paid)
  if (payment.type === 'FILING_FEE') {
    const caseData = await prisma.case.findUnique({
      where: { id: payment.caseId },
      select: { status: true },
    });

    // If case is in DRAFT status and filing fee is paid, move to PENDING_RESPONDENT
    if (caseData?.status === 'DRAFT') {
      await prisma.case.update({
        where: { id: payment.caseId },
        data: { status: 'PENDING_RESPONDENT' },
      });
    }
  }

  console.log('[Payment] Completed:', {
    paymentId: payment.id,
    caseId: payment.caseId,
    type: payment.type,
    amount: Number(payment.amount),
  });
}

/**
 * Handle failed payment from webhook
 */
export async function handlePaymentFailure(
  sessionId: string,
  failureReason?: string
): Promise<void> {
  const payment = await prisma.payment.findFirst({
    where: { stripeSessionId: sessionId },
  });

  if (!payment) {
    console.error('Payment not found for session:', sessionId);
    return;
  }

  await prisma.payment.update({
    where: { id: payment.id },
    data: {
      status: 'FAILED',
      failedAt: new Date(),
      failureReason: failureReason || 'Payment failed',
    },
  });

  await createAuditLog({
    userId: payment.userId,
    action: 'PAYMENT_FAILED',
    caseId: payment.caseId,
    metadata: {
      paymentId: payment.id,
      type: payment.type,
      failureReason,
    },
  });

  console.log('[Payment] Failed:', {
    paymentId: payment.id,
    caseId: payment.caseId,
    reason: failureReason,
  });
}

// ============================================================================
// REFUNDS
// ============================================================================

/**
 * Process a refund for a payment
 */
export async function processRefund(
  paymentId: string,
  reason?: string,
  adminUserId?: string
): Promise<RefundResult> {
  const payment = await prisma.payment.findUnique({
    where: { id: paymentId },
    include: {
      case: { select: { referenceNumber: true } },
    },
  });

  if (!payment) {
    throw new Error('Payment not found');
  }

  if (payment.status !== 'COMPLETED') {
    throw new Error('Only completed payments can be refunded');
  }

  if (!payment.stripePaymentIntentId) {
    throw new Error('No Stripe payment intent found for this payment');
  }

  // Create refund in Stripe
  const refund = await stripe.refunds.create({
    payment_intent: payment.stripePaymentIntentId,
    reason: 'requested_by_customer',
    metadata: {
      paymentId: payment.id,
      caseId: payment.caseId,
      caseReference: payment.case.referenceNumber,
      refundReason: reason || 'Requested by platform',
    },
  });

  // Update payment status
  await prisma.payment.update({
    where: { id: paymentId },
    data: {
      status: 'REFUNDED',
      refundedAt: new Date(),
    },
  });

  // Create audit log
  await createAuditLog({
    userId: adminUserId || payment.userId,
    action: 'REFUND_ISSUED',
    caseId: payment.caseId,
    metadata: {
      paymentId: payment.id,
      refundId: refund.id,
      amount: Number(payment.amount),
      reason,
    },
  });

  console.log('[Payment] Refunded:', {
    paymentId: payment.id,
    refundId: refund.id,
    amount: Number(payment.amount),
  });

  return {
    refundId: refund.id,
    amount: refund.amount / 100, // Convert from cents
    status: refund.status ?? 'pending',
  };
}

// ============================================================================
// RECEIPTS
// ============================================================================

/**
 * Get receipt URL for a payment
 */
export async function getReceiptUrl(paymentId: string): Promise<string | null> {
  const payment = await prisma.payment.findUnique({
    where: { id: paymentId },
  });

  if (!payment || !payment.stripePaymentIntentId) {
    return null;
  }

  // Get the charge from the payment intent
  const paymentIntent = await stripe.paymentIntents.retrieve(payment.stripePaymentIntentId, {
    expand: ['latest_charge'],
  });

  const charge = paymentIntent.latest_charge as Stripe.Charge | null;
  return charge?.receipt_url || null;
}

/**
 * Generate payment receipt data
 */
export async function generateReceiptData(paymentId: string): Promise<{
  payment: PaymentDetails;
  case: {
    referenceNumber: string;
    description: string;
  };
  user: {
    name: string | null;
    email: string;
  };
  receiptUrl: string | null;
} | null> {
  const payment = await prisma.payment.findUnique({
    where: { id: paymentId },
    include: {
      case: {
        select: { referenceNumber: true, description: true },
      },
    },
  });

  if (!payment) {
    return null;
  }

  const user = await prisma.user.findUnique({
    where: { id: payment.userId },
    select: { name: true, email: true },
  });

  if (!user) {
    return null;
  }

  const receiptUrl = await getReceiptUrl(paymentId);

  return {
    payment: {
      id: payment.id,
      caseId: payment.caseId,
      userId: payment.userId,
      type: payment.type,
      status: payment.status,
      amount: Number(payment.amount),
      currency: payment.currency,
      stripePaymentIntentId: payment.stripePaymentIntentId,
      stripeSessionId: payment.stripeSessionId,
      createdAt: payment.createdAt,
      paidAt: payment.paidAt,
      failedAt: payment.failedAt,
      refundedAt: payment.refundedAt,
      failureReason: payment.failureReason,
      receiptUrl,
    },
    case: {
      referenceNumber: payment.case.referenceNumber,
      description: payment.case.description,
    },
    user: {
      name: user.name,
      email: user.email,
    },
    receiptUrl,
  };
}

// ============================================================================
// PAYMENT QUERIES
// ============================================================================

/**
 * Get payment by ID
 */
export async function getPayment(paymentId: string): Promise<PaymentDetails | null> {
  const payment = await prisma.payment.findUnique({
    where: { id: paymentId },
  });

  if (!payment) {
    return null;
  }

  const receiptUrl = payment.status === 'COMPLETED' ? await getReceiptUrl(paymentId) : null;

  return {
    id: payment.id,
    caseId: payment.caseId,
    userId: payment.userId,
    type: payment.type,
    status: payment.status,
    amount: Number(payment.amount),
    currency: payment.currency,
    stripePaymentIntentId: payment.stripePaymentIntentId,
    stripeSessionId: payment.stripeSessionId,
    createdAt: payment.createdAt,
    paidAt: payment.paidAt,
    failedAt: payment.failedAt,
    refundedAt: payment.refundedAt,
    failureReason: payment.failureReason,
    receiptUrl,
  };
}

/**
 * Get payments for a case
 */
export async function getCasePayments(caseId: string): Promise<PaymentDetails[]> {
  const payments = await prisma.payment.findMany({
    where: { caseId },
    orderBy: { createdAt: 'desc' },
  });

  return payments.map((payment) => ({
    id: payment.id,
    caseId: payment.caseId,
    userId: payment.userId,
    type: payment.type,
    status: payment.status,
    amount: Number(payment.amount),
    currency: payment.currency,
    stripePaymentIntentId: payment.stripePaymentIntentId,
    stripeSessionId: payment.stripeSessionId,
    createdAt: payment.createdAt,
    paidAt: payment.paidAt,
    failedAt: payment.failedAt,
    refundedAt: payment.refundedAt,
    failureReason: payment.failureReason,
    receiptUrl: null, // Don't fetch receipt URL for lists
  }));
}

/**
 * Get payment status for a case
 */
export async function getCasePaymentStatus(caseId: string): Promise<{
  filingFeePaid: boolean;
  responseFeePaid: boolean;
  totalPaid: number;
  pendingAmount: number;
}> {
  const payments = await prisma.payment.findMany({
    where: { caseId },
  });

  const completedPayments = payments.filter((p) => p.status === 'COMPLETED');
  const pendingPayments = payments.filter((p) => p.status === 'PENDING');

  const filingFeePaid = completedPayments.some((p) => p.type === 'FILING_FEE');
  const responseFeePaid = completedPayments.some((p) => p.type === 'RESPONSE_FEE');

  const totalPaid = completedPayments.reduce((sum, p) => sum + Number(p.amount), 0);

  const pendingAmount = pendingPayments.reduce((sum, p) => sum + Number(p.amount), 0);

  return {
    filingFeePaid,
    responseFeePaid,
    totalPaid,
    pendingAmount,
  };
}

/**
 * Check if case has required payments
 */
export async function hasRequiredPayments(
  caseId: string,
  requiredTypes: PaymentType[]
): Promise<boolean> {
  const completedPayments = await prisma.payment.findMany({
    where: {
      caseId,
      status: 'COMPLETED',
      type: { in: requiredTypes },
    },
  });

  return requiredTypes.every((type) => completedPayments.some((p) => p.type === type));
}
