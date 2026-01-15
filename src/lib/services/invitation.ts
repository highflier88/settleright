import { randomBytes } from 'crypto';

import { prisma } from '@/lib/db';
import { createAuditLog } from '@/lib/services/audit';
import { sendCaseInvitationEmail } from '@/lib/services/email';
import { sendSms } from '@/lib/services/twilio';
import { InvitationStatus, CaseStatus, AuditAction } from '@prisma/client';

import type { Invitation, Case, User } from '@prisma/client';

// Generate a secure invitation token
export function generateInvitationToken(): string {
  return randomBytes(32).toString('hex');
}

export interface InvitationWithCase extends Invitation {
  case: Case & {
    claimant: Pick<User, 'id' | 'name' | 'email'>;
  };
}

// Get invitation by token
export async function getInvitationByToken(
  token: string
): Promise<InvitationWithCase | null> {
  return prisma.invitation.findUnique({
    where: { token },
    include: {
      case: {
        include: {
          claimant: {
            select: {
              id: true,
              name: true,
              email: true,
            },
          },
        },
      },
    },
  });
}

// Get invitation by case ID
export async function getInvitationByCaseId(
  caseId: string
): Promise<Invitation | null> {
  return prisma.invitation.findUnique({
    where: { caseId },
  });
}

// Mark invitation as viewed
export async function markInvitationViewed(
  token: string,
  ipAddress?: string
): Promise<Invitation | null> {
  const invitation = await prisma.invitation.findUnique({
    where: { token },
  });

  if (!invitation) {
    return null;
  }

  // Only update if not already viewed
  if (!invitation.viewedAt) {
    const updated = await prisma.invitation.update({
      where: { token },
      data: {
        status: InvitationStatus.VIEWED,
        viewedAt: new Date(),
      },
    });

    // Log the view
    await createAuditLog({
      action: AuditAction.INVITATION_VIEWED,
      caseId: invitation.caseId,
      ipAddress,
      metadata: {
        invitationId: invitation.id,
        email: invitation.email,
      },
    });

    return updated;
  }

  return invitation;
}

// Accept invitation and link respondent to case
export async function acceptInvitation(
  token: string,
  respondentId: string,
  ipAddress?: string
): Promise<{ success: boolean; case?: Case; error?: string }> {
  try {
    const invitation = await prisma.invitation.findUnique({
      where: { token },
      include: { case: true },
    });

    if (!invitation) {
      return { success: false, error: 'Invitation not found' };
    }

    // Check if invitation is expired
    if (invitation.expiresAt < new Date()) {
      await prisma.invitation.update({
        where: { token },
        data: { status: InvitationStatus.EXPIRED },
      });
      return { success: false, error: 'Invitation has expired' };
    }

    // Check if already accepted
    if (invitation.status === InvitationStatus.ACCEPTED) {
      return { success: false, error: 'Invitation has already been accepted' };
    }

    // Check if case is still in valid state
    if (invitation.case.status !== CaseStatus.PENDING_RESPONDENT) {
      return { success: false, error: 'Case is no longer accepting responses' };
    }

    // Update invitation and case in transaction
    const updatedCase = await prisma.$transaction(async (tx) => {
      // Update invitation
      await tx.invitation.update({
        where: { token },
        data: {
          status: InvitationStatus.ACCEPTED,
          acceptedAt: new Date(),
        },
      });

      // Link respondent to case and update status
      const caseRecord = await tx.case.update({
        where: { id: invitation.caseId },
        data: {
          respondentId,
          status: CaseStatus.PENDING_AGREEMENT,
          // Set evidence deadline (14 days after agreement is signed - will be updated then)
          evidenceDeadline: new Date(Date.now() + 28 * 24 * 60 * 60 * 1000),
        },
      });

      // Create agreement record
      await tx.agreement.create({
        data: {
          caseId: invitation.caseId,
        },
      });

      return caseRecord;
    });

    // Log acceptance
    await createAuditLog({
      action: AuditAction.INVITATION_ACCEPTED,
      userId: respondentId,
      caseId: invitation.caseId,
      ipAddress,
      metadata: {
        invitationId: invitation.id,
      },
    });

    return { success: true, case: updatedCase };
  } catch (error) {
    console.error('Failed to accept invitation:', error);
    return {
      success: false,
      error: error instanceof Error ? error.message : 'Failed to accept invitation',
    };
  }
}

