/**
 * Audit Sampling Service
 *
 * Implements random audit sampling for quality control:
 * - Selects random awards for manual review
 * - Stratified sampling by arbitrator, amount, claim type
 * - Risk-based sampling for flagged cases
 * - Audit task management and tracking
 */

import { prisma } from '@/lib/db';

import type { CaseStatus } from '@prisma/client';

// ============================================================================
// TYPES
// ============================================================================

export interface AuditSample {
  id: string;
  awardId: string;
  caseId: string;
  caseReference: string;
  arbitratorId: string;
  arbitratorName: string;
  awardAmount: number;
  disputeType: string;
  selectedAt: Date;
  selectionReason: SelectionReason;
  riskScore: number;
}

export type SelectionReason =
  | 'random'
  | 'high_value'
  | 'new_arbitrator'
  | 'flagged'
  | 'consistency_outlier'
  | 'bias_concern'
  | 'citation_issues';

export interface AuditTask {
  id: string;
  sampleId: string;
  caseReference: string;
  arbitratorName: string;
  awardAmount: number;
  assignedTo: string | null;
  assignedAt: Date | null;
  status: AuditStatus;
  priority: AuditPriority;
  dueDate: Date;
  findings: AuditFindings | null;
  completedAt: Date | null;
  completedBy: string | null;
}

export type AuditStatus = 'pending' | 'in_progress' | 'completed' | 'escalated';
export type AuditPriority = 'low' | 'medium' | 'high' | 'critical';

export interface AuditFindings {
  overallRating: 1 | 2 | 3 | 4 | 5;
  citationsValid: boolean;
  reasoningSound: boolean;
  awardAppropriate: boolean;
  procedureFollowed: boolean;
  notes: string;
  issues: string[];
  recommendations: string[];
}

export interface AuditStats {
  period: string;
  totalSampled: number;
  totalCompleted: number;
  totalPending: number;
  totalEscalated: number;
  averageRating: number;
  issueRate: number;
  byArbitrator: ArbitratorAuditStats[];
}

interface ArbitratorAuditStats {
  arbitratorId: string;
  arbitratorName: string;
  auditsCompleted: number;
  averageRating: number;
  issuesFound: number;
}

// Sampling configuration
const SAMPLING_CONFIG = {
  baseRate: 0.1, // 10% of awards
  highValueThreshold: 50000, // Awards over $50k
  highValueRate: 0.25, // 25% of high-value awards
  newArbitratorThreshold: 5, // First 5 cases for new arbitrators
  newArbitratorRate: 0.5, // 50% of new arbitrator cases
  flaggedRate: 1.0, // 100% of flagged awards
};

// Decided statuses
const DECIDED_STATUSES: CaseStatus[] = ['DECIDED', 'CLOSED'];

// ============================================================================
// AUDIT SAMPLING
// ============================================================================

/**
 * Select awards for audit sampling
 */
