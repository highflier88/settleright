/**
 * Arbitrator Compensation Service
 *
 * Handles compensation calculation and tracking:
 * - Per-case, percentage, and hourly compensation models
 * - Compensation calculation on award issuance
 * - Payment tracking and history
 * - Earnings analytics
 */

import { Decimal } from '@prisma/client/runtime/library';

import { prisma } from '@/lib/db';

import type { CompensationType, CompensationStatus } from '@prisma/client';

// ============================================================================
// TYPES
// ============================================================================

export interface CompensationCalculation {
  type: CompensationType;
  baseAmount: number;
  appliedRate: number;
  finalAmount: number;
  breakdown: CompensationBreakdown;
}

export interface CompensationBreakdown {
  description: string;
  caseAmount?: number;
  awardAmount?: number;
  reviewTimeMinutes?: number;
  rateApplied: number;
  calculatedAmount: number;
}

export interface CompensationRecord {
  id: string;
  caseId: string;
  caseReference: string;
  awardId: string | null;
  type: CompensationType;
  amount: number;
  status: CompensationStatus;
  calculatedAt: Date;
  paidAt: Date | null;
  caseAmount: number | null;
  awardAmount: number | null;
  reviewTimeMinutes: number | null;
}

export interface EarningsSummary {
  totalEarned: number;
  totalPending: number;
  totalPaid: number;
  thisMonthEarned: number;
  thisMonthPaid: number;
  casesCompleted: number;
  averagePerCase: number;
}

// Default compensation rates
const DEFAULT_RATES = {
  baseFeePerCase: 250, // $250 per case
  percentageRate: 0.02, // 2% of award amount
  hourlyRate: 150, // $150 per hour
  minCompensation: 100, // Minimum $100 per case
  maxCompensation: 5000, // Maximum $5000 per case
};

// ============================================================================
// COMPENSATION CALCULATION
// ============================================================================

/**
 * Calculate compensation for a case/award
 */
export async function calculateCompensation(
  arbitratorProfileId: string,
  caseId: string,
  reviewTimeMinutes?: number
): Promise<CompensationCalculation> {
  // Get arbitrator profile for rates
  const profile = await prisma.arbitratorProfile.findUnique({
    where: { id: arbitratorProfileId },
    select: {
      compensationType: true,
      baseFeePerCase: true,
      percentageRate: true,
      hourlyRate: true,
    },
  });

  if (!profile) {
    throw new Error('Arbitrator profile not found');
  }

  // Get case and award information
  const caseData = await prisma.case.findUnique({
    where: { id: caseId },
    include: {
      award: true,
    },
  });

  if (!caseData) {
    throw new Error('Case not found');
  }

  const caseAmount = caseData.amount.toNumber();
  const awardAmount = caseData.award?.awardAmount?.toNumber() || 0;

  let finalAmount: number;
  let appliedRate: number;
  let breakdown: CompensationBreakdown;

  switch (profile.compensationType) {
    case 'PER_CASE':
      appliedRate = profile.baseFeePerCase.toNumber();
      finalAmount = appliedRate;
      breakdown = {
        description: 'Flat fee per case',
        caseAmount,
        rateApplied: appliedRate,
        calculatedAmount: finalAmount,
      };
      break;

    case 'PERCENTAGE':
      appliedRate = profile.percentageRate.toNumber();
      // Calculate based on the higher of case amount or award amount
      const baseForPercentage = Math.max(caseAmount, awardAmount);
      finalAmount = baseForPercentage * appliedRate;
      breakdown = {
        description: `${(appliedRate * 100).toFixed(2)}% of ${baseForPercentage === caseAmount ? 'case' : 'award'} amount`,
        caseAmount,
        awardAmount,
        rateApplied: appliedRate,
        calculatedAmount: finalAmount,
      };
      break;

    case 'HOURLY':
      appliedRate = profile.hourlyRate.toNumber();
      const hours = (reviewTimeMinutes || 60) / 60; // Default 1 hour if not tracked
      finalAmount = hours * appliedRate;
      breakdown = {
        description: `${hours.toFixed(2)} hours at $${appliedRate}/hour`,
        reviewTimeMinutes: reviewTimeMinutes || 60,
        rateApplied: appliedRate,
        calculatedAmount: finalAmount,
      };
      break;

    default:
      throw new Error(`Unknown compensation type: ${String(profile.compensationType)}`);
  }

  // Apply min/max limits
  finalAmount = Math.max(DEFAULT_RATES.minCompensation, finalAmount);
  finalAmount = Math.min(DEFAULT_RATES.maxCompensation, finalAmount);

  // Round to 2 decimal places
  finalAmount = Math.round(finalAmount * 100) / 100;

  return {
    type: profile.compensationType,
    baseAmount: appliedRate,
    appliedRate,
    finalAmount,
    breakdown,
  };
}

