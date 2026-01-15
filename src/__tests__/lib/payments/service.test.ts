/**
 * Payment Service Tests
 *
 * Tests for payment processing, checkout sessions, and refunds.
 */

import { prisma } from '@/lib/db';
import { createAuditLog } from '@/lib/services/audit';
import {
  FEE_STRUCTURE,
  calculateFee,
  createCheckoutSession,
  getCheckoutSessionStatus,
  handlePaymentSuccess,
  handlePaymentFailure,
  processRefund,
  getReceiptUrl,
  generateReceiptData,
  getPayment,
  getCasePayments,
  getCasePaymentStatus,
  hasRequiredPayments,
} from '@/lib/payments/service';

// Mock dependencies
jest.mock('@/lib/db', () => ({
  prisma: {
    case: {
      findUnique: jest.fn(),
      update: jest.fn(),
    },
    user: {
      findUnique: jest.fn(),
    },
    payment: {
      findUnique: jest.fn(),
      findFirst: jest.fn(),
      findMany: jest.fn(),
      create: jest.fn(),
      update: jest.fn(),
    },
  },
}));

jest.mock('@/lib/services/audit', () => ({
  createAuditLog: jest.fn(),
}));

// Mock Stripe - need to define inline for hoisting
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

  // Expose mocks for test access
  (MockStripe as unknown as Record<string, unknown>).__mocks = {
    checkoutCreate: mockCheckoutCreate,
    checkoutRetrieve: mockCheckoutRetrieve,
    refundsCreate: mockRefundsCreate,
    paymentIntentsRetrieve: mockPaymentIntentsRetrieve,
  };

  return MockStripe;
});

// Access the mocks
import Stripe from 'stripe';
const stripeMocks = (Stripe as unknown as { __mocks: Record<string, jest.Mock> }).__mocks!;

const mockPrisma = prisma as jest.Mocked<typeof prisma>;
const mockCreateAuditLog = createAuditLog as jest.Mock;

