/**
 * Award Workflow Tests
 *
 * Tests for award review lifecycle including:
 * - Modification tracking with revisions
 * - Rejection with feedback
 * - Escalation to senior arbitrators
 * - Approval workflow
 */

// Mock Prisma before importing anything that uses it
jest.mock('@/lib/db', () => ({
  prisma: {
    draftAward: {
      findUnique: jest.fn(),
      update: jest.fn(),
    },
    draftAwardRevision: {
      findFirst: jest.fn(),
      findMany: jest.fn(),
      create: jest.fn(),
    },
    awardEscalation: {
      findUnique: jest.fn(),
      upsert: jest.fn(),
      update: jest.fn(),
    },
    case: {
      findUnique: jest.fn(),
      update: jest.fn(),
    },
    user: {
      findMany: jest.fn(),
    },
    $transaction: jest.fn((callback) => callback({
      draftAward: {
        update: jest.fn().mockResolvedValue({}),
        findUnique: jest.fn().mockResolvedValue({
          id: 'draft-1',
          findingsOfFact: '[]',
          conclusionsOfLaw: '[]',
          decision: 'Test decision',
          awardAmount: { toNumber: () => 5000 },
          prevailingParty: 'CLAIMANT',
          reasoning: 'Test reasoning',
        }),
      },
      draftAwardRevision: {
        create: jest.fn().mockResolvedValue({}),
      },
    })),
  },
}));

// Mock notification service
jest.mock('@/lib/services/notification', () => ({
  createInAppNotification: jest.fn().mockResolvedValue(undefined),
  NotificationTemplates: {
    DRAFT_AWARD_READY: 'DRAFT_AWARD_READY',
  },
}));

import {
  modifyDraftAward,
  rejectDraftAward,
  escalateDraftAward,
  approveDraftAward,
  getRevisionHistory,
  getRevision,
  createInitialRevision,
} from '@/lib/award/workflow';
import { prisma } from '@/lib/db';

const mockPrisma = prisma as jest.Mocked<typeof prisma>;

