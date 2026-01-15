/**
 * Consistency Analysis Service
 *
 * Analyzes awards for consistency with prior decisions:
 * - Compares damages awarded for similar case types
 * - Identifies outliers in award amounts
 * - Flags inconsistent reasoning patterns
 * - Reports on arbitrator decision patterns
 */

import { prisma } from '@/lib/db';

import type { DisputeType } from '@prisma/client';

// ============================================================================
// TYPES
// ============================================================================

export interface ConsistencyAnalysisResult {
  awardId: string;
  caseId: string;
  consistencyScore: number; // 0-1, higher is more consistent
  damageAnalysis: DamageConsistencyAnalysis;
  reasoningAnalysis: ReasoningConsistencyAnalysis;
  outlierFlags: OutlierFlag[];
  similarCases: SimilarCaseComparison[];
  generatedAt: Date;
}

export interface DamageConsistencyAnalysis {
  awardAmount: number;
  disputeAmount: number;
  awardRatio: number; // award / dispute
  categoryAverage: number;
  categoryMedian: number;
  categoryStdDev: number;
  zScore: number; // How many standard deviations from mean
  percentile: number; // Where this award falls in distribution
  isOutlier: boolean;
}

export interface ReasoningConsistencyAnalysis {
  findingsCount: number;
  conclusionsCount: number;
  avgFindingsInCategory: number;
  avgConclusionsInCategory: number;
  hasStandardStructure: boolean;
  missingElements: string[];
}

export interface OutlierFlag {
  type: 'amount' | 'ratio' | 'structure' | 'timing';
  severity: 'low' | 'medium' | 'high';
  description: string;
  value: number | string;
  expectedRange: string;
}

export interface SimilarCaseComparison {
  caseId: string;
  caseReference: string;
  disputeAmount: number;
  awardAmount: number;
  awardRatio: number;
  similarity: number; // 0-1
  arbitratorId: string;
  decidedAt: Date;
}

export interface SimilarAward {
  awardId: string;
  caseId: string;
  caseReference: string;
  awardAmount: number;
  disputeAmount: number;
  similarity: number;
  arbitratorName: string;
  decidedAt: Date;
}

// ============================================================================
// CONSISTENCY ANALYSIS
// ============================================================================

/**
 * Analyze award consistency with prior decisions
 */
