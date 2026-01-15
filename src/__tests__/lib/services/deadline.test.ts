/**
 * Deadline Service Tests
 *
 * Tests for deadline management and extension handling.
 */

import { prisma } from '@/lib/db';
import { createAuditLog } from '@/lib/services/audit';
import {
  DEADLINE_CONFIG,
  addDays,
  addHours,
  calculateCaseDeadlines,
  setInitialDeadlines,
  getCasesWithApproachingDeadlines,
  getCasesWithPassedDeadlines,
  transitionToAnalysis,
  requestExtension,
  formatDeadline,
  getDeadlineStatus,
  getDeadlineUrgency,
} from '@/lib/services/deadline';

import type { DeadlineInfo } from '@/lib/services/deadline';

// Mock dependencies
jest.mock('@/lib/db', () => ({
  prisma: {
    case: {
      findUnique: jest.fn(),
      findMany: jest.fn(),
      update: jest.fn(),
    },
  },
}));

jest.mock('@/lib/services/audit', () => ({
  createAuditLog: jest.fn(),
}));

const mockPrisma = prisma as jest.Mocked<typeof prisma>;
const mockCreateAuditLog = createAuditLog as jest.Mock;

describe('Deadline Service', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  // ==========================================================================
  // Constants
  // ==========================================================================

  describe('DEADLINE_CONFIG', () => {
    it('should define invitation expiry as 14 days', () => {
      expect(DEADLINE_CONFIG.INVITATION_EXPIRY_DAYS).toBe(14);
    });

    it('should define evidence submission as 14 days', () => {
      expect(DEADLINE_CONFIG.EVIDENCE_SUBMISSION_DAYS).toBe(14);
    });

    it('should define rebuttal as 7 days', () => {
      expect(DEADLINE_CONFIG.REBUTTAL_DAYS).toBe(7);
    });

    it('should limit extension to 7 days max', () => {
      expect(DEADLINE_CONFIG.MAX_EXTENSION_DAYS).toBe(7);
    });

    it('should define reminder intervals', () => {
      expect(DEADLINE_CONFIG.REMINDER_INTERVALS).toContain(72);
      expect(DEADLINE_CONFIG.REMINDER_INTERVALS).toContain(24);
    });
  });

  // ==========================================================================
  // Date Utilities
  // ==========================================================================

  describe('addDays', () => {
    it('should add positive days to a date', () => {
      const date = new Date('2026-01-15T10:00:00Z');
      const result = addDays(date, 7);

      expect(result.getDate()).toBe(22);
    });

    it('should handle month overflow', () => {
      const date = new Date('2026-01-30T10:00:00Z');
      const result = addDays(date, 5);

      expect(result.getMonth()).toBe(1); // February
      expect(result.getDate()).toBe(4);
    });

    it('should not modify original date', () => {
      const date = new Date('2026-01-15T10:00:00Z');
      const originalTime = date.getTime();
      addDays(date, 7);

      expect(date.getTime()).toBe(originalTime);
    });
  });

  describe('addHours', () => {
    it('should add positive hours to a date', () => {
      const date = new Date('2026-01-15T10:00:00Z');
      const result = addHours(date, 5);

      expect(result.getHours()).toBe(15);
    });

    it('should handle day overflow', () => {
      const date = new Date('2026-01-15T22:00:00Z');
      const result = addHours(date, 5);

      expect(result.getDate()).toBe(16);
      expect(result.getHours()).toBe(3);
    });
  });

  // ==========================================================================
  // Calculate Case Deadlines
  // ==========================================================================

  describe('calculateCaseDeadlines', () => {
    it('should return empty object if case not found', async () => {
      (mockPrisma.case.findUnique as jest.Mock).mockResolvedValue(null);

      const result = await calculateCaseDeadlines('case-123');

      expect(result).toEqual({});
    });

    it('should calculate response deadline info', async () => {
      const futureDeadline = new Date(Date.now() + 3 * 24 * 60 * 60 * 1000); // 3 days from now

      (mockPrisma.case.findUnique as jest.Mock).mockResolvedValue({
        status: 'PENDING_RESPONDENT',
        responseDeadline: futureDeadline,
        evidenceDeadline: null,
        rebuttalDeadline: null,
        agreement: null,
      });

      const result = await calculateCaseDeadlines('case-123');

      expect(result.response).toBeDefined();
      expect(result.response?.type).toBe('response');
      expect(result.response?.isPassed).toBe(false);
      expect(result.response?.daysRemaining).toBeGreaterThanOrEqual(2);
      expect(result.response?.canExtend).toBe(false);
    });

    it('should mark passed deadlines', async () => {
      const pastDeadline = new Date(Date.now() - 24 * 60 * 60 * 1000); // 1 day ago

      (mockPrisma.case.findUnique as jest.Mock).mockResolvedValue({
        status: 'PENDING_RESPONDENT',
        responseDeadline: pastDeadline,
        evidenceDeadline: null,
        rebuttalDeadline: null,
        agreement: null,
      });

      const result = await calculateCaseDeadlines('case-123');

      expect(result.response?.isPassed).toBe(true);
      expect(result.response?.hoursRemaining).toBe(0);
      expect(result.response?.daysRemaining).toBe(0);
    });

    it('should calculate all deadline types', async () => {
      const now = Date.now();
      (mockPrisma.case.findUnique as jest.Mock).mockResolvedValue({
        status: 'EVIDENCE_SUBMISSION',
        responseDeadline: new Date(now + 5 * 24 * 60 * 60 * 1000),
        evidenceDeadline: new Date(now + 10 * 24 * 60 * 60 * 1000),
        rebuttalDeadline: new Date(now + 17 * 24 * 60 * 60 * 1000),
        agreement: { status: 'COMPLETED', updatedAt: new Date() },
      });

      const result = await calculateCaseDeadlines('case-123');

      expect(result.response).toBeDefined();
      expect(result.evidence).toBeDefined();
      expect(result.rebuttal).toBeDefined();
    });
  });

  // ==========================================================================
  // Set Initial Deadlines
  // ==========================================================================

  describe('setInitialDeadlines', () => {
    it('should set evidence and rebuttal deadlines', async () => {
      (mockPrisma.case.update as jest.Mock).mockResolvedValue({});

      const result = await setInitialDeadlines('case-123');

      expect(result).toBe(true);
      expect(mockPrisma.case.update).toHaveBeenCalledWith({
        where: { id: 'case-123' },
        data: expect.objectContaining({
          evidenceDeadline: expect.any(Date),
          rebuttalDeadline: expect.any(Date),
          status: 'EVIDENCE_SUBMISSION',
        }),
      });
    });

    it('should create audit log', async () => {
      (mockPrisma.case.update as jest.Mock).mockResolvedValue({});

      await setInitialDeadlines('case-123');

      expect(mockCreateAuditLog).toHaveBeenCalledWith(
        expect.objectContaining({
          action: 'CASE_STATUS_CHANGED',
          caseId: 'case-123',
        })
      );
    });

    it('should return false on error', async () => {
      (mockPrisma.case.update as jest.Mock).mockRejectedValue(new Error('DB error'));

      const result = await setInitialDeadlines('case-123');

      expect(result).toBe(false);
    });
  });

  // ==========================================================================
  // Cases With Approaching Deadlines
  // ==========================================================================

  describe('getCasesWithApproachingDeadlines', () => {
    it('should find cases with deadlines within threshold', async () => {
      const now = Date.now();
      const mockCases = [
        {
          id: 'case-1',
          referenceNumber: 'SR-2026-001',
          claimantId: 'user-1',
          respondentId: 'user-2',
          evidenceDeadline: new Date(now + 12 * 60 * 60 * 1000), // 12 hours from now
          rebuttalDeadline: new Date(now + 5 * 24 * 60 * 60 * 1000),
        },
      ];

      (mockPrisma.case.findMany as jest.Mock).mockResolvedValue(mockCases);

      const result = await getCasesWithApproachingDeadlines(24);

      expect(result).toHaveLength(1);
      expect(result[0]?.deadlineType).toBe('evidence');
      expect(result[0]?.hoursRemaining).toBeLessThan(24);
    });

    it('should return empty array if no approaching deadlines', async () => {
      (mockPrisma.case.findMany as jest.Mock).mockResolvedValue([]);

      const result = await getCasesWithApproachingDeadlines(24);

      expect(result).toEqual([]);
    });
  });

  // ==========================================================================
  // Cases With Passed Deadlines
  // ==========================================================================

  describe('getCasesWithPassedDeadlines', () => {
    it('should find cases where rebuttal deadline passed', async () => {
      const pastDeadline = new Date(Date.now() - 24 * 60 * 60 * 1000);
      const mockCases = [
        { id: 'case-1', rebuttalDeadline: pastDeadline },
        { id: 'case-2', rebuttalDeadline: pastDeadline },
      ];

      (mockPrisma.case.findMany as jest.Mock).mockResolvedValue(mockCases);

      const result = await getCasesWithPassedDeadlines();

      expect(result).toHaveLength(2);
      expect(result[0]?.deadlineType).toBe('rebuttal');
    });
  });

  // ==========================================================================
  // Transition To Analysis
  // ==========================================================================

  describe('transitionToAnalysis', () => {
    it('should update case status to ANALYSIS_PENDING', async () => {
      (mockPrisma.case.update as jest.Mock).mockResolvedValue({});

      const result = await transitionToAnalysis('case-123');

      expect(result).toBe(true);
      expect(mockPrisma.case.update).toHaveBeenCalledWith({
        where: { id: 'case-123' },
        data: { status: 'ANALYSIS_PENDING' },
      });
    });

    it('should create audit log', async () => {
      (mockPrisma.case.update as jest.Mock).mockResolvedValue({});

      await transitionToAnalysis('case-123');

      expect(mockCreateAuditLog).toHaveBeenCalledWith(
        expect.objectContaining({
          action: 'CASE_STATUS_CHANGED',
          caseId: 'case-123',
          metadata: expect.objectContaining({
            newStatus: 'ANALYSIS_PENDING',
          }),
        })
      );
    });
  });

  // ==========================================================================
  // Request Extension
  // ==========================================================================

  describe('requestExtension', () => {
    const baseRequest = {
      caseId: 'case-123',
      userId: 'user-123',
      deadlineType: 'evidence' as const,
      requestedDays: 3,
      reason: 'Need more time to gather documents',
    };

    it('should reject invalid requested days', async () => {
      const result = await requestExtension({ ...baseRequest, requestedDays: 10 });

      expect(result.success).toBe(false);
      expect(result.error).toContain('between 1 and 7 days');
    });

    it('should reject if case not found', async () => {
      (mockPrisma.case.findUnique as jest.Mock).mockResolvedValue(null);

      const result = await requestExtension(baseRequest);

      expect(result.success).toBe(false);
      expect(result.error).toBe('Case not found');
    });

    it('should reject if user is not a party', async () => {
      (mockPrisma.case.findUnique as jest.Mock).mockResolvedValue({
        id: 'case-123',
        status: 'EVIDENCE_SUBMISSION',
        claimantId: 'other-user',
        respondentId: 'another-user',
        evidenceDeadline: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000),
      });

      const result = await requestExtension(baseRequest);

      expect(result.success).toBe(false);
      expect(result.error).toBe('You are not a party to this case');
    });

    it('should reject if case is not in evidence submission', async () => {
      (mockPrisma.case.findUnique as jest.Mock).mockResolvedValue({
        id: 'case-123',
        status: 'DECIDED',
        claimantId: 'user-123',
        respondentId: 'user-456',
        evidenceDeadline: new Date(),
      });

      const result = await requestExtension(baseRequest);

      expect(result.success).toBe(false);
      expect(result.error).toContain('not available');
    });

    it('should reject if deadline has passed', async () => {
      (mockPrisma.case.findUnique as jest.Mock).mockResolvedValue({
        id: 'case-123',
        status: 'EVIDENCE_SUBMISSION',
        claimantId: 'user-123',
        respondentId: 'user-456',
        evidenceDeadline: new Date(Date.now() - 24 * 60 * 60 * 1000),
      });

      const result = await requestExtension(baseRequest);

      expect(result.success).toBe(false);
      expect(result.error).toBe('This deadline has already passed');
    });

    it('should grant extension and update deadlines', async () => {
      const futureDeadline = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000);
      const futureRebuttal = new Date(Date.now() + 14 * 24 * 60 * 60 * 1000);

      (mockPrisma.case.findUnique as jest.Mock).mockResolvedValue({
        id: 'case-123',
        status: 'EVIDENCE_SUBMISSION',
        claimantId: 'user-123',
        respondentId: 'user-456',
        evidenceDeadline: futureDeadline,
        rebuttalDeadline: futureRebuttal,
      });

      (mockPrisma.case.update as jest.Mock).mockResolvedValue({});

      const result = await requestExtension(baseRequest);

      expect(result.success).toBe(true);
      expect(result.newDeadline).toBeDefined();
      expect(mockPrisma.case.update).toHaveBeenCalledWith({
        where: { id: 'case-123' },
        data: expect.objectContaining({
          evidenceDeadline: expect.any(Date),
          rebuttalDeadline: expect.any(Date),
        }),
      });
    });
  });

  // ==========================================================================
  // Format Deadline
  // ==========================================================================

  describe('formatDeadline', () => {
    it('should format deadline as readable string', () => {
      const date = new Date('2026-03-15T14:30:00Z');
      const result = formatDeadline(date);

      expect(result).toContain('March');
      expect(result).toContain('15');
      expect(result).toContain('2026');
    });
  });

  // ==========================================================================
  // Get Deadline Status
  // ==========================================================================

  describe('getDeadlineStatus', () => {
    it('should return "Passed" for passed deadlines', () => {
      const info: DeadlineInfo = {
        type: 'evidence',
        deadline: new Date(),
        isPassed: true,
        hoursRemaining: 0,
        daysRemaining: 0,
        canExtend: false,
        extensionsUsed: 0,
      };

      expect(getDeadlineStatus(info)).toBe('Passed');
    });

    it('should show hours for urgent deadlines', () => {
      const info: DeadlineInfo = {
        type: 'evidence',
        deadline: new Date(Date.now() + 12 * 60 * 60 * 1000),
        isPassed: false,
        hoursRemaining: 12,
        daysRemaining: 0,
        canExtend: true,
        extensionsUsed: 0,
      };

      expect(getDeadlineStatus(info)).toContain('hours remaining');
    });

    it('should show days for upcoming deadlines', () => {
      const info: DeadlineInfo = {
        type: 'evidence',
        deadline: new Date(Date.now() + 5 * 24 * 60 * 60 * 1000),
        isPassed: false,
        hoursRemaining: 120,
        daysRemaining: 5,
        canExtend: true,
        extensionsUsed: 0,
      };

      expect(getDeadlineStatus(info)).toContain('days remaining');
    });
  });

  // ==========================================================================
  // Get Deadline Urgency
  // ==========================================================================

  describe('getDeadlineUrgency', () => {
    it('should return "passed" for passed deadlines', () => {
      const info: DeadlineInfo = {
        type: 'evidence',
        deadline: new Date(),
        isPassed: true,
        hoursRemaining: 0,
        daysRemaining: 0,
        canExtend: false,
        extensionsUsed: 0,
      };

      expect(getDeadlineUrgency(info)).toBe('passed');
    });

    it('should return "critical" for less than 24 hours', () => {
      const info: DeadlineInfo = {
        type: 'evidence',
        deadline: new Date(Date.now() + 12 * 60 * 60 * 1000),
        isPassed: false,
        hoursRemaining: 12,
        daysRemaining: 0,
        canExtend: true,
        extensionsUsed: 0,
      };

      expect(getDeadlineUrgency(info)).toBe('critical');
    });

    it('should return "warning" for 1-3 days', () => {
      const info: DeadlineInfo = {
        type: 'evidence',
        deadline: new Date(Date.now() + 2 * 24 * 60 * 60 * 1000),
        isPassed: false,
        hoursRemaining: 48,
        daysRemaining: 2,
        canExtend: true,
        extensionsUsed: 0,
      };

      expect(getDeadlineUrgency(info)).toBe('warning');
    });

    it('should return "normal" for more than 3 days', () => {
      const info: DeadlineInfo = {
        type: 'evidence',
        deadline: new Date(Date.now() + 10 * 24 * 60 * 60 * 1000),
        isPassed: false,
        hoursRemaining: 240,
        daysRemaining: 10,
        canExtend: true,
        extensionsUsed: 0,
      };

      expect(getDeadlineUrgency(info)).toBe('normal');
    });
  });
});
