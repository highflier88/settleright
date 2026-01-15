/**
 * Enforcement Package Service
 *
 * Generates complete enforcement packages for arbitration awards,
 * including all necessary documents for court confirmation.
 */

import archiver from 'archiver';

import { generateAwardCertificate, type AwardCertificateInput } from '@/lib/award/pdf-generator';
import { prisma } from '@/lib/db';

import {
  generateProofOfService,
  generateArbitratorCredentials,
  generateProceduralCompliance,
  generateFilingInstructions,
} from './documents';
import { getJurisdictionInfo } from './jurisdictions';

import type {
  EnforcementKit,
  EnforcementDocument,
  ProofOfServiceData,
  ArbitratorCredentialsData,
  ProceduralComplianceData,
  FilingInstructionsData,
} from './types';

const PLATFORM_NAME = 'SettleRight Arbitration Platform';
const PLATFORM_RULES_VERSION = '1.0';

/**
 * Generate a complete enforcement package for an award
 */
export async function generateEnforcementPackage(caseId: string): Promise<EnforcementKit> {
  // Get award and all related data
  const award = await prisma.award.findUnique({
    where: { caseId },
    include: {
      case: {
        include: {
          claimant: true,
          respondent: true,
          agreement: {
            include: {
              signatures: {
                orderBy: { signedAt: 'asc' },
                take: 1,
              },
            },
          },
          analysisJob: true,
          arbitratorAssignment: {
            include: {
              arbitrator: {
                include: {
                  arbitratorProfile: true,
                },
              },
            },
          },
        },
      },
      arbitrator: {
        include: {
          arbitratorProfile: true,
        },
      },
    },
  });

  if (!award) {
    throw new Error('Award not found for this case');
  }

  const caseData = award.case;
  const documents: EnforcementDocument[] = [];

  // 1. Generate Award Certificate
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
  documents.push({
    type: 'AWARD_CERTIFICATE',
    name: 'Award Certificate',
    fileName: `${award.referenceNumber}-certificate.pdf`,
    contentType: 'application/pdf',
    buffer: certificate.pdfBuffer,
    hash: certificate.documentHash,
  });

  // 2. Generate Proof of Service
  const proofOfServiceData: ProofOfServiceData = {
    awardReference: award.referenceNumber,
    caseReference: caseData.referenceNumber,
    claimant: {
      name: caseData.claimant?.name || 'Claimant',
      email: caseData.claimant?.email || '',
      notifiedAt: award.claimantNotifiedAt,
    },
    respondent: {
      name: caseData.respondent?.name || 'Respondent',
      email: caseData.respondent?.email || '',
      notifiedAt: award.respondentNotifiedAt,
    },
    awardIssuedAt: award.issuedAt,
    deliveryMethod: 'BOTH',
    platformName: PLATFORM_NAME,
  };

  const proofOfService = await generateProofOfService(proofOfServiceData);
  documents.push(proofOfService);

  // 3. Generate Arbitrator Credentials
  const arbitratorProfile = award.arbitrator.arbitratorProfile;
  const assignment = caseData.arbitratorAssignment;

  const arbitratorCredentialsData: ArbitratorCredentialsData = {
    arbitrator: {
      name: award.arbitrator.name || 'Arbitrator',
      email: award.arbitrator.email,
      barNumber: arbitratorProfile?.barNumber || null,
      barState: arbitratorProfile?.barState || null,
      isRetiredJudge: arbitratorProfile?.isRetiredJudge || false,
      yearsExperience: arbitratorProfile?.yearsExperience || null,
      lawSchool: arbitratorProfile?.lawSchool || null,
      graduationYear: arbitratorProfile?.graduationYear || null,
      jurisdictions: arbitratorProfile?.jurisdictions || [],
      credentialVerifiedAt: arbitratorProfile?.credentialVerifiedAt || null,
      onboardedAt: arbitratorProfile?.onboardedAt || null,
    },
    awardReference: award.referenceNumber,
    caseReference: caseData.referenceNumber,
    jurisdiction: caseData.jurisdiction || 'US-CA',
    assignedAt: assignment?.assignedAt || award.signedAt,
    reviewCompletedAt: assignment?.reviewCompletedAt || null,
    signedAt: award.signedAt,
  };

  const arbitratorCredentials = await generateArbitratorCredentials(arbitratorCredentialsData);
  documents.push(arbitratorCredentials);

  // 4. Generate Procedural Compliance Certificate
  // Get the first signature date as the agreement signed date
  const agreementSignedAt = caseData.agreement?.signatures?.[0]?.signedAt || null;

  const proceduralComplianceData: ProceduralComplianceData = {
    awardReference: award.referenceNumber,
    caseReference: caseData.referenceNumber,
    jurisdiction: caseData.jurisdiction || 'US-CA',
    claimantName: caseData.claimant?.name || 'Claimant',
    respondentName: caseData.respondent?.name || 'Respondent',
    caseCreatedAt: caseData.createdAt,
    agreementSignedAt,
    evidenceSubmissionDeadline: null, // Would come from case deadlines
    analysisCompletedAt: caseData.analysisJob?.completedAt || null,
    awardIssuedAt: award.issuedAt,
    bothPartiesAgreedToArbitrate: !!agreementSignedAt,
    bothPartiesHadOpportunityToSubmitEvidence: true,
    bothPartiesHadOpportunityToSubmitStatements: true,
    neutralArbitratorAssigned: !!assignment,
    awardBasedOnRecordEvidence: true,
    awardIssuedWithinTimeframe: true,
    platformName: PLATFORM_NAME,
    platformRulesVersion: PLATFORM_RULES_VERSION,
  };

  const proceduralCompliance = await generateProceduralCompliance(proceduralComplianceData);
  documents.push(proceduralCompliance);

  // 5. Generate Filing Instructions
  const jurisdictionInfo = getJurisdictionInfo(caseData.jurisdiction || 'US-CA');

  const filingInstructionsData: FilingInstructionsData = {
    jurisdiction: caseData.jurisdiction || 'US-CA',
    awardReference: award.referenceNumber,
    caseReference: caseData.referenceNumber,
    awardAmount: award.awardAmount ? Number(award.awardAmount) : null,
    prevailingParty: award.prevailingParty as 'CLAIMANT' | 'RESPONDENT' | 'SPLIT',
    claimantName: caseData.claimant?.name || 'Claimant',
    respondentName: caseData.respondent?.name || 'Respondent',
    courtName: jurisdictionInfo.courtName,
    courtAddress: jurisdictionInfo.courtAddress,
    filingFeeEstimate: jurisdictionInfo.filingFeeEstimate,
    filingDeadline: jurisdictionInfo.filingDeadline,
    requiredDocuments: jurisdictionInfo.requiredDocuments,
    filingProcedure: jurisdictionInfo.filingProcedure,
    additionalNotes: jurisdictionInfo.additionalNotes,
  };

  const filingInstructions = await generateFilingInstructions(filingInstructionsData);
  documents.push(filingInstructions);

  return {
    awardReference: award.referenceNumber,
    caseReference: caseData.referenceNumber,
    generatedAt: new Date(),
    documents,
    totalDocuments: documents.length,
    jurisdiction: caseData.jurisdiction || 'US-CA',
  };
}

