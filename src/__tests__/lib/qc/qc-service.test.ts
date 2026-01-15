/**
 * QC Service Tests
 *
 * Tests for quality control service including:
 * - Quality check execution
 * - Score calculation
 * - Issue detection
 * - Dashboard data aggregation
 */

// Mock dependencies before imports
jest.mock('@/lib/db', () => ({
  prisma: {
    award: {
      findUnique: jest.fn(),
      findMany: jest.fn(),
    },
    draftAward: {
      findUnique: jest.fn(),
    },
  },
}));

jest.mock('@/lib/qc/citation-verification', () => ({
  verifyCitations: jest.fn(),
}));

jest.mock('@/lib/qc/consistency-analysis', () => ({
  analyzeConsistency: jest.fn(),
}));

jest.mock('@/lib/qc/bias-detection', () => ({
  detectBias: jest.fn(),
  generateBiasReport: jest.fn(),
}));

jest.mock('@/lib/qc/audit-sampling', () => ({
  selectAuditSample: jest.fn(),
  getAuditStats: jest.fn(),
}));

import { prisma } from '@/lib/db';
import { selectAuditSample, getAuditStats } from '@/lib/qc/audit-sampling';
import { detectBias, generateBiasReport } from '@/lib/qc/bias-detection';
import { verifyCitations } from '@/lib/qc/citation-verification';
import { analyzeConsistency } from '@/lib/qc/consistency-analysis';
import { runQualityCheck, getQCDashboardData } from '@/lib/qc/qc-service';

const mockPrisma = prisma as jest.Mocked<typeof prisma>;
const mockVerifyCitations = verifyCitations as jest.Mock;
const mockAnalyzeConsistency = analyzeConsistency as jest.Mock;
const mockDetectBias = detectBias as jest.Mock;
const mockGenerateBiasReport = generateBiasReport as jest.Mock;
const mockSelectAuditSample = selectAuditSample as jest.Mock;
const mockGetAuditStats = getAuditStats as jest.Mock;

