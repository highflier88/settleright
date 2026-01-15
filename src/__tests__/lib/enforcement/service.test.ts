/**
 * Enforcement Service Tests
 *
 * Tests for enforcement package generation.
 */

import { prisma } from '@/lib/db';
import { generateAwardCertificate } from '@/lib/award/pdf-generator';
import {
  generateEnforcementPackage,
  createEnforcementZip,
  getEnforcementStatus,
} from '@/lib/enforcement/service';
import {
  generateProofOfService,
  generateArbitratorCredentials,
  generateProceduralCompliance,
  generateFilingInstructions,
} from '@/lib/enforcement/documents';
import { getJurisdictionInfo } from '@/lib/enforcement/jurisdictions';

// Mock dependencies
jest.mock('@/lib/db', () => ({
  prisma: {
    award: {
      findUnique: jest.fn(),
    },
  },
}));

jest.mock('@/lib/award/pdf-generator', () => ({
  generateAwardCertificate: jest.fn(),
}));

jest.mock('@/lib/enforcement/documents', () => ({
  generateProofOfService: jest.fn(),
  generateArbitratorCredentials: jest.fn(),
  generateProceduralCompliance: jest.fn(),
  generateFilingInstructions: jest.fn(),
}));

jest.mock('@/lib/enforcement/jurisdictions', () => ({
  getJurisdictionInfo: jest.fn(),
}));

const mockPrisma = prisma as jest.Mocked<typeof prisma>;
const mockGenerateAwardCertificate = generateAwardCertificate as jest.Mock;
const mockGenerateProofOfService = generateProofOfService as jest.Mock;
const mockGenerateArbitratorCredentials = generateArbitratorCredentials as jest.Mock;
const mockGenerateProceduralCompliance = generateProceduralCompliance as jest.Mock;
const mockGenerateFilingInstructions = generateFilingInstructions as jest.Mock;
const mockGetJurisdictionInfo = getJurisdictionInfo as jest.Mock;

