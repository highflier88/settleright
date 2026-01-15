/**
 * Arbitrator Assignments API
 *
 * GET /api/arbitrator/assignments - Get cases assigned to the arbitrator
 */

import { NextResponse } from 'next/server';

import { errorResponse } from '@/lib/api/response';
import { withArbitrator, type AuthenticatedRequest } from '@/lib/api/with-auth';
import { prisma } from '@/lib/db';

interface AssignmentWithCase {
  id: string;
  caseId: string;
  assignedAt: Date;
  reviewStartedAt: Date | null;
  reviewCompletedAt: Date | null;
  priority: string;
  dueBy: Date | null;
  case: {
    id: string;
    referenceNumber: string;
    status: string;
    disputeType: string;
    jurisdiction: string;
    amount: unknown;
    description: string;
    createdAt: Date;
    claimant: { id: string; name: string | null } | null;
    respondent: { id: string; name: string | null } | null;
    draftAward: {
      id: string;
      reviewStatus: string | null;
      confidence: number | null;
      generatedAt: Date;
    } | null;
    award: {
      id: string;
      issuedAt: Date;
      referenceNumber: string;
    } | null;
  };
}

/**
 * GET - Get assigned cases for the current arbitrator
 *
 * Query params:
 * - status: filter by case status (ARBITRATOR_REVIEW, DECIDED, etc.)
 * - priority: filter by assignment priority (normal, high, urgent)
 * - hasAward: filter by whether draft award exists (true/false)
 * - limit: number of results (default 50)
 * - offset: pagination offset (default 0)
 */
export const GET = withArbitrator(async (request: AuthenticatedRequest) => {
  try {
    const { searchParams } = new URL(request.url);
    const status = searchParams.get('status');
    const priority = searchParams.get('priority');
    const hasAward = searchParams.get('hasAward');
    const limit = Math.min(parseInt(searchParams.get('limit') || '50'), 100);
    const offset = parseInt(searchParams.get('offset') || '0');

    const userId = request.user.id;

    // Build where clause for case filtering
    const caseWhere: Record<string, unknown> = {};
    if (status) {
      caseWhere.status = status;
    }

    // Build where clause for assignments
    const where: Record<string, unknown> = {
      arbitratorId: userId,
    };

    if (priority) {
      where.priority = priority;
    }

    // Get total count for pagination
    const totalCount = await prisma.arbitratorAssignment.count({
      where: {
        ...where,
        case: Object.keys(caseWhere).length > 0 ? caseWhere : undefined,
      },
    });

    // Get assignments with case details
    const assignments = await prisma.arbitratorAssignment.findMany({
      where: {
        ...where,
        case: Object.keys(caseWhere).length > 0 ? caseWhere : undefined,
      },
      include: {
        case: {
          select: {
            id: true,
            referenceNumber: true,
            status: true,
            disputeType: true,
            jurisdiction: true,
            amount: true,
            description: true,
            createdAt: true,
            claimant: {
              select: {
                id: true,
                name: true,
              },
            },
            respondent: {
              select: {
                id: true,
                name: true,
              },
            },
            draftAward: {
              select: {
                id: true,
                reviewStatus: true,
                confidence: true,
                generatedAt: true,
              },
            },
            award: {
              select: {
                id: true,
                issuedAt: true,
                referenceNumber: true,
              },
            },
          },
        },
      },
      orderBy: [{ priority: 'desc' }, { dueBy: 'asc' }, { assignedAt: 'asc' }],
      take: limit,
      skip: offset,
    });

    // Filter by hasAward if specified
    const typedAssignments = assignments as AssignmentWithCase[];
    let filteredAssignments = typedAssignments;
    if (hasAward !== null) {
      const hasDraft = hasAward === 'true';
      filteredAssignments = typedAssignments.filter(
        (a) => (a.case.draftAward !== null) === hasDraft
      );
    }

    // Transform for response
    const data = filteredAssignments.map((assignment) => ({
      id: assignment.id,
      caseId: assignment.caseId,
      assignedAt: assignment.assignedAt,
      reviewStartedAt: assignment.reviewStartedAt,
      reviewCompletedAt: assignment.reviewCompletedAt,
      priority: assignment.priority,
      dueBy: assignment.dueBy,
      case: {
        id: assignment.case.id,
        referenceNumber: assignment.case.referenceNumber,
        status: assignment.case.status,
        disputeType: assignment.case.disputeType,
        jurisdiction: assignment.case.jurisdiction,
        amount: assignment.case.amount ? Number(assignment.case.amount) : null,
        description: assignment.case.description,
        createdAt: assignment.case.createdAt,
        claimantName: assignment.case.claimant?.name || 'Unknown',
        respondentName: assignment.case.respondent?.name || 'Unknown',
      },
      draftAward: assignment.case.draftAward
        ? {
            id: assignment.case.draftAward.id,
            reviewStatus: assignment.case.draftAward.reviewStatus,
            confidence: assignment.case.draftAward.confidence,
            generatedAt: assignment.case.draftAward.generatedAt,
          }
        : null,
      award: assignment.case.award
        ? {
            id: assignment.case.award.id,
            referenceNumber: assignment.case.award.referenceNumber,
            issuedAt: assignment.case.award.issuedAt,
          }
        : null,
    }));

    return NextResponse.json({
      success: true,
      data: {
        assignments: data,
        pagination: {
          total: totalCount,
          limit,
          offset,
          hasMore: offset + limit < totalCount,
        },
      },
    });
  } catch (error) {
    console.error('Error fetching arbitrator assignments:', error);
    return errorResponse(error as Error);
  }
});
