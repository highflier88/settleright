/**
 * Arbitrator Management Tests
 *
 * Tests for arbitrator lifecycle including:
 * - Onboarding flow
 * - Credential verification
 * - Compensation calculation
 */

// Mock dependencies
jest.mock('@/lib/db', () => ({
  prisma: {
    arbitratorProfile: {
      findUnique: jest.fn(),
      findMany: jest.fn(),
      create: jest.fn(),
      update: jest.fn(),
      updateMany: jest.fn(),
    },
    arbitratorCompensation: {
      findUnique: jest.fn(),
      findMany: jest.fn(),
      create: jest.fn(),
      update: jest.fn(),
    },
    case: {
      findUnique: jest.fn(),
    },
    user: {
      findUnique: jest.fn(),
    },
  },
}));

import { Decimal } from '@prisma/client/runtime/library';

import {
  calculateCompensation,
  approveCompensation,
  getEarningsSummary,
} from '@/lib/arbitrator/compensation';
import {
  submitCredentials,
  verifyCredentials,
  areCredentialsValid,
  getBarVerificationUrl,
  expireCredentials,
} from '@/lib/arbitrator/credentials';
import {
  initializeOnboarding,
  completeOnboarding,
  getOnboardingProgress,
  getAvailableJurisdictions,
  getAvailableSpecialties,
} from '@/lib/arbitrator/onboarding';
import { prisma } from '@/lib/db';

const mockPrisma = prisma as jest.Mocked<typeof prisma>;

