/**
 * Arbitrator Profile API
 *
 * GET /api/arbitrator/profile - Get arbitrator's profile
 * PATCH /api/arbitrator/profile - Update arbitrator's profile
 */

import { NextResponse } from 'next/server';

import { BadRequestError, NotFoundError } from '@/lib/api/errors';
import { errorResponse } from '@/lib/api/response';
import { withArbitrator, type AuthenticatedRequest } from '@/lib/api/with-auth';
import { prisma } from '@/lib/db';

/**
 * GET - Get arbitrator's profile
 */
export const GET = withArbitrator(async (request: AuthenticatedRequest) => {
  try {
    const userId = request.user.id;

    const profile = await prisma.arbitratorProfile.findUnique({
      where: { userId },
      include: {
        user: {
          select: {
            id: true,
            name: true,
            email: true,
            createdAt: true,
          },
        },
      },
    });

    if (!profile) {
      return errorResponse(new NotFoundError('Arbitrator profile not found'));
    }

    // Get assignment stats
    const assignmentStats = await prisma.arbitratorAssignment.groupBy({
      by: ['arbitratorId'],
      where: { arbitratorId: userId },
      _count: { id: true },
    });

    const completedReviews = await prisma.arbitratorAssignment.count({
      where: {
        arbitratorId: userId,
        reviewCompletedAt: { not: null },
      },
    });

    const pendingReviews = await prisma.arbitratorAssignment.count({
      where: {
        arbitratorId: userId,
        reviewCompletedAt: null,
      },
    });

    // Get issued awards count
    const issuedAwards = await prisma.award.count({
      where: { arbitratorId: userId },
    });

    return NextResponse.json({
      success: true,
      data: {
        id: profile.id,
        userId: profile.userId,
        barNumber: profile.barNumber,
        barState: profile.barState,
        isRetiredJudge: profile.isRetiredJudge,
        yearsExperience: profile.yearsExperience,
        jurisdictions: profile.jurisdictions,
        specialties: profile.specialties,
        isActive: profile.isActive,
        maxCasesPerWeek: profile.maxCasesPerWeek,
        casesCompleted: profile.casesCompleted,
        avgReviewTime: profile.avgReviewTime,
        stripeConnectId: profile.stripeConnectId ? '****connected' : null,
        user: {
          id: profile.user.id,
          name: profile.user.name,
          email: profile.user.email,
          createdAt: profile.user.createdAt,
        },
        stats: {
          totalAssignments: assignmentStats[0]?._count.id || 0,
          completedReviews,
          pendingReviews,
          issuedAwards,
        },
      },
    });
  } catch (error) {
    console.error('Error fetching arbitrator profile:', error);
    return errorResponse(error as Error);
  }
});

/**
 * PATCH - Update arbitrator's profile
 */
export const PATCH = withArbitrator(async (request: AuthenticatedRequest) => {
  try {
    const userId = request.user.id;
    const body = (await request.json()) as Record<string, unknown>;

    // Validate input
    const allowedFields = [
      'barNumber',
      'barState',
      'yearsExperience',
      'jurisdictions',
      'specialties',
      'isActive',
      'maxCasesPerWeek',
    ];

    const updates: Record<string, unknown> = {};
    for (const field of allowedFields) {
      if (body[field] !== undefined) {
        updates[field] = body[field];
      }
    }

    if (Object.keys(updates).length === 0) {
      return errorResponse(new BadRequestError('No valid fields to update'));
    }

    // Validate maxCasesPerWeek
    if (updates.maxCasesPerWeek !== undefined) {
      const max = updates.maxCasesPerWeek as number;
      if (max < 1 || max > 50) {
        return errorResponse(new BadRequestError('maxCasesPerWeek must be between 1 and 50'));
      }
    }

    // Validate yearsExperience
    if (updates.yearsExperience !== undefined) {
      const years = updates.yearsExperience as number;
      if (years < 0 || years > 70) {
        return errorResponse(new BadRequestError('yearsExperience must be between 0 and 70'));
      }
    }

    // Check profile exists
    const existing = await prisma.arbitratorProfile.findUnique({
      where: { userId },
    });

    if (!existing) {
      return errorResponse(new NotFoundError('Arbitrator profile not found'));
    }

    // Update profile
    const updated = await prisma.arbitratorProfile.update({
      where: { userId },
      data: updates,
    });

    return NextResponse.json({
      success: true,
      message: 'Profile updated successfully',
      data: {
        id: updated.id,
        barNumber: updated.barNumber,
        barState: updated.barState,
        isRetiredJudge: updated.isRetiredJudge,
        yearsExperience: updated.yearsExperience,
        jurisdictions: updated.jurisdictions,
        specialties: updated.specialties,
        isActive: updated.isActive,
        maxCasesPerWeek: updated.maxCasesPerWeek,
      },
    });
  } catch (error) {
    console.error('Error updating arbitrator profile:', error);
    return errorResponse(error as Error);
  }
});
