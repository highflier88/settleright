/**
 * Award Issuance Service
 *
 * Handles the finalization and issuance of arbitration awards,
 * including PDF generation, digital signing, storage, and party notification.
 */

import { NotificationType } from '@prisma/client';

import { prisma } from '@/lib/db';
import { createAuditLog } from '@/lib/services/audit';
import {
  createInAppNotification,
  NotificationTemplates,
} from '@/lib/services/notification';
import {
  getSigningCredentials,
  signPdfDocument,
} from '@/lib/signature';
import { uploadFile } from '@/lib/storage/blob';

import { getDraftAward } from './generator';
import {
  generateAwardPdf,
  generateReferenceNumber,
  formatCurrency,
  type AwardPdfInput,
} from './pdf-generator';

import type { FindingOfFact, AwardConclusionOfLaw } from './types';

/**
 * Input for finalizing an award
 */
export interface FinalizeAwardInput {
  caseId: string;
  arbitratorId: string;
  ipAddress: string;
  userAgent: string;
}

/**
 * Result from award finalization
 */
export interface FinalizeAwardResult {
  awardId: string;
  referenceNumber: string;
  documentUrl: string;
  documentHash: string;
  awardAmount: number;
  prevailingParty: string;
  issuedAt: Date;
  claimantNotified: boolean;
  respondentNotified: boolean;
  // Digital signature info
  signatureAlgorithm: string;
  certificateFingerprint: string;
  timestampGranted: boolean;
  timestampTime: Date | null;
}

/**
 * Issued award details
 */
export interface IssuedAward {
  id: string;
  caseId: string;
  referenceNumber: string;
  findingsOfFact: FindingOfFact[];
  conclusionsOfLaw: AwardConclusionOfLaw[];
  decision: string;
  awardAmount: number | null;
  prevailingParty: string;
  documentUrl: string;
  documentHash: string;
  arbitratorId: string;
  arbitratorName: string;
  issuedAt: Date;
  signedAt: Date;
  claimantNotifiedAt: Date | null;
  respondentNotifiedAt: Date | null;
}

/**
 * Finalize and issue an approved draft award
 */