/**
 * Create compensation record when award is finalized
 */
export async function createCompensationRecord(
  arbitratorProfileId: string,
  caseId: string,
  awardId: string,
  reviewTimeMinutes?: number
): Promise<CompensationRecord> {
  // Calculate compensation
  const calculation = await calculateCompensation(arbitratorProfileId, caseId, reviewTimeMinutes);

  // Get case data for additional info
  const caseData = await prisma.case.findUnique({
    where: { id: caseId },
    include: { award: true },
  });

  if (!caseData) {
    throw new Error('Case not found');
  }

  // Create compensation record
  const compensation = await prisma.arbitratorCompensation.create({
    data: {
      arbitratorProfileId,
      caseId,
      awardId,
      type: calculation.type,
      amount: new Decimal(calculation.finalAmount),
      status: 'CALCULATED',
      caseAmount: caseData.amount,
      awardAmount: caseData.award?.awardAmount || null,
      reviewTimeMinutes: reviewTimeMinutes || null,
      appliedRate: new Decimal(calculation.appliedRate),
      calculationNotes: JSON.stringify(calculation.breakdown),
    },
    include: {
      case: { select: { referenceNumber: true } },
    },
  });

  return {
    id: compensation.id,
    caseId: compensation.caseId,
    caseReference: compensation.case.referenceNumber,
    awardId: compensation.awardId,
    type: compensation.type,
    amount: compensation.amount.toNumber(),
    status: compensation.status,
    calculatedAt: compensation.calculatedAt,
    paidAt: compensation.paidAt,
    caseAmount: compensation.caseAmount?.toNumber() || null,
    awardAmount: compensation.awardAmount?.toNumber() || null,
    reviewTimeMinutes: compensation.reviewTimeMinutes,
  };
}

/**
 * Approve compensation for payout
 */
export async function approveCompensation(
  compensationId: string,
  adminUserId: string
): Promise<void> {
  const compensation = await prisma.arbitratorCompensation.findUnique({
    where: { id: compensationId },
  });

  if (!compensation) {
    throw new Error('Compensation record not found');
  }

  if (compensation.status !== 'CALCULATED') {
    throw new Error(`Cannot approve compensation with status: ${compensation.status}`);
  }

  await prisma.arbitratorCompensation.update({
    where: { id: compensationId },
    data: {
      status: 'APPROVED',
      approvedAt: new Date(),
      approvedById: adminUserId,
    },
  });
}

/**
 * Mark compensation as paid
 */
export async function markCompensationPaid(
  compensationId: string,
  stripeTransferId?: string,
  stripePayoutId?: string
): Promise<void> {
  await prisma.arbitratorCompensation.update({
    where: { id: compensationId },
    data: {
      status: 'PAID',
      paidAt: new Date(),
      stripeTransferId: stripeTransferId || null,
      stripePayoutId: stripePayoutId || null,
    },
  });
}

/**
 * Dispute a compensation
 */
export async function disputeCompensation(compensationId: string, reason: string): Promise<void> {
  await prisma.arbitratorCompensation.update({
    where: { id: compensationId },
    data: {
      status: 'DISPUTED',
      disputedAt: new Date(),
      disputeReason: reason,
    },
  });
}

// ============================================================================
// EARNINGS & HISTORY
// ============================================================================

/**
 * Get earnings summary for an arbitrator
 */
