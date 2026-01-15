/**
 * Bias Detection Service
 *
 * Analyzes arbitrator decisions for potential bias patterns:
 * - Win rate analysis by party type
 * - Award amount distribution analysis
 * - Decision timing patterns
 * - Party demographic patterns (if available)
 */

import { prisma } from '@/lib/db';

import type { CaseStatus } from '@prisma/client';

// ============================================================================
// TYPES
// ============================================================================

export interface BiasDetectionResult {
  arbitratorId: string;
  arbitratorName: string;
  totalCases: number;
  biasScore: number; // 0-1, lower is better (less bias detected)
  winRateAnalysis: WinRateAnalysis;
  awardDistribution: AwardDistributionAnalysis;
  timingAnalysis: TimingAnalysis;
  flags: BiasFlag[];
  generatedAt: Date;
}

export interface WinRateAnalysis {
  claimantWinRate: number;
  respondentWinRate: number;
  splitDecisionRate: number;
  expectedClaimantWinRate: number; // Platform average
  deviation: number;
  isSignificant: boolean;
}

export interface AwardDistributionAnalysis {
  averageAwardRatio: number; // Award / Dispute amount
  medianAwardRatio: number;
  fullAwardRate: number; // % of cases where full amount awarded
  zeroAwardRate: number; // % of cases with zero award
  platformAverageRatio: number;
  deviation: number;
}

export interface TimingAnalysis {
  averageDaysToDecision: number;
  medianDaysToDecision: number;
  platformAverage: number;
  rushDecisionRate: number; // % of decisions under 7 days
  delayedDecisionRate: number; // % of decisions over 90 days
}

export interface BiasFlag {
  type: 'win_rate' | 'award_amount' | 'timing' | 'pattern';
  severity: 'low' | 'medium' | 'high';
  description: string;
  statistic: number;
  threshold: number;
}

export interface BiasReport {
  reportId: string;
  generatedAt: Date;
  arbitratorCount: number;
  flaggedArbitrators: number;
  arbitratorAnalyses: BiasDetectionResult[];
  platformMetrics: PlatformMetrics;
}

export interface BiasMetrics {
  arbitratorId: string;
  period: string;
  totalCases: number;
  claimantWinRate: number;
  averageAwardRatio: number;
  averageDaysToDecision: number;
  biasScore: number;
}

interface PlatformMetrics {
  totalCases: number;
  totalArbitrators: number;
  averageClaimantWinRate: number;
  averageAwardRatio: number;
  averageDaysToDecision: number;
}

// Decided statuses
const DECIDED_STATUSES: CaseStatus[] = ['DECIDED', 'CLOSED'];

// ============================================================================
// BIAS DETECTION
// ============================================================================

/**
 * Detect potential bias in an arbitrator's decisions
 */
export async function detectBias(
  arbitratorId: string
): Promise<BiasDetectionResult> {
  // Get arbitrator info
  const arbitrator = await prisma.user.findUnique({
    where: { id: arbitratorId },
    select: { id: true, name: true },
  });

  if (!arbitrator) {
    throw new Error('Arbitrator not found');
  }

  // Get arbitrator's decided cases via assignment
  const assignments = await prisma.arbitratorAssignment.findMany({
    where: {
      arbitratorId,
    },
    include: {
      case: {
        include: {
          award: {
            select: {
              awardAmount: true,
              prevailingParty: true,
              issuedAt: true,
            },
          },
        },
      },
    },
  });

  // Filter to decided cases with awards
  const decidedCases = assignments
    .filter(a => DECIDED_STATUSES.includes(a.case.status) && a.case.award !== null)
    .map(a => ({
      ...a.case,
      award: a.case.award!,
    }));

  // Get platform-wide metrics for comparison
  const platformMetrics = await getPlatformMetrics();

  // Analyze win rates
  const winRateAnalysis = analyzeWinRates(decidedCases, platformMetrics);

  // Analyze award distributions
  const awardDistribution = analyzeAwardDistribution(decidedCases, platformMetrics);

  // Analyze timing
  const timingAnalysis = analyzeTimingPatterns(decidedCases, platformMetrics);

  // Identify bias flags
  const flags = identifyBiasFlags(winRateAnalysis, awardDistribution, timingAnalysis);

  // Calculate overall bias score
  const biasScore = calculateBiasScore(flags);

  return {
    arbitratorId,
    arbitratorName: arbitrator.name || 'Unknown',
    totalCases: decidedCases.length,
    biasScore,
    winRateAnalysis,
    awardDistribution,
    timingAnalysis,
    flags,
    generatedAt: new Date(),
  };
}

/**
 * Get platform-wide metrics for comparison
 */