describe('Arbitrator Onboarding', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  describe('initializeOnboarding', () => {
    it('should return existing profile if one exists', async () => {
      (mockPrisma.arbitratorProfile.findUnique as jest.Mock).mockResolvedValue({
        id: 'profile-1',
        userId: 'user-1',
        onboardingStatus: 'IN_PROGRESS',
      });

      const result = await initializeOnboarding('user-1');

      expect(result.profileId).toBe('profile-1');
      expect(result.status).toBe('IN_PROGRESS');
      expect(mockPrisma.arbitratorProfile.create).not.toHaveBeenCalled();
    });

    it('should create new profile if none exists', async () => {
      (mockPrisma.arbitratorProfile.findUnique as jest.Mock).mockResolvedValue(null);
      (mockPrisma.arbitratorProfile.create as jest.Mock).mockResolvedValue({
        id: 'new-profile',
        userId: 'user-1',
        onboardingStatus: 'NOT_STARTED',
      });

      const result = await initializeOnboarding('user-1');

      expect(result.profileId).toBe('new-profile');
      expect(result.status).toBe('NOT_STARTED');
      expect(mockPrisma.arbitratorProfile.create).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({
            userId: 'user-1',
            onboardingStatus: 'NOT_STARTED',
            isActive: false,
          }),
        })
      );
    });
  });

  describe('completeOnboarding', () => {
    it('should complete onboarding with valid data', async () => {
      (mockPrisma.arbitratorProfile.findUnique as jest.Mock).mockResolvedValue({
        id: 'profile-1',
        userId: 'user-1',
      });
      (mockPrisma.arbitratorProfile.update as jest.Mock).mockResolvedValue({
        id: 'profile-1',
        onboardingStatus: 'COMPLETED',
        credentialStatus: 'PENDING',
      });

      const result = await completeOnboarding({
        userId: 'user-1',
        barNumber: '123456',
        barState: 'CA',
        isRetiredJudge: false,
        yearsExperience: 10,
        jurisdictions: ['CA', 'NY'],
        specialties: ['CONTRACT', 'PAYMENT'],
        agreedToTerms: true,
      });

      expect(result.success).toBe(true);
      expect(result.onboardingStatus).toBe('COMPLETED');
    });

    it('should throw error if terms not agreed', async () => {
      await expect(
        completeOnboarding({
          userId: 'user-1',
          barNumber: '123456',
          barState: 'CA',
          isRetiredJudge: false,
          yearsExperience: 10,
          jurisdictions: ['CA'],
          specialties: ['CONTRACT'],
          agreedToTerms: false,
        })
      ).rejects.toThrow('Must agree to arbitrator terms');
    });

    it('should throw error for invalid bar state', async () => {
      await expect(
        completeOnboarding({
          userId: 'user-1',
          barNumber: '123456',
          barState: 'XX',
          isRetiredJudge: false,
          yearsExperience: 10,
          jurisdictions: ['CA'],
          specialties: ['CONTRACT'],
          agreedToTerms: true,
        })
      ).rejects.toThrow('Invalid bar state');
    });

    it('should throw error for invalid jurisdiction', async () => {
      await expect(
        completeOnboarding({
          userId: 'user-1',
          barNumber: '123456',
          barState: 'CA',
          isRetiredJudge: false,
          yearsExperience: 10,
          jurisdictions: ['XX'],
          specialties: ['CONTRACT'],
          agreedToTerms: true,
        })
      ).rejects.toThrow('Invalid jurisdiction');
    });

    it('should throw error for invalid specialty', async () => {
      await expect(
        completeOnboarding({
          userId: 'user-1',
          barNumber: '123456',
          barState: 'CA',
          isRetiredJudge: false,
          yearsExperience: 10,
          jurisdictions: ['CA'],
          specialties: ['INVALID' as any],
          agreedToTerms: true,
        })
      ).rejects.toThrow('Invalid specialty');
    });
  });

  describe('getOnboardingProgress', () => {
    it('should calculate progress correctly', async () => {
      (mockPrisma.arbitratorProfile.findUnique as jest.Mock).mockResolvedValue({
        onboardingStatus: 'IN_PROGRESS',
        barNumber: '123456',
        barState: 'CA',
        yearsExperience: 10,
        jurisdictions: ['CA'],
        specialties: [],
        agreedToTermsAt: null,
      });

      const result = await getOnboardingProgress('user-1');

      expect(result).not.toBeNull();
      expect(result?.completedSteps).toContain('bar_credentials');
      expect(result?.completedSteps).toContain('experience');
      expect(result?.completedSteps).toContain('jurisdictions');
      expect(result?.pendingSteps).toContain('specialties');
      expect(result?.pendingSteps).toContain('terms_agreement');
      expect(result?.percentComplete).toBe(60);
    });

    it('should return null if no profile exists', async () => {
      (mockPrisma.arbitratorProfile.findUnique as jest.Mock).mockResolvedValue(null);

      const result = await getOnboardingProgress('user-1');

      expect(result).toBeNull();
    });
  });

  describe('getAvailableJurisdictions', () => {
    it('should return all US states with names', () => {
      const jurisdictions = getAvailableJurisdictions();

      expect(jurisdictions.length).toBe(51); // 50 states + DC
      expect(jurisdictions.find((j) => j.code === 'CA')?.name).toBe('California');
      expect(jurisdictions.find((j) => j.code === 'NY')?.name).toBe('New York');
      expect(jurisdictions.find((j) => j.code === 'DC')?.name).toBe('District of Columbia');
    });
  });

  describe('getAvailableSpecialties', () => {
    it('should return all dispute types with descriptions', () => {
      const specialties = getAvailableSpecialties();

      expect(specialties.length).toBe(5);
      expect(specialties.map((s) => s.value)).toContain('CONTRACT');
      expect(specialties.map((s) => s.value)).toContain('PAYMENT');
      expect(specialties.map((s) => s.value)).toContain('SERVICE');
      expect(specialties.map((s) => s.value)).toContain('GOODS');
      expect(specialties.map((s) => s.value)).toContain('OTHER');
    });
  });
});

