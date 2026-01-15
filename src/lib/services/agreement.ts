import { createHash } from 'crypto';

import { AgreementStatus, CaseRole, CaseStatus, AuditAction } from '@prisma/client';

import { prisma } from '@/lib/db';
import { createAuditLog } from '@/lib/services/audit';

import type { Agreement, Signature, Case } from '@prisma/client';

// Current agreement template version
export const AGREEMENT_TEMPLATE_VERSION = '1.0';
export const PROCEDURAL_RULES_VERSION = '1.0';

// Agreement content template
export function generateAgreementContent(
  caseData: {
    referenceNumber: string;
    jurisdiction: string;
    disputeType: string;
    amount: number;
    description: string;
  },
  claimant: { name: string | null; email: string },
  respondent: { name: string | null; email: string }
): string {
  return `
SUBMISSION AGREEMENT FOR BINDING ARBITRATION

Case Reference: ${caseData.referenceNumber}
Agreement Version: ${AGREEMENT_TEMPLATE_VERSION}
Procedural Rules Version: ${PROCEDURAL_RULES_VERSION}

PARTIES

Claimant: ${claimant.name ?? claimant.email}
Email: ${claimant.email}

Respondent: ${respondent.name ?? respondent.email}
Email: ${respondent.email}

DISPUTE INFORMATION

Type: ${caseData.disputeType}
Jurisdiction: ${caseData.jurisdiction}
Claimed Amount: $${caseData.amount.toLocaleString()}

Description:
${caseData.description}

AGREEMENT TERMS

1. MUTUAL CONSENT TO ARBITRATE
Both parties hereby agree to submit the above-described dispute to final and binding arbitration administered by Settleright.ai in accordance with its Procedural Rules.

2. WAIVER OF JURY TRIAL
Both parties knowingly and voluntarily waive any right to a jury trial or to litigate this dispute in court, except as necessary to enforce any arbitration award.

3. WAIVER OF CLASS ACTION
Both parties agree to arbitrate this dispute on an individual basis only. Neither party may bring claims as a plaintiff or class member in any purported class or representative proceeding.

4. GOVERNING LAW
This arbitration shall be governed by the laws of the State of ${caseData.jurisdiction.split('-')[1] || caseData.jurisdiction}, and the Federal Arbitration Act (9 U.S.C. §§ 1-16).

5. AI-ASSISTED ARBITRATION DISCLOSURE
Both parties acknowledge and agree that:
- Initial case analysis will be performed by artificial intelligence systems
- A human arbitrator will review and approve all decisions
- The AI analysis assists but does not replace human judgment
- The final award will be signed by a qualified human arbitrator

6. FINALITY OF AWARD
The arbitrator's award shall be final and binding on both parties. Judgment on the award may be entered in any court of competent jurisdiction.

7. CONFIDENTIALITY
All aspects of the arbitration proceeding, including the award, shall be kept confidential by both parties, except as required by law.

8. FEES AND COSTS
Filing fees and arbitration costs shall be allocated as determined by the arbitrator in the final award.

9. PROCEDURAL RULES
This arbitration shall be conducted in accordance with the Settleright.ai Procedural Rules, Version ${PROCEDURAL_RULES_VERSION}, which are incorporated by reference.

10. ELECTRONIC SIGNATURES
Both parties agree that electronic signatures on this agreement are legally binding and have the same force and effect as original signatures.

BY SIGNING BELOW, EACH PARTY CONFIRMS THAT THEY HAVE READ, UNDERSTAND, AND AGREE TO BE BOUND BY THE TERMS OF THIS SUBMISSION AGREEMENT.
`.trim();
}

// Generate consent text for signature
export function generateConsentText(role: CaseRole, caseReference: string): string {
  return `I, as the ${role === CaseRole.CLAIMANT ? 'Claimant' : 'Respondent'} in Case ${caseReference}, have read and understand the Submission Agreement for Binding Arbitration. I voluntarily agree to be bound by its terms, including the waiver of jury trial and class action rights. I understand that the arbitration award will be final and binding.`;
}

// Generate checksum for consent text
export function generateConsentChecksum(consentText: string): string {
  return createHash('sha256').update(consentText).digest('hex');
}

// Generate document hash
export function generateDocumentHash(content: string): string {
  return createHash('sha256').update(content).digest('hex');
}

export interface SignAgreementInput {
  caseId: string;
  userId: string;
  role: CaseRole;
  ipAddress: string;
  userAgent: string;
  deviceFingerprint?: string;
}

export interface SignAgreementResult {
  success: boolean;
  signature?: Signature;
  agreementComplete?: boolean;
  error?: string;
}

// Get agreement for a case
export async function getAgreementForCase(caseId: string): Promise<
  | (Agreement & {
      signatures: Signature[];
      case: Case & {
        claimant: { id: string; name: string | null; email: string };
        respondent: { id: string; name: string | null; email: string } | null;
      };
    })
  | null
> {
  return prisma.agreement.findUnique({
    where: { caseId },
    include: {
      signatures: true,
      case: {
        include: {
          claimant: {
            select: { id: true, name: true, email: true },
          },
          respondent: {
            select: { id: true, name: true, email: true },
          },
        },
      },
    },
  });
}

