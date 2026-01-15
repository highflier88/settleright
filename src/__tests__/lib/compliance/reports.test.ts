/**
 * Compliance Reports Service Tests
 *
 * Tests for compliance report generation.
 */

import { prisma } from '@/lib/db';
import { createAuditLog, verifyAuditLogIntegrity } from '@/lib/services/audit';
import {
  generatePlatformActivityReport,
  generateCaseResolutionReport,
  generateDataIntegrityReport,
  generateArbitratorPerformanceReport,
  exportComplianceReport,
} from '@/lib/compliance/reports';

// Mock dependencies
jest.mock('@/lib/db', () => ({
  prisma: {
    user: {
      count: jest.fn(),
    },
    case: {
      count: jest.fn(),
      findMany: jest.fn(),
      findUnique: jest.fn(),
      groupBy: jest.fn(),
      aggregate: jest.fn(),
    },
    award: {
      aggregate: jest.fn(),
    },
    auditLog: {
      count: jest.fn(),
      findMany: jest.fn(),
      groupBy: jest.fn(),
    },
    arbitratorProfile: {
      findMany: jest.fn(),
    },
    arbitratorAssignment: {
      findMany: jest.fn(),
    },
  },
}));

jest.mock('@/lib/services/audit', () => ({
  createAuditLog: jest.fn(),
  verifyAuditLogIntegrity: jest.fn(),
}));

const mockPrisma = prisma as jest.Mocked<typeof prisma>;
const mockCreateAuditLog = createAuditLog as jest.Mock;
const mockVerifyAuditLogIntegrity = verifyAuditLogIntegrity as jest.Mock;

