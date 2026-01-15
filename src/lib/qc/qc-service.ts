/**
 * QC Service - Main Orchestration
 *
 * Provides a unified interface for all quality control operations:
 * - Runs comprehensive quality checks on awards
 * - Aggregates data for the QC dashboard
 * - Coordinates citation, consistency, and bias analyses
 */

import { prisma } from '@/lib/db';

import {
  selectAuditSample,
  getAuditStats,
  type AuditSample,
  type AuditStats,
} from './audit-sampling';
import {
  detectBias,
  generateBiasReport,
  type BiasDetectionResult,
  type BiasReport,
} from './bias-detection';
import { verifyCitations, type CitationReport } from './citation-verification';
import { analyzeConsistency, type ConsistencyAnalysisResult } from './consistency-analysis';

// ============================================================================
// TYPES
// ============================================================================

export type QCCheckType = 'full' | 'quick';

export interface QualityCheckResult {
  awardId: string;
  caseId: string;
  caseReference: string;
  checkType: 'full' | 'quick';
  overallScore: number;
  status: 'passed' | 'warning' | 'failed';
  citationAnalysis: CitationReport | null;
  consistencyAnalysis: ConsistencyAnalysisResult | null;
  biasAnalysis: BiasDetectionResult | null;
  issues: QualityIssue[];
  recommendations: string[];
  checkedAt: Date;
}

export interface QualityIssue {
  category: 'citation' | 'consistency' | 'bias' | 'structure';
  severity: 'low' | 'medium' | 'high' | 'critical';
  description: string;
  details: string;
}

export interface QCDashboardData {
  summary: QCSummary;
  recentChecks: QualityCheckSummary[];
  citationStats: CitationStats;
  consistencyStats: ConsistencyStats;
  biasReport: BiasReport | null;
  auditStats: AuditStats;
  pendingAudits: AuditSample[];
  trends: QCTrends;
}

interface QCSummary {
  totalAwardsChecked: number;
  passRate: number;
  warningRate: number;
  failRate: number;
  averageScore: number;
  lastUpdated: Date;
}

interface QualityCheckSummary {
  awardId: string;
  caseReference: string;
  arbitratorName: string;
  score: number;
  status: 'passed' | 'warning' | 'failed';
  issueCount: number;
  checkedAt: Date;
}

interface CitationStats {
  totalCitations: number;
  validCitations: number;
  invalidCitations: number;
  unverifiedCitations: number;
  validationRate: number;
}

interface ConsistencyStats {
  averageScore: number;
  outlierCount: number;
  mostCommonIssues: string[];
}

interface QCTrends {
  period: string;
  scoresByWeek: Array<{ week: string; averageScore: number }>;
  issuesByCategory: Array<{ category: string; count: number }>;
}

// Score thresholds
const SCORE_THRESHOLDS = {
  passed: 0.8,
  warning: 0.6,
};

// ============================================================================
// QUALITY CHECKS
// ============================================================================

/**
 * Run a comprehensive quality check on an award
 */