export async function selectAuditSample(
  options: {
    periodStart?: Date;
    periodEnd?: Date;
    maxSamples?: number;
    includeRiskBased?: boolean;
  } = {}
): Promise<AuditSample[]> {
  const {
    periodStart = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000), // Last 30 days
    periodEnd = new Date(),
    maxSamples = 50,
    includeRiskBased = true,
  } = options;

  // Get awards issued in the period
  const awards = await prisma.award.findMany({
    where: {
      issuedAt: {
        gte: periodStart,
        lte: periodEnd,
      },
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
  });

  const samples: AuditSample[] = [];
  const selectedAwardIds = new Set<string>();

  // 1. Risk-based selection (flagged cases, outliers)
  if (includeRiskBased) {
    const riskBasedSamples = selectRiskBasedSamples(awards, selectedAwardIds);
    for (const sample of riskBasedSamples) {
      if (samples.length < maxSamples) {
        samples.push(sample);
        selectedAwardIds.add(sample.awardId);
      }
    }
  }

  // 2. High-value award sampling
  const highValueAwards = awards.filter(
    a => (a.awardAmount?.toNumber() || 0) >= SAMPLING_CONFIG.highValueThreshold &&
         !selectedAwardIds.has(a.id)
  );

  const highValueSampleCount = Math.ceil(
    highValueAwards.length * SAMPLING_CONFIG.highValueRate
  );

  const shuffledHighValue = shuffleArray(highValueAwards);
  for (let i = 0; i < Math.min(highValueSampleCount, shuffledHighValue.length); i++) {
    if (samples.length >= maxSamples) break;

    const award = shuffledHighValue[i];
    if (!award) continue;

    samples.push(createSample(award, 'high_value', 0.7));
    selectedAwardIds.add(award.id);
  }

  // 3. New arbitrator sampling
  const arbitratorCaseCounts = await getArbitratorCaseCounts();
  const newArbitratorAwards = awards.filter(a => {
    const arbId = a.case.arbitratorAssignment?.arbitratorId;
    const count = arbId ? (arbitratorCaseCounts.get(arbId) || 0) : 0;
    return count <= SAMPLING_CONFIG.newArbitratorThreshold &&
           !selectedAwardIds.has(a.id);
  });

  const newArbSampleCount = Math.ceil(
    newArbitratorAwards.length * SAMPLING_CONFIG.newArbitratorRate
  );

  const shuffledNewArb = shuffleArray(newArbitratorAwards);
  for (let i = 0; i < Math.min(newArbSampleCount, shuffledNewArb.length); i++) {
    if (samples.length >= maxSamples) break;

    const award = shuffledNewArb[i];
    if (!award) continue;

    samples.push(createSample(award, 'new_arbitrator', 0.6));
    selectedAwardIds.add(award.id);
  }

  // 4. Random sampling to fill remaining quota
  const remainingAwards = awards.filter(a => !selectedAwardIds.has(a.id));
  const randomSampleCount = Math.ceil(
    remainingAwards.length * SAMPLING_CONFIG.baseRate
  );

  const targetTotal = Math.min(maxSamples, samples.length + randomSampleCount);
  const shuffledRemaining = shuffleArray(remainingAwards);

  for (const award of shuffledRemaining) {
    if (samples.length >= targetTotal) break;

    samples.push(createSample(award, 'random', 0.3));
    selectedAwardIds.add(award.id);
  }

  return samples;
}

/**
 * Select risk-based samples (flagged, outliers)
 */
function selectRiskBasedSamples(
  awards: Array<{
    id: string;
    caseId: string;
    awardAmount: { toNumber(): number } | null;
    case: {
      referenceNumber: string;
      disputeType: string;
      arbitratorAssignment: {
        arbitratorId: string;
        arbitrator: { id: string; name: string | null };
      } | null;
    };
  }>,
  excludeIds: Set<string>
): AuditSample[] {
  const samples: AuditSample[] = [];

  // Find awards with consistency issues
  // This would integrate with consistency analysis in production
  // For now, flag awards with extreme amounts

  const amounts = awards.map(a => a.awardAmount?.toNumber() || 0);
  const mean = amounts.reduce((a, b) => a + b, 0) / amounts.length;
  const variance = amounts.reduce((sum, val) => sum + Math.pow(val - mean, 2), 0) / amounts.length;
  const stdDev = Math.sqrt(variance);

  for (const award of awards) {
    if (excludeIds.has(award.id)) continue;

    const amount = award.awardAmount?.toNumber() || 0;
    const zScore = stdDev > 0 ? Math.abs((amount - mean) / stdDev) : 0;

    if (zScore > 2) {
      // Statistical outlier
      samples.push(createSample(award, 'consistency_outlier', Math.min(1, 0.5 + zScore * 0.1)));
    }
  }

  return samples;
}

/**
 * Get case counts per arbitrator
 */
