/**
 * Document Classifier Tests
 *
 * Tests for document classification functionality.
 */

import { classifyByFilename, estimateClassificationCost } from '@/lib/documents/classifier';

describe('Document Classifier', () => {
  // ==========================================================================
  // classifyByFilename
  // ==========================================================================

  describe('classifyByFilename', () => {
    it('should classify contract files', () => {
      expect(classifyByFilename('service_contract.pdf')).toBe('CONTRACT');
      expect(classifyByFilename('Agreement_2024.docx')).toBe('CONTRACT');
      expect(classifyByFilename('terms_of_service.pdf')).toBe('CONTRACT');
    });

    it('should classify invoice files', () => {
      expect(classifyByFilename('invoice_12345.pdf')).toBe('INVOICE');
      expect(classifyByFilename('Bill_January_2024.pdf')).toBe('INVOICE');
    });

    it('should classify receipt files', () => {
      expect(classifyByFilename('receipt_amazon.pdf')).toBe('RECEIPT');
      expect(classifyByFilename('Payment_Receipt.pdf')).toBe('RECEIPT');
    });

    it('should classify bank statement files', () => {
      expect(classifyByFilename('bank_statement_jan.pdf')).toBe('BANK_STATEMENT');
      expect(classifyByFilename('Statement_December.pdf')).toBe('BANK_STATEMENT');
    });

    it('should classify correspondence files', () => {
      expect(classifyByFilename('letter_to_vendor.pdf')).toBe('CORRESPONDENCE');
      expect(classifyByFilename('email_exchange.pdf')).toBe('CORRESPONDENCE');
      expect(classifyByFilename('correspondence_log.docx')).toBe('CORRESPONDENCE');
    });

    it('should classify legal notice files', () => {
      expect(classifyByFilename('legal_notice.pdf')).toBe('LEGAL_NOTICE');
      expect(classifyByFilename('demand_notice.pdf')).toBe('LEGAL_NOTICE');
      expect(classifyByFilename('cease_and_desist_notice.pdf')).toBe('LEGAL_NOTICE');
    });

    it('should classify demand letter as correspondence due to keyword order', () => {
      // "letter" matches CORRESPONDENCE before "demand" matches LEGAL_NOTICE
      expect(classifyByFilename('demand_letter.pdf')).toBe('CORRESPONDENCE');
    });

    it('should classify photo evidence files', () => {
      expect(classifyByFilename('photo_damage.jpg')).toBe('PHOTO_EVIDENCE');
      expect(classifyByFilename('evidence_image.png')).toBe('PHOTO_EVIDENCE');
      expect(classifyByFilename('damage_report_images.zip')).toBe('PHOTO_EVIDENCE');
    });

    it('should return null for unrecognized filenames', () => {
      expect(classifyByFilename('document.pdf')).toBeNull();
      expect(classifyByFilename('file_2024.docx')).toBeNull();
      expect(classifyByFilename('scan.png')).toBeNull();
    });

    it('should be case-insensitive', () => {
      expect(classifyByFilename('CONTRACT.PDF')).toBe('CONTRACT');
      expect(classifyByFilename('INVOICE_2024.PDF')).toBe('INVOICE');
      expect(classifyByFilename('Bank_STATEMENT.pdf')).toBe('BANK_STATEMENT');
    });

    it('should handle filenames with multiple keywords', () => {
      // Contract takes precedence due to order in code
      expect(classifyByFilename('contract_invoice.pdf')).toBe('CONTRACT');
    });

    it('should handle filenames with path separators', () => {
      expect(classifyByFilename('documents/contracts/agreement.pdf')).toBe('CONTRACT');
    });

    it('should handle filenames with special characters', () => {
      expect(classifyByFilename('contract_final_v2.pdf')).toBe('CONTRACT');
      expect(classifyByFilename('invoice-2024-001.pdf')).toBe('INVOICE');
    });
  });

  // ==========================================================================
  // estimateClassificationCost
  // ==========================================================================

  describe('estimateClassificationCost', () => {
    it('should estimate cost for short text', () => {
      const cost = estimateClassificationCost(1000);

      expect(cost).toBeGreaterThan(0);
      expect(cost).toBeLessThan(0.001); // Should be very cheap
    });

    it('should estimate cost for long text', () => {
      const cost = estimateClassificationCost(10000);

      expect(cost).toBeGreaterThan(0);
      expect(cost).toBeLessThan(0.01);
    });

    it('should scale cost with text length', () => {
      const shortCost = estimateClassificationCost(1000);
      const longCost = estimateClassificationCost(5000);

      expect(longCost).toBeGreaterThan(shortCost);
    });

    it('should include prompt overhead in estimate', () => {
      // Even for zero-length text, there should be some cost for the prompt
      const cost = estimateClassificationCost(0);

      expect(cost).toBeGreaterThan(0);
    });

    it('should estimate cost proportionally', () => {
      const cost1 = estimateClassificationCost(1000);
      const cost2 = estimateClassificationCost(2000);

      // Cost should increase but not exactly double (due to fixed output tokens)
      expect(cost2 / cost1).toBeGreaterThan(1);
      expect(cost2 / cost1).toBeLessThan(2.5);
    });

    it('should return a number for very large text', () => {
      const cost = estimateClassificationCost(100000);

      expect(typeof cost).toBe('number');
      expect(cost).toBeGreaterThan(0);
      expect(cost).toBeLessThan(1); // Should still be less than $1
    });
  });
});
