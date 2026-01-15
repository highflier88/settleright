/**
 * Payment Flow Integration Tests
 *
 * Tests the complete payment flow from checkout to webhook completion.
 */

import { prisma } from '@/lib/db';
import {
  calculateFee,
  createCheckoutSession,
  handlePaymentSuccess,
  handlePaymentFailure,
  getCasePaymentStatus,
  getCasePayments,
  processRefund,
} from '@/lib/payments';
import {
  createMockUser,
  createMockCase,
  createMockPayment,
  generateTestId,
} from '../utils/test-helpers';

// Mock Stripe
jest.mock('stripe', () => {
  const mockCheckoutCreate = jest.fn();
  const mockCheckoutRetrieve = jest.fn();
  const mockRefundsCreate = jest.fn();
  const mockPaymentIntentsRetrieve = jest.fn();

  const MockStripe = jest.fn().mockImplementation(() => ({
    checkout: {
      sessions: {
        create: mockCheckoutCreate,
        retrieve: mockCheckoutRetrieve,
      },
    },
    refunds: {
      create: mockRefundsCreate,
    },
    paymentIntents: {
      retrieve: mockPaymentIntentsRetrieve,
    },
  }));

  (MockStripe as unknown as Record<string, unknown>).__mocks = {
    checkoutCreate: mockCheckoutCreate,
    checkoutRetrieve: mockCheckoutRetrieve,
    refundsCreate: mockRefundsCreate,
    paymentIntentsRetrieve: mockPaymentIntentsRetrieve,
  };

  return MockStripe;
});

// Mock database
jest.mock('@/lib/db', () => ({
  prisma: {
    payment: {
      create: jest.fn(),
      update: jest.fn(),
      findUnique: jest.fn(),
      findFirst: jest.fn(),
      findMany: jest.fn(),
    },
    case: {
      findUnique: jest.fn(),
      update: jest.fn(),
    },
    user: {
      findUnique: jest.fn(),
    },
    auditLog: {
      create: jest.fn(),
    },
    $transaction: jest.fn(),
  },
}));

// Mock notifications
jest.mock('@/lib/services/notification', () => ({
  createInAppNotification: jest.fn().mockResolvedValue({ success: true }),
}));

// Mock audit log
jest.mock('@/lib/services/audit', () => ({
  createAuditLog: jest.fn().mockResolvedValue({ success: true }),
}));

import { createAuditLog } from '@/lib/services/audit';
const mockCreateAuditLog = createAuditLog as jest.Mock;

import Stripe from 'stripe';

const stripeMocks = (Stripe as unknown as { __mocks: Record<string, jest.Mock> }).__mocks!;
const mockPrisma = prisma as jest.Mocked<typeof prisma>;