// Sign the agreement
export async function signAgreement(
  input: SignAgreementInput
): Promise<SignAgreementResult> {
  try {
    // Get the agreement with case details
    const agreement = await getAgreementForCase(input.caseId);

    if (!agreement) {
      return { success: false, error: 'Agreement not found' };
    }

    // Verify the case is in the right status
    if (agreement.case.status !== CaseStatus.PENDING_AGREEMENT) {
      return { success: false, error: 'Case is not pending agreement signing' };
    }

    // Verify the user is the correct party
    const isClaimant = agreement.case.claimant.id === input.userId;
    const isRespondent = agreement.case.respondent?.id === input.userId;

    if (!isClaimant && !isRespondent) {
      return { success: false, error: 'You are not a party to this case' };
    }

    const expectedRole = isClaimant ? CaseRole.CLAIMANT : CaseRole.RESPONDENT;
    if (expectedRole !== input.role) {
      return { success: false, error: 'Role mismatch' };
    }

    // Check if already signed
    const existingSignature = agreement.signatures.find((s) => s.role === input.role);
    if (existingSignature) {
      return { success: false, error: 'You have already signed this agreement' };
    }

    // Generate consent text and checksum
    const consentText = generateConsentText(input.role, agreement.case.referenceNumber);
    const consentChecksum = generateConsentChecksum(consentText);

    // Create the signature
    const signature = await prisma.signature.create({
      data: {
        agreementId: agreement.id,
        userId: input.userId,
        role: input.role,
        ipAddress: input.ipAddress,
        userAgent: input.userAgent,
        deviceFingerprint: input.deviceFingerprint,
        consentText,
        consentChecksum,
      },
    });

    // Log the signing
    await createAuditLog({
      action: AuditAction.AGREEMENT_SIGNED,
      userId: input.userId,
      caseId: input.caseId,
      ipAddress: input.ipAddress,
      userAgent: input.userAgent,
      metadata: {
        role: input.role,
        signatureId: signature.id,
        agreementId: agreement.id,
      },
    });

    // Check if both parties have signed
    const otherRole = input.role === CaseRole.CLAIMANT ? CaseRole.RESPONDENT : CaseRole.CLAIMANT;
    const otherSignature = agreement.signatures.find((s) => s.role === otherRole);
    const agreementComplete = !!otherSignature;

    if (agreementComplete) {
      // Generate agreement document content
      const documentContent = generateAgreementContent(
        {
          referenceNumber: agreement.case.referenceNumber,
          jurisdiction: agreement.case.jurisdiction,
          disputeType: agreement.case.disputeType,
          amount: Number(agreement.case.amount),
          description: agreement.case.description,
        },
        agreement.case.claimant,
        agreement.case.respondent!
      );

      const documentHash = generateDocumentHash(documentContent);

      // Update agreement to complete and case status
      await prisma.$transaction([
        prisma.agreement.update({
          where: { id: agreement.id },
          data: {
            status: AgreementStatus.COMPLETE,
            documentHash,
          },
        }),
        prisma.case.update({
          where: { id: input.caseId },
          data: {
            status: CaseStatus.EVIDENCE_SUBMISSION,
            // Set evidence deadline to 14 days from now
            evidenceDeadline: new Date(Date.now() + 14 * 24 * 60 * 60 * 1000),
          },
        }),
      ]);
    } else {
      // Update agreement status to pending the other party
      const newStatus =
        input.role === CaseRole.CLAIMANT
          ? AgreementStatus.PENDING_RESPONDENT
          : AgreementStatus.PENDING_CLAIMANT;

      await prisma.agreement.update({
        where: { id: agreement.id },
        data: { status: newStatus },
      });
    }

    return {
      success: true,
      signature,
      agreementComplete,
    };
  } catch (error) {
    console.error('Failed to sign agreement:', error);
    return {
      success: false,
      error: error instanceof Error ? error.message : 'Failed to sign agreement',
    };
  }
}

// Check if user can sign agreement
export async function canSignAgreement(
  caseId: string,
  userId: string
): Promise<{
  canSign: boolean;
  reason?: string;
  role?: CaseRole;
  alreadySigned?: boolean;
}> {
  const agreement = await getAgreementForCase(caseId);

  if (!agreement) {
    return { canSign: false, reason: 'Agreement not found' };
  }

  if (agreement.case.status !== CaseStatus.PENDING_AGREEMENT) {
    return { canSign: false, reason: 'Case is not pending agreement signing' };
  }

  const isClaimant = agreement.case.claimant.id === userId;
  const isRespondent = agreement.case.respondent?.id === userId;

  if (!isClaimant && !isRespondent) {
    return { canSign: false, reason: 'You are not a party to this case' };
  }

  const role = isClaimant ? CaseRole.CLAIMANT : CaseRole.RESPONDENT;
  const alreadySigned = agreement.signatures.some((s) => s.role === role);

  if (alreadySigned) {
    return { canSign: false, reason: 'You have already signed', role, alreadySigned: true };
  }

  return { canSign: true, role };
}

// Get agreement status display info
export function getAgreementStatusInfo(agreement: Agreement & { signatures: Signature[] }): {
  label: string;
  description: string;
  claimantSigned: boolean;
  respondentSigned: boolean;
  isComplete: boolean;
} {
  const claimantSigned = agreement.signatures.some((s) => s.role === CaseRole.CLAIMANT);
  const respondentSigned = agreement.signatures.some((s) => s.role === CaseRole.RESPONDENT);
  const isComplete = agreement.status === AgreementStatus.COMPLETE;

  let label: string;
  let description: string;

  if (isComplete) {
    label = 'Complete';
    description = 'Both parties have signed the submission agreement.';
  } else if (claimantSigned && !respondentSigned) {
    label = 'Awaiting Respondent';
    description = 'The claimant has signed. Waiting for the respondent to sign.';
  } else if (!claimantSigned && respondentSigned) {
    label = 'Awaiting Claimant';
    description = 'The respondent has signed. Waiting for the claimant to sign.';
  } else {
    label = 'Pending Signatures';
    description = 'Neither party has signed yet. Both must sign to proceed.';
  }

  return {
    label,
    description,
    claimantSigned,
    respondentSigned,
    isComplete,
  };
}
