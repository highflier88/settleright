import { KYCStatus } from '@prisma/client';
import { z } from 'zod';

import { errorResponse, successResponse } from '@/lib/api/response';
import { withAdmin, type AuthenticatedRequest } from '@/lib/api/with-auth';
import {
  getKYCVerificationDetail,
  overrideKYCStatus,
  extendExpiration,
} from '@/lib/services/kyc-admin';
import { validateBody } from '@/lib/validations';

const KYC_STATUSES = ['NOT_STARTED', 'PENDING', 'VERIFIED', 'FAILED', 'EXPIRED'] as const;

// Get single verification detail
async function handleGet(
  request: AuthenticatedRequest,
  context?: { params: Record<string, string> }
) {
  const id = context?.params?.id;
  if (!id) {
    return errorResponse('Verification ID is required', 400);
  }

  const verification = await getKYCVerificationDetail(id);

  if (!verification) {
    return errorResponse('Verification not found', 404);
  }

  const formatted = {
    id: verification.id,
    userId: verification.userId,
    userEmail: verification.user.email,
    userName: verification.user.name,
    status: verification.status,
    provider: verification.provider,
    providerSessionId: verification.providerSessionId,
    documentType: verification.documentType,
    verifiedName: verification.verifiedName,
    verifiedDob: verification.verifiedDob?.toISOString() ?? null,
    initiatedAt: verification.initiatedAt?.toISOString() ?? null,
    verifiedAt: verification.verifiedAt?.toISOString() ?? null,
    expiresAt: verification.expiresAt?.toISOString() ?? null,
    failedAt: verification.failedAt?.toISOString() ?? null,
    failureReason: verification.failureReason,
    failureCount: verification.failureCount,
    lastFailureCode: verification.lastFailureCode,
    createdAt: verification.createdAt.toISOString(),
    updatedAt: verification.updatedAt.toISOString(),
    adminActions: verification.adminActions.map((action) => ({
      id: action.id,
      adminId: action.adminId,
      actionType: action.actionType,
      previousStatus: action.previousStatus,
      newStatus: action.newStatus,
      reason: action.reason,
      notes: action.notes,
      createdAt: action.createdAt.toISOString(),
    })),
    reminders: verification.reminders.map((reminder) => ({
      id: reminder.id,
      reminderType: reminder.reminderType,
      sentAt: reminder.sentAt.toISOString(),
      emailSent: reminder.emailSent,
    })),
  };

  return successResponse(formatted);
}

// Override status or extend expiration
const patchSchema = z.discriminatedUnion('action', [
  z.object({
    action: z.literal('override'),
    newStatus: z.enum(KYC_STATUSES),
    reason: z.string().min(1, 'Reason is required'),
    notes: z.string().optional(),
  }),
  z.object({
    action: z.literal('extend'),
    newExpirationDate: z.coerce.date(),
    reason: z.string().min(1, 'Reason is required'),
  }),
]);

async function handlePatch(
  request: AuthenticatedRequest,
  context?: { params: Record<string, string> }
) {
  const id = context?.params?.id;
  if (!id) {
    return errorResponse('Verification ID is required', 400);
  }
  const body = await request.json();
  const data = validateBody(patchSchema, body);

  if (data.action === 'override') {
    const result = await overrideKYCStatus(
      id,
      data.newStatus as KYCStatus,
      request.user.id,
      data.reason,
      data.notes
    );

    if (!result.success) {
      return errorResponse(result.error ?? 'Failed to override status', 400);
    }

    return successResponse({ message: 'Status updated successfully' });
  } else if (data.action === 'extend') {
    const result = await extendExpiration(
      id,
      request.user.id,
      data.newExpirationDate,
      data.reason
    );

    if (!result.success) {
      return errorResponse(result.error ?? 'Failed to extend expiration', 400);
    }

    return successResponse({ message: 'Expiration extended successfully' });
  }

  return errorResponse('Invalid action', 400);
}

export const GET = withAdmin(handleGet);
export const PATCH = withAdmin(handlePatch);
