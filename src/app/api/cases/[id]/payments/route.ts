/**
 * Case Payments API
 *
 * GET /api/cases/[id]/payments - Get payment status and history
 * POST /api/cases/[id]/payments - Create checkout session for payment
 */

import { NextResponse } from 'next/server';
import { z } from 'zod';

import { BadRequestError, ForbiddenError, NotFoundError } from '@/lib/api/errors';
import { errorResponse } from '@/lib/api/response';
import { withAuth, type AuthenticatedRequest } from '@/lib/api/with-auth';
import { prisma } from '@/lib/db';
import {
  calculateFee,
  createCheckoutSession,
  getCasePayments,
  getCasePaymentStatus,
} from '@/lib/payments';

import type { PaymentType } from '@prisma/client';

const createPaymentSchema = z.object({
  type: z.enum(['FILING_FEE', 'RESPONSE_FEE', 'EXPEDITED_FEE']),
  disputeAmount: z.number().optional(), // For calculating fee if different from case amount
  amount: z.number().optional(), // Override calculated fee
});

/**
 * GET - Get payment status and history for a case
 */
export const GET = withAuth(async (request: AuthenticatedRequest, context) => {
  const params = context?.params;
  const caseId = params?.id;

  if (!caseId) {
    return errorResponse(new BadRequestError('Case ID is required'));
  }

  try {
    // Get case and verify access
    const caseData = await prisma.case.findUnique({
      where: { id: caseId },
      include: {
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

    // Get payment status and history
    const [status, payments] = await Promise.all([
      getCasePaymentStatus(caseId),
      getCasePayments(caseId),
    ]);

    // Calculate required fees based on dispute amount
    const disputeAmount = caseData.amount ? Number(caseData.amount) : 0;
    const fees = {
      filingFee: calculateFee(disputeAmount, 'FILING_FEE'),
      responseFee: calculateFee(disputeAmount, 'RESPONSE_FEE'),
      expeditedFee: calculateFee(disputeAmount, 'EXPEDITED_FEE'),
    };

    return NextResponse.json({
      success: true,
      data: {
        status,
        payments,
        fees,
      },
    });
  } catch (error) {
    console.error('Error getting payment status:', error);
    return errorResponse(error as Error);
  }
});

/**
 * POST - Create checkout session for payment
 */
export const POST = withAuth(async (request: AuthenticatedRequest, context) => {
  const params = context?.params;
  const caseId = params?.id;

  if (!caseId) {
    return errorResponse(new BadRequestError('Case ID is required'));
  }

  try {
    const body = await request.json();
    const validationResult = createPaymentSchema.safeParse(body);

    if (!validationResult.success) {
      return errorResponse(
        new BadRequestError(validationResult.error.issues[0]?.message || 'Invalid request')
      );
    }

    const { type, disputeAmount: providedDisputeAmount, amount: providedAmount } = validationResult.data;

    // Get case and verify access
    const caseData = await prisma.case.findUnique({
      where: { id: caseId },
    });

    if (!caseData) {
      return errorResponse(new NotFoundError('Case not found'));
    }

    const userId = request.user.id;
    const isClaimant = caseData.claimantId === userId;
    const isRespondent = caseData.respondentId === userId;
    const isAdmin = request.user.role === 'ADMIN';

    // Validate payment type access
    if (type === 'FILING_FEE' && !isClaimant && !isAdmin) {
      return errorResponse(
        new ForbiddenError('Only the claimant can pay the filing fee')
      );
    }

    if (type === 'RESPONSE_FEE' && !isRespondent && !isAdmin) {
      return errorResponse(
        new ForbiddenError('Only the respondent can pay the response fee')
      );
    }

    // Check if already paid
    const existingPayment = await prisma.payment.findFirst({
      where: {
        caseId,
        userId,
        type,
        status: 'COMPLETED',
      },
    });

    if (existingPayment) {
      return errorResponse(
        new BadRequestError('This fee has already been paid')
      );
    }

    // Calculate fee amount
    const disputeAmount = providedDisputeAmount || (caseData.amount ? Number(caseData.amount) : 0);
    const amount = providedAmount || calculateFee(disputeAmount, type as PaymentType);

    // Create checkout session
    const session = await createCheckoutSession({
      caseId,
      userId,
      type: type as PaymentType,
      amount,
    });

    return NextResponse.json({
      success: true,
      data: {
        sessionId: session.sessionId,
        sessionUrl: session.sessionUrl,
        paymentId: session.paymentId,
        amount,
      },
    });
  } catch (error) {
    console.error('Error creating payment session:', error);
    return errorResponse(error as Error);
  }
});