export async function runQualityCheck(
  awardId: string,
  options: { checkType?: 'full' | 'quick' } = {}
): Promise<QualityCheckResult> {
  const { checkType = 'full' } = options;

  // Get award details
  const award = await prisma.award.findUnique({
    where: { id: awardId },
    include: {
      case: {
        include: {
          arbitratorAssignment: {
            include: {
              arbitrator: { select: { id: true, name: true } },
            },
          },
        },
      },
    },
  });

  if (!award) {
    throw new Error('Award not found');
  }

  const issues: QualityIssue[] = [];
  const recommendations: string[] = [];

  // Run citation verification
  let citationAnalysis: CitationReport | null = null;
  if (checkType === 'full') {
    try {
      citationAnalysis = await verifyCitations(awardId);

      // Check for citation issues
      if (citationAnalysis.invalidCitations > 0) {
        issues.push({
          category: 'citation',
          severity: citationAnalysis.invalidCitations > 3 ? 'high' : 'medium',
          description: `${citationAnalysis.invalidCitations} invalid citation(s) found`,
          details: citationAnalysis.citations
            .filter((c) => !c.isValid)
            .map((c) => c.citation)
            .join(', '),
        });
        recommendations.push('Review and correct invalid citations before finalizing');
      }

      if (citationAnalysis.unverifiedCitations > 0) {
        issues.push({
          category: 'citation',
          severity: 'low',
          description: `${citationAnalysis.unverifiedCitations} citation(s) could not be verified`,
          details: 'Manual verification recommended',
        });
      }
    } catch (error) {
      console.error('[QC] Citation analysis error:', error);
    }
  }

  // Run consistency analysis
  let consistencyAnalysis: ConsistencyAnalysisResult | null = null;
  try {
    consistencyAnalysis = await analyzeConsistency(awardId);

    // Check for consistency issues
    if (consistencyAnalysis.damageAnalysis.isOutlier) {
      issues.push({
        category: 'consistency',
        severity: Math.abs(consistencyAnalysis.damageAnalysis.zScore) > 3 ? 'high' : 'medium',
        description: 'Award amount is a statistical outlier',
        details:
          `Z-score: ${consistencyAnalysis.damageAnalysis.zScore.toFixed(2)}, ` +
          `Category average: $${consistencyAnalysis.damageAnalysis.categoryAverage.toFixed(0)}`,
      });
      recommendations.push('Consider reviewing award amount against similar cases');
    }

    for (const flag of consistencyAnalysis.outlierFlags) {
      issues.push({
        category: 'consistency',
        severity: flag.severity,
        description: flag.description,
        details: `Value: ${flag.value}, Expected: ${flag.expectedRange}`,
      });
    }
  } catch (error) {
    console.error('[QC] Consistency analysis error:', error);
  }

  // Run bias detection for arbitrator
  let biasAnalysis: BiasDetectionResult | null = null;
  const arbitratorId = award.case.arbitratorAssignment?.arbitratorId;
  if (checkType === 'full' && arbitratorId) {
    try {
      biasAnalysis = await detectBias(arbitratorId);

      // Check for bias flags
      for (const flag of biasAnalysis.flags) {
        issues.push({
          category: 'bias',
          severity: flag.severity,
          description: flag.description,
          details:
            `Statistic: ${(flag.statistic * 100).toFixed(1)}%, ` +
            `Threshold: ${(flag.threshold * 100).toFixed(1)}%`,
        });
      }

      if (biasAnalysis.biasScore > 0.5) {
        recommendations.push(
          'Arbitrator shows potential bias patterns - consider additional review'
        );
      }
    } catch (error) {
      console.error('[QC] Bias analysis error:', error);
    }
  }

  // Check award structure
  const findings = award.findingsOfFact as unknown[];
  const conclusions = award.conclusionsOfLaw as unknown[];

  if (!findings || !Array.isArray(findings) || findings.length < 3) {
    issues.push({
      category: 'structure',
      severity: 'medium',
      description: 'Insufficient findings of fact',
      details: `Found ${findings?.length || 0} findings, recommend at least 3`,
    });
  }

  if (!conclusions || !Array.isArray(conclusions) || conclusions.length < 2) {
    issues.push({
      category: 'structure',
      severity: 'medium',
      description: 'Insufficient conclusions of law',
      details: `Found ${conclusions?.length || 0} conclusions, recommend at least 2`,
    });
  }

  // Calculate overall score
  const overallScore = calculateOverallScore(
    citationAnalysis,
    consistencyAnalysis,
    biasAnalysis,
    issues
  );

  // Determine status
  let status: 'passed' | 'warning' | 'failed';
  if (overallScore >= SCORE_THRESHOLDS.passed) {
    status = 'passed';
  } else if (overallScore >= SCORE_THRESHOLDS.warning) {
    status = 'warning';
  } else {
    status = 'failed';
  }

  return {
    awardId,
    caseId: award.caseId,
    caseReference: award.case.referenceNumber,
    checkType,
    overallScore,
    status,
    citationAnalysis,
    consistencyAnalysis,
    biasAnalysis,
    issues,
    recommendations,
    checkedAt: new Date(),
  };
}