export async function analyzeConsistency(
  awardId: string
): Promise<ConsistencyAnalysisResult> {
  // Get the award with case details
  const award = await prisma.award.findUnique({
    where: { id: awardId },
    include: {
      case: {
        include: {
          claimant: { select: { id: true, name: true } },
          respondent: { select: { id: true, name: true } },
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

  // Get similar cases for comparison
  const similarCases = await findSimilarCases(
    award.case.id,
    award.case.amount?.toNumber() || 0,
    award.case.disputeType
  );

  // Analyze damage consistency
  const damageAnalysis = analyzeDamageConsistency(
    award.awardAmount?.toNumber() || 0,
    award.case.amount?.toNumber() || 0,
    similarCases
  );

  // Analyze reasoning consistency
  const reasoningAnalysis = analyzeReasoningConsistency(
    award.findingsOfFact as unknown[],
    award.conclusionsOfLaw as unknown[],
    similarCases
  );

  // Identify outliers
  const outlierFlags = identifyOutliers(
    {
      awardAmount: award.awardAmount,
      issuedAt: award.issuedAt,
      case: {
        createdAt: award.case.createdAt,
        amount: award.case.amount,
      },
    },
    damageAnalysis,
    reasoningAnalysis
  );

  // Calculate overall consistency score
  const consistencyScore = calculateConsistencyScore(
    damageAnalysis,
    reasoningAnalysis,
    outlierFlags
  );

  // Format similar cases for response
  const similarCaseComparisons: SimilarCaseComparison[] = similarCases.map(sc => ({
    caseId: sc.caseId,
    caseReference: sc.caseReference,
    disputeAmount: sc.disputeAmount,
    awardAmount: sc.awardAmount,
    awardRatio: sc.disputeAmount > 0 ? sc.awardAmount / sc.disputeAmount : 0,
    similarity: sc.similarity,
    arbitratorId: sc.arbitratorId,
    decidedAt: sc.decidedAt,
  }));

  return {
    awardId,
    caseId: award.caseId,
    consistencyScore,
    damageAnalysis,
    reasoningAnalysis,
    outlierFlags,
    similarCases: similarCaseComparisons,
    generatedAt: new Date(),
  };
}

/**
 * Find similar cases for comparison
 */
async function findSimilarCases(
  excludeCaseId: string,
  disputeAmount: number,
  disputeType: DisputeType
): Promise<Array<{
  caseId: string;
  caseReference: string;
  disputeAmount: number;
  awardAmount: number;
  findingsCount: number;
  conclusionsCount: number;
  similarity: number;
  arbitratorId: string;
  decidedAt: Date;
}>> {
  // Find cases with similar characteristics
  const similarCases = await prisma.case.findMany({
    where: {
      id: { not: excludeCaseId },
      status: { in: ['DECIDED', 'CLOSED'] },
      disputeType: disputeType,
      award: { isNot: null },
    },
    include: {
      award: {
        select: {
          id: true,
          awardAmount: true,
          findingsOfFact: true,
          conclusionsOfLaw: true,
          issuedAt: true,
        },
      },
      arbitratorAssignment: {
        select: {
          arbitratorId: true,
        },
      },
    },
    take: 50, // Limit for performance
    orderBy: { updatedAt: 'desc' },
  });

  // Calculate similarity scores
  return similarCases
    .filter(c => c.award !== null)
    .map(c => {
      const caseDisputeAmount = c.amount?.toNumber() || 0;
      const awardAmount = c.award!.awardAmount?.toNumber() || 0;

      // Calculate similarity based on dispute amount proximity
      const amountDiff = Math.abs(caseDisputeAmount - disputeAmount);
      const maxAmount = Math.max(caseDisputeAmount, disputeAmount, 1);
      const amountSimilarity = 1 - Math.min(amountDiff / maxAmount, 1);

      const findings = c.award!.findingsOfFact as unknown[] || [];
      const conclusions = c.award!.conclusionsOfLaw as unknown[] || [];

      return {
        caseId: c.id,
        caseReference: c.referenceNumber,
        disputeAmount: caseDisputeAmount,
        awardAmount,
        findingsCount: Array.isArray(findings) ? findings.length : 0,
        conclusionsCount: Array.isArray(conclusions) ? conclusions.length : 0,
        similarity: amountSimilarity,
        arbitratorId: c.arbitratorAssignment?.arbitratorId || '',
        decidedAt: c.award!.issuedAt || new Date(),
      };
    })
    .filter(c => c.similarity > 0.3) // Only include reasonably similar cases
    .sort((a, b) => b.similarity - a.similarity)
    .slice(0, 20); // Top 20 most similar
}

/**
 * Analyze damage amount consistency
 */
function analyzeDamageConsistency(
  awardAmount: number,
  disputeAmount: number,
  similarCases: Array<{ awardAmount: number; disputeAmount: number }>
): DamageConsistencyAnalysis {
  const awardRatio = disputeAmount > 0 ? awardAmount / disputeAmount : 0;

  // Calculate statistics from similar cases
  // Note: ratios could be used for more advanced analysis
  const _ratios = similarCases
    .filter(c => c.disputeAmount > 0)
    .map(c => c.awardAmount / c.disputeAmount);
  void _ratios; // Acknowledge unused variable (for future use)

  const amounts = similarCases.map(c => c.awardAmount);

  // Calculate mean and standard deviation
  const categoryAverage = amounts.length > 0
    ? amounts.reduce((a, b) => a + b, 0) / amounts.length
    : 0;

  const sortedAmounts = [...amounts].sort((a, b) => a - b);
  const categoryMedian = sortedAmounts.length > 0
    ? sortedAmounts[Math.floor(sortedAmounts.length / 2)] || 0
    : 0;

  const variance = amounts.length > 1
    ? amounts.reduce((sum, val) => sum + Math.pow(val - categoryAverage, 2), 0) / (amounts.length - 1)
    : 0;
  const categoryStdDev = Math.sqrt(variance);

  // Calculate z-score
  const zScore = categoryStdDev > 0
    ? (awardAmount - categoryAverage) / categoryStdDev
    : 0;

  // Calculate percentile
  const belowCount = amounts.filter(a => a < awardAmount).length;
  const percentile = amounts.length > 0
    ? (belowCount / amounts.length) * 100
    : 50;

  // Determine if outlier (beyond 2 standard deviations)
  const isOutlier = Math.abs(zScore) > 2;

  return {
    awardAmount,
    disputeAmount,
    awardRatio,
    categoryAverage,
    categoryMedian,
    categoryStdDev,
    zScore,
    percentile,
    isOutlier,
  };
}

/**
 * Analyze reasoning structure consistency
 */
function analyzeReasoningConsistency(
  findingsOfFact: unknown[],
  conclusionsOfLaw: unknown[],
  similarCases: Array<{ findingsCount: number; conclusionsCount: number }>
): ReasoningConsistencyAnalysis {
  const findingsCount = Array.isArray(findingsOfFact) ? findingsOfFact.length : 0;
  const conclusionsCount = Array.isArray(conclusionsOfLaw) ? conclusionsOfLaw.length : 0;

  // Calculate averages from similar cases
  const avgFindingsInCategory = similarCases.length > 0
    ? similarCases.reduce((sum, c) => sum + c.findingsCount, 0) / similarCases.length
    : 0;

  const avgConclusionsInCategory = similarCases.length > 0
    ? similarCases.reduce((sum, c) => sum + c.conclusionsCount, 0) / similarCases.length
    : 0;

  // Check for standard structure
  const missingElements: string[] = [];

  if (findingsCount === 0) {
    missingElements.push('No findings of fact');
  }
  if (conclusionsCount === 0) {
    missingElements.push('No conclusions of law');
  }
  if (findingsCount < 3) {
    missingElements.push('Fewer than 3 findings of fact');
  }
  if (conclusionsCount < 2) {
    missingElements.push('Fewer than 2 conclusions of law');
  }

  const hasStandardStructure = missingElements.length === 0;

  return {
    findingsCount,
    conclusionsCount,
    avgFindingsInCategory,
    avgConclusionsInCategory,
    hasStandardStructure,
    missingElements,
  };
}

/**
 * Identify outlier patterns
 */
function identifyOutliers(
  award: {
    awardAmount: { toNumber(): number } | null;
    issuedAt: Date | null;
    case: { createdAt: Date; amount: { toNumber(): number } | null };
  },
  damageAnalysis: DamageConsistencyAnalysis,
  reasoningAnalysis: ReasoningConsistencyAnalysis
): OutlierFlag[] {
  const flags: OutlierFlag[] = [];

  // Check amount outlier
  if (damageAnalysis.isOutlier) {
    const severity = Math.abs(damageAnalysis.zScore) > 3 ? 'high' : 'medium';
    flags.push({
      type: 'amount',
      severity,
      description: `Award amount is ${damageAnalysis.zScore.toFixed(1)} standard deviations from category average`,
      value: damageAnalysis.awardAmount,
      expectedRange: `${(damageAnalysis.categoryAverage - damageAnalysis.categoryStdDev).toFixed(0)} - ${(damageAnalysis.categoryAverage + damageAnalysis.categoryStdDev).toFixed(0)}`,
    });
  }

  // Check ratio outlier
  if (damageAnalysis.awardRatio > 1.5) {
    flags.push({
      type: 'ratio',
      severity: damageAnalysis.awardRatio > 2 ? 'high' : 'medium',
      description: 'Award exceeds disputed amount by significant margin',
      value: `${(damageAnalysis.awardRatio * 100).toFixed(0)}%`,
      expectedRange: '0% - 100%',
    });
  }

  // Check structure issues
  if (!reasoningAnalysis.hasStandardStructure) {
    const severity = reasoningAnalysis.missingElements.length > 2 ? 'high' : 'low';
    flags.push({
      type: 'structure',
      severity,
      description: `Award missing standard elements: ${reasoningAnalysis.missingElements.join(', ')}`,
      value: reasoningAnalysis.missingElements.length,
      expectedRange: '0 missing elements',
    });
  }

  // Check timing
  const createdAt = award.case.createdAt;
  const issuedAt = award.issuedAt;
  if (createdAt && issuedAt) {
    const daysToDecision = Math.floor(
      (issuedAt.getTime() - createdAt.getTime()) / (1000 * 60 * 60 * 24)
    );

    if (daysToDecision < 7) {
      flags.push({
        type: 'timing',
        severity: 'medium',
        description: 'Award issued unusually quickly',
        value: `${daysToDecision} days`,
        expectedRange: '14 - 90 days',
      });
    } else if (daysToDecision > 180) {
      flags.push({
        type: 'timing',
        severity: 'low',
        description: 'Award took longer than typical',
        value: `${daysToDecision} days`,
        expectedRange: '14 - 90 days',
      });
    }
  }

  return flags;
}

/**
 * Calculate overall consistency score
 */
function calculateConsistencyScore(
  damageAnalysis: DamageConsistencyAnalysis,
  reasoningAnalysis: ReasoningConsistencyAnalysis,
  outlierFlags: OutlierFlag[]
): number {
  let score = 1.0;

  // Deduct for amount deviation
  const absZScore = Math.abs(damageAnalysis.zScore);
  if (absZScore > 1) {
    score -= Math.min((absZScore - 1) * 0.1, 0.3);
  }

  // Deduct for ratio issues
  if (damageAnalysis.awardRatio > 1) {
    score -= Math.min((damageAnalysis.awardRatio - 1) * 0.2, 0.2);
  }

  // Deduct for structure issues
  if (!reasoningAnalysis.hasStandardStructure) {
    score -= reasoningAnalysis.missingElements.length * 0.05;
  }

  // Deduct for outlier flags
  for (const flag of outlierFlags) {
    switch (flag.severity) {
      case 'high':
        score -= 0.15;
        break;
      case 'medium':
        score -= 0.08;
        break;
      case 'low':
        score -= 0.03;
        break;
    }
  }

  return Math.max(0, Math.min(1, score));
}

// ============================================================================
// PUBLIC API
// ============================================================================

/**
 * Find awards similar to a given case
 */
export async function findSimilarAwards(
  caseId: string,
  limit: number = 10
): Promise<SimilarAward[]> {
  const targetCase = await prisma.case.findUnique({
    where: { id: caseId },
    select: {
      amount: true,
      disputeType: true,
    },
  });

  if (!targetCase) {
    return [];
  }

  const similarCases = await findSimilarCases(
    caseId,
    targetCase.amount?.toNumber() || 0,
    targetCase.disputeType
  );

  const results: SimilarAward[] = [];

  for (const sc of similarCases.slice(0, limit)) {
    const caseWithArbitrator = await prisma.case.findUnique({
      where: { id: sc.caseId },
      include: {
        arbitratorAssignment: {
          include: {
            arbitrator: { select: { name: true } },
          },
        },
        award: { select: { id: true } },
      },
    });

    if (caseWithArbitrator?.award) {
      results.push({
        awardId: caseWithArbitrator.award.id,
        caseId: sc.caseId,
        caseReference: sc.caseReference,
        awardAmount: sc.awardAmount,
        disputeAmount: sc.disputeAmount,
        similarity: sc.similarity,
        arbitratorName: caseWithArbitrator.arbitratorAssignment?.arbitrator?.name || 'Unknown',
        decidedAt: sc.decidedAt,
      });
    }
  }

  return results;
}

/**
 * Get consistency report for a case
 */
export async function getConsistencyReport(
  caseId: string
): Promise<ConsistencyAnalysisResult | null> {
  const award = await prisma.award.findUnique({
    where: { caseId },
    select: { id: true },
  });

  if (!award) {
    return null;
  }

  return analyzeConsistency(award.id);
}
