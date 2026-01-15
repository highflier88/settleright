/**
 * Case Service Tests
 *
 * Tests for case creation, retrieval, and management functionality.
 */

import { prisma } from '@/lib/db';
import { createAuditLog } from '@/lib/services/audit';
import {
  generateCaseReference,
  generateInvitationToken,
  createCase,
  getCaseById,
  getCaseWithDetails,
  getUserCases,
  updateCaseStatus,
  softDeleteCase,
  userHasAccessToCase,
  getUserCaseStats,
  getCaseDeadlines,
  calculateFilingFee,
  CASE_STATUS_LABELS,
  DISPUTE_TYPE_LABELS,
  SUPPORTED_JURISDICTIONS,
} from '@/lib/services/case';

// Mock dependencies
jest.mock('@/lib/db', () => ({
  prisma: {
    case: {
      findUnique: jest.fn(),
      findFirst: jest.fn(),
      findMany: jest.fn(),
      create: jest.fn(),
      update: jest.fn(),
      count: jest.fn(),
      aggregate: jest.fn(),
    },
    invitation: {
      create: jest.fn(),
    },
    $transaction: jest.fn(),
  },
}));

jest.mock('@/lib/services/audit', () => ({
  createAuditLog: jest.fn(),
}));

const mockPrisma = prisma as jest.Mocked<typeof prisma>;
const mockCreateAuditLog = createAuditLog as jest.Mock;

