import { headers } from 'next/headers';
import { type NextRequest } from 'next/server';

import { InvitationStatus } from '@prisma/client';

import { NotFoundError, BadRequestError, ForbiddenError } from '@/lib/api/errors';
import { successResponse, errorResponse } from '@/lib/api/response';
import { getAuthUser } from '@/lib/auth';
import { CASE_STATUS_LABELS, DISPUTE_TYPE_LABELS } from '@/lib/services/case';
import {
  getInvitationByToken,
  markInvitationViewed,
  acceptInvitation,
  getInvitationTimeRemaining,
  getInvitationStatusLabel,
} from '@/lib/services/invitation';


interface RouteContext {
  params: { token: string };
}

// GET /api/invitations/[token] - Get invitation details (public)
export async function GET(
  request: NextRequest,
  context: RouteContext
) {
  try {
    const token = context.params.token;
    if (!token) {
      throw new NotFoundError('Invitation not found');
    }

    const headersList = headers();
    const ip = headersList.get('x-forwarded-for')?.split(',')[0] ?? undefined;

    // Get invitation
    const invitation = await getInvitationByToken(token);
    if (!invitation) {
      throw new NotFoundError('Invitation not found or has expired');
    }

    // Mark as viewed
    await markInvitationViewed(token, ip);

    // Calculate time remaining
    const timeRemaining = getInvitationTimeRemaining(invitation.expiresAt);

    // Check if user is already logged in
    const user = await getAuthUser();
    const isLoggedIn = !!user;
    const isCorrectEmail = user?.email === invitation.email;

    return successResponse({
      invitation: {
        id: invitation.id,
        status: invitation.status,
        statusLabel: getInvitationStatusLabel(invitation.status),
        email: invitation.email,
        name: invitation.name,
        expiresAt: invitation.expiresAt,
        viewedAt: invitation.viewedAt,
        timeRemaining,
      },
      case: {
        id: invitation.case.id,
        referenceNumber: invitation.case.referenceNumber,
        status: invitation.case.status,
        statusLabel: CASE_STATUS_LABELS[invitation.case.status],
        disputeType: invitation.case.disputeType,
        disputeTypeLabel: DISPUTE_TYPE_LABELS[invitation.case.disputeType],
        jurisdiction: invitation.case.jurisdiction,
        description: invitation.case.description,
        amount: invitation.case.amount,
        claimant: {
          name: invitation.case.claimant.name,
        },
        responseDeadline: invitation.case.responseDeadline,
        createdAt: invitation.case.createdAt,
      },
      auth: {
        isLoggedIn,
        isCorrectEmail,
        userEmail: user?.email,
      },
      canAccept:
        invitation.status !== InvitationStatus.ACCEPTED &&
        invitation.status !== InvitationStatus.EXPIRED &&
        invitation.status !== InvitationStatus.CANCELLED &&
        !timeRemaining.isExpired,
    });
  } catch (error) {
    return errorResponse(error as Error);
  }
}

// POST /api/invitations/[token] - Accept invitation
export async function POST(
  request: NextRequest,
  context: RouteContext
) {
  try {
    const token = context.params.token;
    if (!token) {
      throw new NotFoundError('Invitation not found');
    }

    // User must be authenticated
    const user = await getAuthUser();
    if (!user) {
      throw new ForbiddenError('You must be logged in to accept an invitation');
    }

    // Get invitation
    const invitation = await getInvitationByToken(token);
    if (!invitation) {
      throw new NotFoundError('Invitation not found or has expired');
    }

    // Verify email matches
    if (user.email !== invitation.email) {
      throw new ForbiddenError(
        `This invitation was sent to ${invitation.email}. Please log in with that email address.`
      );
    }

    // Check if already accepted
    if (invitation.status === InvitationStatus.ACCEPTED) {
      throw new BadRequestError('This invitation has already been accepted');
    }

    // Check if expired
    const timeRemaining = getInvitationTimeRemaining(invitation.expiresAt);
    if (timeRemaining.isExpired) {
      throw new BadRequestError('This invitation has expired');
    }

    const headersList = headers();
    const ip = headersList.get('x-forwarded-for')?.split(',')[0] ?? undefined;

    // Accept the invitation
    const result = await acceptInvitation(token, user.id, ip);

    if (!result.success) {
      throw new BadRequestError(result.error ?? 'Failed to accept invitation');
    }

    return successResponse({
      message: 'Invitation accepted successfully',
      case: {
        id: result.case!.id,
        referenceNumber: result.case!.referenceNumber,
        status: result.case!.status,
      },
    });
  } catch (error) {
    return errorResponse(error as Error);
  }
}