async function getPlatformMetrics(): Promise<PlatformMetrics> {
  // Get all decided cases with awards
  const cases = await prisma.case.findMany({
    where: {
      status: { in: DECIDED_STATUSES },
      award: { isNot: null },
    },
    include: {
      award: {
        select: {
          awardAmount: true,
          prevailingParty: true,
          issuedAt: true,
        },
      },
      arbitratorAssignment: {
        select: { arbitratorId: true },
      },
    },
  });

  // Count unique arbitrators
  const arbitratorIds = new Set(
    cases
      .map(c => c.arbitratorAssignment?.arbitratorId)
      .filter((id): id is string => !!id)
  );

  // Calculate claimant win rate
  const claimantWins = cases.filter(
    c => c.award?.prevailingParty === 'CLAIMANT'
  ).length;
  const averageClaimantWinRate = cases.length > 0
    ? claimantWins / cases.length
    : 0.5;

  // Calculate average award ratio
  const ratios = cases
    .filter(c => c.amount && c.amount.toNumber() > 0)
    .map(c => {
      const award = c.award?.awardAmount?.toNumber() || 0;
      const dispute = c.amount?.toNumber() || 1;
      return award / dispute;
    });

  const averageAwardRatio = ratios.length > 0
    ? ratios.reduce((a, b) => a + b, 0) / ratios.length
    : 0.5;

  // Calculate average days to decision
  const daysToDecision = cases
    .filter(c => c.award?.issuedAt)
    .map(c => {
      const created = c.createdAt.getTime();
      const issued = c.award?.issuedAt?.getTime() ?? created;
      return Math.floor((issued - created) / (1000 * 60 * 60 * 24));
    });

  const averageDaysToDecision = daysToDecision.length > 0
    ? daysToDecision.reduce((a, b) => a + b, 0) / daysToDecision.length
    : 30;

  return {
    totalCases: cases.length,
    totalArbitrators: arbitratorIds.size,
    averageClaimantWinRate,
    averageAwardRatio,
    averageDaysToDecision,
  };
}

/**
 * Analyze win rate patterns
 */
function analyzeWinRates(
  cases: Array<{
    award: { prevailingParty: string | null };
  }>,
  platformMetrics: PlatformMetrics
): WinRateAnalysis {
  const total = cases.length;
  if (total === 0) {
    return {
      claimantWinRate: 0,
      respondentWinRate: 0,
      splitDecisionRate: 0,
      expectedClaimantWinRate: platformMetrics.averageClaimantWinRate,
      deviation: 0,
      isSignificant: false,
    };
  }

  const claimantWins = cases.filter(
    c => c.award?.prevailingParty === 'CLAIMANT'
  ).length;
  const respondentWins = cases.filter(
    c => c.award?.prevailingParty === 'RESPONDENT'
  ).length;
  const splitDecisions = cases.filter(
    c => c.award?.prevailingParty === 'SPLIT' || c.award?.prevailingParty === null
  ).length;

  const claimantWinRate = claimantWins / total;
  const respondentWinRate = respondentWins / total;
  const splitDecisionRate = splitDecisions / total;

  const deviation = claimantWinRate - platformMetrics.averageClaimantWinRate;

  // Statistical significance using simple threshold
  // In production, use chi-squared test
  const isSignificant = total >= 10 && Math.abs(deviation) > 0.2;

  return {
    claimantWinRate,
    respondentWinRate,
    splitDecisionRate,
    expectedClaimantWinRate: platformMetrics.averageClaimantWinRate,
    deviation,
    isSignificant,
  };
}

/**
 * Analyze award amount distribution
 */
function analyzeAwardDistribution(
  cases: Array<{
    amount: { toNumber(): number } | null;
    award: { awardAmount: { toNumber(): number } | null };
  }>,
  platformMetrics: PlatformMetrics
): AwardDistributionAnalysis {
  const validCases = cases.filter(
    c => c.amount && c.amount.toNumber() > 0
  );

  if (validCases.length === 0) {
    return {
      averageAwardRatio: 0,
      medianAwardRatio: 0,
      fullAwardRate: 0,
      zeroAwardRate: 0,
      platformAverageRatio: platformMetrics.averageAwardRatio,
      deviation: 0,
    };
  }

  const ratios = validCases.map(c => {
    const award = c.award?.awardAmount?.toNumber() || 0;
    const dispute = c.amount?.toNumber() || 1;
    return award / dispute;
  });

  const averageAwardRatio = ratios.reduce((a, b) => a + b, 0) / ratios.length;

  const sortedRatios = [...ratios].sort((a, b) => a - b);
  const medianAwardRatio = sortedRatios[Math.floor(sortedRatios.length / 2)] || 0;

  const fullAwardRate = ratios.filter(r => r >= 0.95).length / ratios.length;
  const zeroAwardRate = ratios.filter(r => r === 0).length / ratios.length;

  const deviation = averageAwardRatio - platformMetrics.averageAwardRatio;

  return {
    averageAwardRatio,
    medianAwardRatio,
    fullAwardRate,
    zeroAwardRate,
    platformAverageRatio: platformMetrics.averageAwardRatio,
    deviation,
  };
}