describe('Case Service', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  // ==========================================================================
  // Reference Number & Token Generation
  // ==========================================================================

  describe('generateCaseReference', () => {
    it('should generate a reference number in correct format', () => {
      const reference = generateCaseReference();
      const year = new Date().getFullYear();

      expect(reference).toMatch(new RegExp(`^SR-${year}-[A-F0-9]{6}$`));
    });

    it('should generate unique reference numbers', () => {
      const references = new Set<string>();
      for (let i = 0; i < 100; i++) {
        references.add(generateCaseReference());
      }

      // Most should be unique (allowing for rare collisions)
      expect(references.size).toBeGreaterThan(95);
    });
  });

  describe('generateInvitationToken', () => {
    it('should generate a 64-character hex token', () => {
      const token = generateInvitationToken();

      expect(token).toMatch(/^[a-f0-9]{64}$/);
    });

    it('should generate unique tokens', () => {
      const tokens = new Set<string>();
      for (let i = 0; i < 100; i++) {
        tokens.add(generateInvitationToken());
      }

      expect(tokens.size).toBe(100);
    });
  });

  // ==========================================================================
  // Case Creation
  // ==========================================================================

  describe('createCase', () => {
    const validInput = {
      claimantId: 'user-123',
      disputeType: 'CONTRACT' as const,
      jurisdiction: 'US-CA',
      description: 'Test dispute',
      amount: 5000,
      respondent: {
        email: 'respondent@example.com',
        name: 'John Doe',
      },
    };

    it('should create a case with invitation successfully', async () => {
      const mockCase = {
        id: 'case-123',
        referenceNumber: 'SR-2026-ABC123',
        status: 'PENDING_RESPONDENT',
        ...validInput,
      };

      // Mock unique reference number check
      (mockPrisma.case.findUnique as jest.Mock).mockResolvedValue(null);

      // Mock transaction
      (mockPrisma.$transaction as jest.Mock).mockImplementation(async (callback) => {
        const tx = {
          case: {
            create: jest.fn().mockResolvedValue(mockCase),
          },
          invitation: {
            create: jest.fn().mockResolvedValue({ id: 'inv-123' }),
          },
        };
        return callback(tx);
      });

      const result = await createCase(validInput);

      expect(result.success).toBe(true);
      expect(result.case).toBeDefined();
      expect(result.invitationToken).toBeDefined();
      expect(result.invitationToken).toHaveLength(64);
      expect(mockCreateAuditLog).toHaveBeenCalledWith(
        expect.objectContaining({
          action: 'CASE_CREATED',
          userId: validInput.claimantId,
        })
      );
    });

    it('should retry reference number generation on collision', async () => {
      const mockCase = {
        id: 'case-123',
        referenceNumber: 'SR-2026-ABC123',
      };

      // First call returns existing case (collision), second returns null (unique)
      (mockPrisma.case.findUnique as jest.Mock)
        .mockResolvedValueOnce({ id: 'existing' })
        .mockResolvedValueOnce(null);

      (mockPrisma.$transaction as jest.Mock).mockImplementation(async (callback) => {
        const tx = {
          case: { create: jest.fn().mockResolvedValue(mockCase) },
          invitation: { create: jest.fn().mockResolvedValue({ id: 'inv-123' }) },
        };
        return callback(tx);
      });

      const result = await createCase(validInput);

      expect(result.success).toBe(true);
      expect(mockPrisma.case.findUnique).toHaveBeenCalledTimes(2);
    });

    it('should fail after max reference number attempts', async () => {
      // Always return existing case (collision)
      (mockPrisma.case.findUnique as jest.Mock).mockResolvedValue({ id: 'existing' });

      const result = await createCase(validInput);

      expect(result.success).toBe(false);
      expect(result.error).toBe('Failed to generate unique reference number');
    });

    it('should handle database errors gracefully', async () => {
      (mockPrisma.case.findUnique as jest.Mock).mockResolvedValue(null);
      (mockPrisma.$transaction as jest.Mock).mockRejectedValue(new Error('Database error'));

      const result = await createCase(validInput);

      expect(result.success).toBe(false);
      expect(result.error).toBe('Database error');
    });
  });

  // ==========================================================================
  // Case Retrieval
  // ==========================================================================

  describe('getCaseById', () => {
    it('should return a case by ID', async () => {
      const mockCase = { id: 'case-123', status: 'PENDING_RESPONDENT' };
      (mockPrisma.case.findFirst as jest.Mock).mockResolvedValue(mockCase);

      const result = await getCaseById('case-123');

      expect(result).toEqual(mockCase);
      expect(mockPrisma.case.findFirst).toHaveBeenCalledWith({
        where: { id: 'case-123', deletedAt: null },
      });
    });

    it('should exclude soft-deleted cases by default', async () => {
      (mockPrisma.case.findFirst as jest.Mock).mockResolvedValue(null);

      await getCaseById('case-123');

      expect(mockPrisma.case.findFirst).toHaveBeenCalledWith({
        where: expect.objectContaining({ deletedAt: null }),
      });
    });

    it('should include soft-deleted cases when requested', async () => {
      await getCaseById('case-123', true);

      expect(mockPrisma.case.findFirst).toHaveBeenCalledWith({
        where: { id: 'case-123' },
      });
    });
  });

  describe('getCaseWithDetails', () => {
    it('should return case with all related entities', async () => {
      const mockCase = {
        id: 'case-123',
        claimant: { id: 'user-1', name: 'Claimant', email: 'c@test.com' },
        respondent: null,
        invitation: { status: 'PENDING' },
        agreement: null,
        evidence: [],
        statements: [],
      };

      (mockPrisma.case.findFirst as jest.Mock).mockResolvedValue(mockCase);

      const result = await getCaseWithDetails('case-123');

      expect(result).toEqual(mockCase);
      expect(mockPrisma.case.findFirst).toHaveBeenCalledWith(
        expect.objectContaining({
          include: expect.objectContaining({
            claimant: expect.any(Object),
            respondent: expect.any(Object),
            invitation: true,
            agreement: expect.any(Object),
            evidence: expect.any(Object),
            statements: expect.any(Object),
          }),
        })
      );
    });
  });

  describe('getUserCases', () => {
    it('should return paginated cases for a user', async () => {
      const mockCases = [
        { id: 'case-1', status: 'PENDING_RESPONDENT' },
        { id: 'case-2', status: 'DECIDED' },
      ];

      (mockPrisma.case.findMany as jest.Mock).mockResolvedValue(mockCases);
      (mockPrisma.case.count as jest.Mock).mockResolvedValue(2);

      const result = await getUserCases('user-123');

      expect(result.cases).toEqual(mockCases);
      expect(result.total).toBe(2);
      expect(result.page).toBe(1);
      expect(result.limit).toBe(20);
      expect(result.totalPages).toBe(1);
    });

    it('should filter by role', async () => {
      (mockPrisma.case.findMany as jest.Mock).mockResolvedValue([]);
      (mockPrisma.case.count as jest.Mock).mockResolvedValue(0);

      await getUserCases('user-123', { role: 'claimant' });

      expect(mockPrisma.case.findMany).toHaveBeenCalledWith(
        expect.objectContaining({
          where: expect.objectContaining({ claimantId: 'user-123' }),
        })
      );
    });

    it('should filter by status', async () => {
      (mockPrisma.case.findMany as jest.Mock).mockResolvedValue([]);
      (mockPrisma.case.count as jest.Mock).mockResolvedValue(0);

      await getUserCases('user-123', { status: 'DECIDED' as const });

      expect(mockPrisma.case.findMany).toHaveBeenCalledWith(
        expect.objectContaining({
          where: expect.objectContaining({ status: 'DECIDED' }),
        })
      );
    });

    it('should handle pagination correctly', async () => {
      (mockPrisma.case.findMany as jest.Mock).mockResolvedValue([]);
      (mockPrisma.case.count as jest.Mock).mockResolvedValue(50);

      const result = await getUserCases('user-123', { page: 3, limit: 10 });

      expect(result.page).toBe(3);
      expect(result.limit).toBe(10);
      expect(result.totalPages).toBe(5);
      expect(mockPrisma.case.findMany).toHaveBeenCalledWith(
        expect.objectContaining({ skip: 20, take: 10 })
      );
    });
  });

  // ==========================================================================
  // Case Updates
  // ==========================================================================

  describe('updateCaseStatus', () => {
    it('should update case status and log audit event', async () => {
      const mockCase = { id: 'case-123', status: 'EVIDENCE_SUBMISSION' };
      (mockPrisma.case.update as jest.Mock).mockResolvedValue(mockCase);

      const result = await updateCaseStatus('case-123', 'EVIDENCE_SUBMISSION' as const, 'user-123');

      expect(result).toEqual(mockCase);
      expect(mockPrisma.case.update).toHaveBeenCalledWith({
        where: { id: 'case-123' },
        data: { status: 'EVIDENCE_SUBMISSION' },
      });
      expect(mockCreateAuditLog).toHaveBeenCalledWith(
        expect.objectContaining({
          action: 'CASE_STATUS_CHANGED',
          caseId: 'case-123',
        })
      );
    });
  });

  describe('softDeleteCase', () => {
    it('should soft delete a case', async () => {
      (mockPrisma.case.update as jest.Mock).mockResolvedValue({ id: 'case-123' });

      const result = await softDeleteCase('case-123', 'user-123');

      expect(result).toBe(true);
      expect(mockPrisma.case.update).toHaveBeenCalledWith({
        where: { id: 'case-123' },
        data: expect.objectContaining({
          deletedAt: expect.any(Date),
          status: 'CLOSED',
        }),
      });
    });

    it('should return false on error', async () => {
      (mockPrisma.case.update as jest.Mock).mockRejectedValue(new Error('Not found'));

      const result = await softDeleteCase('case-123', 'user-123');

      expect(result).toBe(false);
    });
  });

  // ==========================================================================
  // Access Control
  // ==========================================================================

  describe('userHasAccessToCase', () => {
    it('should return true with claimant role for case claimant', async () => {
      (mockPrisma.case.findFirst as jest.Mock).mockResolvedValue({
        claimantId: 'user-123',
        respondentId: 'user-456',
      });

      const result = await userHasAccessToCase('user-123', 'case-123');

      expect(result).toEqual({ hasAccess: true, role: 'claimant' });
    });

    it('should return true with respondent role for case respondent', async () => {
      (mockPrisma.case.findFirst as jest.Mock).mockResolvedValue({
        claimantId: 'user-456',
        respondentId: 'user-123',
      });

      const result = await userHasAccessToCase('user-123', 'case-123');

      expect(result).toEqual({ hasAccess: true, role: 'respondent' });
    });

    it('should return false for unauthorized user', async () => {
      (mockPrisma.case.findFirst as jest.Mock).mockResolvedValue(null);

      const result = await userHasAccessToCase('user-123', 'case-123');

      expect(result).toEqual({ hasAccess: false });
    });
  });

  // ==========================================================================
  // Statistics
  // ==========================================================================

  describe('getUserCaseStats', () => {
    it('should return user case statistics', async () => {
      (mockPrisma.case.count as jest.Mock)
        .mockResolvedValueOnce(10) // totalCases
        .mockResolvedValueOnce(5) // activeCases
        .mockResolvedValueOnce(3); // decidedCases

      (mockPrisma.case.aggregate as jest.Mock).mockResolvedValue({
        _sum: { amount: { toNumber: () => 50000 } },
      });

      const result = await getUserCaseStats('user-123');

      expect(result).toEqual({
        totalCases: 10,
        activeCases: 5,
        decidedCases: 3,
        closedCases: 2,
        totalAmountClaimed: 50000,
      });
    });

    it('should handle null amounts', async () => {
      (mockPrisma.case.count as jest.Mock)
        .mockResolvedValueOnce(0)
        .mockResolvedValueOnce(0)
        .mockResolvedValueOnce(0);

      (mockPrisma.case.aggregate as jest.Mock).mockResolvedValue({
        _sum: { amount: null },
      });

      const result = await getUserCaseStats('user-123');

      expect(result.totalAmountClaimed).toBe(0);
    });
  });

  // ==========================================================================
  // Deadlines
  // ==========================================================================

  describe('getCaseDeadlines', () => {
    it('should calculate deadline information correctly', () => {
      const now = new Date();
      const futureDate = new Date(now.getTime() + 7 * 24 * 60 * 60 * 1000); // 7 days from now
      const pastDate = new Date(now.getTime() - 3 * 24 * 60 * 60 * 1000); // 3 days ago

      const mockCase = {
        responseDeadline: futureDate,
        evidenceDeadline: pastDate,
        rebuttalDeadline: null,
      } as Parameters<typeof getCaseDeadlines>[0];

      const result = getCaseDeadlines(mockCase);

      expect(result.response?.isPast).toBe(false);
      expect(result.response?.daysRemaining).toBeGreaterThan(6);
      expect(result.response?.daysRemaining).toBeLessThanOrEqual(8);

      expect(result.evidence?.isPast).toBe(true);
      expect(result.evidence?.daysRemaining).toBeLessThan(0);

      expect(result.rebuttal).toBeNull();
    });

    it('should handle missing deadlines', () => {
      const mockCase = {
        responseDeadline: null,
        evidenceDeadline: null,
        rebuttalDeadline: null,
      } as Parameters<typeof getCaseDeadlines>[0];

      const result = getCaseDeadlines(mockCase);

      expect(result.response).toBeNull();
      expect(result.evidence).toBeNull();
      expect(result.rebuttal).toBeNull();
    });
  });

  // ==========================================================================
  // Fee Calculation
  // ==========================================================================

  describe('calculateFilingFee', () => {
    it('should return $49 for amounts up to $1000', () => {
      expect(calculateFilingFee(500)).toBe(49);
      expect(calculateFilingFee(1000)).toBe(49);
    });

    it('should return $99 for amounts $1001-$5000', () => {
      expect(calculateFilingFee(1001)).toBe(99);
      expect(calculateFilingFee(5000)).toBe(99);
    });

    it('should return $149 for amounts $5001-$10000', () => {
      expect(calculateFilingFee(5001)).toBe(149);
      expect(calculateFilingFee(10000)).toBe(149);
    });

    it('should return $249 for amounts $10001-$25000', () => {
      expect(calculateFilingFee(10001)).toBe(249);
      expect(calculateFilingFee(25000)).toBe(249);
    });

    it('should return $349 for amounts over $25000', () => {
      expect(calculateFilingFee(25001)).toBe(349);
      expect(calculateFilingFee(100000)).toBe(349);
    });
  });

  // ==========================================================================
  // Constants
  // ==========================================================================

  describe('Constants', () => {
    it('should have all case status labels', () => {
      expect(CASE_STATUS_LABELS).toHaveProperty('DRAFT');
      expect(CASE_STATUS_LABELS).toHaveProperty('PENDING_RESPONDENT');
      expect(CASE_STATUS_LABELS).toHaveProperty('DECIDED');
      expect(CASE_STATUS_LABELS).toHaveProperty('CLOSED');
    });

    it('should have all dispute type labels', () => {
      expect(DISPUTE_TYPE_LABELS).toHaveProperty('CONTRACT');
      expect(DISPUTE_TYPE_LABELS).toHaveProperty('PAYMENT');
      expect(DISPUTE_TYPE_LABELS).toHaveProperty('SERVICE');
      expect(DISPUTE_TYPE_LABELS).toHaveProperty('GOODS');
      expect(DISPUTE_TYPE_LABELS).toHaveProperty('OTHER');
    });

    it('should include California in supported jurisdictions', () => {
      const california = SUPPORTED_JURISDICTIONS.find((j) => j.code === 'US-CA');
      expect(california).toBeDefined();
      expect(california?.name).toContain('California');
    });
  });
});
