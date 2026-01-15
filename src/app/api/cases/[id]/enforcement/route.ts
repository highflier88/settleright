/**
 * Enforcement Package API
 *
 * GET /api/cases/[id]/enforcement - Get enforcement package status
 * POST /api/cases/[id]/enforcement - Generate and download enforcement package
 */

import { NextResponse } from 'next/server';

import { BadRequestError, ForbiddenError, NotFoundError } from '@/lib/api/errors';
import { errorResponse } from '@/lib/api/response';
import { withAuth, type AuthenticatedRequest } from '@/lib/api/with-auth';
import { prisma } from '@/lib/db';
import {
  generateEnforcementPackage,
  createEnforcementZip,
  getEnforcementStatus,
} from '@/lib/enforcement';
import { createAuditLog } from '@/lib/services/audit';

/**
 * GET - Get enforcement package status
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
      return errorResponse(new ForbiddenError('You do not have access to this case'));
    }

    const status = await getEnforcementStatus(caseId);

    return NextResponse.json({
      success: true,
      data: status,
    });
  } catch (error) {
    console.error('Error getting enforcement status:', error);
    return errorResponse(error as Error);
  }
});

/**
 * POST - Generate and download enforcement package
 */
export const POST = withAuth(
  async (request: AuthenticatedRequest, context) => {
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
            select: { arbitratorId: true },
          },
        },
      });

      if (!caseData) {
        return errorResponse(new NotFoundError('Case not found'));
      }

      // Verify user has access (only parties and admin can download enforcement package)
      const userId = request.user.id;
      const isParty = caseData.claimantId === userId || caseData.respondentId === userId;
      const isAdmin = request.user.role === 'ADMIN';

      if (!isParty && !isAdmin) {
        return errorResponse(
          new ForbiddenError('Only case parties can download the enforcement package')
        );
      }

      // Check if enforcement package is available
      const status = await getEnforcementStatus(caseId);
      if (!status.available) {
        return errorResponse(
          new BadRequestError(status.reason || 'Enforcement package not available')
        );
      }

      // Generate the enforcement package
      const kit = await generateEnforcementPackage(caseId);

      // Fetch the original award PDF
      const award = await prisma.award.findUnique({
        where: { caseId },
        select: { documentUrl: true, referenceNumber: true },
      });

      let awardPdfBuffer: Buffer | undefined;
      if (award?.documentUrl) {
        try {
          const response = await fetch(award.documentUrl);
          if (response.ok) {
            const arrayBuffer = await response.arrayBuffer();
            awardPdfBuffer = Buffer.from(arrayBuffer);
          }
        } catch (error) {
          console.error('Failed to fetch award PDF:', error);
        }
      }

      // Create ZIP archive
      const zipBuffer = await createEnforcementZip(kit, awardPdfBuffer);

      // Log the download
      await createAuditLog({
        userId,
        action: 'ENFORCEMENT_PACKAGE_DOWNLOADED',
        caseId,
        metadata: {
          awardReference: kit.awardReference,
          documentCount: kit.totalDocuments,
          jurisdiction: kit.jurisdiction,
        },
        ipAddress:
          request.headers.get('x-forwarded-for')?.split(',')[0]?.trim() ||
          request.headers.get('x-real-ip') ||
          'unknown',
        userAgent: request.headers.get('user-agent') || 'unknown',
      });

      // Return the ZIP file
      return new NextResponse(new Uint8Array(zipBuffer), {
        status: 200,
        headers: {
          'Content-Type': 'application/zip',
          'Content-Disposition': `attachment; filename="${kit.awardReference}-enforcement-package.zip"`,
          'Content-Length': zipBuffer.byteLength.toString(),
          'Cache-Control': 'private, no-cache',
        },
      });
    } catch (error) {
      console.error('Error generating enforcement package:', error);
      return errorResponse(error as Error);
    }
  },
  {
    rateLimit: { limit: 5, window: 60 }, // 5 downloads per minute
  }
);