export async function finalizeAward(
  input: FinalizeAwardInput
): Promise<FinalizeAwardResult> {
  const { caseId, arbitratorId, ipAddress, userAgent } = input;

  // 1. Get the approved draft award
  const draftAward = await getDraftAward(caseId);
  if (!draftAward) {
    throw new Error('Draft award not found');
  }

  if (draftAward.reviewStatus !== 'APPROVE') {
    throw new Error('Draft award must be approved before finalizing');
  }

  // 2. Get case and party information
  const caseData = await prisma.case.findUnique({
    where: { id: caseId },
    select: {
      id: true,
      referenceNumber: true,
      jurisdiction: true,
      claimantId: true,
      respondentId: true,
      claimant: { select: { id: true, name: true, email: true } },
      respondent: { select: { id: true, name: true, email: true } },
      arbitratorAssignment: {
        select: {
          arbitrator: { select: { id: true, name: true } },
        },
      },
    },
  });

  if (!caseData) {
    throw new Error('Case not found');
  }

  // Verify arbitrator
  const assignedArbitratorId = caseData.arbitratorAssignment?.arbitrator?.id;
  if (assignedArbitratorId !== arbitratorId) {
    throw new Error('Only the assigned arbitrator can finalize the award');
  }

  const arbitratorName =
    caseData.arbitratorAssignment?.arbitrator?.name || 'Arbitrator';

  // 3. Generate unique reference number
  const sequence = await getNextAwardSequence();
  const referenceNumber = generateReferenceNumber(sequence);

  // 4. Generate the PDF
  const signedAt = new Date();
  const pdfInput: AwardPdfInput = {
    referenceNumber,
    caseReference: caseData.referenceNumber,
    claimantName: caseData.claimant?.name || 'Claimant',
    respondentName: caseData.respondent?.name || 'Respondent',
    findingsOfFact: draftAward.findingsOfFact,
    conclusionsOfLaw: draftAward.conclusionsOfLaw,
    decision: draftAward.decision,
    awardAmount: draftAward.awardAmount || 0,
    prevailingParty: (draftAward.prevailingParty?.toLowerCase() || 'split') as
      | 'claimant'
      | 'respondent'
      | 'split',
    reasoning: draftAward.reasoning,
    arbitratorName,
    signedAt,
    jurisdiction: caseData.jurisdiction || 'US-CA',
  };

  const pdfResult = await generateAwardPdf(pdfInput);

  // 5. Get arbitrator's signing credentials
  const credentials = await getSigningCredentials(arbitratorId);

  // 6. Digitally sign the PDF with timestamping
  const signedPdfResult = await signPdfDocument(
    pdfResult.pdfBuffer,
    credentials.keyPair.privateKey,
    credentials.certificate.certificate,
    {
      reason: 'Arbitration Award Issuance',
      location: caseData.jurisdiction || 'Online',
      contactInfo: caseData.arbitratorAssignment?.arbitrator?.name || undefined,
      signerName: arbitratorName,
      includeTimestamp: true,
    }
  );

  // 7. Upload signed PDF to storage
  const uploadResult = await uploadFile(signedPdfResult.signedPdfBuffer, {
    folder: 'awards',
    caseId,
    fileName: `${referenceNumber}.pdf`,
    contentType: 'application/pdf',
    userId: arbitratorId,
  });

  // 8. Create signature metadata (for audit)
  const signatureData = JSON.stringify({
    arbitratorId,
    signedAt: signedAt.toISOString(),
    ipAddress,
    userAgent,
    documentHash: signedPdfResult.documentHash,
    signatureAlgorithm: signedPdfResult.signature.algorithm,
    certificateFingerprint: signedPdfResult.signature.certificateFingerprint,
  });

  // 9. Create Award record with digital signature data
  const award = await prisma.award.create({
    data: {
      caseId,
      referenceNumber,
      findingsOfFact: draftAward.findingsOfFact as object,
      conclusionsOfLaw: draftAward.conclusionsOfLaw as object,
      decision: draftAward.decision,
      awardAmount: draftAward.awardAmount,
      prevailingParty:
        draftAward.prevailingParty === 'CLAIMANT'
          ? 'CLAIMANT'
          : draftAward.prevailingParty === 'RESPONDENT'
            ? 'RESPONDENT'
            : 'SPLIT',
      arbitratorId,
      signedAt,
      signatureData,
      // Digital signature fields
      signatureValue: signedPdfResult.signature.signature,
      signatureCertificate: credentials.certificate.certificate,
      signatureAlgorithm: signedPdfResult.signature.algorithm,
      certificateFingerprint: signedPdfResult.signature.certificateFingerprint,
      // Timestamp fields
      timestampToken: signedPdfResult.timestamp?.timestampToken || null,
      timestampGranted: signedPdfResult.timestamp?.status === 'granted',
      timestampTime: signedPdfResult.timestamp?.timestamp || null,
      timestampTSA: signedPdfResult.timestamp?.tsaName || null,
      // Document
      documentUrl: uploadResult.url,
      documentHash: signedPdfResult.documentHash,
      issuedAt: new Date(),
    },
  });

  // 8. Update case status to DECIDED
  await prisma.case.update({
    where: { id: caseId },
    data: { status: 'DECIDED' },
  });

  // 9. Notify parties
  let claimantNotified = false;
  let respondentNotified = false;

  const prevailingPartyName =
    draftAward.prevailingParty === 'CLAIMANT'
      ? caseData.claimant?.name || 'Claimant'
      : draftAward.prevailingParty === 'RESPONDENT'
        ? caseData.respondent?.name || 'Respondent'
        : 'Split Decision';

  const awardAmountStr = draftAward.awardAmount
    ? formatCurrency(draftAward.awardAmount)
    : 'N/A';

  // Notify claimant
  if (caseData.claimantId) {
    try {
      await createInAppNotification({
        userId: caseData.claimantId,
        type: NotificationType.IN_APP,
        templateId: NotificationTemplates.AWARD_ISSUED,
        subject: 'Arbitration Award Issued',
        body: `The arbitration award for case ${caseData.referenceNumber} has been issued. Award amount: ${awardAmountStr}. Prevailing party: ${prevailingPartyName}. Click to view and download.`,
        metadata: {
          caseId,
          awardId: award.id,
          referenceNumber,
          awardAmount: draftAward.awardAmount,
          prevailingParty: draftAward.prevailingParty,
          actionUrl: `/dashboard/cases/${caseId}/award`,
        },
      });

      await prisma.award.update({
        where: { id: award.id },
        data: { claimantNotifiedAt: new Date() },
      });

      claimantNotified = true;
    } catch (error) {
      console.error('Failed to notify claimant:', error);
    }
  }

  // Notify respondent
  if (caseData.respondentId) {
    try {
      await createInAppNotification({
        userId: caseData.respondentId,
        type: NotificationType.IN_APP,
        templateId: NotificationTemplates.AWARD_ISSUED,
        subject: 'Arbitration Award Issued',
        body: `The arbitration award for case ${caseData.referenceNumber} has been issued. Award amount: ${awardAmountStr}. Prevailing party: ${prevailingPartyName}. Click to view and download.`,
        metadata: {
          caseId,
          awardId: award.id,
          referenceNumber,
          awardAmount: draftAward.awardAmount,
          prevailingParty: draftAward.prevailingParty,
          actionUrl: `/dashboard/cases/${caseId}/award`,
        },
      });

      await prisma.award.update({
        where: { id: award.id },
        data: { respondentNotifiedAt: new Date() },
      });

      respondentNotified = true;
    } catch (error) {
      console.error('Failed to notify respondent:', error);
    }
  }

  // 10. Log the award signing and issuance in audit trail
  await createAuditLog({
    userId: arbitratorId,
    action: 'AWARD_SIGNED',
    caseId,
    metadata: {
      awardId: award.id,
      referenceNumber,
      signedAt: signedAt.toISOString(),
    },
    ipAddress,
    userAgent,
  });

  await createAuditLog({
    userId: arbitratorId,
    action: 'AWARD_ISSUED',
    caseId,
    metadata: {
      awardId: award.id,
      referenceNumber,
      awardAmount: draftAward.awardAmount,
      prevailingParty: draftAward.prevailingParty,
      documentHash: signedPdfResult.documentHash,
      claimantNotified,
      respondentNotified,
    },
    ipAddress,
    userAgent,
  });

  console.log('[Award] Issued:', {
    awardId: award.id,
    caseId,
    referenceNumber,
  });

  return {
    awardId: award.id,
    referenceNumber,
    documentUrl: uploadResult.url,
    documentHash: signedPdfResult.documentHash,
    awardAmount: draftAward.awardAmount || 0,
    prevailingParty: draftAward.prevailingParty || 'SPLIT',
    issuedAt: award.issuedAt,
    claimantNotified,
    respondentNotified,
    // Digital signature info
    signatureAlgorithm: signedPdfResult.signature.algorithm,
    certificateFingerprint: signedPdfResult.signature.certificateFingerprint,
    timestampGranted: signedPdfResult.timestamp?.status === 'granted' || false,
    timestampTime: signedPdfResult.timestamp?.timestamp || null,
  };
}

