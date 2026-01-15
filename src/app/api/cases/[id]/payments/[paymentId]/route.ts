/**
 * Individual Payment API
 *
 * GET /api/cases/[id]/payments/[paymentId] - Get payment details
 * DELETE /api/cases/[id]/payments/[paymentId] - Request refund (admin only)
 */

import { NextResponse } from 'next/server';
import { z } from 'zod';

import { BadRequestError, ForbiddenError, NotFoundError } from '@/lib/api/errors';
import { errorResponse } from '@/lib/api/response';
import { withAuth, type AuthenticatedRequest } from '@/lib/api/with-auth';
import { prisma } from '@/lib/db';
import { getPayment, generateReceiptData, processRefund } from '@/lib/payments';

const refundSchema = z.object({
  reason: z.string().optional(),
});

/**
 * GET - Get payment details
 */
export const GET = withAuth(async (request: AuthenticatedRequest, context) => {
  const params = context?.params;
  const caseId = params?.id;
  const paymentId = params?.paymentId;

  if (!caseId || !paymentId) {
    return errorResponse(new BadRequestError('Case ID and Payment ID are required'));
  }

  try {
    // Get case and verify access
    const caseData = await prisma.case.findUnique({
      where: { id: caseId },
      select: {
        id: true,
        claimantId: true,
        respondentId: true,
        arbitratorAssignment: {
          select: { arbitratorId: true },
        },
      },
    });

    if (!caseData) {
      return errorResponse(new NotFoundError('Case not found'));
    }

    // Verify user has access
    const userId = request.user.id;
    const isParty = caseData.claimantId === userId || caseData.respondentId === userId;
    const isArbitrator = caseData.arbitratorAssignment?.arbitratorId === userId;
    const isAdmin = request.user.role === 'ADMIN';

    if (!isParty && !isArbitrator && !isAdmin) {
      return errorResponse(
        new ForbiddenError('You do not have access to this case')
      );
    }

    // Get payment
    const payment = await getPayment(paymentId);

    if (!payment) {
      return errorResponse(new NotFoundError('Payment not found'));
    }

    if (payment.caseId !== caseId) {
      return errorResponse(new NotFoundError('Payment not found for this case'));
    }

    // If requesting user is the payment owner or admin, include receipt data
    let receiptData = null;
    if (payment.userId === userId || isAdmin) {
      receiptData = await generateReceiptData(paymentId);
    }

    return NextResponse.json({
      success: true,
      data: {
        payment,
        receipt: receiptData,
      },
    });
  } catch (error) {
    console.error('Error getting payment:', error);
    return errorResponse(error as Error);
  }
});

/**
 * DELETE - Process refund (admin only)
 */
export const DELETE = withAuth(
  async (request: AuthenticatedRequest, context) => {
    const params = context?.params;
    const caseId = params?.id;
    const paymentId = params?.paymentId;

    if (!caseId || !paymentId) {
      return errorResponse(new BadRequestError('Case ID and Payment ID are required'));
    }

    try {
      // Only admins can process refunds
      if (request.user.role !== 'ADMIN') {
        return errorResponse(
          new ForbiddenError('Only administrators can process refunds')
        );
      }

      // Parse refund reason
      let reason: string | undefined;
      try {
        const body = await request.json();
        const validationResult = refundSchema.safeParse(body);
        if (validationResult.success) {
          reason = validationResult.data.reason;
        }
      } catch {
        // Body is optional
      }

      // Verify payment exists and belongs to case
      const payment = await getPayment(paymentId);

      if (!payment) {
        return errorResponse(new NotFoundError('Payment not found'));
      }

      if (payment.caseId !== caseId) {
        return errorResponse(new NotFoundError('Payment not found for this case'));
      }

      // Process refund
      const refundResult = await processRefund(paymentId, reason, request.user.id);

      return NextResponse.json({
        success: true,
        message: 'Refund processed successfully',
        data: refundResult,
      });
    } catch (error) {
      console.error('Error processing refund:', error);
      return errorResponse(error as Error);
    }
  },
  {
    permissions: ['admin:payments'],
  }
);