describe('Enforcement Service', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  // ==========================================================================
  // Generate Enforcement Package
  // ==========================================================================

  describe('generateEnforcementPackage', () => {
    const mockAwardData = {
      id: 'award-123',
      referenceNumber: 'AWD-2026-00001',
      caseId: 'case-123',
      awardAmount: 5000,
      prevailingParty: 'CLAIMANT',
      documentHash: 'sha256:abc123',
      signatureAlgorithm: 'RSA-SHA256',
      certificateFingerprint: 'fingerprint123',
      timestampGranted: true,
      timestampTime: new Date(),
      signedAt: new Date(),
      issuedAt: new Date(),
      claimantNotifiedAt: new Date(),
      respondentNotifiedAt: new Date(),
      case: {
        id: 'case-123',
        referenceNumber: 'SR-2026-ABC123',
        jurisdiction: 'US-CA',
        createdAt: new Date(),
        claimant: {
          id: 'user-1',
          name: 'John Claimant',
          email: 'claimant@example.com',
        },
        respondent: {
          id: 'user-2',
          name: 'Jane Respondent',
          email: 'respondent@example.com',
        },
        agreement: {
          id: 'agreement-123',
          signatures: [{ signedAt: new Date() }],
        },
        analysisJob: {
          completedAt: new Date(),
        },
        arbitratorAssignment: {
          assignedAt: new Date(),
          reviewCompletedAt: new Date(),
        },
      },
      arbitrator: {
        id: 'arb-123',
        name: 'Judge Arbitrator',
        email: 'arbitrator@example.com',
        arbitratorProfile: {
          barNumber: '12345',
          barState: 'CA',
          isRetiredJudge: true,
          yearsExperience: 20,
          lawSchool: 'Harvard Law School',
          graduationYear: 1995,
          jurisdictions: ['US-CA'],
          credentialVerifiedAt: new Date(),
          onboardedAt: new Date(),
        },
      },
    };

    const mockDocument = {
      type: 'PROOF_OF_SERVICE' as const,
      name: 'Test Document',
      fileName: 'test.pdf',
      contentType: 'application/pdf',
      buffer: Buffer.from('test pdf content'),
      hash: 'sha256:testhash',
    };

    beforeEach(() => {
      (mockPrisma.award.findUnique as jest.Mock).mockResolvedValue(mockAwardData);

      mockGenerateAwardCertificate.mockResolvedValue({
        pdfBuffer: Buffer.from('certificate pdf'),
        documentHash: 'sha256:certhash',
      });

      mockGenerateProofOfService.mockResolvedValue(mockDocument);
      mockGenerateArbitratorCredentials.mockResolvedValue(mockDocument);
      mockGenerateProceduralCompliance.mockResolvedValue(mockDocument);
      mockGenerateFilingInstructions.mockResolvedValue(mockDocument);

      mockGetJurisdictionInfo.mockReturnValue({
        courtName: 'Superior Court of California',
        courtAddress: '123 Court St, Los Angeles, CA',
        filingFeeEstimate: '$435-$750',
        filingDeadline: '4 years from award date',
        requiredDocuments: ['Petition to Confirm', 'Copy of Award'],
        filingProcedure: ['File petition', 'Serve respondent', 'Attend hearing'],
        additionalNotes: ['Court may order expedited hearing'],
      });
    });

    it('should throw error if award not found', async () => {
      (mockPrisma.award.findUnique as jest.Mock).mockResolvedValue(null);

      await expect(generateEnforcementPackage('case-123')).rejects.toThrow(
        'Award not found for this case'
      );
    });

    it('should generate enforcement package with all documents', async () => {
      const result = await generateEnforcementPackage('case-123');

      expect(result.awardReference).toBe('AWD-2026-00001');
      expect(result.caseReference).toBe('SR-2026-ABC123');
      expect(result.jurisdiction).toBe('US-CA');
      expect(result.documents).toHaveLength(5);
      expect(result.totalDocuments).toBe(5);
      expect(result.generatedAt).toBeInstanceOf(Date);
    });

    it('should include award certificate', async () => {
      const result = await generateEnforcementPackage('case-123');

      const certificate = result.documents.find((d) => d.type === 'AWARD_CERTIFICATE');
      expect(certificate).toBeDefined();
      expect(certificate?.fileName).toContain('certificate.pdf');
      expect(mockGenerateAwardCertificate).toHaveBeenCalledWith(
        expect.objectContaining({
          referenceNumber: 'AWD-2026-00001',
          caseReference: 'SR-2026-ABC123',
          claimantName: 'John Claimant',
          respondentName: 'Jane Respondent',
        })
      );
    });

    it('should include proof of service', async () => {
      const result = await generateEnforcementPackage('case-123');

      expect(mockGenerateProofOfService).toHaveBeenCalledWith(
        expect.objectContaining({
          awardReference: 'AWD-2026-00001',
          claimant: expect.objectContaining({
            name: 'John Claimant',
            email: 'claimant@example.com',
          }),
          respondent: expect.objectContaining({
            name: 'Jane Respondent',
            email: 'respondent@example.com',
          }),
          deliveryMethod: 'BOTH',
        })
      );

      expect(result.documents.length).toBeGreaterThan(0);
    });

    it('should include arbitrator credentials', async () => {
      await generateEnforcementPackage('case-123');

      expect(mockGenerateArbitratorCredentials).toHaveBeenCalledWith(
        expect.objectContaining({
          arbitrator: expect.objectContaining({
            name: 'Judge Arbitrator',
            barNumber: '12345',
            barState: 'CA',
            isRetiredJudge: true,
          }),
          jurisdiction: 'US-CA',
        })
      );
    });

    it('should include procedural compliance certificate', async () => {
      await generateEnforcementPackage('case-123');

      expect(mockGenerateProceduralCompliance).toHaveBeenCalledWith(
        expect.objectContaining({
          awardReference: 'AWD-2026-00001',
          jurisdiction: 'US-CA',
          bothPartiesAgreedToArbitrate: true,
          bothPartiesHadOpportunityToSubmitEvidence: true,
          neutralArbitratorAssigned: true,
        })
      );
    });

    it('should include filing instructions for jurisdiction', async () => {
      await generateEnforcementPackage('case-123');

      expect(mockGetJurisdictionInfo).toHaveBeenCalledWith('US-CA');
      expect(mockGenerateFilingInstructions).toHaveBeenCalledWith(
        expect.objectContaining({
          jurisdiction: 'US-CA',
          courtName: 'Superior Court of California',
          awardAmount: 5000,
          prevailingParty: 'CLAIMANT',
        })
      );
    });

    it('should handle missing optional data gracefully', async () => {
      const minimalAwardData = {
        ...mockAwardData,
        case: {
          ...mockAwardData.case,
          claimant: null,
          respondent: null,
          agreement: null,
          analysisJob: null,
          arbitratorAssignment: null,
          jurisdiction: null,
        },
        arbitrator: {
          ...mockAwardData.arbitrator,
          name: null,
          arbitratorProfile: null,
        },
        awardAmount: null,
        signatureAlgorithm: null,
        certificateFingerprint: null,
      };

      (mockPrisma.award.findUnique as jest.Mock).mockResolvedValue(minimalAwardData);

      const result = await generateEnforcementPackage('case-123');

      expect(result.documents).toBeDefined();
      expect(result.jurisdiction).toBe('US-CA'); // Default
    });
  });

  // ==========================================================================
  // Create Enforcement ZIP
  // ==========================================================================

  describe('createEnforcementZip', () => {
    const mockKit = {
      awardReference: 'AWD-2026-00001',
      caseReference: 'SR-2026-ABC123',
      generatedAt: new Date(),
      jurisdiction: 'US-CA',
      totalDocuments: 2,
      documents: [
        {
          type: 'AWARD_CERTIFICATE' as const,
          name: 'Award Certificate',
          fileName: 'AWD-2026-00001-certificate.pdf',
          contentType: 'application/pdf',
          buffer: Buffer.from('certificate content'),
          hash: 'sha256:certhash',
        },
        {
          type: 'PROOF_OF_SERVICE' as const,
          name: 'Proof of Service',
          fileName: 'AWD-2026-00001-proof-of-service.pdf',
          contentType: 'application/pdf',
          buffer: Buffer.from('proof content'),
          hash: 'sha256:proofhash',
        },
      ],
    };

    it('should create a valid ZIP buffer', async () => {
      const result = await createEnforcementZip(mockKit);

      expect(result).toBeInstanceOf(Buffer);
      expect(result.length).toBeGreaterThan(0);
    });

    it('should include award PDF when provided', async () => {
      const awardPdf = Buffer.from('award pdf content');
      const result = await createEnforcementZip(mockKit, awardPdf);

      expect(result).toBeInstanceOf(Buffer);
      // ZIP should be larger with the award PDF
      expect(result.length).toBeGreaterThan(100);
    });

    it('should work without award PDF', async () => {
      const result = await createEnforcementZip(mockKit);

      expect(result).toBeInstanceOf(Buffer);
    });
  });

  // ==========================================================================
  // Get Enforcement Status
  // ==========================================================================

  describe('getEnforcementStatus', () => {
    it('should return unavailable if no award exists', async () => {
      (mockPrisma.award.findUnique as jest.Mock).mockResolvedValue(null);

      const result = await getEnforcementStatus('case-123');

      expect(result).toEqual({
        available: false,
        reason: 'No award has been issued for this case',
      });
    });

    it('should return unavailable if award has no document URL', async () => {
      (mockPrisma.award.findUnique as jest.Mock).mockResolvedValue({
        referenceNumber: 'AWD-2026-00001',
        documentUrl: null,
        claimantNotifiedAt: new Date(),
        respondentNotifiedAt: new Date(),
      });

      const result = await getEnforcementStatus('case-123');

      expect(result).toEqual({
        available: false,
        reason: 'Award document is not available',
        awardReference: 'AWD-2026-00001',
      });
    });

    it('should return available if award is complete', async () => {
      (mockPrisma.award.findUnique as jest.Mock).mockResolvedValue({
        referenceNumber: 'AWD-2026-00001',
        documentUrl: 'https://storage.example.com/awards/award.pdf',
        claimantNotifiedAt: new Date(),
        respondentNotifiedAt: new Date(),
      });

      const result = await getEnforcementStatus('case-123');

      expect(result).toEqual({
        available: true,
        awardReference: 'AWD-2026-00001',
      });
    });
  });
});