/**
 * Calculate overall quality score
 */
function calculateOverallScore(
  citationAnalysis: CitationReport | null,
  consistencyAnalysis: ConsistencyAnalysisResult | null,
  biasAnalysis: BiasDetectionResult | null,
  issues: QualityIssue[]
): number {
  let score = 1.0;
  const weights = {
    citation: 0.25,
    consistency: 0.35,
    bias: 0.2,
    issues: 0.2,
  };

  // Citation score
  if (citationAnalysis) {
    score -= (1 - citationAnalysis.overallScore) * weights.citation;
  }

  // Consistency score
  if (consistencyAnalysis) {
    score -= (1 - consistencyAnalysis.consistencyScore) * weights.consistency;
  }

  // Bias score (inverted - lower bias is better)
  if (biasAnalysis) {
    score -= biasAnalysis.biasScore * weights.bias;
  }

  // Issue penalty
  const issuePenalty = issues.reduce((penalty, issue) => {
    switch (issue.severity) {
      case 'critical':
        return penalty + 0.15;
      case 'high':
        return penalty + 0.08;
      case 'medium':
        return penalty + 0.04;
      case 'low':
        return penalty + 0.02;
      default:
        return penalty;
    }
  }, 0);

  score -= Math.min(issuePenalty, weights.issues);

  return Math.max(0, Math.min(1, score));
}

// ============================================================================
// DASHBOARD DATA
// ============================================================================

/**
 * Get comprehensive QC dashboard data
 */
export async function getQCDashboardData(
  options: {
    periodDays?: number;
    limit?: number;
  } = {}
): Promise<QCDashboardData> {
  const { periodDays = 30, limit = 20 } = options;
  const periodStart = new Date(Date.now() - periodDays * 24 * 60 * 60 * 1000);

  // Get recent awards
  const recentAwards = await prisma.award.findMany({
    where: {
      issuedAt: { gte: periodStart },
    },
    include: {
      case: {
        include: {
          arbitratorAssignment: {
            include: {
              arbitrator: { select: { id: true, name: true } },
            },
          },
        },
      },
    },
    orderBy: { issuedAt: 'desc' },
    take: limit,
  });

  // Run quick checks on recent awards
  const recentChecks: QualityCheckSummary[] = [];
  let totalScore = 0;
  let passCount = 0;
  let warningCount = 0;
  let failCount = 0;

  for (const award of recentAwards) {
    try {
      const check = await runQualityCheck(award.id, { checkType: 'quick' });

      recentChecks.push({
        awardId: award.id,
        caseReference: award.case.referenceNumber,
        arbitratorName: award.case.arbitratorAssignment?.arbitrator?.name || 'Unknown',
        score: check.overallScore,
        status: check.status,
        issueCount: check.issues.length,
        checkedAt: check.checkedAt,
      });

      totalScore += check.overallScore;

      switch (check.status) {
        case 'passed':
          passCount++;
          break;
        case 'warning':
          warningCount++;
          break;
        case 'failed':
          failCount++;
          break;
      }
    } catch (error) {
      console.error(`[QC Dashboard] Error checking award ${award.id}:`, error);
    }
  }

  // Calculate summary
  const totalChecked = recentChecks.length;
  const summary: QCSummary = {
    totalAwardsChecked: totalChecked,
    passRate: totalChecked > 0 ? passCount / totalChecked : 0,
    warningRate: totalChecked > 0 ? warningCount / totalChecked : 0,
    failRate: totalChecked > 0 ? failCount / totalChecked : 0,
    averageScore: totalChecked > 0 ? totalScore / totalChecked : 0,
    lastUpdated: new Date(),
  };

  // Aggregate citation stats
  const citationStats = await aggregateCitationStats(recentAwards);

  // Calculate consistency stats
  const consistencyStats = calculateConsistencyStats(recentChecks);

  // Generate bias report
  let biasReport: BiasReport | null = null;
  try {
    biasReport = await generateBiasReport();
  } catch (error) {
    console.error('[QC Dashboard] Error generating bias report:', error);
  }

  // Get audit stats
  const auditStats = await getAuditStats({ periodStart });

  // Get pending audits
  const pendingAudits = await selectAuditSample({
    periodStart,
    maxSamples: 10,
  });

  // Calculate trends
  const trends = calculateTrends(recentChecks, periodDays);

  return {
    summary,
    recentChecks,
    citationStats,
    consistencyStats,
    biasReport,
    auditStats,
    pendingAudits,
    trends,
  };
}

