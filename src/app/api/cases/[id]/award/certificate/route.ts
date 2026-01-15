/**
 * Award Certificate API
 *
 * GET /api/cases/[id]/award/certificate - Download award certificate PDF
 */

import { NextResponse } from 'next/server';

import { BadRequestError, ForbiddenError, NotFoundError } from '@/lib/api/errors';
import { errorResponse } from '@/lib/api/response';
import { withAuth, type AuthenticatedRequest } from '@/lib/api/with-auth';
import { generateAwardCertificate, type AwardCertificateInput } from '@/lib/award/pdf-generator';
import { prisma } from '@/lib/db';
import { createAuditLog } from '@/lib/services/audit';

/**
 * GET - Download award certificate PDF
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
        referenceNumber: true,
        jurisdiction: true,
        claimantId: true,
        respondentId: true,
        claimant: { select: { name: true } },
        respondent: { select: { name: true } },
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
    const isAdmin = request.user.role === 'ADMIN';

    if (!isParty && !isArbitrator && !isAdmin) {
      return errorResponse(new ForbiddenError('You do not have access to this case'));
    }

    // Get award with signature details
    const award = await prisma.award.findUnique({
      where: { caseId },
      select: {
        id: true,
        referenceNumber: true,
        awardAmount: true,
        prevailingParty: true,
        documentHash: true,
        signedAt: true,
        issuedAt: true,
        signatureAlgorithm: true,
        certificateFingerprint: true,
        timestampGranted: true,
        timestampTime: true,
        arbitrator: {
          select: { name: true },
        },
      },
    });

    if (!award) {
      return errorResponse(new NotFoundError('Award not found for this case'));
    }

    // Generate certificate
    const certificateInput: AwardCertificateInput = {
      referenceNumber: award.referenceNumber,
      caseReference: caseData.referenceNumber,
      claimantName: caseData.claimant?.name || 'Claimant',
      respondentName: caseData.respondent?.name || 'Respondent',
      awardAmount: award.awardAmount ? Number(award.awardAmount) : null,
      prevailingParty: award.prevailingParty as 'CLAIMANT' | 'RESPONDENT' | 'SPLIT',
      arbitratorName: award.arbitrator.name || 'Arbitrator',
      signedAt: award.signedAt,
      issuedAt: award.issuedAt,
      jurisdiction: caseData.jurisdiction || 'US-CA',
      documentHash: award.documentHash,
      signatureAlgorithm: award.signatureAlgorithm || 'RSA-SHA256',
      certificateFingerprint: award.certificateFingerprint || '',
      timestampGranted: award.timestampGranted,
      timestampTime: award.timestampTime,
    };

    const certificate = await generateAwardCertificate(certificateInput);

    // Log the certificate download
    await createAuditLog({
      userId,
      action: 'AWARD_DOWNLOADED',
      caseId,
      metadata: {
        awardId: award.id,
        documentType: 'certificate',
        referenceNumber: award.referenceNumber,
      },
      ipAddress:
        request.headers.get('x-forwarded-for')?.split(',')[0]?.trim() ||
        request.headers.get('x-real-ip') ||
        'unknown',
      userAgent: request.headers.get('user-agent') || 'unknown',
    });

    // Return the certificate PDF
    return new NextResponse(new Uint8Array(certificate.pdfBuffer), {
      status: 200,
      headers: {
        'Content-Type': 'application/pdf',
        'Content-Disposition': `attachment; filename="${award.referenceNumber}-certificate.pdf"`,
        'Content-Length': certificate.pdfBuffer.byteLength.toString(),
        'Cache-Control': 'private, max-age=3600',
      },
    });
  } catch (error) {
    console.error('Error generating award certificate:', error);
    return errorResponse(error as Error);
  }
});