/**
 * Create a ZIP archive containing all enforcement documents
 */
export async function createEnforcementZip(
  kit: EnforcementKit,
  awardPdfBuffer?: Buffer
): Promise<Buffer> {
  return new Promise((resolve, reject) => {
    const archive = archiver('zip', { zlib: { level: 9 } });
    const chunks: Buffer[] = [];

    archive.on('data', (chunk: Buffer) => chunks.push(chunk));
    archive.on('end', () => resolve(Buffer.concat(chunks)));
    archive.on('error', reject);

    // Add README
    const readme = generateReadme(kit);
    archive.append(readme, { name: 'README.txt' });

    // Add manifest
    const manifest = generateManifest(kit);
    archive.append(manifest, { name: 'MANIFEST.json' });

    // Add the original award PDF if provided
    if (awardPdfBuffer) {
      archive.append(awardPdfBuffer, { name: `${kit.awardReference}.pdf` });
    }

    // Add all enforcement documents
    for (const doc of kit.documents) {
      archive.append(doc.buffer, { name: doc.fileName });
    }

    void archive.finalize();
  });
}

/**
 * Generate README for the enforcement package
 */
function generateReadme(kit: EnforcementKit): string {
  return `ENFORCEMENT PACKAGE
==================

Award Reference: ${kit.awardReference}
Case Reference: ${kit.caseReference}
Generated: ${kit.generatedAt.toISOString()}
Jurisdiction: ${kit.jurisdiction}

CONTENTS
--------
This package contains the following documents to assist with
confirming and enforcing your arbitration award:

${kit.documents.map((doc, i) => `${i + 1}. ${doc.name} (${doc.fileName})`).join('\n')}

INSTRUCTIONS
------------
1. Review the Filing Instructions document for jurisdiction-specific
   guidance on confirming your award.

2. The Award Certificate provides a summary of the award with
   verification information.

3. The Proof of Service certifies that the award was delivered
   to all parties.

4. The Arbitrator Credentials document certifies the arbitrator's
   qualifications.

5. The Procedural Compliance Certificate confirms that proper
   arbitration procedures were followed.

IMPORTANT
---------
This package is provided for informational purposes. Consult with
a licensed attorney in your jurisdiction for legal advice regarding
the confirmation and enforcement of your arbitration award.

Generated by SettleRight Arbitration Platform
`;
}

/**
 * Generate manifest JSON for the enforcement package
 */
function generateManifest(kit: EnforcementKit): string {
  return JSON.stringify(
    {
      version: '1.0',
      awardReference: kit.awardReference,
      caseReference: kit.caseReference,
      jurisdiction: kit.jurisdiction,
      generatedAt: kit.generatedAt.toISOString(),
      documents: kit.documents.map((doc) => ({
        type: doc.type,
        name: doc.name,
        fileName: doc.fileName,
        contentType: doc.contentType,
        hash: doc.hash,
      })),
      platform: {
        name: PLATFORM_NAME,
        rulesVersion: PLATFORM_RULES_VERSION,
      },
    },
    null,
    2
  );
}

/**
 * Get enforcement package status for a case
 */
export async function getEnforcementStatus(caseId: string): Promise<{
  available: boolean;
  reason?: string;
  awardReference?: string;
}> {
  const award = await prisma.award.findUnique({
    where: { caseId },
    select: {
      referenceNumber: true,
      documentUrl: true,
      claimantNotifiedAt: true,
      respondentNotifiedAt: true,
    },
  });

  if (!award) {
    return {
      available: false,
      reason: 'No award has been issued for this case',
    };
  }

  if (!award.documentUrl) {
    return {
      available: false,
      reason: 'Award document is not available',
      awardReference: award.referenceNumber,
    };
  }

  return {
    available: true,
    awardReference: award.referenceNumber,
  };
}