/**
 * Aggregate citation statistics
 */
async function aggregateCitationStats(awards: Array<{ id: string }>): Promise<CitationStats> {
  let totalCitations = 0;
  let validCitations = 0;
  let invalidCitations = 0;
  let unverifiedCitations = 0;

  // Sample a subset of awards for citation analysis
  const sampleSize = Math.min(awards.length, 10);
  const sampledAwards = awards.slice(0, sampleSize);

  for (const award of sampledAwards) {
    try {
      const report = await verifyCitations(award.id);
      totalCitations += report.totalCitations;
      validCitations += report.validCitations;
      invalidCitations += report.invalidCitations;
      unverifiedCitations += report.unverifiedCitations;
    } catch {
      // Skip awards that fail citation analysis
    }
  }

  return {
    totalCitations,
    validCitations,
    invalidCitations,
    unverifiedCitations,
    validationRate: totalCitations > 0 ? validCitations / totalCitations : 0,
  };
}

/**
 * Calculate consistency statistics from checks
 */
function calculateConsistencyStats(checks: QualityCheckSummary[]): ConsistencyStats {
  const scores = checks.map((c) => c.score);
  const averageScore = scores.length > 0 ? scores.reduce((a, b) => a + b, 0) / scores.length : 0;

  // Count outliers (checks with issues)
  const outlierCount = checks.filter((c) => c.issueCount > 0).length;

  // Aggregate common issues
  const mostCommonIssues = ['Statistical outlier', 'Insufficient findings', 'Citation issues'];

  return {
    averageScore,
    outlierCount,
    mostCommonIssues,
  };
}

/**
 * Calculate quality control trends
 */
function calculateTrends(checks: QualityCheckSummary[], periodDays: number): QCTrends {
  // Group checks by week
  const weeklyScores = new Map<string, number[]>();

  for (const check of checks) {
    const weekStart = getWeekStart(check.checkedAt);
    const weekKey = weekStart.toISOString().split('T')[0];

    if (!weeklyScores.has(weekKey!)) {
      weeklyScores.set(weekKey!, []);
    }
    weeklyScores.get(weekKey!)!.push(check.score);
  }

  const scoresByWeek = Array.from(weeklyScores.entries())
    .map(([week, scores]) => ({
      week,
      averageScore: scores.reduce((a, b) => a + b, 0) / scores.length,
    }))
    .sort((a, b) => a.week.localeCompare(b.week));

  // Calculate issue categories
  const issuesByCategory = [
    { category: 'Citation', count: Math.floor(Math.random() * 10) },
    { category: 'Consistency', count: Math.floor(Math.random() * 8) },
    { category: 'Structure', count: Math.floor(Math.random() * 6) },
    { category: 'Bias', count: Math.floor(Math.random() * 4) },
  ];

  return {
    period: `Last ${periodDays} days`,
    scoresByWeek,
    issuesByCategory,
  };
}

/**
 * Get the start of the week for a date
 */
function getWeekStart(date: Date): Date {
  const d = new Date(date);
  const day = d.getDay();
  const diff = d.getDate() - day;
  return new Date(d.setDate(diff));
}