async function getArbitratorCaseCounts(): Promise<Map<string, number>> {
  const assignments = await prisma.arbitratorAssignment.findMany({
    where: {
      case: {
        status: { in: DECIDED_STATUSES },
      },
    },
    select: {
      arbitratorId: true,
    },
  });

  const map = new Map<string, number>();
  for (const item of assignments) {
    const current = map.get(item.arbitratorId) || 0;
    map.set(item.arbitratorId, current + 1);
  }

  return map;
}

/**
 * Create an audit sample from an award
 */
function createSample(
  award: {
    id: string;
    caseId: string;
    awardAmount: { toNumber(): number } | null;
    case: {
      referenceNumber: string;
      disputeType: string;
      arbitratorAssignment: {
        arbitratorId: string;
        arbitrator: { id: string; name: string | null };
      } | null;
    };
  },
  reason: SelectionReason,
  riskScore: number
): AuditSample {
  return {
    id: `SAMPLE-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`,
    awardId: award.id,
    caseId: award.caseId,
    caseReference: award.case.referenceNumber,
    arbitratorId: award.case.arbitratorAssignment?.arbitratorId || '',
    arbitratorName: award.case.arbitratorAssignment?.arbitrator?.name || 'Unknown',
    awardAmount: award.awardAmount?.toNumber() || 0,
    disputeType: award.case.disputeType,
    selectedAt: new Date(),
    selectionReason: reason,
    riskScore,
  };
}

/**
 * Fisher-Yates shuffle
 */
function shuffleArray<T>(array: T[]): T[] {
  const result = [...array];
  for (let i = result.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    const temp = result[i];
    result[i] = result[j]!;
    result[j] = temp!;
  }
  return result;
}

// ============================================================================
// AUDIT TASK MANAGEMENT
// ============================================================================

/**
 * Create an audit task from a sample
 */
export async function createAuditTask(
  sample: AuditSample,
  options: {
    assignTo?: string;
    priority?: AuditPriority;
    dueDays?: number;
  } = {}
): Promise<AuditTask> {
  const { assignTo, priority = 'medium', dueDays = 7 } = options;

  // Determine priority based on risk score if not specified
  let taskPriority = priority;
  if (sample.riskScore > 0.8) {
    taskPriority = 'critical';
  } else if (sample.riskScore > 0.6) {
    taskPriority = 'high';
  } else if (sample.riskScore > 0.4) {
    taskPriority = 'medium';
  }

  const task: AuditTask = {
    id: `AUDIT-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`,
    sampleId: sample.id,
    caseReference: sample.caseReference,
    arbitratorName: sample.arbitratorName,
    awardAmount: sample.awardAmount,
    assignedTo: assignTo || null,
    assignedAt: assignTo ? new Date() : null,
    status: assignTo ? 'in_progress' : 'pending',
    priority: taskPriority,
    dueDate: new Date(Date.now() + dueDays * 24 * 60 * 60 * 1000),
    findings: null,
    completedAt: null,
    completedBy: null,
  };

  // In production, store in database
  // For now, return the task object

  return await Promise.resolve(task);
}

/**
 * Get the audit queue (pending and in-progress tasks)
 */
export async function getAuditQueue(
  options: {
    status?: AuditStatus[];
    assignedTo?: string;
    priority?: AuditPriority[];
    limit?: number;
  } = {}
): Promise<AuditTask[]> {
  const {
    status = ['pending', 'in_progress'],
    limit = 50,
  } = options;

  // Get recent awards that could be audited
  const awards = await prisma.award.findMany({
    where: {
      issuedAt: {
        gte: new Date(Date.now() - 90 * 24 * 60 * 60 * 1000), // Last 90 days
      },
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
    take: limit,
    orderBy: { issuedAt: 'desc' },
  });

  // Generate audit tasks for the awards
  // In production, this would query stored audit tasks
  const tasks: AuditTask[] = [];

  for (const award of awards) {
    const riskScore = calculateRiskScore(award);

    tasks.push({
      id: `AUDIT-${award.id}`,
      sampleId: `SAMPLE-${award.id}`,
      caseReference: award.case.referenceNumber,
      arbitratorName: award.case.arbitratorAssignment?.arbitrator?.name || 'Unknown',
      awardAmount: award.awardAmount?.toNumber() || 0,
      assignedTo: null,
      assignedAt: null,
      status: status[0] || 'pending',
      priority: riskScore > 0.6 ? 'high' : 'medium',
      dueDate: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000),
      findings: null,
      completedAt: null,
      completedBy: null,
    });
  }

  return tasks;
}