describe('QC Service', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  describe('runQualityCheck', () => {
    const mockAward = {
      id: 'award-1',
      caseId: 'case-1',
      findingsOfFact: [
        { id: 'f1', finding: 'Finding 1' },
        { id: 'f2', finding: 'Finding 2' },
        { id: 'f3', finding: 'Finding 3' },
      ],
      conclusionsOfLaw: [
        { id: 'c1', conclusion: 'Conclusion 1' },
        { id: 'c2', conclusion: 'Conclusion 2' },
      ],
      case: {
        referenceNumber: 'CASE-001',
        arbitratorAssignment: {
          arbitratorId: 'arb-1',
          arbitrator: { id: 'arb-1', name: 'John Arbitrator' },
        },
      },
    };

    it('should run full quality check with all analyses', async () => {
      (mockPrisma.award.findUnique as jest.Mock).mockResolvedValue(mockAward);

      mockVerifyCitations.mockResolvedValue({
        totalCitations: 5,
        validCitations: 4,
        invalidCitations: 1,
        unverifiedCitations: 0,
        overallScore: 0.8,
        citations: [
          { citation: '42 U.S.C. § 1983', isValid: true },
          { citation: 'Invalid Citation', isValid: false },
        ],
      });

      mockAnalyzeConsistency.mockResolvedValue({
        consistencyScore: 0.85,
        damageAnalysis: {
          isOutlier: false,
          zScore: 0.5,
          categoryAverage: 5000,
        },
        outlierFlags: [],
      });

      mockDetectBias.mockResolvedValue({
        biasScore: 0.1,
        flags: [],
        metrics: {},
      });

      const result = await runQualityCheck('award-1', { checkType: 'full' });

      expect(result.awardId).toBe('award-1');
      expect(result.checkType).toBe('full');
      expect(result.citationAnalysis).not.toBeNull();
      expect(result.consistencyAnalysis).not.toBeNull();
      expect(result.biasAnalysis).not.toBeNull();
      expect(result.overallScore).toBeGreaterThan(0);
      expect(result.status).toBeDefined();
    });

    it('should run quick check without citation analysis', async () => {
      (mockPrisma.award.findUnique as jest.Mock).mockResolvedValue(mockAward);

      mockAnalyzeConsistency.mockResolvedValue({
        consistencyScore: 0.9,
        damageAnalysis: { isOutlier: false, zScore: 0.2, categoryAverage: 5000 },
        outlierFlags: [],
      });

      const result = await runQualityCheck('award-1', { checkType: 'quick' });

      expect(result.checkType).toBe('quick');
      expect(result.citationAnalysis).toBeNull();
      expect(mockVerifyCitations).not.toHaveBeenCalled();
    });

    it('should detect citation issues and add to issues list', async () => {
      (mockPrisma.award.findUnique as jest.Mock).mockResolvedValue(mockAward);

      mockVerifyCitations.mockResolvedValue({
        totalCitations: 5,
        validCitations: 1,
        invalidCitations: 4,
        unverifiedCitations: 0,
        overallScore: 0.2,
        citations: [
          { citation: 'Invalid 1', isValid: false },
          { citation: 'Invalid 2', isValid: false },
          { citation: 'Invalid 3', isValid: false },
          { citation: 'Invalid 4', isValid: false },
        ],
      });

      mockAnalyzeConsistency.mockResolvedValue({
        consistencyScore: 0.9,
        damageAnalysis: { isOutlier: false },
        outlierFlags: [],
      });

      mockDetectBias.mockResolvedValue({
        biasScore: 0,
        flags: [],
      });

      const result = await runQualityCheck('award-1', { checkType: 'full' });

      expect(result.issues.length).toBeGreaterThan(0);
      expect(result.issues.some((i) => i.category === 'citation')).toBe(true);
      expect(result.issues.find((i) => i.category === 'citation')?.severity).toBe('high');
    });

    it('should detect consistency outliers', async () => {
      (mockPrisma.award.findUnique as jest.Mock).mockResolvedValue(mockAward);

      mockVerifyCitations.mockResolvedValue({
        overallScore: 1,
        totalCitations: 0,
        validCitations: 0,
        invalidCitations: 0,
        unverifiedCitations: 0,
        citations: [],
      });

      mockAnalyzeConsistency.mockResolvedValue({
        consistencyScore: 0.5,
        damageAnalysis: {
          isOutlier: true,
          zScore: 3.5,
          categoryAverage: 5000,
        },
        outlierFlags: [],
      });

      mockDetectBias.mockResolvedValue({
        biasScore: 0,
        flags: [],
      });

      const result = await runQualityCheck('award-1', { checkType: 'full' });

      expect(result.issues.some((i) => i.category === 'consistency')).toBe(true);
      expect(result.recommendations.length).toBeGreaterThan(0);
    });

    it('should detect bias flags', async () => {
      (mockPrisma.award.findUnique as jest.Mock).mockResolvedValue(mockAward);

      mockVerifyCitations.mockResolvedValue({
        overallScore: 1,
        totalCitations: 0,
        validCitations: 0,
        invalidCitations: 0,
        unverifiedCitations: 0,
        citations: [],
      });

      mockAnalyzeConsistency.mockResolvedValue({
        consistencyScore: 0.9,
        damageAnalysis: { isOutlier: false },
        outlierFlags: [],
      });

      mockDetectBias.mockResolvedValue({
        biasScore: 0.7,
        flags: [
          {
            type: 'party_bias',
            severity: 'high',
            description: 'Strong claimant favoritism detected',
            statistic: 0.85,
            threshold: 0.65,
          },
        ],
      });

      const result = await runQualityCheck('award-1', { checkType: 'full' });

      expect(result.issues.some((i) => i.category === 'bias')).toBe(true);
      expect(result.recommendations.some((r) => r.includes('bias'))).toBe(true);
    });

    it('should detect insufficient findings', async () => {
      const awardWithFewFindings = {
        ...mockAward,
        findingsOfFact: [{ id: 'f1', finding: 'Only one' }],
      };

      (mockPrisma.award.findUnique as jest.Mock).mockResolvedValue(awardWithFewFindings);

      mockAnalyzeConsistency.mockResolvedValue({
        consistencyScore: 0.9,
        damageAnalysis: { isOutlier: false },
        outlierFlags: [],
      });

      const result = await runQualityCheck('award-1', { checkType: 'quick' });

      expect(
        result.issues.some((i) => i.category === 'structure' && i.description.includes('findings'))
      ).toBe(true);
    });

    it('should throw error if award not found', async () => {
      (mockPrisma.award.findUnique as jest.Mock).mockResolvedValue(null);

      await expect(runQualityCheck('invalid-id')).rejects.toThrow('Award not found');
    });

    it('should calculate passed status for high scores', async () => {
      (mockPrisma.award.findUnique as jest.Mock).mockResolvedValue(mockAward);

      mockVerifyCitations.mockResolvedValue({
        overallScore: 1,
        totalCitations: 5,
        validCitations: 5,
        invalidCitations: 0,
        unverifiedCitations: 0,
        citations: [],
      });

      mockAnalyzeConsistency.mockResolvedValue({
        consistencyScore: 0.95,
        damageAnalysis: { isOutlier: false },
        outlierFlags: [],
      });

      mockDetectBias.mockResolvedValue({
        biasScore: 0,
        flags: [],
      });

      const result = await runQualityCheck('award-1', { checkType: 'full' });

      expect(result.status).toBe('passed');
      expect(result.overallScore).toBeGreaterThanOrEqual(0.8);
    });

    it('should calculate failed status for low scores', async () => {
      (mockPrisma.award.findUnique as jest.Mock).mockResolvedValue(mockAward);

      mockVerifyCitations.mockResolvedValue({
        overallScore: 0.1,
        totalCitations: 10,
        validCitations: 1,
        invalidCitations: 9,
        unverifiedCitations: 0,
        citations: Array(9).fill({ citation: 'Bad', isValid: false }),
      });

      mockAnalyzeConsistency.mockResolvedValue({
        consistencyScore: 0.3,
        damageAnalysis: { isOutlier: true, zScore: 4, categoryAverage: 1000 },
        outlierFlags: [
          { description: 'Major outlier', severity: 'high', value: 'test', expectedRange: 'range' },
        ],
      });

      mockDetectBias.mockResolvedValue({
        biasScore: 0.8,
        flags: [
          {
            type: 'bias',
            severity: 'critical',
            description: 'Critical bias',
            statistic: 0.9,
            threshold: 0.5,
          },
        ],
      });

      const result = await runQualityCheck('award-1', { checkType: 'full' });

      expect(result.status).toBe('failed');
      expect(result.overallScore).toBeLessThan(0.6);
    });
  });

  describe('getQCDashboardData', () => {
    it('should aggregate dashboard data', async () => {
      const mockAwards = [
        {
          id: 'award-1',
          issuedAt: new Date(),
          findingsOfFact: [{ id: 'f1' }, { id: 'f2' }, { id: 'f3' }],
          conclusionsOfLaw: [{ id: 'c1' }, { id: 'c2' }],
          case: {
            referenceNumber: 'CASE-001',
            arbitratorAssignment: {
              arbitratorId: 'arb-1',
              arbitrator: { id: 'arb-1', name: 'Arbitrator' },
            },
          },
        },
      ];

      (mockPrisma.award.findMany as jest.Mock).mockResolvedValue(mockAwards);
      (mockPrisma.award.findUnique as jest.Mock).mockResolvedValue(mockAwards[0]);

      mockAnalyzeConsistency.mockResolvedValue({
        consistencyScore: 0.9,
        damageAnalysis: { isOutlier: false },
        outlierFlags: [],
      });

      mockGenerateBiasReport.mockResolvedValue({
        totalArbitrators: 5,
        flaggedArbitrators: 1,
        averageBiasScore: 0.2,
        arbitrators: [],
      });

      mockGetAuditStats.mockResolvedValue({
        totalSampled: 10,
        auditedCount: 8,
        pendingCount: 2,
        averageScore: 0.85,
      });

      mockSelectAuditSample.mockResolvedValue([]);

      mockVerifyCitations.mockResolvedValue({
        totalCitations: 5,
        validCitations: 4,
        invalidCitations: 1,
        unverifiedCitations: 0,
        overallScore: 0.8,
        citations: [],
      });

      const result = await getQCDashboardData({ periodDays: 30, limit: 10 });

      expect(result.summary).toBeDefined();
      expect(result.summary.totalAwardsChecked).toBeGreaterThanOrEqual(0);
      expect(result.citationStats).toBeDefined();
      expect(result.consistencyStats).toBeDefined();
      expect(result.auditStats).toBeDefined();
      expect(result.trends).toBeDefined();
    });

    it('should handle empty award list', async () => {
      (mockPrisma.award.findMany as jest.Mock).mockResolvedValue([]);

      mockGenerateBiasReport.mockResolvedValue({
        totalArbitrators: 0,
        flaggedArbitrators: 0,
        averageBiasScore: 0,
        arbitrators: [],
      });

      mockGetAuditStats.mockResolvedValue({
        totalSampled: 0,
        auditedCount: 0,
        pendingCount: 0,
        averageScore: 0,
      });

      mockSelectAuditSample.mockResolvedValue([]);

      const result = await getQCDashboardData();

      expect(result.summary.totalAwardsChecked).toBe(0);
      expect(result.summary.passRate).toBe(0);
      expect(result.recentChecks).toHaveLength(0);
    });
  });
});
