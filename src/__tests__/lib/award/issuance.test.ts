/**
 * Award Issuance Service Tests
 *
 * Tests for award finalization, validation, and notification.
 */

import { canIssueAward } from '@/lib/award/issuance';

// Mock Prisma
jest.mock('@/lib/db', () => ({
  prisma: {
    award: {
      findUnique: jest.fn(),
      create: jest.fn(),
      update: jest.fn(),
      count: jest.fn(),
    },
    case: {
      findUnique: jest.fn(),
      update: jest.fn(),
    },
  },
}));

// Mock draft award getter
jest.mock('@/lib/award/generator', () => ({
  getDraftAward: jest.fn(),
}));

// Mock storage
jest.mock('@/lib/storage/blob', () => ({
  uploadFile: jest.fn(),
}));

// Mock notifications
jest.mock('@/lib/services/notification', () => ({
  createInAppNotification: jest.fn(),
  NotificationTemplates: {
    AWARD_ISSUED: 'AWARD_ISSUED',
  },
}));

import { prisma } from '@/lib/db';
import { getDraftAward } from '@/lib/award/generator';

const mockPrisma = prisma as jest.Mocked<typeof prisma>;
const mockGetDraftAward = getDraftAward as jest.MockedFunction<typeof getDraftAward>;

// Helper to create mock draft award response
const createMockDraftAward = (
  overrides: Partial<Awaited<ReturnType<typeof getDraftAward>>> = {}
) => ({
  id: 'draft-1',
  caseId: 'case-1',
  findingsOfFact: [],
  conclusionsOfLaw: [],
  decision: 'Test decision',
  awardAmount: 5000,
  prevailingParty: 'CLAIMANT',
  reasoning: 'Test reasoning',
  confidence: 0.85,
  citationsVerified: true,
  reviewStatus: 'APPROVE',
  reviewNotes: null,
  generatedAt: new Date(),
  reviewedAt: new Date(),
  ...overrides,
});

describe('Award Issuance Service', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  describe('canIssueAward', () => {
    it('should return false if award already exists', async () => {
      (mockPrisma.award.findUnique as jest.Mock).mockResolvedValue({
        id: 'existing-award',
        caseId: 'case-1',
      });

      const result = await canIssueAward('case-1');

      expect(result.canIssue).toBe(false);
      expect(result.reason).toBe('Award has already been issued for this case');
    });

    it('should return false if draft award not found', async () => {
      (mockPrisma.award.findUnique as jest.Mock).mockResolvedValue(null);
      mockGetDraftAward.mockResolvedValue(null);

      const result = await canIssueAward('case-1');

      expect(result.canIssue).toBe(false);
      expect(result.reason).toBe('Draft award not found');
    });

    it('should return false if draft award not approved', async () => {
      (mockPrisma.award.findUnique as jest.Mock).mockResolvedValue(null);
      mockGetDraftAward.mockResolvedValue(createMockDraftAward({ reviewStatus: 'MODIFY' }));

      const result = await canIssueAward('case-1');

      expect(result.canIssue).toBe(false);
      expect(result.reason).toContain('MODIFY');
      expect(result.reason).toContain('must be APPROVE');
    });

    it('should return false if case not found', async () => {
      (mockPrisma.award.findUnique as jest.Mock).mockResolvedValue(null);
      mockGetDraftAward.mockResolvedValue(createMockDraftAward());
      (mockPrisma.case.findUnique as jest.Mock).mockResolvedValue(null);

      const result = await canIssueAward('case-1');

      expect(result.canIssue).toBe(false);
      expect(result.reason).toBe('Case not found');
    });

    it('should return false if case status is not ARBITRATOR_REVIEW', async () => {
      (mockPrisma.award.findUnique as jest.Mock).mockResolvedValue(null);
      mockGetDraftAward.mockResolvedValue(createMockDraftAward());
      (mockPrisma.case.findUnique as jest.Mock).mockResolvedValue({
        id: 'case-1',
        status: 'EVIDENCE_SUBMISSION',
      });

      const result = await canIssueAward('case-1');

      expect(result.canIssue).toBe(false);
      expect(result.reason).toContain('EVIDENCE_SUBMISSION');
    });

    it('should return true if all conditions are met', async () => {
      (mockPrisma.award.findUnique as jest.Mock).mockResolvedValue(null);
      mockGetDraftAward.mockResolvedValue(createMockDraftAward());
      (mockPrisma.case.findUnique as jest.Mock).mockResolvedValue({
        id: 'case-1',
        status: 'ARBITRATOR_REVIEW',
      });

      const result = await canIssueAward('case-1');

      expect(result.canIssue).toBe(true);
      expect(result.reason).toBeUndefined();
    });

    it('should return true if case status is DECIDED (reissuance)', async () => {
      (mockPrisma.award.findUnique as jest.Mock).mockResolvedValue(null);
      mockGetDraftAward.mockResolvedValue(createMockDraftAward());
      (mockPrisma.case.findUnique as jest.Mock).mockResolvedValue({
        id: 'case-1',
        status: 'DECIDED',
      });

      const result = await canIssueAward('case-1');

      expect(result.canIssue).toBe(true);
    });
  });
});