describe('Compliance Reports Service', () => {
  const testOptions = {
    startDate: new Date('2026-01-01'),
    endDate: new Date('2026-01-31'),
  };

  beforeEach(() => {
    jest.clearAllMocks();
  });

  // ==========================================================================
  // Platform Activity Report
  // ==========================================================================

  describe('generatePlatformActivityReport', () => {
    beforeEach(() => {
      // User metrics
      (mockPrisma.user.count as jest.Mock)
        .mockResolvedValueOnce(100) // totalUsers
        .mockResolvedValueOnce(20) // newUsers
        .mockResolvedValueOnce(80); // verifiedUsers

      // Active users
      (mockPrisma.auditLog.findMany as jest.Mock).mockResolvedValue([
        { userId: 'user-1' },
        { userId: 'user-2' },
        { userId: 'user-3' },
      ]);

      // Case metrics
      (mockPrisma.case.count as jest.Mock)
        .mockResolvedValueOnce(50) // totalCases
        .mockResolvedValueOnce(10) // newCases
        .mockResolvedValueOnce(5) // resolvedCases
        .mockResolvedValueOnce(15); // pendingCases

      (mockPrisma.case.groupBy as jest.Mock).mockResolvedValue([
        { status: 'PENDING_RESPONDENT', _count: { status: 10 } },
        { status: 'DECIDED', _count: { status: 5 } },
      ]);

      (mockPrisma.case.findMany as jest.Mock).mockResolvedValue([
        { createdAt: new Date('2026-01-01'), updatedAt: new Date('2026-01-10') },
        { createdAt: new Date('2026-01-05'), updatedAt: new Date('2026-01-20') },
      ]);

      // Financial metrics
      (mockPrisma.case.aggregate as jest.Mock).mockResolvedValue({
        _sum: { amount: { toNumber: () => 500000 } },
        _avg: { amount: { toNumber: () => 10000 } },
        _count: { id: 50 },
      });

      (mockPrisma.award.aggregate as jest.Mock).mockResolvedValue({
        _sum: { awardAmount: { toNumber: () => 250000 } },
        _avg: { awardAmount: { toNumber: () => 5000 } },
      });

      // Audit metrics
      (mockPrisma.auditLog.count as jest.Mock).mockResolvedValue(500);
      (mockPrisma.auditLog.groupBy as jest.Mock).mockResolvedValue([
        { action: 'USER_LOGIN', _count: { action: 200 } },
        { action: 'CASE_CREATED', _count: { action: 50 } },
      ]);
    });

    it('should generate platform activity report', async () => {
      const result = await generatePlatformActivityReport(testOptions, 'admin-123');

      expect(result.reportType).toBe('PLATFORM_ACTIVITY');
      expect(result.reportId).toMatch(/^PAR-/);
      expect(result.period.startDate).toEqual(testOptions.startDate);
      expect(result.period.endDate).toEqual(testOptions.endDate);
      expect(result.generatedBy).toBe('admin-123');
      expect(result.generatedAt).toBeInstanceOf(Date);
    });

    it('should include user metrics', async () => {
      const result = await generatePlatformActivityReport(testOptions, 'admin-123');

      expect(result.userMetrics.totalUsers).toBe(100);
      expect(result.userMetrics.newUsers).toBe(20);
      expect(result.userMetrics.verifiedUsers).toBe(80);
      expect(result.userMetrics.activeUsers).toBe(3);
    });

    it('should include case metrics', async () => {
      const result = await generatePlatformActivityReport(testOptions, 'admin-123');

      expect(result.caseMetrics.totalCases).toBe(50);
      expect(result.caseMetrics.newCases).toBe(10);
      expect(result.caseMetrics.resolvedCases).toBe(5);
      expect(result.caseMetrics.pendingCases).toBe(15);
      expect(result.caseMetrics.casesByStatus).toHaveProperty('PENDING_RESPONDENT');
    });

    it('should include financial metrics', async () => {
      const result = await generatePlatformActivityReport(testOptions, 'admin-123');

      expect(result.financialMetrics.totalClaimAmount).toBe(500000);
      expect(result.financialMetrics.totalAwardAmount).toBe(250000);
      expect(result.financialMetrics.averageClaimAmount).toBe(10000);
      expect(result.financialMetrics.averageAwardAmount).toBe(5000);
    });

    it('should include audit metrics', async () => {
      const result = await generatePlatformActivityReport(testOptions, 'admin-123');

      expect(result.auditMetrics.totalAuditEvents).toBe(500);
      expect(result.auditMetrics.eventsByAction).toHaveProperty('USER_LOGIN');
    });

    it('should create audit log for report generation', async () => {
      await generatePlatformActivityReport(testOptions, 'admin-123');

      expect(mockCreateAuditLog).toHaveBeenCalledWith(
        expect.objectContaining({
          action: 'COMPLIANCE_REPORT_GENERATED',
          userId: 'admin-123',
          metadata: expect.objectContaining({
            reportType: 'PLATFORM_ACTIVITY',
          }),
        })
      );
    });
  });

  // ==========================================================================
  // Case Resolution Report
  // ==========================================================================

  describe('generateCaseResolutionReport', () => {
    beforeEach(() => {
      const now = new Date('2026-01-15');
      const mockCases = [
        {
          id: 'case-1',
          createdAt: new Date('2026-01-01'),
          updatedAt: new Date('2026-01-10'),
          award: { prevailingParty: 'CLAIMANT', awardAmount: { toNumber: () => 5000 } },
        },
        {
          id: 'case-2',
          createdAt: new Date('2026-01-05'),
          updatedAt: new Date('2026-01-15'),
          award: { prevailingParty: 'RESPONDENT', awardAmount: { toNumber: () => 0 } },
        },
        {
          id: 'case-3',
          createdAt: new Date('2026-01-08'),
          updatedAt: new Date('2026-01-20'),
          award: { prevailingParty: 'SPLIT', awardAmount: { toNumber: () => 2500 } },
        },
      ];

      (mockPrisma.case.findMany as jest.Mock).mockResolvedValue(mockCases);
      (mockPrisma.case.groupBy as jest.Mock).mockResolvedValue([
        { disputeType: 'CONTRACT', _count: { id: 2 } },
        { jurisdiction: 'US-CA', _count: { id: 3 } },
      ]);
    });

    it('should generate case resolution report', async () => {
      const result = await generateCaseResolutionReport(testOptions);

      expect(result.reportType).toBe('CASE_RESOLUTION');
      expect(result.reportId).toMatch(/^CRR-/);
      expect(result.period.startDate).toEqual(testOptions.startDate);
      expect(result.generatedAt).toBeInstanceOf(Date);
    });

    it('should calculate summary statistics', async () => {
      const result = await generateCaseResolutionReport(testOptions);

      expect(result.summary.totalResolved).toBe(3);
      expect(result.summary.claimantPrevailed).toBe(1);
      expect(result.summary.respondentPrevailed).toBe(1);
      expect(result.summary.splitDecisions).toBe(1);
      expect(result.summary.averageResolutionDays).toBeGreaterThan(0);
    });
  });

  // ==========================================================================
  // Data Integrity Report
  // ==========================================================================

  describe('generateDataIntegrityReport', () => {
    beforeEach(() => {
      mockVerifyAuditLogIntegrity.mockResolvedValue({
        isValid: true,
        totalLogs: 100,
        invalidLogs: [],
      });

      (mockPrisma.case.findMany as jest.Mock).mockResolvedValue([
        { id: 'case-1' },
        { id: 'case-2' },
        { id: 'case-3' },
      ]);

      (mockPrisma.auditLog.findMany as jest.Mock).mockResolvedValue([
        { caseId: 'case-1' },
        { caseId: 'case-2' },
      ]);

      (mockPrisma.case.findUnique as jest.Mock).mockResolvedValue({ id: 'case-1' });
    });

    it('should generate data integrity report', async () => {
      const result = await generateDataIntegrityReport(testOptions);

      expect(result.reportType).toBe('DATA_INTEGRITY');
      expect(result.reportId).toMatch(/^DIR-/);
      expect(result.generatedAt).toBeInstanceOf(Date);
    });

    it('should include audit log integrity status', async () => {
      const result = await generateDataIntegrityReport(testOptions);

      expect(result.auditLogIntegrity.isValid).toBe(true);
      expect(result.auditLogIntegrity.totalLogs).toBe(100);
      expect(result.auditLogIntegrity.validLogs).toBe(100);
      expect(result.auditLogIntegrity.invalidLogs).toBe(0);
      expect(result.auditLogIntegrity.chainStatus).toBe('intact');
    });

    it('should detect integrity issues', async () => {
      mockVerifyAuditLogIntegrity.mockResolvedValue({
        isValid: false,
        totalLogs: 100,
        invalidLogs: [{ id: 'log-1' }, { id: 'log-2' }],
      });

      const result = await generateDataIntegrityReport(testOptions);

      expect(result.auditLogIntegrity.isValid).toBe(false);
      expect(result.auditLogIntegrity.invalidLogs).toBe(2);
      expect(result.auditLogIntegrity.chainStatus).toBe('partial');
      expect(
        result.recommendations.some((r) => r.includes('Audit log chain integrity issues'))
      ).toBe(true);
    });

    it('should identify cases without audit trail', async () => {
      const result = await generateDataIntegrityReport(testOptions);

      expect(result.dataConsistency.casesWithAuditTrail).toBe(2);
      expect(result.dataConsistency.casesWithoutAuditTrail).toBe(1);
    });

    it('should provide recommendations when issues found', async () => {
      const result = await generateDataIntegrityReport(testOptions);

      expect(result.recommendations).toBeDefined();
      expect(result.recommendations.length).toBeGreaterThan(0);
    });
  });

  // ==========================================================================
  // Arbitrator Performance Report
  // ==========================================================================

  describe('generateArbitratorPerformanceReport', () => {
    beforeEach(() => {
      (mockPrisma.arbitratorProfile.findMany as jest.Mock).mockResolvedValue([
        {
          userId: 'arb-1',
          isActive: true,
          user: { id: 'arb-1', name: 'Judge Smith' },
        },
        {
          userId: 'arb-2',
          isActive: true,
          user: { id: 'arb-2', name: 'Judge Jones' },
        },
      ]);

      (mockPrisma.arbitratorAssignment.findMany as jest.Mock).mockResolvedValue([
        {
          arbitratorId: 'arb-1',
          assignedAt: new Date('2026-01-01'),
          reviewCompletedAt: new Date('2026-01-05'),
          case: {
            award: { prevailingParty: 'CLAIMANT', awardAmount: { toNumber: () => 5000 } },
          },
        },
        {
          arbitratorId: 'arb-1',
          assignedAt: new Date('2026-01-10'),
          reviewCompletedAt: new Date('2026-01-12'),
          case: {
            award: { prevailingParty: 'RESPONDENT', awardAmount: { toNumber: () => 0 } },
          },
        },
        {
          arbitratorId: 'arb-2',
          assignedAt: new Date('2026-01-05'),
          reviewCompletedAt: new Date('2026-01-10'),
          case: {
            award: { prevailingParty: 'CLAIMANT', awardAmount: { toNumber: () => 3000 } },
          },
        },
      ]);
    });

    it('should generate arbitrator performance report', async () => {
      const result = await generateArbitratorPerformanceReport(testOptions);

      expect(result.reportType).toBe('ARBITRATOR_PERFORMANCE');
      expect(result.reportId).toMatch(/^APR-/);
      expect(result.generatedAt).toBeInstanceOf(Date);
    });

    it('should include summary statistics', async () => {
      const result = await generateArbitratorPerformanceReport(testOptions);

      expect(result.summary.totalArbitrators).toBe(2);
      expect(result.summary.activeArbitrators).toBe(2);
      expect(result.summary.totalCasesReviewed).toBe(3);
      expect(result.summary.averageCasesPerArbitrator).toBeGreaterThan(0);
    });

    it('should include per-arbitrator statistics', async () => {
      const result = await generateArbitratorPerformanceReport(testOptions);

      expect(result.arbitrators).toHaveLength(2);

      const arb1 = result.arbitrators.find((a) => a.id === 'arb-1');
      expect(arb1).toBeDefined();
      expect(arb1?.casesCompleted).toBe(2);
      expect(arb1?.averageReviewDays).toBeGreaterThan(0);
    });

    it('should sort arbitrators by cases completed', async () => {
      const result = await generateArbitratorPerformanceReport(testOptions);

      // arb-1 has 2 cases, arb-2 has 1 case
      expect(result.arbitrators[0]?.casesCompleted).toBeGreaterThanOrEqual(
        result.arbitrators[1]?.casesCompleted || 0
      );
    });
  });

  // ==========================================================================
  // Export Compliance Report
  // ==========================================================================

  describe('exportComplianceReport', () => {
    const mockReport = {
      reportId: 'TEST-123',
      reportType: 'TEST',
      period: {
        startDate: new Date('2026-01-01'),
        endDate: new Date('2026-01-31'),
      },
      metrics: {
        count: 10,
        average: 5.5,
      },
      items: [{ id: 1 }, { id: 2 }],
      generatedAt: new Date('2026-01-15'),
    };

    it('should export to JSON format', () => {
      const result = exportComplianceReport(mockReport, 'json');

      expect(result).toContain('"reportId": "TEST-123"');
      expect(() => JSON.parse(result)).not.toThrow();

      const parsed = JSON.parse(result);
      expect(parsed.reportId).toBe('TEST-123');
      expect(parsed.metrics.count).toBe(10);
    });

    it('should export to CSV format', () => {
      const result = exportComplianceReport(mockReport, 'csv');

      expect(result).toContain('reportId');
      expect(result).toContain('TEST-123');
      expect(result.split('\n')).toHaveLength(2); // header + values
    });

    it('should handle nested objects in CSV export', () => {
      const result = exportComplianceReport(mockReport, 'csv');

      expect(result).toContain('metrics.count');
      expect(result).toContain('10');
    });

    it('should handle arrays in CSV export', () => {
      const result = exportComplianceReport(mockReport, 'csv');

      // Arrays should be JSON stringified
      expect(result).toContain('items');
    });

    it('should use JSON as default format', () => {
      const result = exportComplianceReport(mockReport);

      expect(() => JSON.parse(result)).not.toThrow();
    });
  });
});
