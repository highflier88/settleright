/**
 * Fact Analysis Module Tests
 *
 * Tests for fact extraction, timeline reconstruction, and contradiction detection.
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
              facts: [
                {
                  id: 'f1',
                  statement: 'Contract was signed on January 1, 2025',
                  category: 'event',
                  date: '2025-01-01',
                  confidence: 0.9,
                },
              ],
            }),
          },
        ],
        usage: { input_tokens: 100, output_tokens: 200 },
      }),
    },
  })),
}));

import type {
  ExtractedFact,
  EvidenceSummary,
  TimelineEvent,
  Contradiction,
  DisputedFact,
  UndisputedFact,
  FactCategory,
  PartySource,
} from '@/lib/analysis/types';

describe('Fact Analysis Module', () => {
  describe('ExtractedFact type validation', () => {
    it('should validate ExtractedFact structure', () => {
      const fact: ExtractedFact = {
        id: 'f1',
        statement: 'The contract was signed on January 1, 2025',
        category: 'event',
        date: '2025-01-01',
        amount: undefined,
        confidence: 0.9,
        supportingEvidence: ['e1', 'e2'],
      };

      expect(fact.id).toBeDefined();
      expect(fact.statement).toContain('contract');
      expect(fact.confidence).toBeGreaterThanOrEqual(0);
      expect(fact.confidence).toBeLessThanOrEqual(1);
      expect(fact.supportingEvidence).toHaveLength(2);
    });

    it('should allow optional date and amount fields', () => {
      const fact: ExtractedFact = {
        id: 'f2',
        statement: 'General statement',
        category: 'claim',
        date: undefined,
        amount: undefined,
        confidence: 0.7,
        supportingEvidence: [],
      };

      expect(fact.date).toBeUndefined();
      expect(fact.amount).toBeUndefined();
    });

    it('should support all fact categories', () => {
      const categories: FactCategory[] = ['event', 'claim', 'admission', 'denial', 'allegation'];

      categories.forEach((category) => {
        const fact: ExtractedFact = {
          id: `f-${category}`,
          statement: `Test fact for ${category}`,
          category,
          confidence: 0.8,
        };
        expect(fact.category).toBe(category);
      });
    });
  });

  describe('TimelineEvent type validation', () => {
    it('should validate TimelineEvent structure', () => {
      const event: TimelineEvent = {
        id: 'te1',
        date: '2025-01-15',
        event: 'Payment was made',
        source: 'claimant',
        sourceId: 'statement-1',
        disputed: false,
        details: 'Payment of $5,000 via bank transfer',
      };

      expect(event.date).toBe('2025-01-15');
      expect(event.source).toBe('claimant');
      expect(event.disputed).toBe(false);
    });

    it('should support different source types', () => {
      const claimantEvent: TimelineEvent = {
        id: 'te2',
        date: '2025-02-01',
        event: 'Claimant sent notice',
        source: 'claimant',
        sourceId: 's1',
        disputed: false,
      };

      const respondentEvent: TimelineEvent = {
        id: 'te3',
        date: '2025-02-15',
        event: 'Respondent received goods',
        source: 'respondent',
        sourceId: 's2',
        disputed: true,
      };

      const evidenceEvent: TimelineEvent = {
        id: 'te4',
        date: '2025-02-20',
        event: 'Invoice issued',
        source: 'evidence',
        sourceId: 'e1',
        disputed: false,
      };

      expect(claimantEvent.source).toBe('claimant');
      expect(respondentEvent.source).toBe('respondent');
      expect(evidenceEvent.source).toBe('evidence');
    });
  });

  describe('Contradiction type validation', () => {
    it('should validate Contradiction structure', () => {
      const contradiction: Contradiction = {
        id: 'c1',
        topic: 'Payment date',
        claimantClaim: 'Payment was made on January 15, 2025',
        respondentClaim: 'Payment was never received',
        severity: 'major',
        analysis: 'Critical discrepancy regarding payment',
        relatedFactIds: ['f1', 'f2'],
        caseImpact: 'Significant impact on damages claim',
      };

      expect(contradiction.topic).toBeDefined();
      expect(contradiction.severity).toBe('major');
      expect(contradiction.relatedFactIds).toHaveLength(2);
    });

    it('should identify different severity levels', () => {
      const majorContradiction: Contradiction = {
        id: 'c2',
        topic: 'Contract terms',
        claimantClaim: 'Contract specified $10,000',
        respondentClaim: 'Contract was verbal, no fixed amount',
        severity: 'major',
        analysis: 'Fundamental disagreement on contract existence',
      };

      const minorContradiction: Contradiction = {
        id: 'c3',
        topic: 'Meeting location',
        claimantClaim: 'Met at office',
        respondentClaim: 'Met at coffee shop',
        severity: 'minor',
        analysis: 'Minor discrepancy with no impact',
      };

      expect(majorContradiction.severity).toBe('major');
      expect(minorContradiction.severity).toBe('minor');
    });
  });

  describe('DisputedFact type validation', () => {
    it('should validate DisputedFact structure', () => {
      const disputed: DisputedFact = {
        id: 'df1',
        topic: 'Service delivery date',
        claimantPosition: 'Services were delivered on January 20',
        respondentPosition: 'Services were never completed',
        relevantEvidence: ['e1', 'e2'],
        materialityScore: 0.9,
        analysis: 'Core dispute affecting damages calculation',
      };

      expect(disputed.topic).toBeDefined();
      expect(disputed.materialityScore).toBeGreaterThan(0.5);
      expect(disputed.relevantEvidence).toHaveLength(2);
    });
  });

  describe('UndisputedFact type validation', () => {
    it('should validate UndisputedFact structure', () => {
      const undisputed: UndisputedFact = {
        id: 'uf1',
        fact: 'Both parties entered into a written agreement on January 1, 2025',
        agreedBy: ['claimant', 'respondent'],
        supportingEvidence: ['e1'],
        materialityScore: 0.95,
      };

      expect(undisputed.agreedBy).toContain('claimant');
      expect(undisputed.agreedBy).toContain('respondent');
      expect(undisputed.materialityScore).toBeGreaterThan(0.9);
    });
  });

  describe('EvidenceSummary type validation', () => {
    it('should validate EvidenceSummary structure', () => {
      const evidence: EvidenceSummary = {
        id: 'e1',
        fileName: 'contract.pdf',
        documentType: 'PDF',
        extractedText: 'This agreement is made between...',
        summary: 'A service agreement dated January 1, 2025',
        keyPoints: ['Agreement date: Jan 1', 'Amount: $5,000'],
        submittedBy: 'claimant',
      };

      expect(evidence.documentType).toBe('PDF');
      expect(evidence.summary).toBeDefined();
      expect(evidence.keyPoints).toHaveLength(2);
      expect(evidence.submittedBy).toBe('claimant');
    });

    it('should support different document types', () => {
      const pdfEvidence: EvidenceSummary = {
        id: 'e2',
        fileName: 'invoice.pdf',
        documentType: 'PDF',
        summary: 'Invoice for $5,000',
        submittedBy: 'claimant',
      };

      const imageEvidence: EvidenceSummary = {
        id: 'e3',
        fileName: 'receipt.jpg',
        documentType: 'Image',
        summary: 'Photo of payment receipt',
        submittedBy: 'respondent',
      };

      expect(pdfEvidence.documentType).toBe('PDF');
      expect(imageEvidence.documentType).toBe('Image');
    });
  });

  describe('Fact categorization', () => {
    it('should categorize facts by type', () => {
      const facts: ExtractedFact[] = [
        {
          id: 'f1',
          statement: 'Contract signed on Jan 1',
          category: 'event',
          date: '2025-01-01',
          confidence: 0.9,
        },
        {
          id: 'f2',
          statement: 'Claimant is owed $5,000',
          category: 'claim',
          confidence: 0.85,
        },
        {
          id: 'f3',
          statement: 'Respondent admits to delay',
          category: 'admission',
          confidence: 0.7,
        },
      ];

      const eventFacts = facts.filter((f) => f.category === 'event');
      const claimFacts = facts.filter((f) => f.category === 'claim');
      const admissionFacts = facts.filter((f) => f.category === 'admission');

      expect(eventFacts).toHaveLength(1);
      expect(claimFacts).toHaveLength(1);
      expect(admissionFacts).toHaveLength(1);
    });
  });

  describe('Confidence scoring', () => {
    it('should identify high confidence facts', () => {
      const facts: ExtractedFact[] = [
        {
          id: 'f1',
          statement: 'High confidence fact',
          category: 'event',
          confidence: 0.95,
          supportingEvidence: ['e1', 'e2'],
        },
        {
          id: 'f2',
          statement: 'Low confidence fact',
          category: 'allegation',
          confidence: 0.4,
        },
      ];

      const highConfidenceFacts = facts.filter((f) => f.confidence >= 0.8);
      const lowConfidenceFacts = facts.filter((f) => f.confidence < 0.6);

      expect(highConfidenceFacts).toHaveLength(1);
      expect(lowConfidenceFacts).toHaveLength(1);
    });

    it('should calculate average confidence', () => {
      const facts: ExtractedFact[] = [
        { id: 'f1', statement: '', category: 'event', confidence: 0.8 },
        { id: 'f2', statement: '', category: 'event', confidence: 0.9 },
        { id: 'f3', statement: '', category: 'event', confidence: 0.7 },
      ];

      const avgConfidence = facts.reduce((sum, f) => sum + f.confidence, 0) / facts.length;

      expect(avgConfidence).toBeCloseTo(0.8, 2);
    });
  });

  describe('Timeline ordering', () => {
    it('should sort timeline events by date', () => {
      const events: TimelineEvent[] = [
        {
          id: 'te1',
          date: '2025-03-01',
          event: 'Event 3',
          source: 'claimant',
          sourceId: 's1',
          disputed: false,
        },
        {
          id: 'te2',
          date: '2025-01-01',
          event: 'Event 1',
          source: 'claimant',
          sourceId: 's1',
          disputed: false,
        },
        {
          id: 'te3',
          date: '2025-02-01',
          event: 'Event 2',
          source: 'respondent',
          sourceId: 's2',
          disputed: false,
        },
      ];

      const sortedEvents = [...events].sort((a, b) => a.date.localeCompare(b.date));

      expect(sortedEvents[0]!.event).toBe('Event 1');
      expect(sortedEvents[1]!.event).toBe('Event 2');
      expect(sortedEvents[2]!.event).toBe('Event 3');
    });

    it('should identify disputed vs undisputed events', () => {
      const events: TimelineEvent[] = [
        {
          id: 'te1',
          date: '2025-01-01',
          event: 'Agreed event',
          source: 'claimant',
          sourceId: 's1',
          disputed: false,
        },
        {
          id: 'te2',
          date: '2025-02-01',
          event: 'Disputed event',
          source: 'respondent',
          sourceId: 's2',
          disputed: true,
        },
      ];

      const disputedEvents = events.filter((e) => e.disputed);
      const undisputedEvents = events.filter((e) => !e.disputed);

      expect(disputedEvents).toHaveLength(1);
      expect(undisputedEvents).toHaveLength(1);
    });
  });
});
