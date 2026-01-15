/**
 * Payment Factory
 *
 * Creates mock Payment objects for testing.
 */

import { generateId, mockDecimal } from './utils';

export type PaymentType = 'FILING_FEE' | 'RESPONSE_FEE' | 'EXPEDITED_FEE' | 'ARBITRATOR_FEE';
export type PaymentStatus = 'PENDING' | 'COMPLETED' | 'FAILED' | 'REFUNDED';

export interface PaymentFactoryOptions {
  id?: string;
  caseId?: string;
  userId?: string;
  type?: PaymentType;
  status?: PaymentStatus;
  amount?: number;
  currency?: string;
  stripeSessionId?: string | null;
  stripePaymentIntentId?: string | null;
  createdAt?: Date;
  paidAt?: Date | null;
}

/**
 * Create a mock Payment
 */
export function createPayment(options: PaymentFactoryOptions = {}) {
  const id = options.id ?? generateId();
  const createdAt = options.createdAt ?? new Date();
  const status = options.status ?? 'PENDING';

  return {
    id,
    caseId: options.caseId ?? generateId(),
    userId: options.userId ?? generateId(),
    type: options.type ?? 'FILING_FEE',
    status,
    amount: mockDecimal(options.amount ?? 99),
    currency: options.currency ?? 'USD',
    stripeSessionId:
      options.stripeSessionId ?? (status !== 'PENDING' ? `cs_${generateId()}` : null),
    stripePaymentIntentId:
      options.stripePaymentIntentId ?? (status === 'COMPLETED' ? `pi_${generateId()}` : null),
    paidAt: options.paidAt ?? (status === 'COMPLETED' ? new Date() : null),
    failedAt: status === 'FAILED' ? new Date() : null,
    refundedAt: status === 'REFUNDED' ? new Date() : null,
    failureReason: status === 'FAILED' ? 'Card declined' : null,
    createdAt,
    updatedAt: createdAt,
  };
}

/**
 * Create a pending payment
 */
export function createPendingPayment(options: Omit<PaymentFactoryOptions, 'status'> = {}) {
  return createPayment({ ...options, status: 'PENDING' });
}

/**
 * Create a completed payment
 */
export function createCompletedPayment(options: Omit<PaymentFactoryOptions, 'status'> = {}) {
  return createPayment({
    ...options,
    status: 'COMPLETED',
    paidAt: options.paidAt ?? new Date(),
  });
}

/**
 * Create a failed payment
 */
export function createFailedPayment(options: Omit<PaymentFactoryOptions, 'status'> = {}) {
  return createPayment({ ...options, status: 'FAILED' });
}

/**
 * Create a refunded payment
 */
export function createRefundedPayment(options: Omit<PaymentFactoryOptions, 'status'> = {}) {
  return createPayment({ ...options, status: 'REFUNDED' });
}

/**
 * Create a filing fee payment
 */
export function createFilingFeePayment(options: Omit<PaymentFactoryOptions, 'type'> = {}) {
  return createPayment({
    ...options,
    type: 'FILING_FEE',
    amount: options.amount ?? 99,
  });
}

/**
 * Create a response fee payment
 */
export function createResponseFeePayment(options: Omit<PaymentFactoryOptions, 'type'> = {}) {
  return createPayment({
    ...options,
    type: 'RESPONSE_FEE',
    amount: options.amount ?? 49,
  });
}

/**
 * Create an expedited fee payment
 */
export function createExpeditedFeePayment(options: Omit<PaymentFactoryOptions, 'type'> = {}) {
  return createPayment({
    ...options,
    type: 'EXPEDITED_FEE',
    amount: options.amount ?? 199,
  });
}

/**
 * Create a set of payments for a case
 */
export function createPaymentSet(caseId: string, claimantId: string, respondentId: string) {
  return [
    createFilingFeePayment({
      caseId,
      userId: claimantId,
      status: 'COMPLETED',
    }),
    createResponseFeePayment({
      caseId,
      userId: respondentId,
      status: 'COMPLETED',
    }),
  ];
}
