/**
 * Enforcement Package Types
 *
 * Types for generating enforcement documents that help parties
 * confirm and enforce arbitration awards in court.
 */

/**
 * Proof of Service Certificate data
 */
export interface ProofOfServiceData {
  awardReference: string;
  caseReference: string;
  claimant: {
    name: string;
    email: string;
    notifiedAt: Date | null;
  };
  respondent: {
    name: string;
    email: string;
    notifiedAt: Date | null;
  };
  awardIssuedAt: Date;
  deliveryMethod: 'EMAIL' | 'IN_APP' | 'BOTH';
  platformName: string;
}

/**
 * Arbitrator Credentials data
 */
export interface ArbitratorCredentialsData {
  arbitrator: {
    name: string;
    email: string;
    barNumber: string | null;
    barState: string | null;
    isRetiredJudge: boolean;
    yearsExperience: number | null;
    lawSchool: string | null;
    graduationYear: number | null;
    jurisdictions: string[];
    credentialVerifiedAt: Date | null;
    onboardedAt: Date | null;
  };
  awardReference: string;
  caseReference: string;
  jurisdiction: string;
  assignedAt: Date;
  reviewCompletedAt: Date | null;
  signedAt: Date;
}

/**
 * Procedural Compliance Certificate data
 */
export interface ProceduralComplianceData {
  awardReference: string;
  caseReference: string;
  jurisdiction: string;

  // Parties
  claimantName: string;
  respondentName: string;

  // Timeline
  caseCreatedAt: Date;
  agreementSignedAt: Date | null;
  evidenceSubmissionDeadline: Date | null;
  analysisCompletedAt: Date | null;
  awardIssuedAt: Date;

  // Procedural elements
  bothPartiesAgreedToArbitrate: boolean;
  bothPartiesHadOpportunityToSubmitEvidence: boolean;
  bothPartiesHadOpportunityToSubmitStatements: boolean;
  neutralArbitratorAssigned: boolean;
  awardBasedOnRecordEvidence: boolean;
  awardIssuedWithinTimeframe: boolean;

  // Platform info
  platformName: string;
  platformRulesVersion: string;
}

/**
 * Filing Instructions data
 */
export interface FilingInstructionsData {
  jurisdiction: string;
  awardReference: string;
  caseReference: string;
  awardAmount: number | null;
  prevailingParty: 'CLAIMANT' | 'RESPONDENT' | 'SPLIT';
  claimantName: string;
  respondentName: string;

  // Court information (jurisdiction-specific)
  courtName: string;
  courtAddress: string;
  filingFeeEstimate: string;
  filingDeadline: string;
  requiredDocuments: string[];
  filingProcedure: string[];
  additionalNotes: string[];
}

/**
 * Enforcement Kit contents
 */
export interface EnforcementKit {
  awardReference: string;
  caseReference: string;
  generatedAt: Date;

  documents: EnforcementDocument[];

  // Summary
  totalDocuments: number;
  jurisdiction: string;
}

/**
 * Individual enforcement document
 */
export interface EnforcementDocument {
  type: EnforcementDocumentType;
  name: string;
  fileName: string;
  contentType: string;
  buffer: Buffer;
  hash: string;
}

/**
 * Types of enforcement documents
 */
export type EnforcementDocumentType =
  | 'AWARD'
  | 'AWARD_CERTIFICATE'
  | 'PROOF_OF_SERVICE'
  | 'ARBITRATOR_CREDENTIALS'
  | 'PROCEDURAL_COMPLIANCE'
  | 'FILING_INSTRUCTIONS';

/**
 * Jurisdiction filing information
 */
export interface JurisdictionFilingInfo {
  jurisdiction: string;
  jurisdictionName: string;
  courtName: string;
  courtAddress: string;
  filingFeeEstimate: string;
  filingDeadline: string;
  requiredDocuments: string[];
  filingProcedure: string[];
  additionalNotes: string[];
  statute: string;
  statuteText: string;
}