describe('Credential Verification', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  describe('submitCredentials', () => {
    it('should update profile with credential information', async () => {
      (mockPrisma.arbitratorProfile.findUnique as jest.Mock).mockResolvedValue({
        id: 'profile-1',
      });
      (mockPrisma.arbitratorProfile.update as jest.Mock).mockResolvedValue({});

      const result = await submitCredentials({
        arbitratorProfileId: 'profile-1',
        barNumber: '123456',
        barState: 'CA',
        isRetiredJudge: true,
      });

      expect(result.success).toBe(true);
      expect(mockPrisma.arbitratorProfile.update).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({
            barNumber: '123456',
            barState: 'CA',
            credentialStatus: 'PENDING',
          }),
        })
      );
    });

    it('should throw error if profile not found', async () => {
      (mockPrisma.arbitratorProfile.findUnique as jest.Mock).mockResolvedValue(null);

      await expect(
        submitCredentials({
          arbitratorProfileId: 'invalid',
          barNumber: '123456',
          barState: 'CA',
        })
      ).rejects.toThrow('Arbitrator profile not found');
    });
  });

  describe('verifyCredentials', () => {
    it('should verify credentials and set expiration', async () => {
      (mockPrisma.arbitratorProfile.findUnique as jest.Mock).mockResolvedValue({
        id: 'profile-1',
        stripeConnectStatus: 'ACTIVE',
      });
      (mockPrisma.arbitratorProfile.update as jest.Mock).mockResolvedValue({
        credentialStatus: 'VERIFIED',
        credentialVerifiedAt: new Date(),
        credentialExpiresAt: new Date(Date.now() + 365 * 24 * 60 * 60 * 1000),
        credentialNotes: 'Verified via state bar website',
        isActive: true,
      });

      const result = await verifyCredentials({
        arbitratorProfileId: 'profile-1',
        adminUserId: 'admin-1',
        status: 'VERIFIED',
        notes: 'Verified via state bar website',
      });

      expect(result.status).toBe('VERIFIED');
      expect(result.verifiedAt).not.toBeNull();
      expect(result.expiresAt).not.toBeNull();
    });

    it('should reject credentials with notes', async () => {
      (mockPrisma.arbitratorProfile.findUnique as jest.Mock).mockResolvedValue({
        id: 'profile-1',
      });
      (mockPrisma.arbitratorProfile.update as jest.Mock).mockResolvedValue({
        credentialStatus: 'REJECTED',
        credentialVerifiedAt: null,
        credentialExpiresAt: null,
        credentialNotes: 'Bar number not found',
      });

      const result = await verifyCredentials({
        arbitratorProfileId: 'profile-1',
        adminUserId: 'admin-1',
        status: 'REJECTED',
        notes: 'Bar number not found',
      });

      expect(result.status).toBe('REJECTED');
      expect(result.verifiedAt).toBeNull();
    });
  });

  describe('areCredentialsValid', () => {
    it('should return valid for verified non-expired credentials', async () => {
      (mockPrisma.arbitratorProfile.findUnique as jest.Mock).mockResolvedValue({
        credentialStatus: 'VERIFIED',
        credentialExpiresAt: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000), // 30 days from now
      });

      const result = await areCredentialsValid('profile-1');

      expect(result.valid).toBe(true);
    });

    it('should return invalid for expired credentials', async () => {
      (mockPrisma.arbitratorProfile.findUnique as jest.Mock).mockResolvedValue({
        credentialStatus: 'VERIFIED',
        credentialExpiresAt: new Date(Date.now() - 24 * 60 * 60 * 1000), // Yesterday
      });
      (mockPrisma.arbitratorProfile.update as jest.Mock).mockResolvedValue({});

      const result = await areCredentialsValid('profile-1');

      expect(result.valid).toBe(false);
      expect(result.reason).toContain('expired');
      expect(mockPrisma.arbitratorProfile.update).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({
            credentialStatus: 'EXPIRED',
            isActive: false,
          }),
        })
      );
    });

    it('should return invalid for pending credentials', async () => {
      (mockPrisma.arbitratorProfile.findUnique as jest.Mock).mockResolvedValue({
        credentialStatus: 'PENDING',
        credentialExpiresAt: null,
      });

      const result = await areCredentialsValid('profile-1');

      expect(result.valid).toBe(false);
      expect(result.reason).toContain('pending');
    });
  });

  describe('getBarVerificationUrl', () => {
    it('should return URL for known states', () => {
      expect(getBarVerificationUrl('CA')).toContain('calbar');
      expect(getBarVerificationUrl('NY')).toContain('courts.state.ny');
      expect(getBarVerificationUrl('TX')).toContain('texasbar');
    });

    it('should return null for unknown states', () => {
      expect(getBarVerificationUrl('XX')).toBeNull();
    });
  });

  describe('expireCredentials', () => {
    it('should expire all credentials past expiration date', async () => {
      (mockPrisma.arbitratorProfile.updateMany as jest.Mock).mockResolvedValue({
        count: 5,
      });

      const count = await expireCredentials();

      expect(count).toBe(5);
      expect(mockPrisma.arbitratorProfile.updateMany).toHaveBeenCalledWith(
        expect.objectContaining({
          where: expect.objectContaining({
            credentialStatus: 'VERIFIED',
          }),
          data: expect.objectContaining({
            credentialStatus: 'EXPIRED',
            isActive: false,
          }),
        })
      );
    });
  });
});