/**
 * Get the issued award for a case
 */
export async function getIssuedAward(
  caseId: string
): Promise<IssuedAward | null> {
  const award = await prisma.award.findUnique({
    where: { caseId },
    include: {
      arbitrator: {
        select: { name: true },
      },
    },
  });

  if (!award) return null;

  return {
    id: award.id,
    caseId: award.caseId,
    referenceNumber: award.referenceNumber,
    findingsOfFact: award.findingsOfFact as unknown as FindingOfFact[],
    conclusionsOfLaw: award.conclusionsOfLaw as unknown as AwardConclusionOfLaw[],
    decision: award.decision,
    awardAmount: award.awardAmount ? Number(award.awardAmount) : null,
    prevailingParty: award.prevailingParty,
    documentUrl: award.documentUrl,
    documentHash: award.documentHash,
    arbitratorId: award.arbitratorId,
    arbitratorName: award.arbitrator.name || 'Arbitrator',
    issuedAt: award.issuedAt,
    signedAt: award.signedAt,
    claimantNotifiedAt: award.claimantNotifiedAt,
    respondentNotifiedAt: award.respondentNotifiedAt,
  };
}

/**
 * Get next sequence number for award reference
 */
async function getNextAwardSequence(): Promise<number> {
  const today = new Date();
  const startOfDay = new Date(today.getFullYear(), today.getMonth(), today.getDate());
  const endOfDay = new Date(startOfDay.getTime() + 24 * 60 * 60 * 1000);

  const count = await prisma.award.count({
    where: {
      issuedAt: {
        gte: startOfDay,
        lt: endOfDay,
      },
    },
  });

  return count + 1;
}

/**
 * Check if award can be issued for a case
 */
export async function canIssueAward(caseId: string): Promise<{
  canIssue: boolean;
  reason?: string;
}> {
  // Check if award already exists
  const existingAward = await prisma.award.findUnique({
    where: { caseId },
  });

  if (existingAward) {
    return { canIssue: false, reason: 'Award has already been issued for this case' };
  }

  // Check if draft award exists and is approved
  const draftAward = await getDraftAward(caseId);
  if (!draftAward) {
    return { canIssue: false, reason: 'Draft award not found' };
  }

  if (draftAward.reviewStatus !== 'APPROVE') {
    return {
      canIssue: false,
      reason: `Draft award status is ${draftAward.reviewStatus || 'pending'}, must be APPROVE`,
    };
  }

  // Check case status
  const caseData = await prisma.case.findUnique({
    where: { id: caseId },
    select: { status: true },
  });

  if (!caseData) {
    return { canIssue: false, reason: 'Case not found' };
  }

  // Allow issuance from ARBITRATOR_REVIEW or DECIDED status
  if (caseData.status !== 'ARBITRATOR_REVIEW' && caseData.status !== 'DECIDED') {
    return {
      canIssue: false,
      reason: `Case status is ${caseData.status}, must be ARBITRATOR_REVIEW`,
    };
  }

  return { canIssue: true };
}

/**
 * Get download URL for award PDF
 */
export async function getAwardDownloadUrl(caseId: string): Promise<string | null> {
  const award = await prisma.award.findUnique({
    where: { caseId },
    select: { documentUrl: true },
  });

  return award?.documentUrl || null;
}