/**
 * Analyze decision timing patterns
 */
function analyzeTimingPatterns(
  cases: Array<{
    createdAt: Date;
    award: { issuedAt: Date | null };
  }>,
  platformMetrics: PlatformMetrics
): TimingAnalysis {
  const casesWithTiming = cases.filter(c => c.award?.issuedAt);

  if (casesWithTiming.length === 0) {
    return {
      averageDaysToDecision: 0,
      medianDaysToDecision: 0,
      platformAverage: platformMetrics.averageDaysToDecision,
      rushDecisionRate: 0,
      delayedDecisionRate: 0,
    };
  }

  const daysToDecision = casesWithTiming.map(c => {
    const created = c.createdAt.getTime();
    const issued = c.award?.issuedAt?.getTime() ?? created;
    return Math.floor((issued - created) / (1000 * 60 * 60 * 24));
  });

  const averageDaysToDecision = daysToDecision.reduce((a, b) => a + b, 0) / daysToDecision.length;

  const sortedDays = [...daysToDecision].sort((a, b) => a - b);
  const medianDaysToDecision = sortedDays[Math.floor(sortedDays.length / 2)] || 0;

  const rushDecisionRate = daysToDecision.filter(d => d < 7).length / daysToDecision.length;
  const delayedDecisionRate = daysToDecision.filter(d => d > 90).length / daysToDecision.length;

  return {
    averageDaysToDecision,
    medianDaysToDecision,
    platformAverage: platformMetrics.averageDaysToDecision,
    rushDecisionRate,
    delayedDecisionRate,
  };
}

/**
 * Identify bias flags based on analysis
 */
function identifyBiasFlags(
  winRateAnalysis: WinRateAnalysis,
  awardDistribution: AwardDistributionAnalysis,
  timingAnalysis: TimingAnalysis
): BiasFlag[] {
  const flags: BiasFlag[] = [];

  // Check win rate bias
  if (winRateAnalysis.isSignificant) {
    const severity = Math.abs(winRateAnalysis.deviation) > 0.3 ? 'high' : 'medium';
    const direction = winRateAnalysis.deviation > 0 ? 'claimant' : 'respondent';
    flags.push({
      type: 'win_rate',
      severity,
      description: `Significant ${direction} win rate bias detected`,
      statistic: winRateAnalysis.claimantWinRate,
      threshold: winRateAnalysis.expectedClaimantWinRate,
    });
  }

  // Check extreme win rates
  if (winRateAnalysis.claimantWinRate > 0.85) {
    flags.push({
      type: 'win_rate',
      severity: 'high',
      description: 'Claimant wins in over 85% of cases',
      statistic: winRateAnalysis.claimantWinRate,
      threshold: 0.85,
    });
  } else if (winRateAnalysis.respondentWinRate > 0.85) {
    flags.push({
      type: 'win_rate',
      severity: 'high',
      description: 'Respondent wins in over 85% of cases',
      statistic: winRateAnalysis.respondentWinRate,
      threshold: 0.85,
    });
  }

  // Check award amount patterns
  if (awardDistribution.fullAwardRate > 0.7) {
    flags.push({
      type: 'award_amount',
      severity: 'medium',
      description: 'Full award granted in over 70% of cases',
      statistic: awardDistribution.fullAwardRate,
      threshold: 0.7,
    });
  }

  if (awardDistribution.zeroAwardRate > 0.5) {
    flags.push({
      type: 'award_amount',
      severity: 'medium',
      description: 'Zero award in over 50% of cases',
      statistic: awardDistribution.zeroAwardRate,
      threshold: 0.5,
    });
  }

  if (Math.abs(awardDistribution.deviation) > 0.3) {
    const severity = Math.abs(awardDistribution.deviation) > 0.5 ? 'high' : 'medium';
    const direction = awardDistribution.deviation > 0 ? 'higher' : 'lower';
    flags.push({
      type: 'award_amount',
      severity,
      description: `Award amounts significantly ${direction} than platform average`,
      statistic: awardDistribution.averageAwardRatio,
      threshold: awardDistribution.platformAverageRatio,
    });
  }

  // Check timing patterns
  if (timingAnalysis.rushDecisionRate > 0.3) {
    flags.push({
      type: 'timing',
      severity: 'medium',
      description: 'Over 30% of decisions made in under 7 days',
      statistic: timingAnalysis.rushDecisionRate,
      threshold: 0.3,
    });
  }

  if (timingAnalysis.delayedDecisionRate > 0.3) {
    flags.push({
      type: 'timing',
      severity: 'low',
      description: 'Over 30% of decisions take more than 90 days',
      statistic: timingAnalysis.delayedDecisionRate,
      threshold: 0.3,
    });
  }

  return flags;
}

