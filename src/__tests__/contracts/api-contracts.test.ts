/**
 * API Contract Tests
 *
 * Validates that API responses match expected schemas.
 * These tests ensure API stability and backwards compatibility.
 */

import {
  CaseSchema,
  CaseResponseSchema,
  EvidenceSchema,
  AwardSchema,
  PaymentSchema,
  CheckoutSessionResponseSchema,
  NotificationSchema,
  UserSchema,
  SuccessResponseSchema,
  ErrorResponseSchema,
} from './schemas';
import { validateSchema, assertSchema } from './validator';
import {
  createCase,
  createEvidence,
  createAward,
  createPayment,
  createNotification,
  createUser,
} from '../factories';

describe('API Contract Validation', () => {
  describe('Success Response Schema', () => {
    it('should validate correct success response', () => {
      const response = {
        success: true,
        data: { id: '123' },
      };

      const result = validateSchema(SuccessResponseSchema, response);
      expect(result.valid).toBe(true);
    });

    it('should reject response without data', () => {
      const response = {
        success: true,
      };

      const result = validateSchema(SuccessResponseSchema, response);
      expect(result.valid).toBe(false);
    });

    it('should reject response with success: false', () => {
      const response = {
        success: false,
        data: {},
      };

      const result = validateSchema(SuccessResponseSchema, response);
      expect(result.valid).toBe(false);
    });
  });

  describe('Error Response Schema', () => {
    it('should validate correct error response', () => {
      const response = {
        success: false,
        error: {
          message: 'Not found',
          code: 'NOT_FOUND',
        },
      };

      const result = validateSchema(ErrorResponseSchema, response);
      expect(result.valid).toBe(true);
    });

    it('should validate error without code', () => {
      const response = {
        success: false,
        error: {
          message: 'Something went wrong',
        },
      };

      const result = validateSchema(ErrorResponseSchema, response);
      expect(result.valid).toBe(true);
    });

    it('should reject error without message', () => {
      const response = {
        success: false,
        error: {},
      };

      const result = validateSchema(ErrorResponseSchema, response);
      expect(result.valid).toBe(false);
    });
  });

  describe('User Schema', () => {
    it('should validate user data from factory', () => {
      const user = createUser();
      const userData = {
        id: user.id,
        email: user.email,
        name: user.name,
        role: user.role,
        emailVerified: user.emailVerified,
        createdAt: user.createdAt.toISOString(),
      };

      const result = validateSchema(UserSchema, userData);
      expect(result.valid).toBe(true);
    });

    it('should reject invalid email', () => {
      const userData = {
        id: 'test-id',
        email: 'not-an-email',
        name: 'Test',
        role: 'USER',
        emailVerified: true,
        createdAt: new Date().toISOString(),
      };

      const result = validateSchema(UserSchema, userData);
      expect(result.valid).toBe(false);
      expect(result.errors[0]).toContain('email');
    });

    it('should reject invalid role', () => {
      const userData = {
        id: 'test-id',
        email: 'test@example.com',
        name: 'Test',
        role: 'SUPERUSER',
        emailVerified: true,
        createdAt: new Date().toISOString(),
      };

      const result = validateSchema(UserSchema, userData);
      expect(result.valid).toBe(false);
    });
  });

  describe('Case Schema', () => {
    it('should validate case data from factory', () => {
      const caseData = createCase();
      const serialized = {
        id: caseData.id,
        referenceNumber: caseData.referenceNumber,
        status: caseData.status,
        jurisdiction: caseData.jurisdiction,
        disputeType: caseData.disputeType,
        description: caseData.description,
        amount: 5000,
        claimantId: caseData.claimantId,
        respondentId: caseData.respondentId,
        responseDeadline: caseData.responseDeadline?.toISOString() ?? null,
        evidenceDeadline: caseData.evidenceDeadline?.toISOString() ?? null,
        createdAt: caseData.createdAt.toISOString(),
        updatedAt: caseData.updatedAt.toISOString(),
      };

      const result = validateSchema(CaseSchema, serialized);
      expect(result.valid).toBe(true);
    });

    it('should validate case response', () => {
      const caseData = createCase();
      const response = {
        success: true,
        data: {
          id: caseData.id,
          referenceNumber: caseData.referenceNumber,
          status: caseData.status,
          jurisdiction: caseData.jurisdiction,
          disputeType: caseData.disputeType,
          description: caseData.description,
          amount: 5000,
          claimantId: caseData.claimantId,
          respondentId: null,
          responseDeadline: null,
          evidenceDeadline: null,
          createdAt: new Date().toISOString(),
          updatedAt: new Date().toISOString(),
        },
      };

      const result = validateSchema(CaseResponseSchema, response);
      expect(result.valid).toBe(true);
    });

    it('should reject invalid status', () => {
      const caseData = {
        id: 'test',
        referenceNumber: 'ARB-123',
        status: 'INVALID_STATUS',
        jurisdiction: 'US-CA',
        disputeType: 'CONTRACTS',
        description: 'Test',
        amount: 5000,
        claimantId: 'user-1',
        respondentId: null,
        responseDeadline: null,
        evidenceDeadline: null,
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
      };

      const result = validateSchema(CaseSchema, caseData);
      expect(result.valid).toBe(false);
    });
  });

  describe('Evidence Schema', () => {
    it('should validate evidence data', () => {
      const evidence = createEvidence();
      const serialized = {
        id: evidence.id,
        caseId: evidence.caseId,
        uploadedById: evidence.uploadedById,
        type: evidence.type,
        status: evidence.status,
        title: evidence.title,
        description: evidence.description,
        fileName: evidence.fileName,
        mimeType: evidence.mimeType,
        fileSize: evidence.fileSize,
        fileUrl: evidence.fileUrl,
        createdAt: evidence.createdAt.toISOString(),
      };

      const result = validateSchema(EvidenceSchema, serialized);
      expect(result.valid).toBe(true);
    });

    it('should reject invalid file URL', () => {
      const evidence = {
        id: 'test',
        caseId: 'case-1',
        uploadedById: 'user-1',
        type: 'DOCUMENT',
        status: 'UPLOADED',
        title: 'Test',
        description: null,
        fileName: 'test.pdf',
        mimeType: 'application/pdf',
        fileSize: 1024,
        fileUrl: 'not-a-url',
        createdAt: new Date().toISOString(),
      };

      const result = validateSchema(EvidenceSchema, evidence);
      expect(result.valid).toBe(false);
      expect(result.errors[0]).toContain('fileUrl');
    });
  });

  describe('Payment Schema', () => {
    it('should validate payment data', () => {
      const payment = createPayment();
      const serialized = {
        id: payment.id,
        caseId: payment.caseId,
        userId: payment.userId,
        type: payment.type,
        status: payment.status,
        amount: 99,
        currency: payment.currency,
        paidAt: payment.paidAt?.toISOString() ?? null,
        createdAt: payment.createdAt.toISOString(),
      };

      const result = validateSchema(PaymentSchema, serialized);
      expect(result.valid).toBe(true);
    });

    it('should validate checkout session response', () => {
      const response = {
        success: true,
        data: {
          sessionId: 'cs_test_123',
          sessionUrl: 'https://checkout.stripe.com/pay/cs_test_123',
          paymentId: 'pay_123',
          amount: 99,
        },
      };

      const result = validateSchema(CheckoutSessionResponseSchema, response);
      expect(result.valid).toBe(true);
    });
  });

  describe('Award Schema', () => {
    it('should validate award data', () => {
      const award = createAward();
      const serialized = {
        id: award.id,
        caseId: award.caseId,
        referenceNumber: award.referenceNumber,
        awardAmount: 5000,
        prevailingParty: award.prevailingParty,
        documentUrl: award.documentUrl,
        issuedAt: award.issuedAt?.toISOString() ?? null,
        signedAt: award.signedAt?.toISOString() ?? null,
      };

      const result = validateSchema(AwardSchema, serialized);
      expect(result.valid).toBe(true);
    });
  });

  describe('Notification Schema', () => {
    it('should validate notification data', () => {
      const notification = createNotification();
      const serialized = {
        id: notification.id,
        userId: notification.userId,
        type: notification.type,
        title: notification.title,
        message: notification.message,
        actionUrl: notification.actionUrl,
        read: notification.read,
        createdAt: notification.createdAt.toISOString(),
      };

      const result = validateSchema(NotificationSchema, serialized);
      expect(result.valid).toBe(true);
    });
  });

  describe('assertSchema', () => {
    it('should not throw for valid data', () => {
      const response = {
        success: true,
        data: { id: '123' },
      };

      expect(() => {
        assertSchema(SuccessResponseSchema, response);
      }).not.toThrow();
    });

    it('should throw for invalid data', () => {
      const response = {
        success: true,
        // missing data
      };

      expect(() => {
        assertSchema(SuccessResponseSchema, response, 'TestAPI');
      }).toThrow('[TestAPI] Schema validation failed');
    });
  });
});