describe('Compensation Calculation', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  describe('calculateCompensation', () => {
    it('should calculate PER_CASE compensation', async () => {
      (mockPrisma.arbitratorProfile.findUnique as jest.Mock).mockResolvedValue({
        compensationType: 'PER_CASE',
        baseFeePerCase: new Decimal(300),
        percentageRate: new Decimal(0.02),
        hourlyRate: new Decimal(150),
      });
      (mockPrisma.case.findUnique as jest.Mock).mockResolvedValue({
        amount: new Decimal(5000),
        award: null,
      });

      const result = await calculateCompensation('profile-1', 'case-1');

      expect(result.type).toBe('PER_CASE');
      expect(result.finalAmount).toBe(300);
      expect(result.breakdown.description).toContain('per case');
    });

    it('should calculate PERCENTAGE compensation', async () => {
      (mockPrisma.arbitratorProfile.findUnique as jest.Mock).mockResolvedValue({
        compensationType: 'PERCENTAGE',
        baseFeePerCase: new Decimal(300),
        percentageRate: new Decimal(0.05),
        hourlyRate: new Decimal(150),
      });
      (mockPrisma.case.findUnique as jest.Mock).mockResolvedValue({
        amount: new Decimal(10000),
        award: { awardAmount: new Decimal(8000) },
      });

      const result = await calculateCompensation('profile-1', 'case-1');

      expect(result.type).toBe('PERCENTAGE');
      expect(result.finalAmount).toBe(500); // 5% of 10000 (higher of case amount)
    });

    it('should calculate HOURLY compensation', async () => {
      (mockPrisma.arbitratorProfile.findUnique as jest.Mock).mockResolvedValue({
        compensationType: 'HOURLY',
        baseFeePerCase: new Decimal(300),
        percentageRate: new Decimal(0.02),
        hourlyRate: new Decimal(200),
      });
      (mockPrisma.case.findUnique as jest.Mock).mockResolvedValue({
        amount: new Decimal(5000),
        award: null,
      });

      const result = await calculateCompensation('profile-1', 'case-1', 120);

      expect(result.type).toBe('HOURLY');
      expect(result.finalAmount).toBe(400); // 2 hours * $200
      expect(result.breakdown.reviewTimeMinutes).toBe(120);
    });

    it('should apply minimum compensation', async () => {
      (mockPrisma.arbitratorProfile.findUnique as jest.Mock).mockResolvedValue({
        compensationType: 'PERCENTAGE',
        baseFeePerCase: new Decimal(300),
        percentageRate: new Decimal(0.01),
        hourlyRate: new Decimal(150),
      });
      (mockPrisma.case.findUnique as jest.Mock).mockResolvedValue({
        amount: new Decimal(1000),
        award: null,
      });

      const result = await calculateCompensation('profile-1', 'case-1');

      // 1% of $1000 = $10, but minimum is $100
      expect(result.finalAmount).toBe(100);
    });

    it('should apply maximum compensation', async () => {
      (mockPrisma.arbitratorProfile.findUnique as jest.Mock).mockResolvedValue({
        compensationType: 'PERCENTAGE',
        baseFeePerCase: new Decimal(300),
        percentageRate: new Decimal(0.1),
        hourlyRate: new Decimal(150),
      });
      (mockPrisma.case.findUnique as jest.Mock).mockResolvedValue({
        amount: new Decimal(100000),
        award: null,
      });

      const result = await calculateCompensation('profile-1', 'case-1');

      // 10% of $100,000 = $10,000, but maximum is $5,000
      expect(result.finalAmount).toBe(5000);
    });

    it('should throw error if profile not found', async () => {
      (mockPrisma.arbitratorProfile.findUnique as jest.Mock).mockResolvedValue(null);

      await expect(calculateCompensation('invalid', 'case-1')).rejects.toThrow(
        'Arbitrator profile not found'
      );
    });

    it('should throw error if case not found', async () => {
      (mockPrisma.arbitratorProfile.findUnique as jest.Mock).mockResolvedValue({
        compensationType: 'PER_CASE',
        baseFeePerCase: new Decimal(300),
      });
      (mockPrisma.case.findUnique as jest.Mock).mockResolvedValue(null);

      await expect(calculateCompensation('profile-1', 'invalid')).rejects.toThrow('Case not found');
    });
  });

  describe('approveCompensation', () => {
    it('should approve compensation', async () => {
      (mockPrisma.arbitratorCompensation.findUnique as jest.Mock).mockResolvedValue({
        id: 'comp-1',
        status: 'CALCULATED',
      });
      (mockPrisma.arbitratorCompensation.update as jest.Mock).mockResolvedValue({});

      await approveCompensation('comp-1', 'admin-1');

      expect(mockPrisma.arbitratorCompensation.update).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({
            status: 'APPROVED',
            approvedById: 'admin-1',
          }),
        })
      );
    });

    it('should throw error for non-CALCULATED status', async () => {
      (mockPrisma.arbitratorCompensation.findUnique as jest.Mock).mockResolvedValue({
        id: 'comp-1',
        status: 'PAID',
      });

      await expect(approveCompensation('comp-1', 'admin-1')).rejects.toThrow(
        'Cannot approve compensation with status'
      );
    });
  });

  describe('getEarningsSummary', () => {
    it('should calculate earnings summary', async () => {
      const now = new Date();
      const firstOfMonth = new Date(now.getFullYear(), now.getMonth(), 1);

      (mockPrisma.arbitratorCompensation.findMany as jest.Mock).mockResolvedValue([
        {
          amount: new Decimal(500),
          status: 'PAID',
          paidAt: new Date(firstOfMonth.getTime() + 24 * 60 * 60 * 1000), // Day after first of month
          calculatedAt: firstOfMonth,
        },
        {
          amount: new Decimal(300),
          status: 'CALCULATED',
          paidAt: null,
          calculatedAt: firstOfMonth,
        },
        {
          amount: new Decimal(200),
          status: 'APPROVED',
          paidAt: null,
          calculatedAt: firstOfMonth,
        },
      ]);

      const result = await getEarningsSummary('profile-1');

      expect(result.totalEarned).toBe(1000);
      expect(result.totalPaid).toBe(500);
      expect(result.totalPending).toBe(500);
      expect(result.casesCompleted).toBe(3);
      expect(result.averagePerCase).toBeCloseTo(333.33, 1);
    });

    it('should handle empty compensation history', async () => {
      (mockPrisma.arbitratorCompensation.findMany as jest.Mock).mockResolvedValue([]);

      const result = await getEarningsSummary('profile-1');

      expect(result.totalEarned).toBe(0);
      expect(result.casesCompleted).toBe(0);
      expect(result.averagePerCase).toBe(0);
    });
  });
});
