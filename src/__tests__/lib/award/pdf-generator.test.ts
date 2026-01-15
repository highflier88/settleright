/**
 * Award PDF Generator Tests
 *
 * Tests for PDF generation, reference number creation, and currency formatting.
 */

import {
  generateAwardPdf,
  generateReferenceNumber,
  formatCurrency,
  type AwardPdfInput,
} from '@/lib/award/pdf-generator';
import type { FindingOfFact, AwardConclusionOfLaw } from '@/lib/award/types';

describe('Award PDF Generator', () => {
  describe('generateReferenceNumber', () => {
    it('should generate reference number with correct format', () => {
      const sequence = 1;
      const refNum = generateReferenceNumber(sequence);

      // Format: AWD-YYYYMMDD-XXXXX
      expect(refNum).toMatch(/^AWD-\d{8}-\d{5}$/);
    });

    it('should pad sequence number to 5 digits', () => {
      expect(generateReferenceNumber(1)).toMatch(/-00001$/);
      expect(generateReferenceNumber(99)).toMatch(/-00099$/);
      expect(generateReferenceNumber(12345)).toMatch(/-12345$/);
    });

    it('should include today\'s date in YYYYMMDD format', () => {
      const today = new Date();
      const expectedDate = today.toISOString().slice(0, 10).replace(/-/g, '');
      const refNum = generateReferenceNumber(1);

      expect(refNum).toContain(expectedDate);
    });

    it('should generate different reference numbers for different sequences', () => {
      const ref1 = generateReferenceNumber(1);
      const ref2 = generateReferenceNumber(2);

      expect(ref1).not.toEqual(ref2);
    });
  });

  describe('formatCurrency', () => {
    it('should format positive amounts correctly', () => {
      expect(formatCurrency(1000)).toBe('$1,000.00');
      expect(formatCurrency(1234.56)).toBe('$1,234.56');
      expect(formatCurrency(0)).toBe('$0.00');
    });

    it('should format large amounts with proper commas', () => {
      expect(formatCurrency(1000000)).toBe('$1,000,000.00');
      expect(formatCurrency(999999.99)).toBe('$999,999.99');
    });

    it('should round to 2 decimal places', () => {
      expect(formatCurrency(1234.567)).toBe('$1,234.57');
      expect(formatCurrency(1234.564)).toBe('$1,234.56');
    });

    it('should handle small amounts', () => {
      expect(formatCurrency(0.01)).toBe('$0.01');
      expect(formatCurrency(0.99)).toBe('$0.99');
    });
  });

  describe('generateAwardPdf', () => {
    const mockFindingsOfFact: FindingOfFact[] = [
      {
        id: 'finding-1',
        number: 1,
        finding: 'The claimant and respondent entered into a service agreement on January 1, 2025.',
        basis: 'undisputed',
        supportingEvidence: ['evidence-1'],
      },
      {
        id: 'finding-2',
        number: 2,
        finding: 'The respondent failed to deliver services as agreed.',
        basis: 'proven',
        supportingEvidence: ['evidence-2', 'evidence-3'],
      },
      {
        id: 'finding-3',
        number: 3,
        finding: 'The claimant\'s testimony regarding damages was more credible than the respondent\'s.',
        basis: 'credibility',
        supportingEvidence: ['evidence-4'],
        credibilityNote: 'Claimant provided consistent documentation; respondent testimony was inconsistent.',
      },
    ];

    const mockConclusionsOfLaw: AwardConclusionOfLaw[] = [
      {
        id: 'conclusion-1',
        number: 1,
        issue: 'Contract Formation',
        conclusion: 'A valid contract existed between the parties.',
        legalBasis: ['Cal. Civ. Code § 1549', 'Restatement (Second) of Contracts § 17'],
        supportingFindings: [1],
      },
      {
        id: 'conclusion-2',
        number: 2,
        issue: 'Breach of Contract',
        conclusion: 'The respondent materially breached the contract.',
        legalBasis: ['Cal. Civ. Code § 3300'],
        supportingFindings: [1, 2],
      },
    ];

    const createMockInput = (overrides?: Partial<AwardPdfInput>): AwardPdfInput => ({
      referenceNumber: 'AWD-20260113-00001',
      caseReference: 'ARB-2026-001234',
      claimantName: 'John Smith',
      respondentName: 'Jane Doe',
      findingsOfFact: mockFindingsOfFact,
      conclusionsOfLaw: mockConclusionsOfLaw,
      decision: 'Respondent shall pay Claimant $5,000.00 in damages plus interest.',
      awardAmount: 5000,
      prevailingParty: 'claimant',
      reasoning: 'Based on the evidence presented, the claimant has proven their case by a preponderance of the evidence.',
      arbitratorName: 'Hon. Sarah Johnson',
      signedAt: new Date('2026-01-13T12:00:00Z'),
      jurisdiction: 'US-CA',
      ...overrides,
    });

    it('should generate a valid PDF buffer', async () => {
      const input = createMockInput();
      const result = await generateAwardPdf(input);

      expect(result.pdfBuffer).toBeInstanceOf(Buffer);
      expect(result.pdfBuffer.length).toBeGreaterThan(0);
    });

    it('should return a SHA-256 document hash', async () => {
      const input = createMockInput();
      const result = await generateAwardPdf(input);

      // SHA-256 hash is 64 hex characters
      expect(result.documentHash).toMatch(/^[a-f0-9]{64}$/);
    });

    it('should return page count of at least 1', async () => {
      const input = createMockInput();
      const result = await generateAwardPdf(input);

      expect(result.pageCount).toBeGreaterThanOrEqual(1);
    });

    it('should generate consistent hash for same input', async () => {
      const input = createMockInput();
      const result1 = await generateAwardPdf(input);
      const result2 = await generateAwardPdf(input);

      // Same input should produce same hash
      expect(result1.documentHash).toEqual(result2.documentHash);
    });

    it('should generate different hash for different inputs', async () => {
      const input1 = createMockInput({
        claimantName: 'John Smith',
        decision: 'Decision one - Respondent shall pay $5,000.00',
      });
      const input2 = createMockInput({
        claimantName: 'Robert Johnson',
        decision: 'Decision two - Claimant takes nothing',
      });

      const result1 = await generateAwardPdf(input1);
      const result2 = await generateAwardPdf(input2);

      expect(result1.documentHash).not.toEqual(result2.documentHash);
    });

    it('should handle split decision', async () => {
      const input = createMockInput({
        prevailingParty: 'split',
        decision: 'Each party shall bear their own costs. No damages awarded.',
        awardAmount: 0,
      });

      const result = await generateAwardPdf(input);

      expect(result.pdfBuffer).toBeInstanceOf(Buffer);
      expect(result.pageCount).toBeGreaterThanOrEqual(1);
    });

    it('should handle respondent as prevailing party', async () => {
      const input = createMockInput({
        prevailingParty: 'respondent',
        decision: 'The claims are dismissed. Claimant takes nothing.',
        awardAmount: 0,
      });

      const result = await generateAwardPdf(input);

      expect(result.pdfBuffer).toBeInstanceOf(Buffer);
    });

    it('should handle long party names', async () => {
      const input = createMockInput({
        claimantName: 'ABC International Holdings Corporation Limited Partnership',
        respondentName: 'XYZ Global Services and Consulting Group Incorporated',
      });

      const result = await generateAwardPdf(input);

      expect(result.pdfBuffer).toBeInstanceOf(Buffer);
    });

    it('should handle multiple pages with many findings', async () => {
      const manyFindings: FindingOfFact[] = Array.from({ length: 20 }, (_, i) => ({
        id: `finding-${i + 1}`,
        number: i + 1,
        finding: `Finding number ${i + 1}: The evidence demonstrates that the party made representations regarding the matter at issue in this arbitration proceeding.`,
        basis: 'proven' as const,
        supportingEvidence: [`evidence-${i + 1}`],
      }));

      const input = createMockInput({ findingsOfFact: manyFindings });
      const result = await generateAwardPdf(input);

      expect(result.pageCount).toBeGreaterThan(1);
    });

    it('should generate PDF with valid header bytes', async () => {
      const input = createMockInput();
      const result = await generateAwardPdf(input);

      // PDF files start with %PDF-
      const header = result.pdfBuffer.slice(0, 5).toString('ascii');
      expect(header).toBe('%PDF-');
    });
  });
});