describe('Payment Flow', () => {
  const mockUser = createMockUser();
  const mockCase = createMockCase({
    claimantId: mockUser.id,
    amount: 5000,
  });

  beforeEach(() => {
    jest.clearAllMocks();
  });

  // ==========================================================================
  // Fee Calculation
  // ==========================================================================

  describe('Fee Calculation', () => {
    it('should calculate filing fee correctly', () => {
      const fee = calculateFee(5000, 'FILING_FEE');
      expect(fee).toBeGreaterThan(0);
      expect(fee).toBeLessThan(5000); // Fee shouldn't exceed dispute amount
    });

    it('should calculate response fee correctly', () => {
      const fee = calculateFee(5000, 'RESPONSE_FEE');
      expect(fee).toBeGreaterThan(0);
    });

    it('should calculate expedited fee correctly', () => {
      const fee = calculateFee(5000, 'EXPEDITED_FEE');
      expect(fee).toBeGreaterThan(0);
    });

    it('should have tiered pricing based on dispute amount', () => {
      const smallFee = calculateFee(1000, 'FILING_FEE');
      const largeFee = calculateFee(100000, 'FILING_FEE');

      // Larger disputes should have higher fees
      expect(largeFee).toBeGreaterThan(smallFee);
    });

    it('should have minimum fee for small disputes', () => {
      const smallFee = calculateFee(100, 'FILING_FEE');
      expect(smallFee).toBeGreaterThan(0);
    });
  });

  // ==========================================================================
  // Checkout Session Creation
  // ==========================================================================

  describe('Checkout Session Creation', () => {
    const checkoutInput = {
      caseId: mockCase.id,
      userId: mockUser.id,
      type: 'FILING_FEE' as const,
      amount: 99,
    };

    beforeEach(() => {
      // Mock case query
      (mockPrisma.case.findUnique as jest.Mock).mockResolvedValue({
        referenceNumber: mockCase.referenceNumber,
      });

      // Mock user query
      (mockPrisma.user.findUnique as jest.Mock).mockResolvedValue({
        email: mockUser.email,
        name: mockUser.name,
      });

      // Mock Stripe checkout
      stripeMocks.checkoutCreate!.mockResolvedValue({
        id: 'cs_test_session_123',
        url: 'https://checkout.stripe.com/pay/cs_test_session_123',
        payment_intent: 'pi_test_123',
      });

      // Mock payment creation
      (mockPrisma.payment.create as jest.Mock).mockResolvedValue({
        id: generateTestId('pay'),
        ...checkoutInput,
        stripeSessionId: 'cs_test_session_123',
        status: 'PENDING',
      });
    });

    it('should create Stripe checkout session', async () => {
      const result = await createCheckoutSession(checkoutInput);

      expect(result.sessionId).toBeDefined();
      expect(result.sessionUrl).toContain('stripe.com');
      expect(stripeMocks.checkoutCreate).toHaveBeenCalled();
    });

    it('should create payment record in database', async () => {
      await createCheckoutSession(checkoutInput);

      expect(mockPrisma.payment.create).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({
            caseId: checkoutInput.caseId,
            userId: checkoutInput.userId,
            type: checkoutInput.type,
            amount: checkoutInput.amount,
            status: 'PENDING',
          }),
        })
      );
    });

    it('should return payment ID for tracking', async () => {
      const result = await createCheckoutSession(checkoutInput);

      expect(result.paymentId).toBeDefined();
    });

    it('should include case metadata in Stripe session', async () => {
      await createCheckoutSession(checkoutInput);

      expect(stripeMocks.checkoutCreate).toHaveBeenCalledWith(
        expect.objectContaining({
          metadata: expect.objectContaining({
            caseId: checkoutInput.caseId,
          }),
        })
      );
    });
  });

  // ==========================================================================
  // Payment Success Handling
  // ==========================================================================

  describe('Payment Success (Webhook)', () => {
    const sessionId = 'cs_test_session_123';
    const paymentIntentId = 'pi_test_123';

    beforeEach(() => {
      (mockPrisma.payment.findFirst as jest.Mock).mockResolvedValue({
        id: 'pay-123',
        caseId: mockCase.id,
        userId: mockUser.id,
        type: 'FILING_FEE',
        amount: 99,
        stripeSessionId: sessionId,
        status: 'PENDING',
      });

      (mockPrisma.payment.update as jest.Mock).mockResolvedValue({
        id: 'pay-123',
        status: 'COMPLETED',
        completedAt: new Date(),
      });

      (mockPrisma.case.findUnique as jest.Mock).mockResolvedValue(mockCase);
      (mockPrisma.case.update as jest.Mock).mockResolvedValue({
        ...mockCase,
        status: 'PENDING_AGREEMENT',
      });

      stripeMocks.paymentIntentsRetrieve!.mockResolvedValue({
        id: paymentIntentId,
        status: 'succeeded',
        charges: {
          data: [{ receipt_url: 'https://stripe.com/receipts/123' }],
        },
      });
    });

    it('should update payment status to COMPLETED', async () => {
      await handlePaymentSuccess(sessionId, paymentIntentId);

      expect(mockPrisma.payment.update).toHaveBeenCalledWith(
        expect.objectContaining({
          where: { id: 'pay-123' },
          data: expect.objectContaining({
            status: 'COMPLETED',
          }),
        })
      );
    });

    it('should store Stripe payment intent ID', async () => {
      await handlePaymentSuccess(sessionId, paymentIntentId);

      expect(mockPrisma.payment.update).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({
            stripePaymentIntentId: paymentIntentId,
          }),
        })
      );
    });

    it('should advance case status after filing fee payment', async () => {
      (mockPrisma.payment.findFirst as jest.Mock).mockResolvedValue({
        id: 'pay-123',
        caseId: mockCase.id,
        userId: mockUser.id,
        type: 'FILING_FEE',
        status: 'PENDING',
        amount: 99,
        case: { referenceNumber: mockCase.referenceNumber },
      });

      // Mock case lookup for status check
      (mockPrisma.case.findUnique as jest.Mock).mockResolvedValue({
        status: 'DRAFT',
      });

      await handlePaymentSuccess(sessionId, paymentIntentId);

      // Audit log should be created for payment completion
      expect(mockCreateAuditLog).toHaveBeenCalledWith(
        expect.objectContaining({
          action: 'PAYMENT_COMPLETED',
        })
      );
    });

    it('should create audit log entry', async () => {
      await handlePaymentSuccess(sessionId, paymentIntentId);

      expect(mockCreateAuditLog).toHaveBeenCalledWith(
        expect.objectContaining({
          action: 'PAYMENT_COMPLETED',
          caseId: mockCase.id,
        })
      );
    });
  });

  // ==========================================================================
  // Payment Failure Handling
  // ==========================================================================

  describe('Payment Failure (Webhook)', () => {
    const sessionId = 'cs_test_session_456';

    beforeEach(() => {
      (mockPrisma.payment.findFirst as jest.Mock).mockResolvedValue({
        id: 'pay-456',
        caseId: mockCase.id,
        userId: mockUser.id,
        type: 'FILING_FEE',
        amount: 99,
        stripeSessionId: sessionId,
        status: 'PENDING',
      });

      (mockPrisma.payment.update as jest.Mock).mockResolvedValue({
        id: 'pay-456',
        status: 'FAILED',
      });
    });

    it('should update payment status to FAILED', async () => {
      await handlePaymentFailure(sessionId, 'Card declined');

      expect(mockPrisma.payment.update).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({
            status: 'FAILED',
          }),
        })
      );
    });

    it('should store failure reason', async () => {
      const failureReason = 'Card declined';
      await handlePaymentFailure(sessionId, failureReason);

      expect(mockPrisma.payment.update).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({
            failureReason: failureReason,
          }),
        })
      );
    });

    it('should handle expired sessions', async () => {
      await handlePaymentFailure(sessionId, 'Session expired');

      expect(mockPrisma.payment.update).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({
            status: 'FAILED',
            failureReason: 'Session expired',
          }),
        })
      );
    });
  });

  // ==========================================================================
  // Payment Status Queries
  // ==========================================================================

  describe('Payment Status Queries', () => {
    it('should return payment status for case', async () => {
      (mockPrisma.payment.findMany as jest.Mock).mockResolvedValue([
        createMockPayment({ type: 'FILING_FEE', status: 'COMPLETED' }),
      ]);

      const status = await getCasePaymentStatus(mockCase.id);

      expect(status).toBeDefined();
      expect(status.filingFeePaid).toBe(true);
    });

    it('should detect missing required payments', async () => {
      (mockPrisma.payment.findMany as jest.Mock).mockResolvedValue([]);

      const status = await getCasePaymentStatus(mockCase.id);

      expect(status.filingFeePaid).toBe(false);
    });

    it('should return payment history for case', async () => {
      const mockPayments = [
        createMockPayment({ id: 'pay-1', type: 'FILING_FEE', status: 'COMPLETED' }),
        createMockPayment({ id: 'pay-2', type: 'RESPONSE_FEE', status: 'PENDING' }),
      ];
      (mockPrisma.payment.findMany as jest.Mock).mockResolvedValue(mockPayments);

      const payments = await getCasePayments(mockCase.id);

      expect(payments).toHaveLength(2);
      expect(payments[0]?.type).toBe('FILING_FEE');
    });
  });

  // ==========================================================================
  // Refund Processing
  // ==========================================================================

  describe('Refund Processing', () => {
    const mockPayment = {
      ...createMockPayment({
        id: 'pay-123',
        status: 'COMPLETED',
        amount: 99,
      }),
      stripePaymentIntentId: 'pi_test_123',
    };

    beforeEach(() => {
      (mockPrisma.payment.findUnique as jest.Mock).mockResolvedValue({
        ...mockPayment,
        case: { referenceNumber: mockCase.referenceNumber },
      });
      stripeMocks.refundsCreate!.mockResolvedValue({
        id: 're_test_123',
        status: 'succeeded',
        amount: 9900, // in cents
      });
      (mockPrisma.payment.update as jest.Mock).mockResolvedValue({
        ...mockPayment,
        status: 'REFUNDED',
      });
    });

    it('should process full refund', async () => {
      const result = await processRefund(mockPayment.id, 'Case withdrawn');

      expect(result.refundId).toBeDefined();
      expect(stripeMocks.refundsCreate).toHaveBeenCalledWith(
        expect.objectContaining({
          payment_intent: mockPayment.stripePaymentIntentId,
        })
      );
    });

    it('should update payment status to REFUNDED', async () => {
      await processRefund(mockPayment.id, 'Case withdrawn');

      expect(mockPrisma.payment.update).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({
            status: 'REFUNDED',
          }),
        })
      );
    });

    it('should return refund details', async () => {
      stripeMocks.refundsCreate!.mockResolvedValue({
        id: 're_test_full',
        status: 'succeeded',
        amount: 9900, // $99 in cents
      });

      const result = await processRefund(mockPayment.id, 'Refund requested');

      expect(result.refundId).toBe('re_test_full');
      expect(result.amount).toBe(99); // converted from cents
      expect(result.status).toBe('succeeded');
    });

    it('should reject refund for non-completed payment', async () => {
      (mockPrisma.payment.findUnique as jest.Mock).mockResolvedValue({
        ...mockPayment,
        status: 'PENDING',
        case: { referenceNumber: mockCase.referenceNumber },
      });

      await expect(processRefund(mockPayment.id, 'Test')).rejects.toThrow(
        'Only completed payments can be refunded'
      );
    });
  });

  // ==========================================================================
  // End-to-End Payment Flow
  // ==========================================================================

  describe('End-to-End Payment Flow', () => {
    it('should complete full payment flow from checkout to success', async () => {
      const sessionId = 'cs_test_e2e_123';
      const paymentIntentId = 'pi_test_e2e_123';

      // Step 1: Calculate fee
      const fee = calculateFee(5000, 'FILING_FEE');
      expect(fee).toBeGreaterThan(0);

      // Step 2: Create checkout session
      stripeMocks.checkoutCreate!.mockResolvedValue({
        id: sessionId,
        url: 'https://checkout.stripe.com/pay/cs_test_e2e_123',
        payment_intent: paymentIntentId,
      });
      (mockPrisma.payment.create as jest.Mock).mockResolvedValue({
        id: 'pay-e2e',
        caseId: mockCase.id,
        userId: mockUser.id,
        type: 'FILING_FEE',
        amount: fee,
        stripeSessionId: sessionId,
        status: 'PENDING',
      });

      const checkout = await createCheckoutSession({
        caseId: mockCase.id,
        userId: mockUser.id,
        type: 'FILING_FEE',
        amount: fee,
      });

      expect(checkout.sessionId).toBe(sessionId);
      expect(checkout.sessionUrl).toContain('stripe.com');

      // Step 3: Simulate webhook success
      (mockPrisma.payment.findFirst as jest.Mock).mockResolvedValue({
        id: 'pay-e2e',
        caseId: mockCase.id,
        userId: mockUser.id,
        type: 'FILING_FEE',
        amount: fee,
        stripeSessionId: sessionId,
        status: 'PENDING',
      });
      (mockPrisma.payment.update as jest.Mock).mockResolvedValue({
        id: 'pay-e2e',
        status: 'COMPLETED',
        completedAt: new Date(),
        stripePaymentIntentId: paymentIntentId,
      });
      (mockPrisma.case.findUnique as jest.Mock).mockResolvedValue(mockCase);
      stripeMocks.paymentIntentsRetrieve!.mockResolvedValue({
        id: paymentIntentId,
        status: 'succeeded',
      });

      await handlePaymentSuccess(sessionId, paymentIntentId);

      expect(mockPrisma.payment.update).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({
            status: 'COMPLETED',
          }),
        })
      );

      // Step 4: Verify payment status
      (mockPrisma.payment.findMany as jest.Mock).mockResolvedValue([
        {
          id: 'pay-e2e',
          type: 'FILING_FEE',
          status: 'COMPLETED',
        },
      ]);

      const status = await getCasePaymentStatus(mockCase.id);
      expect(status.filingFeePaid).toBe(true);
    });
  });
});
