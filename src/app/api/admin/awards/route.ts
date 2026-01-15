/**
 * Admin Awards API
 *
 * GET /api/admin/awards - List and search issued awards
 */

import { NextResponse } from 'next/server';
import type { NextRequest } from 'next/server';

import { requireRole } from '@/lib/auth';
import { prisma } from '@/lib/db';

type PrevailingParty = 'CLAIMANT' | 'RESPONDENT' | 'SPLIT';

export const dynamic = 'force-dynamic';

/**
 * GET - List and search issued awards
 */
export async function GET(request: NextRequest) {
  try {
    await requireRole('ADMIN');

    const { searchParams } = new URL(request.url);

    // Pagination
    const page = Math.max(1, parseInt(searchParams.get('page') || '1', 10));
    const limit = Math.min(100, Math.max(1, parseInt(searchParams.get('limit') || '20', 10)));
    const skip = (page - 1) * limit;

    // Filters
    const search = searchParams.get('search') || undefined;
    const prevailingParty = searchParams.get('prevailingParty') as PrevailingParty | undefined;
    const startDate = searchParams.get('startDate');
    const endDate = searchParams.get('endDate');
    const arbitratorId = searchParams.get('arbitratorId') || undefined;
    const minAmount = searchParams.get('minAmount');
    const maxAmount = searchParams.get('maxAmount');

    // Sorting
    const sortBy = searchParams.get('sortBy') || 'issuedAt';
    const sortOrder = searchParams.get('sortOrder') === 'asc' ? 'asc' : 'desc';

    // Build where clause
    const where: {
      referenceNumber?: { contains: string; mode: 'insensitive' };
      prevailingParty?: PrevailingParty;
      issuedAt?: { gte?: Date; lte?: Date };
      arbitratorId?: string;
      awardAmount?: { gte?: number; lte?: number };
    } = {};

    if (search) {
      where.referenceNumber = { contains: search, mode: 'insensitive' };
    }

    if (prevailingParty && ['CLAIMANT', 'RESPONDENT', 'SPLIT'].includes(prevailingParty)) {
      where.prevailingParty = prevailingParty;
    }

    if (startDate || endDate) {
      where.issuedAt = {};
      if (startDate) {
        where.issuedAt.gte = new Date(startDate);
      }
      if (endDate) {
        where.issuedAt.lte = new Date(endDate);
      }
    }

    if (arbitratorId) {
      where.arbitratorId = arbitratorId;
    }

    if (minAmount || maxAmount) {
      where.awardAmount = {};
      if (minAmount) {
        where.awardAmount.gte = parseFloat(minAmount);
      }
      if (maxAmount) {
        where.awardAmount.lte = parseFloat(maxAmount);
      }
    }

    // Build orderBy
    const validSortFields = ['issuedAt', 'awardAmount', 'referenceNumber'];
    const orderByField = validSortFields.includes(sortBy) ? sortBy : 'issuedAt';
    const orderBy = { [orderByField]: sortOrder };

    // Execute queries
    const [awards, totalCount] = await Promise.all([
      prisma.award.findMany({
        where,
        orderBy,
        skip,
        take: limit,
        select: {
          id: true,
          referenceNumber: true,
          caseId: true,
          awardAmount: true,
          prevailingParty: true,
          issuedAt: true,
          signedAt: true,
          documentHash: true,
          timestampGranted: true,
          claimantNotifiedAt: true,
          respondentNotifiedAt: true,
          case: {
            select: {
              referenceNumber: true,
              jurisdiction: true,
              disputeType: true,
              claimant: { select: { name: true, email: true } },
              respondent: { select: { name: true, email: true } },
            },
          },
          arbitrator: {
            select: { id: true, name: true, email: true },
          },
        },
      }),
      prisma.award.count({ where }),
    ]);

    // Calculate aggregates
    const aggregates = await prisma.award.aggregate({
      where,
      _sum: { awardAmount: true },
      _avg: { awardAmount: true },
      _count: { id: true },
    });

    // Calculate totals by prevailing party
    const byPrevailingParty = await prisma.award.groupBy({
      by: ['prevailingParty'],
      where,
      _count: { id: true },
      _sum: { awardAmount: true },
    });

    // Format response
    const formattedAwards = awards.map((award) => ({
      id: award.id,
      referenceNumber: award.referenceNumber,
      caseId: award.caseId,
      caseReference: award.case.referenceNumber,
      jurisdiction: award.case.jurisdiction,
      disputeType: award.case.disputeType,
      awardAmount: award.awardAmount ? Number(award.awardAmount) : null,
      prevailingParty: award.prevailingParty,
      issuedAt: award.issuedAt,
      signedAt: award.signedAt,
      documentHash: award.documentHash,
      timestampGranted: award.timestampGranted,
      claimant: {
        name: award.case.claimant?.name || 'Unknown',
        email: award.case.claimant?.email,
      },
      respondent: {
        name: award.case.respondent?.name || 'Unknown',
        email: award.case.respondent?.email,
      },
      arbitrator: {
        id: award.arbitrator.id,
        name: award.arbitrator.name || 'Unknown',
        email: award.arbitrator.email,
      },
      notificationStatus: {
        claimantNotified: !!award.claimantNotifiedAt,
        respondentNotified: !!award.respondentNotifiedAt,
      },
    }));

    return NextResponse.json({
      success: true,
      data: {
        awards: formattedAwards,
        pagination: {
          page,
          limit,
          totalCount,
          totalPages: Math.ceil(totalCount / limit),
          hasMore: skip + limit < totalCount,
        },
        aggregates: {
          totalAwards: aggregates._count.id,
          totalAwardAmount: aggregates._sum.awardAmount ? Number(aggregates._sum.awardAmount) : 0,
          averageAwardAmount: aggregates._avg.awardAmount ? Number(aggregates._avg.awardAmount) : 0,
        },
        byPrevailingParty: byPrevailingParty.map((item) => ({
          prevailingParty: item.prevailingParty,
          count: item._count.id,
          totalAmount: item._sum.awardAmount ? Number(item._sum.awardAmount) : 0,
        })),
      },
    });
  } catch (error) {
    console.error('[Admin Awards API] GET error:', error);
    const message = error instanceof Error ? error.message : 'Failed to list awards';
    const status = message.includes('required') || message.includes('Insufficient') ? 401 : 500;
    return NextResponse.json({ success: false, error: message }, { status });
  }
}