describe('Payment Service', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  // ==========================================================================
  // Fee Structure & Calculation
  // ==========================================================================

  describe('FEE_STRUCTURE', () => {
    it('should define filing fee tiers', () => {
      expect(FEE_STRUCTURE.FILING_FEE.tiers).toBeDefined();
      expect(FEE_STRUCTURE.FILING_FEE.tiers.length).toBeGreaterThan(0);
    });

    it('should define response fee tiers', () => {
      expect(FEE_STRUCTURE.RESPONSE_FEE.tiers).toBeDefined();
    });

    it('should define expedited fee', () => {
      expect(FEE_STRUCTURE.EXPEDITED_FEE.flat).toBe(199);
    });

    it('should have filing fees higher than response fees', () => {
      const filingTier = FEE_STRUCTURE.FILING_FEE.tiers[0]!;
      const responseTier = FEE_STRUCTURE.RESPONSE_FEE.tiers[0]!;

      expect(filingTier.fee).toBeGreaterThan(responseTier.fee);
    });
  });

  describe('calculateFee', () => {
    describe('FILING_FEE', () => {
      it('should return $49 for claims up to $1000', () => {
        expect(calculateFee(500, 'FILING_FEE')).toBe(49);
        expect(calculateFee(1000, 'FILING_FEE')).toBe(49);
      });

      it('should return $99 for claims $1001-$5000', () => {
        expect(calculateFee(2500, 'FILING_FEE')).toBe(99);
        expect(calculateFee(5000, 'FILING_FEE')).toBe(99);
      });

      it('should return $149 for claims $5001-$10000', () => {
        expect(calculateFee(7500, 'FILING_FEE')).toBe(149);
      });

      it('should return $249 for claims $10001-$25000', () => {
        expect(calculateFee(15000, 'FILING_FEE')).toBe(249);
      });

      it('should return $349 for claims $25001-$50000', () => {
        expect(calculateFee(40000, 'FILING_FEE')).toBe(349);
      });

      it('should return $499 for claims over $50000', () => {
        expect(calculateFee(100000, 'FILING_FEE')).toBe(499);
      });
    });

    describe('RESPONSE_FEE', () => {
      it('should return lower fees than filing fee', () => {
        expect(calculateFee(1000, 'RESPONSE_FEE')).toBe(29);
        expect(calculateFee(5000, 'RESPONSE_FEE')).toBe(49);
        expect(calculateFee(10000, 'RESPONSE_FEE')).toBe(99);
      });
    });

    describe('EXPEDITED_FEE', () => {
      it('should return flat fee regardless of claim amount', () => {
        expect(calculateFee(100, 'EXPEDITED_FEE')).toBe(199);
        expect(calculateFee(100000, 'EXPEDITED_FEE')).toBe(199);
      });
    });

    it('should throw error for invalid payment type', () => {
      expect(() => calculateFee(1000, 'INVALID_TYPE' as 'FILING_FEE')).toThrow(
        'Invalid payment type'
      );
    });
  });

  // ==========================================================================
  // Checkout Session
  // ==========================================================================

  describe('createCheckoutSession', () => {
    const mockInput = {
      caseId: 'case-123',
      userId: 'user-123',
      type: 'FILING_FEE' as const,
      amount: 99,
      description: 'Filing fee for case',
    };

    beforeEach(() => {
      (mockPrisma.case.findUnique as jest.Mock).mockResolvedValue({
        id: 'case-123',
        referenceNumber: 'SR-2026-ABC123',
      });

      (mockPrisma.user.findUnique as jest.Mock).mockResolvedValue({
        id: 'user-123',
        email: 'test@example.com',
        name: 'Test User',
      });

      (mockPrisma.payment.create as jest.Mock).mockResolvedValue({
        id: 'pay-123',
        ...mockInput,
        status: 'PENDING',
      });

      (mockPrisma.payment.update as jest.Mock).mockResolvedValue({});

      stripeMocks.checkoutCreate!.mockResolvedValue({
        id: 'cs_test_123',
        url: 'https://checkout.stripe.com/pay/cs_test_123',
      });
    });

    it('should create a payment record', async () => {
      await createCheckoutSession(mockInput);

      expect(mockPrisma.payment.create).toHaveBeenCalledWith({
        data: expect.objectContaining({
          caseId: mockInput.caseId,
          userId: mockInput.userId,
          type: mockInput.type,
          amount: mockInput.amount,
          currency: 'USD',
          status: 'PENDING',
        }),
      });
    });

    it('should throw error if case not found', async () => {
      (mockPrisma.case.findUnique as jest.Mock).mockResolvedValue(null);

      await expect(createCheckoutSession(mockInput)).rejects.toThrow('Case not found');
    });

    it('should throw error if user not found', async () => {
      (mockPrisma.user.findUnique as jest.Mock).mockResolvedValue(null);

      await expect(createCheckoutSession(mockInput)).rejects.toThrow('User not found');
    });
  });

  describe('getCheckoutSessionStatus', () => {
    it('should return session status', async () => {
      stripeMocks.checkoutRetrieve!.mockResolvedValue({
        status: 'complete',
        payment_status: 'paid',
      });

      const result = await getCheckoutSessionStatus('cs_test_123');

      expect(result).toEqual({
        status: 'complete',
        paymentStatus: 'paid',
      });
    });
  });

  // ==========================================================================
  // Payment Processing
  // ==========================================================================

  describe('handlePaymentSuccess', () => {
    it('should update payment to completed status', async () => {
      const mockPayment = {
        id: 'pay-123',
        caseId: 'case-123',
        userId: 'user-123',
        type: 'RESPONSE_FEE',
        amount: { toNumber: () => 99 },
        case: { referenceNumber: 'SR-2026-ABC123' },
      };

      (mockPrisma.payment.findFirst as jest.Mock).mockResolvedValue(mockPayment);
      (mockPrisma.payment.update as jest.Mock).mockResolvedValue({});

      await handlePaymentSuccess('cs_test_123', 'pi_test_123');

      expect(mockPrisma.payment.update).toHaveBeenCalledWith({
        where: { id: 'pay-123' },
        data: {
          status: 'COMPLETED',
          stripePaymentIntentId: 'pi_test_123',
          paidAt: expect.any(Date),
        },
      });
    });

    it('should create audit log on success', async () => {
      const mockPayment = {
        id: 'pay-123',
        caseId: 'case-123',
        userId: 'user-123',
        type: 'FILING_FEE',
        amount: { toNumber: () => 99 },
        case: { referenceNumber: 'SR-2026-ABC123' },
      };

      (mockPrisma.payment.findFirst as jest.Mock).mockResolvedValue(mockPayment);
      (mockPrisma.payment.update as jest.Mock).mockResolvedValue({});

      await handlePaymentSuccess('cs_test_123', 'pi_test_123');

      expect(mockCreateAuditLog).toHaveBeenCalledWith(
        expect.objectContaining({
          action: 'PAYMENT_COMPLETED',
          caseId: 'case-123',
        })
      );
    });

    it('should update case status for filing fee when case is DRAFT', async () => {
      const mockPayment = {
        id: 'pay-123',
        caseId: 'case-123',
        userId: 'user-123',
        type: 'FILING_FEE',
        amount: { toNumber: () => 99 },
        case: { referenceNumber: 'SR-2026-ABC123' },
      };

      (mockPrisma.payment.findFirst as jest.Mock).mockResolvedValue(mockPayment);
      (mockPrisma.payment.update as jest.Mock).mockResolvedValue({});
      (mockPrisma.case.findUnique as jest.Mock).mockResolvedValue({ status: 'DRAFT' });
      (mockPrisma.case.update as jest.Mock).mockResolvedValue({});

      await handlePaymentSuccess('cs_test_123', 'pi_test_123');

      expect(mockPrisma.case.update).toHaveBeenCalledWith({
        where: { id: 'case-123' },
        data: { status: 'PENDING_RESPONDENT' },
      });
    });

    it('should handle missing payment gracefully', async () => {
      (mockPrisma.payment.findFirst as jest.Mock).mockResolvedValue(null);

      // Should not throw
      await expect(handlePaymentSuccess('cs_test_123', 'pi_test_123')).resolves.toBeUndefined();
    });
  });

  describe('handlePaymentFailure', () => {
    it('should update payment to failed status', async () => {
      const mockPayment = {
        id: 'pay-123',
        caseId: 'case-123',
        userId: 'user-123',
        type: 'FILING_FEE',
      };

      (mockPrisma.payment.findFirst as jest.Mock).mockResolvedValue(mockPayment);
      (mockPrisma.payment.update as jest.Mock).mockResolvedValue({});

      await handlePaymentFailure('cs_test_123', 'Card declined');

      expect(mockPrisma.payment.update).toHaveBeenCalledWith({
        where: { id: 'pay-123' },
        data: {
          status: 'FAILED',
          failedAt: expect.any(Date),
          failureReason: 'Card declined',
        },
      });
    });

    it('should use default failure reason', async () => {
      (mockPrisma.payment.findFirst as jest.Mock).mockResolvedValue({
        id: 'pay-123',
        caseId: 'case-123',
        userId: 'user-123',
      });
      (mockPrisma.payment.update as jest.Mock).mockResolvedValue({});

      await handlePaymentFailure('cs_test_123');

      expect(mockPrisma.payment.update).toHaveBeenCalledWith({
        where: { id: 'pay-123' },
        data: expect.objectContaining({
          failureReason: 'Payment failed',
        }),
      });
    });

    it('should create audit log on failure', async () => {
      (mockPrisma.payment.findFirst as jest.Mock).mockResolvedValue({
        id: 'pay-123',
        caseId: 'case-123',
        userId: 'user-123',
        type: 'FILING_FEE',
      });
      (mockPrisma.payment.update as jest.Mock).mockResolvedValue({});

      await handlePaymentFailure('cs_test_123', 'Insufficient funds');

      expect(mockCreateAuditLog).toHaveBeenCalledWith(
        expect.objectContaining({
          action: 'PAYMENT_FAILED',
          metadata: expect.objectContaining({
            failureReason: 'Insufficient funds',
          }),
        })
      );
    });
  });

  // ==========================================================================
  // Refunds
  // ==========================================================================

  describe('processRefund', () => {
    it('should throw error if payment not found', async () => {
      (mockPrisma.payment.findUnique as jest.Mock).mockResolvedValue(null);

      await expect(processRefund('pay-123')).rejects.toThrow('Payment not found');
    });

    it('should throw error if payment not completed', async () => {
      (mockPrisma.payment.findUnique as jest.Mock).mockResolvedValue({
        id: 'pay-123',
        status: 'PENDING',
      });

      await expect(processRefund('pay-123')).rejects.toThrow(
        'Only completed payments can be refunded'
      );
    });

    it('should throw error if no stripe payment intent', async () => {
      (mockPrisma.payment.findUnique as jest.Mock).mockResolvedValue({
        id: 'pay-123',
        status: 'COMPLETED',
        stripePaymentIntentId: null,
      });

      await expect(processRefund('pay-123')).rejects.toThrow(
        'No Stripe payment intent found for this payment'
      );
    });

    it('should create refund and update payment status', async () => {
      const mockPayment = {
        id: 'pay-123',
        caseId: 'case-123',
        userId: 'user-123',
        status: 'COMPLETED',
        stripePaymentIntentId: 'pi_test_123',
        amount: { toNumber: () => 99 },
        case: { referenceNumber: 'SR-2026-ABC123' },
      };

      (mockPrisma.payment.findUnique as jest.Mock).mockResolvedValue(mockPayment);
      (mockPrisma.payment.update as jest.Mock).mockResolvedValue({});
      stripeMocks.refundsCreate!.mockResolvedValue({
        id: 're_test_123',
        amount: 9900,
        status: 'succeeded',
      });

      const result = await processRefund('pay-123', 'Customer requested');

      expect(result).toEqual({
        refundId: 're_test_123',
        amount: 99,
        status: 'succeeded',
      });

      expect(mockPrisma.payment.update).toHaveBeenCalledWith({
        where: { id: 'pay-123' },
        data: {
          status: 'REFUNDED',
          refundedAt: expect.any(Date),
        },
      });
    });

    it('should create audit log for refund', async () => {
      const mockPayment = {
        id: 'pay-123',
        caseId: 'case-123',
        userId: 'user-123',
        status: 'COMPLETED',
        stripePaymentIntentId: 'pi_test_123',
        amount: { toNumber: () => 99 },
        case: { referenceNumber: 'SR-2026-ABC123' },
      };

      (mockPrisma.payment.findUnique as jest.Mock).mockResolvedValue(mockPayment);
      (mockPrisma.payment.update as jest.Mock).mockResolvedValue({});
      stripeMocks.refundsCreate!.mockResolvedValue({
        id: 're_test_123',
        amount: 9900,
        status: 'succeeded',
      });

      await processRefund('pay-123', 'Duplicate payment', 'admin-123');

      expect(mockCreateAuditLog).toHaveBeenCalledWith(
        expect.objectContaining({
          userId: 'admin-123',
          action: 'REFUND_ISSUED',
        })
      );
    });
  });

  // ==========================================================================
  // Receipt
  // ==========================================================================

  describe('getReceiptUrl', () => {
    it('should return null if payment not found', async () => {
      (mockPrisma.payment.findUnique as jest.Mock).mockResolvedValue(null);

      const result = await getReceiptUrl('pay-123');

      expect(result).toBeNull();
    });

    it('should return null if no payment intent', async () => {
      (mockPrisma.payment.findUnique as jest.Mock).mockResolvedValue({
        id: 'pay-123',
        stripePaymentIntentId: null,
      });

      const result = await getReceiptUrl('pay-123');

      expect(result).toBeNull();
    });
  });

  describe('generateReceiptData', () => {
    it('should return null if payment not found', async () => {
      (mockPrisma.payment.findUnique as jest.Mock).mockResolvedValue(null);

      const result = await generateReceiptData('pay-123');

      expect(result).toBeNull();
    });

    it('should return null if user not found', async () => {
      (mockPrisma.payment.findUnique as jest.Mock).mockResolvedValue({
        id: 'pay-123',
        userId: 'user-123',
        case: { referenceNumber: 'SR-2026-ABC123', description: 'Test' },
      });
      (mockPrisma.user.findUnique as jest.Mock).mockResolvedValue(null);

      const result = await generateReceiptData('pay-123');

      expect(result).toBeNull();
    });
  });

  // ==========================================================================
  // Payment Queries
  // ==========================================================================

  describe('getPayment', () => {
    it('should return null if payment not found', async () => {
      (mockPrisma.payment.findUnique as jest.Mock).mockResolvedValue(null);

      const result = await getPayment('pay-123');

      expect(result).toBeNull();
    });

    it('should return payment details', async () => {
      const mockPayment = {
        id: 'pay-123',
        caseId: 'case-123',
        userId: 'user-123',
        type: 'FILING_FEE',
        status: 'PENDING',
        amount: 99, // Prisma returns Decimal but Number() converts it
        currency: 'USD',
        stripePaymentIntentId: null,
        stripeSessionId: 'cs_test_123',
        createdAt: new Date(),
        paidAt: null,
        failedAt: null,
        refundedAt: null,
        failureReason: null,
      };

      (mockPrisma.payment.findUnique as jest.Mock).mockResolvedValue(mockPayment);

      const result = await getPayment('pay-123');

      expect(result).not.toBeNull();
      expect(result?.id).toBe('pay-123');
      expect(result?.amount).toBe(99);
    });
  });

  describe('getCasePayments', () => {
    it('should return all payments for a case', async () => {
      const mockPayments = [
        {
          id: 'pay-1',
          caseId: 'case-123',
          type: 'FILING_FEE',
          status: 'COMPLETED',
          amount: { toNumber: () => 99 },
          currency: 'USD',
        },
        {
          id: 'pay-2',
          caseId: 'case-123',
          type: 'RESPONSE_FEE',
          status: 'PENDING',
          amount: { toNumber: () => 49 },
          currency: 'USD',
        },
      ];

      (mockPrisma.payment.findMany as jest.Mock).mockResolvedValue(mockPayments);

      const result = await getCasePayments('case-123');

      expect(result).toHaveLength(2);
      expect(mockPrisma.payment.findMany).toHaveBeenCalledWith({
        where: { caseId: 'case-123' },
        orderBy: { createdAt: 'desc' },
      });
    });
  });

  describe('getCasePaymentStatus', () => {
    it('should return payment status summary', async () => {
      const mockPayments = [
        { id: 'p1', type: 'FILING_FEE', status: 'COMPLETED', amount: 99 },
        { id: 'p2', type: 'RESPONSE_FEE', status: 'PENDING', amount: 49 },
      ];

      (mockPrisma.payment.findMany as jest.Mock).mockResolvedValue(mockPayments);

      const result = await getCasePaymentStatus('case-123');

      expect(result).toEqual({
        filingFeePaid: true,
        responseFeePaid: false,
        totalPaid: 99,
        pendingAmount: 49,
      });
    });

    it('should handle no payments', async () => {
      (mockPrisma.payment.findMany as jest.Mock).mockResolvedValue([]);

      const result = await getCasePaymentStatus('case-123');

      expect(result).toEqual({
        filingFeePaid: false,
        responseFeePaid: false,
        totalPaid: 0,
        pendingAmount: 0,
      });
    });
  });

  describe('hasRequiredPayments', () => {
    it('should return true if all required payments are completed', async () => {
      const mockPayments = [
        { id: 'p1', type: 'FILING_FEE', status: 'COMPLETED' },
        { id: 'p2', type: 'RESPONSE_FEE', status: 'COMPLETED' },
      ];

      (mockPrisma.payment.findMany as jest.Mock).mockResolvedValue(mockPayments);

      const result = await hasRequiredPayments('case-123', ['FILING_FEE', 'RESPONSE_FEE']);

      expect(result).toBe(true);
    });

    it('should return false if some required payments are missing', async () => {
      const mockPayments = [{ id: 'p1', type: 'FILING_FEE', status: 'COMPLETED' }];

      (mockPrisma.payment.findMany as jest.Mock).mockResolvedValue(mockPayments);

      const result = await hasRequiredPayments('case-123', ['FILING_FEE', 'RESPONSE_FEE']);

      expect(result).toBe(false);
    });

    it('should return true if no payments required', async () => {
      (mockPrisma.payment.findMany as jest.Mock).mockResolvedValue([]);

      const result = await hasRequiredPayments('case-123', []);

      expect(result).toBe(true);
    });
  });
});
