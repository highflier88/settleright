/**
 * Admin Payments API
 *
 * GET /api/admin/payments - List all payments with filtering
 */

import { NextResponse } from 'next/server';

import { BadRequestError } from '@/lib/api/errors';
import { errorResponse } from '@/lib/api/response';
import { withAuth, type AuthenticatedRequest } from '@/lib/api/with-auth';
import { prisma } from '@/lib/db';

import type { PaymentStatus, PaymentType, Prisma } from '@prisma/client';

/**
 * GET - List payments with filtering and pagination
 */
export const GET = withAuth(
  async (request: AuthenticatedRequest) => {
    try {
      const url = new URL(request.url);
      const page = parseInt(url.searchParams.get('page') || '1', 10);
      const limit = Math.min(parseInt(url.searchParams.get('limit') || '20', 10), 100);
      const status = url.searchParams.get('status') as PaymentStatus | null;
      const type = url.searchParams.get('type') as PaymentType | null;
      const caseId = url.searchParams.get('caseId');
      const userId = url.searchParams.get('userId');
      const startDate = url.searchParams.get('startDate');
      const endDate = url.searchParams.get('endDate');
      const sortBy = url.searchParams.get('sortBy') || 'createdAt';
      const sortOrder = (url.searchParams.get('sortOrder') || 'desc') as 'asc' | 'desc';

      if (page < 1 || limit < 1) {
        return errorResponse(new BadRequestError('Invalid pagination parameters'));
      }

      // Build where clause
      const where: Prisma.PaymentWhereInput = {};

      if (status) {
        where.status = status;
      }

      if (type) {
        where.type = type;
      }

      if (caseId) {
        where.caseId = caseId;
      }

      if (userId) {
        where.userId = userId;
      }

      if (startDate || endDate) {
        where.createdAt = {};
        if (startDate) {
          where.createdAt.gte = new Date(startDate);
        }
        if (endDate) {
          where.createdAt.lte = new Date(endDate);
        }
      }

      // Build order by
      const validSortFields = ['createdAt', 'paidAt', 'amount', 'status', 'type'];
      const orderByField = validSortFields.includes(sortBy) ? sortBy : 'createdAt';
      const orderBy = { [orderByField]: sortOrder };

      // Execute query with count
      const [payments, total] = await Promise.all([
        prisma.payment.findMany({
          where,
          orderBy,
          skip: (page - 1) * limit,
          take: limit,
          include: {
            case: {
              select: {
                referenceNumber: true,
                description: true,
              },
            },
          },
        }),
        prisma.payment.count({ where }),
      ]);

      // Calculate aggregates for filtered results
      const aggregates = await prisma.payment.aggregate({
        where,
        _sum: {
          amount: true,
        },
        _count: {
          id: true,
        },
      });

      // Get status breakdown
      const statusBreakdown = await prisma.payment.groupBy({
        by: ['status'],
        where,
        _count: {
          id: true,
        },
        _sum: {
          amount: true,
        },
      });

      // Get type breakdown
      const typeBreakdown = await prisma.payment.groupBy({
        by: ['type'],
        where,
        _count: {
          id: true,
        },
        _sum: {
          amount: true,
        },
      });

      const totalPages = Math.ceil(total / limit);

      return NextResponse.json({
        success: true,
        data: {
          payments: payments.map((p) => ({
            id: p.id,
            caseId: p.caseId,
            caseReference: p.case.referenceNumber,
            caseDescription: p.case.description,
            userId: p.userId,
            type: p.type,
            status: p.status,
            amount: Number(p.amount),
            currency: p.currency,
            stripePaymentIntentId: p.stripePaymentIntentId,
            stripeSessionId: p.stripeSessionId,
            createdAt: p.createdAt,
            paidAt: p.paidAt,
            failedAt: p.failedAt,
            refundedAt: p.refundedAt,
            failureReason: p.failureReason,
          })),
          pagination: {
            page,
            limit,
            total,
            totalPages,
            hasMore: page < totalPages,
          },
          aggregates: {
            totalAmount: Number(aggregates._sum.amount || 0),
            count: aggregates._count.id,
            byStatus: statusBreakdown.map((s) => ({
              status: s.status,
              count: s._count.id,
              amount: Number(s._sum.amount || 0),
            })),
            byType: typeBreakdown.map((t) => ({
              type: t.type,
              count: t._count.id,
              amount: Number(t._sum.amount || 0),
            })),
          },
        },
      });
    } catch (error) {
      console.error('Error listing payments:', error);
      return errorResponse(error as Error);
    }
  },
  {
    permissions: ['admin:payments'],
  }
);
