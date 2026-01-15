/**
 * Agreement Service Tests
 *
 * Tests for agreement generation, signing, and status management.
 */

import { CaseRole, AgreementStatus } from '@prisma/client';
import {
  generateAgreementContent,
  generateConsentText,
  generateConsentChecksum,
  generateDocumentHash,
  getAgreementStatusInfo,
  AGREEMENT_TEMPLATE_VERSION,
  PROCEDURAL_RULES_VERSION,
} from '@/lib/services/agreement';

describe('Agreement Service', () => {
  // ==========================================================================
  // generateAgreementContent
  // ==========================================================================

  describe('generateAgreementContent', () => {
    const caseData = {
      referenceNumber: 'SR-2026-ABC123',
      jurisdiction: 'US-CA',
      disputeType: 'CONTRACT',
      amount: 5000,
      description: 'Breach of service contract',
    };

    const claimant = {
      name: 'John Smith',
      email: 'john@example.com',
    };

    const respondent = {
      name: 'Jane Doe',
      email: 'jane@example.com',
    };

    it('should include case reference number', () => {
      const content = generateAgreementContent(caseData, claimant, respondent);
      expect(content).toContain('SR-2026-ABC123');
    });

    it('should include template version', () => {
      const content = generateAgreementContent(caseData, claimant, respondent);
      expect(content).toContain(`Agreement Version: ${AGREEMENT_TEMPLATE_VERSION}`);
    });

    it('should include procedural rules version', () => {
      const content = generateAgreementContent(caseData, claimant, respondent);
      expect(content).toContain(`Procedural Rules Version: ${PROCEDURAL_RULES_VERSION}`);
    });

    it('should include claimant information', () => {
      const content = generateAgreementContent(caseData, claimant, respondent);
      expect(content).toContain('John Smith');
      expect(content).toContain('john@example.com');
    });

    it('should include respondent information', () => {
      const content = generateAgreementContent(caseData, claimant, respondent);
      expect(content).toContain('Jane Doe');
      expect(content).toContain('jane@example.com');
    });

    it('should include dispute type', () => {
      const content = generateAgreementContent(caseData, claimant, respondent);
      expect(content).toContain('CONTRACT');
    });

    it('should include jurisdiction', () => {
      const content = generateAgreementContent(caseData, claimant, respondent);
      expect(content).toContain('US-CA');
    });

    it('should include formatted amount', () => {
      const content = generateAgreementContent(caseData, claimant, respondent);
      expect(content).toContain('$5,000');
    });

    it('should include description', () => {
      const content = generateAgreementContent(caseData, claimant, respondent);
      expect(content).toContain('Breach of service contract');
    });

    it('should use email when name is null', () => {
      const noNameClaimant = { name: null, email: 'claimant@example.com' };
      const noNameRespondent = { name: null, email: 'respondent@example.com' };
      const content = generateAgreementContent(caseData, noNameClaimant, noNameRespondent);
      expect(content).toContain('claimant@example.com');
      expect(content).toContain('respondent@example.com');
    });

    it('should include jury trial waiver', () => {
      const content = generateAgreementContent(caseData, claimant, respondent);
      expect(content).toContain('WAIVER OF JURY TRIAL');
    });

    it('should include class action waiver', () => {
      const content = generateAgreementContent(caseData, claimant, respondent);
      expect(content).toContain('WAIVER OF CLASS ACTION');
    });

    it('should include AI disclosure', () => {
      const content = generateAgreementContent(caseData, claimant, respondent);
      expect(content).toContain('AI-ASSISTED ARBITRATION DISCLOSURE');
      expect(content).toContain('artificial intelligence');
    });

    it('should include confidentiality clause', () => {
      const content = generateAgreementContent(caseData, claimant, respondent);
      expect(content).toContain('CONFIDENTIALITY');
    });

    it('should include electronic signature acknowledgment', () => {
      const content = generateAgreementContent(caseData, claimant, respondent);
      expect(content).toContain('ELECTRONIC SIGNATURES');
      expect(content).toContain('legally binding');
    });

    it('should extract state from jurisdiction', () => {
      const content = generateAgreementContent(caseData, claimant, respondent);
      expect(content).toContain('laws of the State of CA');
    });

    it('should handle jurisdiction without state code', () => {
      const otherCaseData = { ...caseData, jurisdiction: 'FEDERAL' };
      const content = generateAgreementContent(otherCaseData, claimant, respondent);
      expect(content).toContain('FEDERAL');
    });
  });

  // ==========================================================================
  // generateConsentText
  // ==========================================================================

  describe('generateConsentText', () => {
    it('should generate claimant consent text', () => {
      const text = generateConsentText(CaseRole.CLAIMANT, 'SR-2026-ABC123');
      expect(text).toContain('Claimant');
      expect(text).toContain('SR-2026-ABC123');
      expect(text).toContain('have read and understand');
      expect(text).toContain('waiver of jury trial');
      expect(text).toContain('final and binding');
    });

    it('should generate respondent consent text', () => {
      const text = generateConsentText(CaseRole.RESPONDENT, 'SR-2026-XYZ789');
      expect(text).toContain('Respondent');
      expect(text).toContain('SR-2026-XYZ789');
    });

    it('should include case reference', () => {
      const text = generateConsentText(CaseRole.CLAIMANT, 'CASE-12345');
      expect(text).toContain('Case CASE-12345');
    });
  });

  // ==========================================================================
  // generateConsentChecksum
  // ==========================================================================

  describe('generateConsentChecksum', () => {
    it('should generate SHA-256 hash', () => {
      const checksum = generateConsentChecksum('Test consent text');
      expect(checksum).toMatch(/^[a-f0-9]{64}$/);
    });

    it('should generate consistent hash for same input', () => {
      const text = 'Same input text';
      const hash1 = generateConsentChecksum(text);
      const hash2 = generateConsentChecksum(text);
      expect(hash1).toBe(hash2);
    });

    it('should generate different hash for different input', () => {
      const hash1 = generateConsentChecksum('Text A');
      const hash2 = generateConsentChecksum('Text B');
      expect(hash1).not.toBe(hash2);
    });

    it('should handle empty string', () => {
      const checksum = generateConsentChecksum('');
      expect(checksum).toMatch(/^[a-f0-9]{64}$/);
    });
  });

  // ==========================================================================
  // generateDocumentHash
  // ==========================================================================

  describe('generateDocumentHash', () => {
    it('should generate SHA-256 hash', () => {
      const hash = generateDocumentHash('Document content');
      expect(hash).toMatch(/^[a-f0-9]{64}$/);
    });

    it('should generate consistent hash for same content', () => {
      const content = 'Same document content';
      const hash1 = generateDocumentHash(content);
      const hash2 = generateDocumentHash(content);
      expect(hash1).toBe(hash2);
    });

    it('should generate different hash for different content', () => {
      const hash1 = generateDocumentHash('Document A');
      const hash2 = generateDocumentHash('Document B');
      expect(hash1).not.toBe(hash2);
    });

    it('should handle long content', () => {
      const longContent = 'A'.repeat(10000);
      const hash = generateDocumentHash(longContent);
      expect(hash).toMatch(/^[a-f0-9]{64}$/);
    });
  });

  // ==========================================================================
  // getAgreementStatusInfo
  // ==========================================================================

  describe('getAgreementStatusInfo', () => {
    const createMockAgreement = (
      status: AgreementStatus,
      signatures: { role: CaseRole }[]
    ) => ({
      id: 'agreement-123',
      caseId: 'case-123',
      status,
      templateVersion: '1.0',
      rulesVersion: '1.0',
      documentHash: null,
      createdAt: new Date(),
      updatedAt: new Date(),
      signatures: signatures.map((s, i) => ({
        id: `sig-${i}`,
        agreementId: 'agreement-123',
        userId: `user-${i}`,
        role: s.role,
        signedAt: new Date(),
        ipAddress: '127.0.0.1',
        userAgent: 'test',
        deviceFingerprint: null,
        consentText: 'test',
        consentChecksum: 'test',
      })),
    });

    it('should return complete status when agreement is complete', () => {
      const agreement = createMockAgreement(AgreementStatus.COMPLETE, [
        { role: CaseRole.CLAIMANT },
        { role: CaseRole.RESPONDENT },
      ]);

      const info = getAgreementStatusInfo(agreement);

      expect(info.label).toBe('Complete');
      expect(info.isComplete).toBe(true);
      expect(info.claimantSigned).toBe(true);
      expect(info.respondentSigned).toBe(true);
    });

    it('should return awaiting respondent when only claimant signed', () => {
      const agreement = createMockAgreement(AgreementStatus.PENDING_RESPONDENT, [
        { role: CaseRole.CLAIMANT },
      ]);

      const info = getAgreementStatusInfo(agreement);

      expect(info.label).toBe('Awaiting Respondent');
      expect(info.isComplete).toBe(false);
      expect(info.claimantSigned).toBe(true);
      expect(info.respondentSigned).toBe(false);
    });

    it('should return awaiting claimant when only respondent signed', () => {
      const agreement = createMockAgreement(AgreementStatus.PENDING_CLAIMANT, [
        { role: CaseRole.RESPONDENT },
      ]);

      const info = getAgreementStatusInfo(agreement);

      expect(info.label).toBe('Awaiting Claimant');
      expect(info.isComplete).toBe(false);
      expect(info.claimantSigned).toBe(false);
      expect(info.respondentSigned).toBe(true);
    });

    it('should return pending when no one has signed', () => {
      const agreement = createMockAgreement(AgreementStatus.PENDING_BOTH, []);

      const info = getAgreementStatusInfo(agreement);

      expect(info.label).toBe('Pending Signatures');
      expect(info.isComplete).toBe(false);
      expect(info.claimantSigned).toBe(false);
      expect(info.respondentSigned).toBe(false);
    });

    it('should include meaningful descriptions', () => {
      const complete = createMockAgreement(AgreementStatus.COMPLETE, [
        { role: CaseRole.CLAIMANT },
        { role: CaseRole.RESPONDENT },
      ]);
      const pending = createMockAgreement(AgreementStatus.PENDING_BOTH, []);

      expect(getAgreementStatusInfo(complete).description).toContain('Both parties');
      expect(getAgreementStatusInfo(pending).description).toContain('Neither party');
    });
  });

  // ==========================================================================
  // Constants
  // ==========================================================================

  describe('Constants', () => {
    it('should have valid template version', () => {
      expect(AGREEMENT_TEMPLATE_VERSION).toMatch(/^\d+\.\d+$/);
    });

    it('should have valid procedural rules version', () => {
      expect(PROCEDURAL_RULES_VERSION).toMatch(/^\d+\.\d+$/);
    });
  });
});
