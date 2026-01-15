/**
 * KYC Service Tests
 *
 * Tests for identity verification functionality.
 */

import { prisma } from '@/lib/db';
import { isVerificationValid } from '@/lib/services/stripe-identity';
import { ForbiddenError } from '@/lib/api/errors';
import { checkKYCStatus, requireKYC, canParticipateInCase, bothPartiesVerified } from '@/lib/kyc';

// Mock dependencies
jest.mock('@/lib/db', () => ({
  prisma: {
    identityVerification: {
      findUnique: jest.fn(),
      update: jest.fn(),
    },
  },
}));

jest.mock('@/lib/services/stripe-identity', () => ({
  isVerificationValid: jest.fn(),
}));

const mockPrisma = prisma as jest.Mocked<typeof prisma>;
const mockIsVerificationValid = isVerificationValid as jest.Mock;

describe('KYC Service', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  // ==========================================================================
  // checkKYCStatus
  // ==========================================================================

  describe('checkKYCStatus', () => {
    it('should return NOT_STARTED when no verification exists', async () => {
      (mockPrisma.identityVerification.findUnique as jest.Mock).mockResolvedValue(null);

      const result = await checkKYCStatus('user-123');

      expect(result.isVerified).toBe(false);
      expect(result.status).toBe('NOT_STARTED');
      expect(result.requiresAction).toBe(true);
      expect(result.message).toContain('not been started');
    });

    it('should return VERIFIED for verified user', async () => {
      const futureDate = new Date(Date.now() + 365 * 24 * 60 * 60 * 1000);
      (mockPrisma.identityVerification.findUnique as jest.Mock).mockResolvedValue({
        status: 'VERIFIED',
        expiresAt: futureDate,
        verifiedAt: new Date(),
      });

      const result = await checkKYCStatus('user-123');

      expect(result.isVerified).toBe(true);
      expect(result.status).toBe('VERIFIED');
      expect(result.requiresAction).toBe(false);
      expect(result.message).toBe('Identity is verified');
    });

    it('should return PENDING for in-progress verification', async () => {
      (mockPrisma.identityVerification.findUnique as jest.Mock).mockResolvedValue({
        status: 'PENDING',
        expiresAt: null,
        verifiedAt: null,
      });

      const result = await checkKYCStatus('user-123');

      expect(result.isVerified).toBe(false);
      expect(result.status).toBe('PENDING');
      expect(result.requiresAction).toBe(false);
      expect(result.message).toContain('in progress');
    });

    it('should return FAILED for failed verification', async () => {
      (mockPrisma.identityVerification.findUnique as jest.Mock).mockResolvedValue({
        status: 'FAILED',
        expiresAt: null,
        verifiedAt: null,
      });

      const result = await checkKYCStatus('user-123');

      expect(result.isVerified).toBe(false);
      expect(result.status).toBe('FAILED');
      expect(result.requiresAction).toBe(true);
      expect(result.message).toContain('failed');
    });

    it('should return EXPIRED and update status for expired verification', async () => {
      const pastDate = new Date(Date.now() - 24 * 60 * 60 * 1000); // Yesterday
      (mockPrisma.identityVerification.findUnique as jest.Mock).mockResolvedValue({
        status: 'VERIFIED',
        expiresAt: pastDate,
        verifiedAt: new Date(Date.now() - 365 * 24 * 60 * 60 * 1000),
      });

      const result = await checkKYCStatus('user-123');

      expect(result.isVerified).toBe(false);
      expect(result.status).toBe('EXPIRED');
      expect(result.requiresAction).toBe(true);
      expect(mockPrisma.identityVerification.update).toHaveBeenCalledWith({
        where: { userId: 'user-123' },
        data: { status: 'EXPIRED' },
      });
    });

    it('should return EXPIRED status without update if already expired', async () => {
      (mockPrisma.identityVerification.findUnique as jest.Mock).mockResolvedValue({
        status: 'EXPIRED',
        expiresAt: new Date(Date.now() - 24 * 60 * 60 * 1000),
        verifiedAt: null,
      });

      const result = await checkKYCStatus('user-123');

      expect(result.isVerified).toBe(false);
      expect(result.status).toBe('EXPIRED');
      expect(result.requiresAction).toBe(true);
      // Should not call update since status is already EXPIRED
      expect(mockPrisma.identityVerification.update).not.toHaveBeenCalled();
    });

    it('should handle unknown status', async () => {
      (mockPrisma.identityVerification.findUnique as jest.Mock).mockResolvedValue({
        status: 'UNKNOWN_STATUS' as never,
        expiresAt: null,
        verifiedAt: null,
      });

      const result = await checkKYCStatus('user-123');

      expect(result.isVerified).toBe(false);
      expect(result.status).toBe('NOT_STARTED');
      expect(result.requiresAction).toBe(true);
    });
  });

  // ==========================================================================
  // requireKYC
  // ==========================================================================

  describe('requireKYC', () => {
    it('should not throw for verified user', async () => {
      mockIsVerificationValid.mockResolvedValue(true);

      await expect(requireKYC('user-123')).resolves.not.toThrow();
    });

    it('should throw ForbiddenError for unverified user', async () => {
      mockIsVerificationValid.mockResolvedValue(false);

      await expect(requireKYC('user-123')).rejects.toThrow(ForbiddenError);
      await expect(requireKYC('user-123')).rejects.toThrow(/Identity verification required/);
    });
  });

  // ==========================================================================
  // canParticipateInCase
  // ==========================================================================

  describe('canParticipateInCase', () => {
    it('should allow participation for verified user', async () => {
      const futureDate = new Date(Date.now() + 365 * 24 * 60 * 60 * 1000);
      (mockPrisma.identityVerification.findUnique as jest.Mock).mockResolvedValue({
        status: 'VERIFIED',
        expiresAt: futureDate,
        verifiedAt: new Date(),
      });

      const result = await canParticipateInCase('user-123');

      expect(result.canParticipate).toBe(true);
      expect(result.reason).toBeUndefined();
    });

    it('should deny participation for unverified user', async () => {
      (mockPrisma.identityVerification.findUnique as jest.Mock).mockResolvedValue(null);

      const result = await canParticipateInCase('user-123');

      expect(result.canParticipate).toBe(false);
      expect(result.reason).toBeDefined();
      expect(result.reason).toContain('not been started');
    });

    it('should deny participation for failed verification', async () => {
      (mockPrisma.identityVerification.findUnique as jest.Mock).mockResolvedValue({
        status: 'FAILED',
        expiresAt: null,
        verifiedAt: null,
      });

      const result = await canParticipateInCase('user-123');

      expect(result.canParticipate).toBe(false);
      expect(result.reason).toContain('failed');
    });
  });

  // ==========================================================================
  // bothPartiesVerified
  // ==========================================================================

  describe('bothPartiesVerified', () => {
    it('should return true when both parties are verified', async () => {
      const futureDate = new Date(Date.now() + 365 * 24 * 60 * 60 * 1000);
      (mockPrisma.identityVerification.findUnique as jest.Mock).mockResolvedValue({
        status: 'VERIFIED',
        expiresAt: futureDate,
        verifiedAt: new Date(),
      });

      const result = await bothPartiesVerified('claimant-123', 'respondent-456');

      expect(result.bothVerified).toBe(true);
      expect(result.claimantVerified).toBe(true);
      expect(result.respondentVerified).toBe(true);
    });

    it('should return false when claimant is not verified', async () => {
      const futureDate = new Date(Date.now() + 365 * 24 * 60 * 60 * 1000);
      (mockPrisma.identityVerification.findUnique as jest.Mock)
        .mockResolvedValueOnce(null) // Claimant not verified
        .mockResolvedValueOnce({
          status: 'VERIFIED',
          expiresAt: futureDate,
          verifiedAt: new Date(),
        });

      const result = await bothPartiesVerified('claimant-123', 'respondent-456');

      expect(result.bothVerified).toBe(false);
      expect(result.claimantVerified).toBe(false);
      expect(result.respondentVerified).toBe(true);
    });

    it('should return false when respondent is not verified', async () => {
      const futureDate = new Date(Date.now() + 365 * 24 * 60 * 60 * 1000);
      (mockPrisma.identityVerification.findUnique as jest.Mock)
        .mockResolvedValueOnce({
          status: 'VERIFIED',
          expiresAt: futureDate,
          verifiedAt: new Date(),
        })
        .mockResolvedValueOnce(null); // Respondent not verified

      const result = await bothPartiesVerified('claimant-123', 'respondent-456');

      expect(result.bothVerified).toBe(false);
      expect(result.claimantVerified).toBe(true);
      expect(result.respondentVerified).toBe(false);
    });

    it('should handle null respondent', async () => {
      const futureDate = new Date(Date.now() + 365 * 24 * 60 * 60 * 1000);
      (mockPrisma.identityVerification.findUnique as jest.Mock).mockResolvedValue({
        status: 'VERIFIED',
        expiresAt: futureDate,
        verifiedAt: new Date(),
      });

      const result = await bothPartiesVerified('claimant-123', null);

      expect(result.bothVerified).toBe(false);
      expect(result.claimantVerified).toBe(true);
      expect(result.respondentVerified).toBe(false);
    });

    it('should return false when neither party is verified', async () => {
      (mockPrisma.identityVerification.findUnique as jest.Mock).mockResolvedValue(null);

      const result = await bothPartiesVerified('claimant-123', 'respondent-456');

      expect(result.bothVerified).toBe(false);
      expect(result.claimantVerified).toBe(false);
      expect(result.respondentVerified).toBe(false);
    });
  });
});
