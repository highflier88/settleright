/**
 * Stripe Mock Helpers
 *
 * Provides utilities for mocking Stripe in tests.
 */

import { generateId } from '../factories/utils';

export interface MockCheckoutSession {
  id: string;
  url: string;
  payment_status: 'unpaid' | 'paid' | 'no_payment_required';
  status: 'open' | 'complete' | 'expired';
  client_reference_id: string | null;
  customer_email: string | null;
  payment_intent: string | null;
  metadata: Record<string, string>;
}

export interface MockPaymentIntent {
  id: string;
  status: 'requires_payment_method' | 'requires_confirmation' | 'succeeded' | 'canceled';
  amount: number;
  currency: string;
  metadata: Record<string, string>;
  latest_charge: MockCharge | null;
  last_payment_error: { message: string } | null;
}

export interface MockCharge {
  id: string;
  receipt_url: string;
  paid: boolean;
  amount: number;
}

export interface MockRefund {
  id: string;
  amount: number;
  status: 'pending' | 'succeeded' | 'failed' | 'canceled';
  payment_intent: string;
}

/**
 * Create a mock Stripe SDK
 */
export function createMockStripe() {
  return {
    checkout: {
      sessions: {
        create: jest.fn(),
        retrieve: jest.fn(),
        expire: jest.fn(),
      },
    },
    paymentIntents: {
      retrieve: jest.fn(),
      cancel: jest.fn(),
    },
    refunds: {
      create: jest.fn(),
    },
    webhooks: {
      constructEvent: jest.fn(),
    },
    identity: {
      verificationSessions: {
        create: jest.fn(),
        retrieve: jest.fn(),
      },
    },
  };
}

/**
 * Create a mock Checkout Session
 */
export function createMockCheckoutSession(
  overrides: Partial<MockCheckoutSession> = {}
): MockCheckoutSession {
  const id = `cs_${generateId()}`;
  return {
    id,
    url: `https://checkout.stripe.com/pay/${id}`,
    payment_status: 'unpaid',
    status: 'open',
    client_reference_id: null,
    customer_email: null,
    payment_intent: null,
    metadata: {},
    ...overrides,
  };
}

/**
 * Create a completed Checkout Session
 */
export function createCompletedCheckoutSession(
  overrides: Partial<MockCheckoutSession> = {}
): MockCheckoutSession {
  return createMockCheckoutSession({
    payment_status: 'paid',
    status: 'complete',
    payment_intent: `pi_${generateId()}`,
    ...overrides,
  });
}

/**
 * Create a mock Payment Intent
 */
export function createMockPaymentIntent(
  overrides: Partial<MockPaymentIntent> = {}
): MockPaymentIntent {
  return {
    id: `pi_${generateId()}`,
    status: 'succeeded',
    amount: 9900, // $99 in cents
    currency: 'usd',
    metadata: {},
    latest_charge: {
      id: `ch_${generateId()}`,
      receipt_url: 'https://receipt.stripe.com/test',
      paid: true,
      amount: 9900,
    },
    last_payment_error: null,
    ...overrides,
  };
}

/**
 * Create a mock Refund
 */
export function createMockRefund(overrides: Partial<MockRefund> = {}): MockRefund {
  return {
    id: `re_${generateId()}`,
    amount: 9900,
    status: 'succeeded',
    payment_intent: `pi_${generateId()}`,
    ...overrides,
  };
}

/**
 * Setup Stripe mock for successful payment flow
 */
export function setupStripeSuccessFlow(mockStripe: ReturnType<typeof createMockStripe>): void {
  const session = createCompletedCheckoutSession();
  const paymentIntent = createMockPaymentIntent();

  mockStripe.checkout.sessions.create.mockResolvedValue(session);
  mockStripe.checkout.sessions.retrieve.mockResolvedValue(session);
  mockStripe.paymentIntents.retrieve.mockResolvedValue(paymentIntent);
}

/**
 * Setup Stripe mock for failed payment
 */
export function setupStripeFailureFlow(mockStripe: ReturnType<typeof createMockStripe>): void {
  const session = createMockCheckoutSession({ status: 'expired' });
  const paymentIntent = createMockPaymentIntent({
    status: 'canceled',
    last_payment_error: { message: 'Card was declined' },
  });

  mockStripe.checkout.sessions.create.mockResolvedValue(session);
  mockStripe.checkout.sessions.retrieve.mockResolvedValue(session);
  mockStripe.paymentIntents.retrieve.mockResolvedValue(paymentIntent);
}
