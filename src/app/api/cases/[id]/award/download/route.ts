/**
 * Award Download API
 *
 * GET /api/cases/[id]/award/download - Download award PDF
 */

import { NextResponse } from 'next/server';

import { BadRequestError, ForbiddenError, NotFoundError } from '@/lib/api/errors';
import { errorResponse } from '@/lib/api/response';
import { withAuth, type AuthenticatedRequest } from '@/lib/api/with-auth';
import { prisma } from '@/lib/db';
import { createAuditLog } from '@/lib/services/audit';

/**
 * GET - Download award PDF
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
      select: {
        id: true,
        claimantId: true,
        respondentId: true,
        arbitratorAssignment: {
          select: {
            arbitratorId: true,
          },
        },
      },
    });

    if (!caseData) {
      return errorResponse(new NotFoundError('Case not found'));
    }

    // Verify user has access to this case
    const userId = request.user.id;
    const isParty = caseData.claimantId === userId || caseData.respondentId === userId;
    const isArbitrator = caseData.arbitratorAssignment?.arbitratorId === userId;

    if (!isParty && !isArbitrator) {
      return errorResponse(new ForbiddenError('You do not have access to this case'));
    }

    // Get award
    const award = await prisma.award.findUnique({
      where: { caseId },
      select: {
        id: true,
        referenceNumber: true,
        documentUrl: true,
        documentHash: true,
      },
    });

    if (!award) {
      return errorResponse(new NotFoundError('Award not found for this case'));
    }

    if (!award.documentUrl) {
      return errorResponse(new NotFoundError('Award document not available'));
    }

    // Log the download in audit trail
    await createAuditLog({
      userId,
      action: 'AWARD_DOWNLOADED',
      caseId,
      metadata: {
        awardId: award.id,
        documentType: 'award',
        referenceNumber: award.referenceNumber,
      },
      ipAddress:
        request.headers.get('x-forwarded-for')?.split(',')[0]?.trim() ||
        request.headers.get('x-real-ip') ||
        'unknown',
      userAgent: request.headers.get('user-agent') || 'unknown',
    });

    // Fetch the PDF from storage
    const pdfResponse = await fetch(award.documentUrl);

    if (!pdfResponse.ok) {
      console.error('Failed to fetch PDF from storage:', pdfResponse.status);
      return errorResponse(new Error('Failed to retrieve award document'));
    }

    const pdfBuffer = await pdfResponse.arrayBuffer();

    // Return the PDF with proper headers
    return new NextResponse(pdfBuffer, {
      status: 200,
      headers: {
        'Content-Type': 'application/pdf',
        'Content-Disposition': `attachment; filename="${award.referenceNumber}.pdf"`,
        'Content-Length': pdfBuffer.byteLength.toString(),
        'X-Document-Hash': award.documentHash,
        'Cache-Control': 'private, max-age=3600',
      },
    });
  } catch (error) {
    console.error('Error downloading award:', error);
    return errorResponse(error as Error);
  }
});
