/**
 * Timeline Reconstruction Tests
 *
 * Tests for timeline reconstruction and event extraction.
 */

import {
  extractEventsFromFacts,
  extractEventsFromEvidence,
  mergeTimelineEvents,
  formatTimelineForDisplay,
  getTimelineSpanDays,
} from '@/lib/analysis/timeline';
import type { ExtractedFact, EvidenceSummary, TimelineEvent } from '@/lib/analysis/types';

describe('Timeline Reconstruction', () => {
  // ==========================================================================
  // extractEventsFromFacts
  // ==========================================================================

  describe('extractEventsFromFacts', () => {
    it('should extract events from claimant facts', () => {
      const claimantFacts: ExtractedFact[] = [
        {
          id: 'f1',
          statement: 'Contract was signed',
          date: '2024-01-01',
          category: 'event',
          confidence: 0.9,
        },
        {
          id: 'f2',
          statement: 'Work completed',
          date: '2024-02-01',
          category: 'event',
          confidence: 0.85,
        },
      ];

      const events = extractEventsFromFacts(claimantFacts, []);

      expect(events).toHaveLength(2);
      expect(events[0].source).toBe('claimant');
      expect(events[0].event).toBe('Contract was signed');
    });

    it('should extract events from respondent facts', () => {
      const respondentFacts: ExtractedFact[] = [
        {
          id: 'f1',
          statement: 'Payment made',
          date: '2024-01-15',
          category: 'event',
          confidence: 0.9,
        },
      ];

      const events = extractEventsFromFacts([], respondentFacts);

      expect(events).toHaveLength(1);
      expect(events[0].source).toBe('respondent');
      expect(events[0].event).toBe('Payment made');
    });

    it('should skip facts without dates', () => {
      const claimantFacts: ExtractedFact[] = [
        { id: 'f1', statement: 'Some fact', category: 'event', confidence: 0.9 },
      ];

      const events = extractEventsFromFacts(claimantFacts, []);

      expect(events).toHaveLength(0);
    });

    it('should skip non-event category facts', () => {
      const claimantFacts: ExtractedFact[] = [
        {
          id: 'f1',
          statement: 'Amount is $5000',
          date: '2024-01-01',
          category: 'monetary',
          confidence: 0.9,
        },
      ];

      const events = extractEventsFromFacts(claimantFacts, []);

      expect(events).toHaveLength(0);
    });

    it('should parse valid dates', () => {
      const claimantFacts: ExtractedFact[] = [
        {
          id: 'f1',
          statement: 'Event occurred',
          date: '2024-03-15',
          category: 'event',
          confidence: 0.9,
        },
      ];

      const events = extractEventsFromFacts(claimantFacts, []);

      expect(events[0].parsedDate).toBeInstanceOf(Date);
      expect(events[0].parsedDate?.getFullYear()).toBe(2024);
    });

    it('should set disputed to false by default', () => {
      const claimantFacts: ExtractedFact[] = [
        { id: 'f1', statement: 'Event', date: '2024-01-01', category: 'event', confidence: 0.9 },
      ];

      const events = extractEventsFromFacts(claimantFacts, []);

      expect(events[0].disputed).toBe(false);
    });

    it('should create unique IDs for claimant events', () => {
      const claimantFacts: ExtractedFact[] = [
        { id: 'f1', statement: 'Event 1', date: '2024-01-01', category: 'event', confidence: 0.9 },
        { id: 'f2', statement: 'Event 2', date: '2024-01-02', category: 'event', confidence: 0.9 },
      ];

      const events = extractEventsFromFacts(claimantFacts, []);

      expect(events[0].id).toBe('claimant_event_1');
      expect(events[1].id).toBe('claimant_event_2');
    });

    it('should create unique IDs for respondent events', () => {
      const respondentFacts: ExtractedFact[] = [
        { id: 'f1', statement: 'Event 1', date: '2024-01-01', category: 'event', confidence: 0.9 },
      ];

      const events = extractEventsFromFacts([], respondentFacts);

      expect(events[0].id).toBe('respondent_event_1');
    });

    it('should include source ID from original fact', () => {
      const claimantFacts: ExtractedFact[] = [
        {
          id: 'original-id-123',
          statement: 'Event',
          date: '2024-01-01',
          category: 'event',
          confidence: 0.9,
        },
      ];

      const events = extractEventsFromFacts(claimantFacts, []);

      expect(events[0].sourceId).toBe('original-id-123');
    });
  });

  // ==========================================================================
  // extractEventsFromEvidence
  // ==========================================================================

  describe('extractEventsFromEvidence', () => {
    it('should extract events from evidence dates', () => {
      const evidenceSummaries: EvidenceSummary[] = [
        {
          id: 'ev1',
          fileName: 'contract.pdf',
          summary: 'Contract document',
          entities: {
            dates: ['2024-01-01', '2024-12-31'],
            names: [],
            amounts: [],
          },
        },
      ];

      const events = extractEventsFromEvidence(evidenceSummaries);

      expect(events).toHaveLength(2);
      expect(events[0].source).toBe('evidence');
      expect(events[0].event).toContain('contract.pdf');
    });

    it('should handle evidence without entities', () => {
      const evidenceSummaries: EvidenceSummary[] = [
        {
          id: 'ev1',
          fileName: 'document.pdf',
          summary: 'Some document',
        },
      ];

      const events = extractEventsFromEvidence(evidenceSummaries);

      expect(events).toHaveLength(0);
    });

    it('should handle evidence with empty dates array', () => {
      const evidenceSummaries: EvidenceSummary[] = [
        {
          id: 'ev1',
          fileName: 'document.pdf',
          summary: 'Document without dates',
          entities: {
            dates: [],
            names: ['John Doe'],
            amounts: ['$100'],
          },
        },
      ];

      const events = extractEventsFromEvidence(evidenceSummaries);

      expect(events).toHaveLength(0);
    });

    it('should include evidence summary as details', () => {
      const evidenceSummaries: EvidenceSummary[] = [
        {
          id: 'ev1',
          fileName: 'invoice.pdf',
          summary: 'Invoice for services rendered in January 2024',
          entities: {
            dates: ['2024-01-15'],
            names: [],
            amounts: [],
          },
        },
      ];

      const events = extractEventsFromEvidence(evidenceSummaries);

      expect(events[0].details).toContain('Invoice');
    });

    it('should truncate long summaries in details', () => {
      const longSummary = 'A'.repeat(300);
      const evidenceSummaries: EvidenceSummary[] = [
        {
          id: 'ev1',
          fileName: 'document.pdf',
          summary: longSummary,
          entities: {
            dates: ['2024-01-15'],
            names: [],
            amounts: [],
          },
        },
      ];

      const events = extractEventsFromEvidence(evidenceSummaries);

      expect(events[0].details?.length).toBeLessThanOrEqual(200);
    });

    it('should set disputed to false by default', () => {
      const evidenceSummaries: EvidenceSummary[] = [
        {
          id: 'ev1',
          fileName: 'document.pdf',
          summary: 'Test',
          entities: { dates: ['2024-01-01'], names: [], amounts: [] },
        },
      ];

      const events = extractEventsFromEvidence(evidenceSummaries);

      expect(events[0].disputed).toBe(false);
    });

    it('should create unique IDs for each evidence date', () => {
      const evidenceSummaries: EvidenceSummary[] = [
        {
          id: 'ev1',
          fileName: 'doc1.pdf',
          summary: 'First doc',
          entities: { dates: ['2024-01-01', '2024-01-02'], names: [], amounts: [] },
        },
        {
          id: 'ev2',
          fileName: 'doc2.pdf',
          summary: 'Second doc',
          entities: { dates: ['2024-02-01'], names: [], amounts: [] },
        },
      ];

      const events = extractEventsFromEvidence(evidenceSummaries);

      expect(events[0].id).toBe('evidence_1_date_1');
      expect(events[1].id).toBe('evidence_1_date_2');
      expect(events[2].id).toBe('evidence_2_date_1');
    });
  });

  // ==========================================================================
  // mergeTimelineEvents
  // ==========================================================================

  describe('mergeTimelineEvents', () => {
    it('should merge events from multiple sources', () => {
      const source1: TimelineEvent[] = [
        {
          id: 'e1',
          date: '2024-01-01',
          event: 'Event 1',
          source: 'claimant',
          sourceId: 's1',
          disputed: false,
        },
      ];
      const source2: TimelineEvent[] = [
        {
          id: 'e2',
          date: '2024-02-01',
          event: 'Event 2',
          source: 'respondent',
          sourceId: 's2',
          disputed: false,
        },
      ];

      const merged = mergeTimelineEvents(source1, source2);

      expect(merged).toHaveLength(2);
    });

    it('should deduplicate events with identical date and event text', () => {
      const source1: TimelineEvent[] = [
        {
          id: 'e1',
          date: '2024-01-01',
          event: 'Contract signed',
          source: 'claimant',
          sourceId: 's1',
          disputed: false,
        },
      ];
      const source2: TimelineEvent[] = [
        {
          id: 'e2',
          date: '2024-01-01',
          event: 'Contract signed',
          source: 'respondent',
          sourceId: 's2',
          disputed: false,
        },
      ];

      const merged = mergeTimelineEvents(source1, source2);

      expect(merged).toHaveLength(1);
    });

    it('should keep events with different text on same date', () => {
      const source1: TimelineEvent[] = [
        {
          id: 'e1',
          date: '2024-01-01',
          event: 'Contract signed',
          source: 'claimant',
          sourceId: 's1',
          disputed: false,
        },
      ];
      const source2: TimelineEvent[] = [
        {
          id: 'e2',
          date: '2024-01-01',
          event: 'Payment received',
          source: 'respondent',
          sourceId: 's2',
          disputed: false,
        },
      ];

      const merged = mergeTimelineEvents(source1, source2);

      expect(merged).toHaveLength(2);
    });

    it('should sort events by date', () => {
      const events: TimelineEvent[] = [
        {
          id: 'e1',
          date: '2024-03-01',
          parsedDate: new Date('2024-03-01'),
          event: 'Third',
          source: 'claimant',
          sourceId: 's1',
          disputed: false,
        },
        {
          id: 'e2',
          date: '2024-01-01',
          parsedDate: new Date('2024-01-01'),
          event: 'First',
          source: 'claimant',
          sourceId: 's2',
          disputed: false,
        },
        {
          id: 'e3',
          date: '2024-02-01',
          parsedDate: new Date('2024-02-01'),
          event: 'Second',
          source: 'claimant',
          sourceId: 's3',
          disputed: false,
        },
      ];

      const merged = mergeTimelineEvents(events);

      expect(merged[0].event).toBe('First');
      expect(merged[1].event).toBe('Second');
      expect(merged[2].event).toBe('Third');
    });

    it('should handle events without parsed dates', () => {
      const events: TimelineEvent[] = [
        {
          id: 'e1',
          date: 'unknown',
          event: 'Undated event',
          source: 'claimant',
          sourceId: 's1',
          disputed: false,
        },
        {
          id: 'e2',
          date: '2024-01-01',
          parsedDate: new Date('2024-01-01'),
          event: 'Dated event',
          source: 'claimant',
          sourceId: 's2',
          disputed: false,
        },
      ];

      const merged = mergeTimelineEvents(events);

      expect(merged).toHaveLength(2);
      expect(merged[0].event).toBe('Dated event'); // Dated events come first
    });

    it('should handle empty arrays', () => {
      const merged = mergeTimelineEvents([], [], []);

      expect(merged).toHaveLength(0);
    });

    it('should handle single source', () => {
      const source: TimelineEvent[] = [
        {
          id: 'e1',
          date: '2024-01-01',
          event: 'Event',
          source: 'claimant',
          sourceId: 's1',
          disputed: false,
        },
      ];

      const merged = mergeTimelineEvents(source);

      expect(merged).toHaveLength(1);
    });

    it('should merge three or more sources', () => {
      const source1: TimelineEvent[] = [
        {
          id: 'e1',
          date: '2024-01-01',
          event: 'Event 1',
          source: 'claimant',
          sourceId: 's1',
          disputed: false,
        },
      ];
      const source2: TimelineEvent[] = [
        {
          id: 'e2',
          date: '2024-02-01',
          event: 'Event 2',
          source: 'respondent',
          sourceId: 's2',
          disputed: false,
        },
      ];
      const source3: TimelineEvent[] = [
        {
          id: 'e3',
          date: '2024-03-01',
          event: 'Event 3',
          source: 'evidence',
          sourceId: 's3',
          disputed: false,
        },
      ];

      const merged = mergeTimelineEvents(source1, source2, source3);

      expect(merged).toHaveLength(3);
    });
  });

  // ==========================================================================
  // formatTimelineForDisplay
  // ==========================================================================

  describe('formatTimelineForDisplay', () => {
    it('should format events for display', () => {
      const events: TimelineEvent[] = [
        {
          id: 'e1',
          date: '2024-01-01',
          event: 'Contract signed',
          source: 'claimant',
          sourceId: 's1',
          disputed: false,
        },
        {
          id: 'e2',
          date: '2024-02-01',
          event: 'Payment disputed',
          source: 'respondent',
          sourceId: 's2',
          disputed: true,
        },
      ];

      const formatted = formatTimelineForDisplay(events);

      expect(formatted).toContain('2024-01-01: Contract signed (claimant)');
      expect(formatted).toContain('2024-02-01: Payment disputed (respondent) [DISPUTED]');
    });

    it('should handle empty events', () => {
      const formatted = formatTimelineForDisplay([]);

      expect(formatted).toBe('No timeline events identified.');
    });

    it('should mark disputed events', () => {
      const events: TimelineEvent[] = [
        {
          id: 'e1',
          date: '2024-01-01',
          event: 'Disputed event',
          source: 'claimant',
          sourceId: 's1',
          disputed: true,
        },
      ];

      const formatted = formatTimelineForDisplay(events);

      expect(formatted).toContain('[DISPUTED]');
    });

    it('should not mark non-disputed events', () => {
      const events: TimelineEvent[] = [
        {
          id: 'e1',
          date: '2024-01-01',
          event: 'Normal event',
          source: 'claimant',
          sourceId: 's1',
          disputed: false,
        },
      ];

      const formatted = formatTimelineForDisplay(events);

      expect(formatted).not.toContain('[DISPUTED]');
    });

    it('should include source in output', () => {
      const events: TimelineEvent[] = [
        {
          id: 'e1',
          date: '2024-01-01',
          event: 'Test',
          source: 'evidence',
          sourceId: 's1',
          disputed: false,
        },
      ];

      const formatted = formatTimelineForDisplay(events);

      expect(formatted).toContain('(evidence)');
    });

    it('should format multiple events with newlines', () => {
      const events: TimelineEvent[] = [
        {
          id: 'e1',
          date: '2024-01-01',
          event: 'First',
          source: 'claimant',
          sourceId: 's1',
          disputed: false,
        },
        {
          id: 'e2',
          date: '2024-01-02',
          event: 'Second',
          source: 'claimant',
          sourceId: 's2',
          disputed: false,
        },
      ];

      const formatted = formatTimelineForDisplay(events);

      expect(formatted).toContain('\n');
      const lines = formatted.split('\n');
      expect(lines).toHaveLength(2);
    });
  });

  // ==========================================================================
  // getTimelineSpanDays
  // ==========================================================================

  describe('getTimelineSpanDays', () => {
    it('should calculate span between earliest and latest events', () => {
      const events: TimelineEvent[] = [
        {
          id: 'e1',
          date: '2024-01-01',
          parsedDate: new Date('2024-01-01'),
          event: 'Start',
          source: 'claimant',
          sourceId: 's1',
          disputed: false,
        },
        {
          id: 'e2',
          date: '2024-01-31',
          parsedDate: new Date('2024-01-31'),
          event: 'End',
          source: 'claimant',
          sourceId: 's2',
          disputed: false,
        },
      ];

      const span = getTimelineSpanDays(events);

      expect(span).toBe(30);
    });

    it('should return null for single event', () => {
      const events: TimelineEvent[] = [
        {
          id: 'e1',
          date: '2024-01-01',
          parsedDate: new Date('2024-01-01'),
          event: 'Only event',
          source: 'claimant',
          sourceId: 's1',
          disputed: false,
        },
      ];

      const span = getTimelineSpanDays(events);

      expect(span).toBeNull();
    });

    it('should return null for events without dates', () => {
      const events: TimelineEvent[] = [
        {
          id: 'e1',
          date: 'unknown',
          event: 'Undated',
          source: 'claimant',
          sourceId: 's1',
          disputed: false,
        },
        {
          id: 'e2',
          date: 'unknown',
          event: 'Also undated',
          source: 'claimant',
          sourceId: 's2',
          disputed: false,
        },
      ];

      const span = getTimelineSpanDays(events);

      expect(span).toBeNull();
    });

    it('should handle mixed dated and undated events', () => {
      const events: TimelineEvent[] = [
        {
          id: 'e1',
          date: '2024-01-01',
          parsedDate: new Date('2024-01-01'),
          event: 'Dated 1',
          source: 'claimant',
          sourceId: 's1',
          disputed: false,
        },
        {
          id: 'e2',
          date: 'unknown',
          event: 'Undated',
          source: 'claimant',
          sourceId: 's2',
          disputed: false,
        },
        {
          id: 'e3',
          date: '2024-01-15',
          parsedDate: new Date('2024-01-15'),
          event: 'Dated 2',
          source: 'claimant',
          sourceId: 's3',
          disputed: false,
        },
      ];

      const span = getTimelineSpanDays(events);

      expect(span).toBe(14);
    });

    it('should return null for empty events', () => {
      const span = getTimelineSpanDays([]);

      expect(span).toBeNull();
    });

    it('should handle same-day events', () => {
      const events: TimelineEvent[] = [
        {
          id: 'e1',
          date: '2024-01-01',
          parsedDate: new Date('2024-01-01'),
          event: 'Event 1',
          source: 'claimant',
          sourceId: 's1',
          disputed: false,
        },
        {
          id: 'e2',
          date: '2024-01-01',
          parsedDate: new Date('2024-01-01'),
          event: 'Event 2',
          source: 'claimant',
          sourceId: 's2',
          disputed: false,
        },
      ];

      const span = getTimelineSpanDays(events);

      expect(span).toBe(0);
    });

    it('should handle year-spanning events', () => {
      const events: TimelineEvent[] = [
        {
          id: 'e1',
          date: '2023-12-01',
          parsedDate: new Date('2023-12-01'),
          event: 'Start',
          source: 'claimant',
          sourceId: 's1',
          disputed: false,
        },
        {
          id: 'e2',
          date: '2024-01-31',
          parsedDate: new Date('2024-01-31'),
          event: 'End',
          source: 'claimant',
          sourceId: 's2',
          disputed: false,
        },
      ];

      const span = getTimelineSpanDays(events);

      expect(span).toBe(61); // 31 days in Dec + 30 days through Jan 31
    });
  });
});