describe('Award Workflow', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  describe('createInitialRevision', () => {
    it('should create initial revision when none exists', async () => {
      (mockPrisma.draftAward.findUnique as jest.Mock).mockResolvedValue({
        id: 'draft-1',
        findingsOfFact: '[]',
        conclusionsOfLaw: '[]',
        decision: 'Test decision',
        awardAmount: { toNumber: () => 5000 },
        prevailingParty: 'CLAIMANT',
        reasoning: 'Test reasoning',
      });
      (mockPrisma.draftAwardRevision.findFirst as jest.Mock).mockResolvedValue(null);
      (mockPrisma.draftAwardRevision.create as jest.Mock).mockResolvedValue({});

      await createInitialRevision('draft-1', 'user-1');

      expect(mockPrisma.draftAwardRevision.create).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({
            draftAwardId: 'draft-1',
            version: 1,
            changeType: 'INITIAL',
            modifiedById: 'user-1',
          }),
        })
      );
    });

    it('should not create duplicate initial revision', async () => {
      (mockPrisma.draftAward.findUnique as jest.Mock).mockResolvedValue({
        id: 'draft-1',
        findingsOfFact: '[]',
      });
      (mockPrisma.draftAwardRevision.findFirst as jest.Mock).mockResolvedValue({
        id: 'revision-1',
        version: 1,
      });

      await createInitialRevision('draft-1', 'user-1');

      expect(mockPrisma.draftAwardRevision.create).not.toHaveBeenCalled();
    });

    it('should throw error if draft award not found', async () => {
      (mockPrisma.draftAward.findUnique as jest.Mock).mockResolvedValue(null);

      await expect(createInitialRevision('draft-1', 'user-1')).rejects.toThrow(
        'Draft award not found'
      );
    });
  });

  describe('getRevisionHistory', () => {
    it('should return revision history in descending order', async () => {
      const mockRevisions = [
        {
          version: 3,
          changeType: 'ARBITRATOR_EDIT',
          changeSummary: 'Modified award amount',
          changedFields: ['awardAmount'],
          modifiedById: 'user-1',
          modifiedBy: { id: 'user-1', name: 'John Doe' },
          createdAt: new Date('2026-01-13'),
        },
        {
          version: 2,
          changeType: 'ARBITRATOR_EDIT',
          changeSummary: 'Updated findings',
          changedFields: ['findingsOfFact'],
          modifiedById: 'user-1',
          modifiedBy: { id: 'user-1', name: 'John Doe' },
          createdAt: new Date('2026-01-12'),
        },
        {
          version: 1,
          changeType: 'INITIAL',
          changeSummary: 'Initial AI-generated draft',
          changedFields: [],
          modifiedById: 'system',
          modifiedBy: { id: 'system', name: 'System' },
          createdAt: new Date('2026-01-11'),
        },
      ];

      (mockPrisma.draftAwardRevision.findMany as jest.Mock).mockResolvedValue(mockRevisions);

      const history = await getRevisionHistory('draft-1');

      expect(history).toHaveLength(3);
      expect(history[0]!.version).toBe(3);
      expect(history[2]!.version).toBe(1);
    });
  });

  describe('getRevision', () => {
    it('should return specific revision with parsed fields', async () => {
      // The actual code uses Number(revision.awardAmount), so we need a proper Decimal mock
      const mockDecimal = Object.assign(5000, { toNumber: () => 5000 });
      (mockPrisma.draftAwardRevision.findFirst as jest.Mock).mockResolvedValue({
        findingsOfFact: [{ id: 'f1', finding: 'Test' }],
        conclusionsOfLaw: [{ id: 'c1', conclusion: 'Test' }],
        decision: 'Test decision',
        awardAmount: mockDecimal,
        prevailingParty: 'CLAIMANT',
        reasoning: 'Test reasoning',
      });

      const revision = await getRevision('draft-1', 2);

      expect(revision).not.toBeNull();
      expect(revision?.decision).toBe('Test decision');
      expect(revision?.awardAmount).toBe(5000);
    });

    it('should return null if revision not found', async () => {
      (mockPrisma.draftAwardRevision.findFirst as jest.Mock).mockResolvedValue(null);

      const revision = await getRevision('draft-1', 999);

      expect(revision).toBeNull();
    });
  });

  describe('modifyDraftAward', () => {
    it('should apply modifications and create revision', async () => {
      (mockPrisma.draftAward.findUnique as jest.Mock).mockResolvedValue({
        id: 'draft-1',
        caseId: 'case-1',
      });
      (mockPrisma.draftAwardRevision.findFirst as jest.Mock).mockResolvedValue({
        version: 1,
      });

      const result = await modifyDraftAward(
        'case-1',
        'user-1',
        {
          awardAmount: 7500,
          reasoning: 'Updated reasoning',
        },
        'Adjusted award amount based on review'
      );

      expect(result.changedFields).toContain('awardAmount');
      expect(result.changedFields).toContain('reasoning');
      expect(result.version).toBe(2);
      expect(mockPrisma.$transaction).toHaveBeenCalled();
    });

    it('should throw error if no modifications provided', async () => {
      (mockPrisma.draftAward.findUnique as jest.Mock).mockResolvedValue({
        id: 'draft-1',
        caseId: 'case-1',
      });

      await expect(modifyDraftAward('case-1', 'user-1', {})).rejects.toThrow(
        'No modifications provided'
      );
    });

    it('should throw error if draft award not found', async () => {
      (mockPrisma.draftAward.findUnique as jest.Mock).mockResolvedValue(null);

      await expect(
        modifyDraftAward('case-1', 'user-1', { awardAmount: 5000 })
      ).rejects.toThrow('Draft award not found');
    });

    it('should handle prevailingParty conversion', async () => {
      (mockPrisma.draftAward.findUnique as jest.Mock).mockResolvedValue({
        id: 'draft-1',
        caseId: 'case-1',
      });
      (mockPrisma.draftAwardRevision.findFirst as jest.Mock).mockResolvedValue({
        version: 1,
      });

      const result = await modifyDraftAward('case-1', 'user-1', {
        prevailingParty: 'respondent',
      });

      expect(result.changedFields).toContain('prevailingParty');
    });
  });

  describe('rejectDraftAward', () => {
    it('should reject award with structured feedback', async () => {
      (mockPrisma.draftAward.findUnique as jest.Mock).mockResolvedValue({
        id: 'draft-1',
        caseId: 'case-1',
      });
      (mockPrisma.draftAward.update as jest.Mock).mockResolvedValue({});
      (mockPrisma.case.update as jest.Mock).mockResolvedValue({});

      const result = await rejectDraftAward('case-1', 'user-1', {
        category: 'legal_error',
        description: 'Incorrect application of statute of limitations',
        affectedSections: ['Conclusion 2', 'Conclusion 3'],
        severity: 'major',
      });

      expect(result.success).toBe(true);
      expect(mockPrisma.draftAward.update).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({
            reviewStatus: 'REJECT',
          }),
        })
      );
      expect(mockPrisma.case.update).toHaveBeenCalledWith(
        expect.objectContaining({
          data: { status: 'ANALYSIS_IN_PROGRESS' },
        })
      );
    });

    it('should throw error if draft award not found', async () => {
      (mockPrisma.draftAward.findUnique as jest.Mock).mockResolvedValue(null);

      await expect(
        rejectDraftAward('case-1', 'user-1', {
          category: 'legal_error',
          description: 'Test',
          affectedSections: [],
          severity: 'minor',
        })
      ).rejects.toThrow('Draft award not found');
    });
  });

  describe('escalateDraftAward', () => {
    it('should escalate and assign to senior arbitrator', async () => {
      (mockPrisma.draftAward.findUnique as jest.Mock).mockResolvedValue({
        id: 'draft-1',
        caseId: 'case-1',
      });
      (mockPrisma.awardEscalation.findUnique as jest.Mock).mockResolvedValue(null);
      (mockPrisma.user.findMany as jest.Mock).mockResolvedValue([
        {
          id: 'senior-1',
          name: 'Senior Arbitrator',
          arbitratorProfile: {
            casesCompleted: 100,
            maxCasesPerWeek: 10,
          },
          assignedCases: [],
        },
      ]);
      (mockPrisma.awardEscalation.upsert as jest.Mock).mockResolvedValue({
        id: 'esc-1',
        status: 'ASSIGNED',
        escalatedAt: new Date(),
      });
      (mockPrisma.draftAward.update as jest.Mock).mockResolvedValue({});
      (mockPrisma.case.findUnique as jest.Mock).mockResolvedValue({
        referenceNumber: 'CASE-001',
      });

      const result = await escalateDraftAward('case-1', 'user-1', {
        reason: 'COMPLEX_LEGAL_ISSUES',
        reasonDetails: 'Multiple jurisdictions involved',
        urgency: 'HIGH',
      });

      expect(result.status).toBe('ASSIGNED');
      expect(result.assignedToId).toBe('senior-1');
    });

    it('should throw error if already escalated', async () => {
      (mockPrisma.draftAward.findUnique as jest.Mock).mockResolvedValue({
        id: 'draft-1',
        caseId: 'case-1',
      });
      (mockPrisma.awardEscalation.findUnique as jest.Mock).mockResolvedValue({
        id: 'esc-1',
        status: 'PENDING',
      });

      await expect(
        escalateDraftAward('case-1', 'user-1', {
          reason: 'COMPLEX_LEGAL_ISSUES',
        })
      ).rejects.toThrow('already escalated');
    });

    it('should handle escalation when no senior arbitrator available', async () => {
      (mockPrisma.draftAward.findUnique as jest.Mock).mockResolvedValue({
        id: 'draft-1',
        caseId: 'case-1',
      });
      (mockPrisma.awardEscalation.findUnique as jest.Mock).mockResolvedValue(null);
      (mockPrisma.user.findMany as jest.Mock).mockResolvedValue([]);
      (mockPrisma.awardEscalation.upsert as jest.Mock).mockResolvedValue({
        id: 'esc-1',
        status: 'PENDING',
        escalatedAt: new Date(),
      });
      (mockPrisma.draftAward.update as jest.Mock).mockResolvedValue({});

      const result = await escalateDraftAward('case-1', 'user-1', {
        reason: 'OTHER',
      });

      expect(result.status).toBe('PENDING');
      expect(result.assignedToId).toBeUndefined();
    });
  });

  describe('approveDraftAward', () => {
    it('should approve draft award and update case status', async () => {
      (mockPrisma.draftAward.findUnique as jest.Mock).mockResolvedValue({
        id: 'draft-1',
        caseId: 'case-1',
        findingsOfFact: '[]',
        conclusionsOfLaw: '[]',
        decision: 'Test',
        awardAmount: { toNumber: () => 5000 },
        prevailingParty: 'CLAIMANT',
        reasoning: 'Test',
      });
      (mockPrisma.draftAward.update as jest.Mock).mockResolvedValue({});
      (mockPrisma.case.update as jest.Mock).mockResolvedValue({});
      (mockPrisma.draftAwardRevision.findFirst as jest.Mock).mockResolvedValue({
        version: 1,
      });
      (mockPrisma.draftAwardRevision.create as jest.Mock).mockResolvedValue({});

      const result = await approveDraftAward('case-1', 'user-1', 'Looks good');

      expect(result.success).toBe(true);
      expect(result.nextStep).toContain('issuance');
      expect(mockPrisma.draftAward.update).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({
            reviewStatus: 'APPROVE',
          }),
        })
      );
      expect(mockPrisma.case.update).toHaveBeenCalledWith(
        expect.objectContaining({
          data: { status: 'DECIDED' },
        })
      );
    });

    it('should throw error if draft award not found', async () => {
      (mockPrisma.draftAward.findUnique as jest.Mock).mockResolvedValue(null);

      await expect(approveDraftAward('case-1', 'user-1')).rejects.toThrow(
        'Draft award not found'
      );
    });
  });
});