/**
 * Calculate overall bias score (0-1, lower is better)
 */
function calculateBiasScore(flags: BiasFlag[]): number {
  if (flags.length === 0) {
    return 0;
  }

  let score = 0;

  for (const flag of flags) {
    switch (flag.severity) {
      case 'high':
        score += 0.3;
        break;
      case 'medium':
        score += 0.15;
        break;
      case 'low':
        score += 0.05;
        break;
    }
  }

  return Math.min(1, score);
}

// ============================================================================
// PUBLIC API
// ============================================================================

/**
 * Generate a comprehensive bias report for all arbitrators
 */
export async function generateBiasReport(): Promise<BiasReport> {
  // Get all arbitrators with decided cases
  const arbitrators = await prisma.user.findMany({
    where: {
      role: 'ARBITRATOR',
      assignedCases: {
        some: {
          case: {
            status: { in: DECIDED_STATUSES },
            award: { isNot: null },
          },
        },
      },
    },
    select: { id: true },
  });

  // Analyze each arbitrator
  const analyses: BiasDetectionResult[] = [];
  for (const arb of arbitrators) {
    try {
      const analysis = await detectBias(arb.id);
      analyses.push(analysis);
    } catch (error) {
      console.error(`[Bias] Error analyzing arbitrator ${arb.id}:`, error);
    }
  }

  // Get platform metrics
  const platformMetrics = await getPlatformMetrics();

  // Count flagged arbitrators
  const flaggedArbitrators = analyses.filter(a => a.biasScore > 0.3).length;

  return {
    reportId: `BIAS-${Date.now()}`,
    generatedAt: new Date(),
    arbitratorCount: analyses.length,
    flaggedArbitrators,
    arbitratorAnalyses: analyses,
    platformMetrics,
  };
}

/**
 * Get bias metrics for a specific arbitrator
 */
export async function getBiasMetrics(
  arbitratorId: string,
  period?: { start: Date; end: Date }
): Promise<BiasMetrics> {
  // Get arbitrator's cases via assignment
  const assignments = await prisma.arbitratorAssignment.findMany({
    where: {
      arbitratorId,
      ...(period ? {
        assignedAt: { gte: period.start, lte: period.end },
      } : {}),
    },
    include: {
      case: {
        include: {
          award: {
            select: {
              awardAmount: true,
              prevailingParty: true,
              issuedAt: true,
            },
          },
        },
      },
    },
  });

  // Filter to decided cases with awards
  const cases = assignments
    .filter(a => DECIDED_STATUSES.includes(a.case.status) && a.case.award !== null)
    .map(a => ({
      ...a.case,
      award: a.case.award!,
    }));

  const totalCases = cases.length;

  // Calculate claimant win rate
  const claimantWins = cases.filter(
    c => c.award?.prevailingParty === 'CLAIMANT'
  ).length;
  const claimantWinRate = totalCases > 0 ? claimantWins / totalCases : 0;

  // Calculate average award ratio
  const validCases = cases.filter(
    c => c.amount && c.amount.toNumber() > 0
  );
  const ratios = validCases.map(c => {
    const award = c.award?.awardAmount?.toNumber() || 0;
    const dispute = c.amount?.toNumber() || 1;
    return award / dispute;
  });
  const averageAwardRatio = ratios.length > 0
    ? ratios.reduce((a, b) => a + b, 0) / ratios.length
    : 0;

  // Calculate average days to decision
  const daysToDecision = cases
    .filter(c => c.award?.issuedAt)
    .map(c => {
      const created = c.createdAt.getTime();
      const issued = c.award?.issuedAt?.getTime() ?? created;
      return Math.floor((issued - created) / (1000 * 60 * 60 * 24));
    });
  const averageDaysToDecision = daysToDecision.length > 0
    ? daysToDecision.reduce((a, b) => a + b, 0) / daysToDecision.length
    : 0;

  // Calculate bias score (simplified)
  let biasScore = 0;
  if (Math.abs(claimantWinRate - 0.5) > 0.3) biasScore += 0.3;
  if (Math.abs(averageAwardRatio - 0.5) > 0.3) biasScore += 0.3;
  if (averageDaysToDecision < 7 || averageDaysToDecision > 120) biasScore += 0.2;

  return {
    arbitratorId,
    period: period
      ? `${period.start.toISOString()} - ${period.end.toISOString()}`
      : 'all-time',
    totalCases,
    claimantWinRate,
    averageAwardRatio,
    averageDaysToDecision,
    biasScore: Math.min(1, biasScore),
  };
}