export async function getEarningsSummary(arbitratorProfileId: string): Promise<EarningsSummary> {
  const compensations = await prisma.arbitratorCompensation.findMany({
    where: { arbitratorProfileId },
  });

  const now = new Date();
  const firstOfMonth = new Date(now.getFullYear(), now.getMonth(), 1);

  let totalEarned = 0;
  let totalPending = 0;
  let totalPaid = 0;
  let thisMonthEarned = 0;
  let thisMonthPaid = 0;

  for (const comp of compensations) {
    const amount = comp.amount.toNumber();

    if (comp.status === 'PAID') {
      totalPaid += amount;
      totalEarned += amount;

      if (comp.paidAt && comp.paidAt >= firstOfMonth) {
        thisMonthPaid += amount;
        thisMonthEarned += amount;
      }
    } else if (comp.status === 'CALCULATED' || comp.status === 'APPROVED') {
      totalPending += amount;
      totalEarned += amount;

      if (comp.calculatedAt >= firstOfMonth) {
        thisMonthEarned += amount;
      }
    }
  }

  const casesCompleted = compensations.filter(
    (c) => c.status === 'PAID' || c.status === 'CALCULATED' || c.status === 'APPROVED'
  ).length;

  const averagePerCase = casesCompleted > 0 ? totalEarned / casesCompleted : 0;

  return {
    totalEarned: Math.round(totalEarned * 100) / 100,
    totalPending: Math.round(totalPending * 100) / 100,
    totalPaid: Math.round(totalPaid * 100) / 100,
    thisMonthEarned: Math.round(thisMonthEarned * 100) / 100,
    thisMonthPaid: Math.round(thisMonthPaid * 100) / 100,
    casesCompleted,
    averagePerCase: Math.round(averagePerCase * 100) / 100,
  };
}

/**
 * Get compensation history for an arbitrator
 */
export async function getCompensationHistory(
  arbitratorProfileId: string,
  options: {
    status?: CompensationStatus[];
    limit?: number;
    offset?: number;
  } = {}
): Promise<CompensationRecord[]> {
  const { status, limit = 50, offset = 0 } = options;

  const compensations = await prisma.arbitratorCompensation.findMany({
    where: {
      arbitratorProfileId,
      ...(status && { status: { in: status } }),
    },
    include: {
      case: { select: { referenceNumber: true } },
    },
    orderBy: { calculatedAt: 'desc' },
    take: limit,
    skip: offset,
  });

  return compensations.map((comp) => ({
    id: comp.id,
    caseId: comp.caseId,
    caseReference: comp.case.referenceNumber,
    awardId: comp.awardId,
    type: comp.type,
    amount: comp.amount.toNumber(),
    status: comp.status,
    calculatedAt: comp.calculatedAt,
    paidAt: comp.paidAt,
    caseAmount: comp.caseAmount?.toNumber() || null,
    awardAmount: comp.awardAmount?.toNumber() || null,
    reviewTimeMinutes: comp.reviewTimeMinutes,
  }));
}

/**
 * Get pending compensations for payout processing
 */
export async function getPendingCompensations(options: { limit?: number } = {}): Promise<
  Array<{
    id: string;
    arbitratorProfileId: string;
    arbitratorName: string | null;
    arbitratorEmail: string;
    stripeConnectId: string | null;
    amount: number;
    caseReference: string;
    calculatedAt: Date;
  }>
> {
  const { limit = 100 } = options;

  const compensations = await prisma.arbitratorCompensation.findMany({
    where: {
      status: 'APPROVED',
    },
    include: {
      case: { select: { referenceNumber: true } },
      arbitratorProfile: {
        include: {
          user: { select: { name: true, email: true } },
        },
      },
    },
    orderBy: { approvedAt: 'asc' },
    take: limit,
  });

  return compensations.map((comp) => ({
    id: comp.id,
    arbitratorProfileId: comp.arbitratorProfileId,
    arbitratorName: comp.arbitratorProfile.user.name,
    arbitratorEmail: comp.arbitratorProfile.user.email,
    stripeConnectId: comp.arbitratorProfile.stripeConnectId,
    amount: comp.amount.toNumber(),
    caseReference: comp.case.referenceNumber,
    calculatedAt: comp.calculatedAt,
  }));
}

/**
 * Update arbitrator compensation rates
 */
export async function updateCompensationRates(
  arbitratorProfileId: string,
  rates: {
    compensationType?: CompensationType;
    baseFeePerCase?: number;
    percentageRate?: number;
    hourlyRate?: number;
  }
): Promise<void> {
  await prisma.arbitratorProfile.update({
    where: { id: arbitratorProfileId },
    data: {
      ...(rates.compensationType && { compensationType: rates.compensationType }),
      ...(rates.baseFeePerCase !== undefined && {
        baseFeePerCase: new Decimal(rates.baseFeePerCase),
      }),
      ...(rates.percentageRate !== undefined && {
        percentageRate: new Decimal(rates.percentageRate),
      }),
      ...(rates.hourlyRate !== undefined && { hourlyRate: new Decimal(rates.hourlyRate) }),
    },
  });
}
