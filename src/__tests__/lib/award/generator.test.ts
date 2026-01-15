/**
 * Draft Award Generator Tests
 *
 * Tests for draft award generation, retrieval, and review submission.
 */

// Mock Prisma before importing anything that uses it
jest.mock('@/lib/db', () => ({
  prisma: {
    draftAward: {
      findUnique: jest.fn(),
      create: jest.fn(),
      update: jest.fn(),
    },
    case: {
      findUnique: jest.fn(),
      update: jest.fn(),
    },
    analysisJob: {
      findUnique: jest.fn(),
    },
  },
}));

// Mock Anthropic API
jest.mock('@anthropic-ai/sdk', () => ({
  __esModule: true,
  default: jest.fn().mockImplementation(() => ({
    messages: {
      create: jest.fn().mockResolvedValue({
        content: [{ type: 'text', text: '{"findings": [], "conclusions": [], "decision": {}}' }],
        usage: { input_tokens: 100, output_tokens: 200 },
      }),
    },
  })),
}));

// Mock notification service
jest.mock('@/lib/services/notification', () => ({
  createInAppNotification: jest.fn().mockResolvedValue(undefined),
  NotificationTemplates: {
    DRAFT_AWARD_READY: 'DRAFT_AWARD_READY',
    AWARD_ISSUED: 'AWARD_ISSUED',
  },
}));

import { prisma } from '@/lib/db';
import { getDraftAward, submitDraftAwardReview } from '@/lib/award/generator';

const mockPrisma = prisma as jest.Mocked<typeof prisma>;

describe('Draft Award Generator', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  describe('getDraftAward', () => {
    it('should return null if draft award not found', async () => {
      (mockPrisma.draftAward.findUnique as jest.Mock).mockResolvedValue(null);

      const result = await getDraftAward('case-1');

      expect(result).toBeNull();
      expect(mockPrisma.draftAward.findUnique).toHaveBeenCalledWith({
        where: { caseId: 'case-1' },
      });
    });

    it('should return draft award with parsed JSON fields', async () => {
      const mockDraftAward = {
        id: 'draft-1',
        caseId: 'case-1',
        findingsOfFact: JSON.stringify([{ id: 'f1', number: 1, finding: 'Test finding' }]),
        conclusionsOfLaw: JSON.stringify([{ id: 'c1', number: 1, conclusion: 'Test conclusion' }]),
        decision: 'Test decision',
        awardAmount: { toNumber: () => 5000 },
        prevailingParty: 'CLAIMANT',
        reasoning: 'Test reasoning',
        confidence: { toNumber: () => 0.85 },
        citationsVerified: true,
        modelUsed: 'claude-3-opus',
        generatedAt: new Date('2026-01-13'),
        reviewStatus: 'APPROVE',
        reviewedAt: new Date('2026-01-13'),
        reviewNotes: 'Looks good',
        createdAt: new Date('2026-01-13'),
        updatedAt: new Date('2026-01-13'),
      };

      (mockPrisma.draftAward.findUnique as jest.Mock).mockResolvedValue(mockDraftAward);

      const result = await getDraftAward('case-1');

      expect(result).not.toBeNull();
      expect(result?.caseId).toBe('case-1');
      expect(result?.reviewStatus).toBe('APPROVE');
    });
  });

  describe('submitDraftAwardReview', () => {
    it('should update draft award with review status', async () => {
      const mockUpdatedDraft = {
        id: 'draft-1',
        caseId: 'case-1',
        reviewStatus: 'APPROVE',
        reviewedAt: new Date(),
        reviewNotes: 'Approved with no changes',
      };

      (mockPrisma.draftAward.update as jest.Mock).mockResolvedValue(mockUpdatedDraft);
      (mockPrisma.case.update as jest.Mock).mockResolvedValue({
        id: 'case-1',
        status: 'ARBITRATOR_REVIEW',
      });

      const result = await submitDraftAwardReview('case-1', {
        reviewStatus: 'APPROVE',
        reviewNotes: 'Approved with no changes',
      });

      expect(result.reviewStatus).toBe('APPROVE');
      expect(mockPrisma.draftAward.update).toHaveBeenCalled();
    });

    it('should return correct next step for APPROVE', async () => {
      const mockUpdatedDraft = {
        id: 'draft-1',
        caseId: 'case-1',
        reviewStatus: 'APPROVE',
        reviewedAt: new Date(),
        reviewNotes: null,
      };

      (mockPrisma.draftAward.update as jest.Mock).mockResolvedValue(mockUpdatedDraft);
      (mockPrisma.case.update as jest.Mock).mockResolvedValue({});

      const result = await submitDraftAwardReview('case-1', {
        reviewStatus: 'APPROVE',
      });

      expect(result.nextStep).toContain('finalize');
    });

    it('should return correct next step for MODIFY', async () => {
      const mockUpdatedDraft = {
        id: 'draft-1',
        caseId: 'case-1',
        reviewStatus: 'MODIFY',
        reviewedAt: new Date(),
        reviewNotes: 'Needs changes to finding 3',
      };

      (mockPrisma.draftAward.update as jest.Mock).mockResolvedValue(mockUpdatedDraft);
      (mockPrisma.case.update as jest.Mock).mockResolvedValue({});

      const result = await submitDraftAwardReview('case-1', {
        reviewStatus: 'MODIFY',
        reviewNotes: 'Needs changes to finding 3',
      });

      expect(result.nextStep).toContain('regenerate');
    });

    it('should return correct next step for REJECT', async () => {
      const mockUpdatedDraft = {
        id: 'draft-1',
        caseId: 'case-1',
        reviewStatus: 'REJECT',
        reviewedAt: new Date(),
        reviewNotes: 'Insufficient evidence',
      };

      (mockPrisma.draftAward.update as jest.Mock).mockResolvedValue(mockUpdatedDraft);
      (mockPrisma.case.update as jest.Mock).mockResolvedValue({});

      const result = await submitDraftAwardReview('case-1', {
        reviewStatus: 'REJECT',
        reviewNotes: 'Insufficient evidence',
      });

      expect(result.nextStep).toContain('reviewed');
    });

    it('should return correct next step for ESCALATE', async () => {
      const mockUpdatedDraft = {
        id: 'draft-1',
        caseId: 'case-1',
        reviewStatus: 'ESCALATE',
        reviewedAt: new Date(),
        reviewNotes: 'Complex legal issues',
      };

      (mockPrisma.draftAward.update as jest.Mock).mockResolvedValue(mockUpdatedDraft);
      (mockPrisma.case.update as jest.Mock).mockResolvedValue({});

      const result = await submitDraftAwardReview('case-1', {
        reviewStatus: 'ESCALATE',
        reviewNotes: 'Complex legal issues',
      });

      expect(result.nextStep).toContain('human arbitrator');
    });
  });
});
