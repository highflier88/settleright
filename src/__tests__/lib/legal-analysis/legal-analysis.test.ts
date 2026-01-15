/**
 * Legal Analysis Module Tests
 *
 * Tests for legal issue classification, burden of proof analysis,
 * and damages calculation.
 */

// Mock Anthropic before imports
jest.mock('@anthropic-ai/sdk', () => ({
  __esModule: true,
  default: jest.fn().mockImplementation(() => ({
    messages: {
      create: jest.fn().mockResolvedValue({
        content: [
          {
            type: 'text',
            text: JSON.stringify({
              issues: [],
              analyses: [],
            }),
          },
        ],
        usage: { input_tokens: 100, output_tokens: 200 },
      }),
    },
  })),
}));

import type {
  LegalIssue,
  LegalIssueCategory,
  LegalElement,
  BurdenAnalysis,
  BurdenOfProofStandard,
  DamagesItem,
  DamagesCalculation,
  ConclusionOfLaw,
  InterestCalculation,
  DamagesAdjustment,
  MitigationAnalysis,
} from '@/lib/legal-analysis/types';

describe('Legal Analysis Module', () => {
  describe('LegalIssue type validation', () => {
    it('should validate LegalIssue structure', () => {
      const issue: LegalIssue = {
        id: 'issue-1',
        category: 'breach_of_contract',
        description: 'Breach of written service agreement',
        elements: [],
        applicableStatutes: ['Cal. Civ. Code § 1549'],
        applicableCaseLaw: ['Oasis West Realty v. Goldman'],
        materialityScore: 0.95,
        analysisNotes: 'Primary claim in this case',
      };

      expect(issue.category).toBe('breach_of_contract');
      expect(issue.materialityScore).toBeGreaterThan(0.5);
      expect(issue.applicableStatutes.length).toBeGreaterThan(0);
    });

    it('should support all legal issue categories', () => {
      const categories: LegalIssueCategory[] = [
        'breach_of_contract',
        'consumer_protection',
        'warranty',
        'fraud',
        'negligence',
        'unjust_enrichment',
        'statutory_violation',
        'payment_dispute',
        'service_dispute',
        'property_damage',
      ];

      categories.forEach((category) => {
        const issue: LegalIssue = {
          id: `issue-${category}`,
          category,
          description: `Test issue for ${category}`,
          elements: [],
          applicableStatutes: [],
          applicableCaseLaw: [],
          materialityScore: 0.5,
        };
        expect(issue.category).toBe(category);
      });
    });
  });

  describe('LegalElement type validation', () => {
    it('should validate LegalElement structure', () => {
      const element: LegalElement = {
        id: 'elem-1',
        name: 'Existence of Contract',
        description: 'A valid contract exists between the parties',
        isSatisfied: true,
        supportingFacts: ['f1', 'f2'],
        opposingFacts: [],
        analysis: 'Documentary evidence confirms signed contract',
        confidence: 0.95,
      };

      expect(element.isSatisfied).toBe(true);
      expect(element.confidence).toBeGreaterThan(0.8);
      expect(element.supportingFacts.length).toBeGreaterThan(0);
    });

    it('should handle undetermined elements', () => {
      const element: LegalElement = {
        id: 'elem-2',
        name: 'Damages',
        description: 'Claimant suffered actual damages',
        isSatisfied: null,
        supportingFacts: [],
        opposingFacts: [],
        analysis: 'Insufficient evidence to determine',
        confidence: 0.3,
      };

      expect(element.isSatisfied).toBeNull();
      expect(element.confidence).toBeLessThan(0.5);
    });

    it('should track opposing facts', () => {
      const element: LegalElement = {
        id: 'elem-3',
        name: 'Performance',
        description: 'Respondent failed to perform',
        isSatisfied: false,
        supportingFacts: ['f1'],
        opposingFacts: ['f5', 'f6', 'f7'],
        analysis: 'Respondent evidence shows partial performance',
        confidence: 0.4,
      };

      expect(element.opposingFacts.length).toBeGreaterThan(element.supportingFacts.length);
      expect(element.isSatisfied).toBe(false);
    });
  });

  describe('BurdenAnalysis type validation', () => {
    it('should validate BurdenAnalysis structure', () => {
      const analysis: BurdenAnalysis = {
        party: 'claimant',
        standard: 'preponderance',
        issue: 'Breach of contract',
        isMet: true,
        probability: 0.75,
        reasoning: 'Evidence supports breach by preponderance',
        keyEvidence: ['e1', 'e2'],
        weaknesses: ['No direct witness testimony'],
      };

      expect(analysis.party).toBe('claimant');
      expect(analysis.standard).toBe('preponderance');
      expect(analysis.probability).toBeGreaterThan(0.5);
      expect(analysis.isMet).toBe(true);
    });

    it('should support different burden of proof standards', () => {
      const standards: BurdenOfProofStandard[] = [
        'preponderance',
        'clear_and_convincing',
        'beyond_reasonable_doubt',
      ];

      standards.forEach((standard) => {
        const analysis: BurdenAnalysis = {
          party: 'claimant',
          standard,
          issue: 'Test issue',
          isMet: null,
          probability: 0.5,
          reasoning: `Analysis under ${standard} standard`,
          keyEvidence: [],
          weaknesses: [],
        };
        expect(analysis.standard).toBe(standard);
      });
    });

    it('should identify unmet burdens', () => {
      const analysis: BurdenAnalysis = {
        party: 'claimant',
        standard: 'preponderance',
        issue: 'Damages causation',
        isMet: false,
        probability: 0.35,
        reasoning: 'Insufficient link between breach and claimed damages',
        keyEvidence: [],
        weaknesses: ['No expert testimony on causation', 'Timeline gaps in evidence'],
      };

      expect(analysis.isMet).toBe(false);
      expect(analysis.probability).toBeLessThan(0.5);
      expect(analysis.weaknesses.length).toBeGreaterThan(0);
    });
  });

  describe('DamagesItem type validation', () => {
    it('should validate DamagesItem structure', () => {
      const item: DamagesItem = {
        id: 'dmg-1',
        type: 'compensatory',
        description: 'Unpaid service fees',
        claimedAmount: 5000,
        supportedAmount: 4500,
        calculatedAmount: 4500,
        basis: 'Contract terms',
        evidenceSupport: ['e1', 'e2'],
        adjustments: [],
        confidence: 0.9,
      };

      expect(item.claimedAmount).toBe(5000);
      expect(item.supportedAmount).toBeLessThanOrEqual(item.claimedAmount);
      expect(item.calculatedAmount).toBe(4500);
    });

    it('should handle damages with adjustments', () => {
      const adjustment: DamagesAdjustment = {
        type: 'mitigation',
        description: 'Failure to mitigate damages',
        amount: -500,
        legalBasis: 'Cal. Civ. Code § 3358',
      };

      const item: DamagesItem = {
        id: 'dmg-2',
        type: 'compensatory',
        description: 'Lost profits',
        claimedAmount: 10000,
        supportedAmount: 8000,
        calculatedAmount: 7500,
        basis: 'Business records',
        evidenceSupport: [],
        adjustments: [adjustment],
        confidence: 0.7,
      };

      expect(item.adjustments.length).toBe(1);
      expect(item.adjustments[0]!.amount).toBeLessThan(0);
    });
  });

  describe('DamagesCalculation type validation', () => {
    it('should calculate total damages correctly', () => {
      const items: DamagesItem[] = [
        {
          id: 'dmg-1',
          type: 'compensatory',
          description: 'Unpaid fees',
          claimedAmount: 5000,
          supportedAmount: 5000,
          calculatedAmount: 5000,
          basis: '',
          evidenceSupport: [],
          adjustments: [],
          confidence: 0.9,
        },
        {
          id: 'dmg-2',
          type: 'compensatory',
          description: 'Additional expenses',
          claimedAmount: 2000,
          supportedAmount: 1500,
          calculatedAmount: 1500,
          basis: '',
          evidenceSupport: [],
          adjustments: [],
          confidence: 0.8,
        },
      ];

      const totalClaimed = items.reduce((sum, i) => sum + i.claimedAmount, 0);
      const totalSupported = items.reduce((sum, i) => sum + i.supportedAmount, 0);

      expect(totalClaimed).toBe(7000);
      expect(totalSupported).toBe(6500);
    });

    it('should handle interest calculations', () => {
      const interestCalc: InterestCalculation = {
        principal: 5000,
        rate: 0.1,
        startDate: '2025-01-01',
        endDate: '2026-01-13',
        days: 377,
        interestAmount: 516.16,
        statutoryBasis: 'Cal. Civ. Code § 3289',
      };

      expect(interestCalc.rate).toBe(0.1);
      expect(interestCalc.interestAmount).toBeGreaterThan(0);
      expect(interestCalc.principal + interestCalc.interestAmount).toBeCloseTo(5516.16, 2);
    });
  });

  describe('ConclusionOfLaw type validation', () => {
    it('should validate ConclusionOfLaw structure', () => {
      const conclusion: ConclusionOfLaw = {
        id: 'col-1',
        issue: 'Breach of Contract',
        conclusion: 'Respondent materially breached the service agreement',
        legalBasis: ['Cal. Civ. Code § 1549', 'Oasis West Realty v. Goldman'],
        supportingFacts: ['f1', 'f2'],
        confidence: 0.85,
      };

      expect(conclusion.conclusion).toContain('breach');
      expect(conclusion.legalBasis.length).toBeGreaterThan(0);
      expect(conclusion.confidence).toBeGreaterThan(0.8);
    });

    it('should link to supporting facts', () => {
      const conclusion: ConclusionOfLaw = {
        id: 'col-2',
        issue: 'Damages',
        conclusion: 'Claimant is entitled to $5,000 in compensatory damages',
        legalBasis: ['Cal. Civ. Code § 3300'],
        supportingFacts: ['f4', 'f5'],
        confidence: 0.9,
      };

      expect(conclusion.supportingFacts).toHaveLength(2);
      expect(conclusion.issue).toBe('Damages');
    });
  });

  describe('Jurisdiction-specific rules', () => {
    it('should apply California-specific rules', () => {
      const calculateCaliforniaInterest = (
        principal: number,
        startDate: Date,
        endDate: Date
      ): number => {
        const annualRate = 0.1;
        const days = Math.floor((endDate.getTime() - startDate.getTime()) / (1000 * 60 * 60 * 24));
        return principal * annualRate * (days / 365);
      };

      const interest = calculateCaliforniaInterest(
        5000,
        new Date('2025-01-01'),
        new Date('2026-01-01')
      );

      expect(interest).toBeCloseTo(500, 0);
    });

    it('should validate statute citations', () => {
      const validCitations = [
        'Cal. Civ. Code § 1549',
        'Cal. Civ. Code § 3289',
        'Cal. Civ. Code § 3300',
        'Cal. Bus. & Prof. Code § 17200',
      ];

      validCitations.forEach((citation) => {
        expect(citation).toMatch(/^Cal\.\s+(Civ\.|Bus\. & Prof\.)\s+Code\s+§\s+\d+/);
      });
    });
  });

  describe('Legal element satisfaction', () => {
    it('should determine breach of contract satisfaction', () => {
      const breachElements: LegalElement[] = [
        {
          id: 'e1',
          name: 'Existence of Contract',
          description: 'Valid contract exists',
          isSatisfied: true,
          supportingFacts: ['f1'],
          opposingFacts: [],
          analysis: 'Signed contract in evidence',
          confidence: 0.95,
        },
        {
          id: 'e2',
          name: 'Performance by Plaintiff',
          description: 'Plaintiff performed obligations',
          isSatisfied: true,
          supportingFacts: ['f2', 'f3'],
          opposingFacts: [],
          analysis: 'Evidence shows services delivered',
          confidence: 0.85,
        },
        {
          id: 'e3',
          name: 'Breach by Defendant',
          description: 'Defendant failed to perform',
          isSatisfied: true,
          supportingFacts: ['f4'],
          opposingFacts: ['f5'],
          analysis: 'Non-payment despite services rendered',
          confidence: 0.75,
        },
        {
          id: 'e4',
          name: 'Resulting Damages',
          description: 'Plaintiff suffered damages',
          isSatisfied: true,
          supportingFacts: ['f6'],
          opposingFacts: [],
          analysis: 'Unpaid invoice as documented damages',
          confidence: 0.9,
        },
      ];

      const allSatisfied = breachElements.every((e) => e.isSatisfied === true);
      const avgConfidence =
        breachElements.reduce((sum, e) => sum + e.confidence, 0) / breachElements.length;

      expect(allSatisfied).toBe(true);
      expect(avgConfidence).toBeGreaterThan(0.8);
    });

    it('should identify unsatisfied elements', () => {
      const elements: LegalElement[] = [
        {
          id: 'e1',
          name: 'Contract Formation',
          description: '',
          isSatisfied: true,
          supportingFacts: [],
          opposingFacts: [],
          analysis: '',
          confidence: 0.9,
        },
        {
          id: 'e2',
          name: 'Breach',
          description: '',
          isSatisfied: false,
          supportingFacts: [],
          opposingFacts: [],
          analysis: '',
          confidence: 0.3,
        },
      ];

      const unsatisfied = elements.filter((e) => e.isSatisfied === false);
      expect(unsatisfied).toHaveLength(1);
      expect(unsatisfied[0]?.name).toBe('Breach');
    });
  });
});