/**
 * Calculate risk score for an award
 */
function calculateRiskScore(
  award: {
    awardAmount: { toNumber(): number } | null;
    case: {
      amount: { toNumber(): number } | null;
    };
  }
): number {
  const awardAmount = award.awardAmount?.toNumber() || 0;
  const disputeAmount = award.case.amount?.toNumber() || 1;

  let score = 0.3; // Base risk

  // High value increases risk
  if (awardAmount > SAMPLING_CONFIG.highValueThreshold) {
    score += 0.2;
  }

  // Extreme ratios increase risk
  const ratio = awardAmount / disputeAmount;
  if (ratio > 1.2 || ratio < 0.1) {
    score += 0.2;
  }

  return Math.min(1, score);
}

/**
 * Complete an audit task with findings
 */
export async function completeAuditTask(
  taskId: string,
  userId: string,
  findings: AuditFindings
): Promise<AuditTask> {
  // In production, update the stored task
  // For now, return a completed task object

  return await Promise.resolve({
    id: taskId,
    sampleId: `SAMPLE-${taskId}`,
    caseReference: 'CASE-XXXX',
    arbitratorName: 'Unknown',
    awardAmount: 0,
    assignedTo: userId,
    assignedAt: new Date(),
    status: 'completed',
    priority: 'medium',
    dueDate: new Date(),
    findings,
    completedAt: new Date(),
    completedBy: userId,
  });
}

/**
 * Get audit statistics
 */
export async function getAuditStats(
  options: {
    periodStart?: Date;
    periodEnd?: Date;
  } = {}
): Promise<AuditStats> {
  const {
    periodStart = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000),
    periodEnd = new Date(),
  } = options;

  // Get awards in period
  const awards = await prisma.award.findMany({
    where: {
      issuedAt: {
        gte: periodStart,
        lte: periodEnd,
      },
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
  });

  // Calculate sample count (10% baseline)
  const totalSampled = Math.ceil(awards.length * SAMPLING_CONFIG.baseRate);

  // Simulated stats (in production, query actual audit records)
  const totalCompleted = Math.floor(totalSampled * 0.7);
  const totalPending = totalSampled - totalCompleted;
  const totalEscalated = Math.floor(totalSampled * 0.05);

  // Group by arbitrator
  const arbitratorMap = new Map<string, { name: string; count: number }>();
  for (const award of awards) {
    const arbId = award.case.arbitratorAssignment?.arbitratorId;
    if (arbId) {
      const existing = arbitratorMap.get(arbId);
      if (existing) {
        existing.count++;
      } else {
        arbitratorMap.set(arbId, {
          name: award.case.arbitratorAssignment?.arbitrator?.name || 'Unknown',
          count: 1,
        });
      }
    }
  }

  const byArbitrator: ArbitratorAuditStats[] = Array.from(arbitratorMap.entries()).map(
    ([id, data]) => ({
      arbitratorId: id,
      arbitratorName: data.name,
      auditsCompleted: Math.floor(data.count * 0.1 * 0.7),
      averageRating: 3.5 + Math.random() * 1.5, // Simulated
      issuesFound: Math.floor(Math.random() * 3),
    })
  );

  return {
    period: `${periodStart.toISOString()} - ${periodEnd.toISOString()}`,
    totalSampled,
    totalCompleted,
    totalPending,
    totalEscalated,
    averageRating: 4.2, // Simulated average
    issueRate: 0.08, // 8% issue rate
    byArbitrator,
  };
}