// Resend invitation
export async function resendInvitation(
  caseId: string,
  userId: string
): Promise<{ success: boolean; error?: string }> {
  try {
    const invitation = await prisma.invitation.findUnique({
      where: { caseId },
      include: {
        case: {
          include: {
            claimant: {
              select: { name: true },
            },
          },
        },
      },
    });

    if (!invitation) {
      return { success: false, error: 'Invitation not found' };
    }

    // Check if already accepted
    if (invitation.status === InvitationStatus.ACCEPTED) {
      return { success: false, error: 'Invitation has already been accepted' };
    }

    // Generate new token and extend expiration
    const newToken = generateInvitationToken();
    const newExpiresAt = new Date();
    newExpiresAt.setDate(newExpiresAt.getDate() + 14);

    await prisma.invitation.update({
      where: { caseId },
      data: {
        token: newToken,
        expiresAt: newExpiresAt,
        status: InvitationStatus.PENDING,
        remindersSent: invitation.remindersSent + 1,
        lastReminderAt: new Date(),
      },
    });

    // Send email
    const invitationUrl = `${process.env.NEXT_PUBLIC_APP_URL}/invitation/${newToken}`;
    await sendCaseInvitationEmail(invitation.email, {
      recipientName: invitation.name ?? 'Respondent',
      claimantName: invitation.case.claimant.name ?? 'Claimant',
      caseReference: invitation.case.referenceNumber,
      disputeAmount: `$${Number(invitation.case.amount).toLocaleString()}`,
      disputeDescription: invitation.case.description,
      invitationUrl,
      expiresAt: newExpiresAt.toISOString(),
    });

    // Send SMS if phone available
    if (invitation.phone) {
      await sendSms(
        invitation.phone,
        `Reminder: You've been invited to respond to a dispute on Settleright.ai. ` +
          `Case #${invitation.case.referenceNumber}. View and respond: ${invitationUrl}`
      );
    }

    // Log resend
    await createAuditLog({
      action: AuditAction.INVITATION_SENT,
      userId,
      caseId,
      metadata: {
        type: 'resend',
        reminderCount: invitation.remindersSent + 1,
      },
    });

    return { success: true };
  } catch (error) {
    console.error('Failed to resend invitation:', error);
    return {
      success: false,
      error: error instanceof Error ? error.message : 'Failed to resend invitation',
    };
  }
}

// Cancel invitation
export async function cancelInvitation(
  caseId: string,
  userId: string
): Promise<boolean> {
  try {
    await prisma.invitation.update({
      where: { caseId },
      data: {
        status: InvitationStatus.CANCELLED,
      },
    });

    await createAuditLog({
      action: AuditAction.INVITATION_EXPIRED, // Using closest available action
      userId,
      caseId,
      metadata: {
        reason: 'cancelled_by_claimant',
      },
    });

    return true;
  } catch (error) {
    console.error('Failed to cancel invitation:', error);
    return false;
  }
}

// Check and expire old invitations (for cron job)
export async function expireOldInvitations(): Promise<number> {
  const now = new Date();

  const result = await prisma.invitation.updateMany({
    where: {
      status: {
        in: [InvitationStatus.PENDING, InvitationStatus.VIEWED],
      },
      expiresAt: {
        lt: now,
      },
    },
    data: {
      status: InvitationStatus.EXPIRED,
    },
  });

  // Log expired invitations
  if (result.count > 0) {
    console.log(`Expired ${result.count} invitations`);
  }

  return result.count;
}

// Get invitation status for display
export function getInvitationStatusLabel(status: InvitationStatus): string {
  const labels: Record<InvitationStatus, string> = {
    [InvitationStatus.PENDING]: 'Pending',
    [InvitationStatus.VIEWED]: 'Viewed',
    [InvitationStatus.ACCEPTED]: 'Accepted',
    [InvitationStatus.EXPIRED]: 'Expired',
    [InvitationStatus.CANCELLED]: 'Cancelled',
  };
  return labels[status];
}

// Calculate time remaining for invitation
export function getInvitationTimeRemaining(expiresAt: Date): {
  isExpired: boolean;
  daysRemaining: number;
  hoursRemaining: number;
} {
  const now = new Date();
  const diff = expiresAt.getTime() - now.getTime();

  if (diff <= 0) {
    return { isExpired: true, daysRemaining: 0, hoursRemaining: 0 };
  }

  return {
    isExpired: false,
    daysRemaining: Math.floor(diff / (1000 * 60 * 60 * 24)),
    hoursRemaining: Math.floor((diff % (1000 * 60 * 60 * 24)) / (1000 * 60 * 60)),
  };
}
