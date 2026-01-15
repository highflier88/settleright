/**
 * Timeline Reconstruction Module
 *
 * Reconstructs chronological timeline of events from
 * party statements and documentary evidence.
 */

import Anthropic from '@anthropic-ai/sdk';

import { buildTimelinePrompt, FACT_ANALYSIS_SYSTEM_PROMPT } from './prompts';

import type {
  DisputedFact,
  EvidenceSummary,
  ExtractedFact,
  TimelineEvent,
  TimelineResult,
} from './types';

// Singleton Anthropic client
let anthropicClient: Anthropic | null = null;

/**
 * Get or create the Anthropic client
 */
function getAnthropicClient(): Anthropic {
  if (!anthropicClient) {
    const apiKey = process.env.ANTHROPIC_API_KEY;
    if (!apiKey) {
      throw new Error('ANTHROPIC_API_KEY environment variable is not set');
    }
    anthropicClient = new Anthropic({ apiKey });
  }
  return anthropicClient;
}

/**
 * Reconstruct timeline from statements and evidence
 */
export async function reconstructTimeline(
  claimantStatement: string,
  respondentStatement: string | undefined,
  evidenceSummaries: EvidenceSummary[],
  disputedFacts: DisputedFact[],
  caseContext: string
): Promise<{ timeline: TimelineResult; tokensUsed: number }> {
  const client = getAnthropicClient();

  const truncatedClaimant = claimantStatement.slice(0, 8000);
  const truncatedRespondent = respondentStatement?.slice(0, 8000);

  const prompt = buildTimelinePrompt(
    truncatedClaimant,
    truncatedRespondent,
    evidenceSummaries,
    caseContext
  );

  try {
    const response = await client.messages.create({
      model: 'claude-3-haiku-20240307',
      max_tokens: 2048,
      system: FACT_ANALYSIS_SYSTEM_PROMPT,
      messages: [
        {
          role: 'user',
          content: prompt,
        },
      ],
    });

    const responseText =
      response.content[0]?.type === 'text' ? response.content[0].text : '';

    const tokensUsed =
      (response.usage?.input_tokens || 0) + (response.usage?.output_tokens || 0);

    const timeline = parseTimelineResponse(responseText, disputedFacts);

    return { timeline, tokensUsed };
  } catch (error) {
    console.error('Timeline reconstruction failed:', error);
    return {
      timeline: { events: [], undatedEvents: [] },
      tokensUsed: 0,
    };
  }
}

/**
 * Extract timeline events from extracted facts
 * This supplements the Claude-generated timeline
 */
export function extractEventsFromFacts(
  claimantFacts: ExtractedFact[],
  respondentFacts: ExtractedFact[]
): TimelineEvent[] {
  const events: TimelineEvent[] = [];

  // Extract from claimant facts
  claimantFacts
    .filter((f) => f.date && f.category === 'event')
    .forEach((f, index) => {
      events.push({
        id: `claimant_event_${index + 1}`,
        date: f.date!,
        parsedDate: tryParseDate(f.date!),
        event: f.statement,
        source: 'claimant',
        sourceId: f.id,
        disputed: false,
      });
    });

  // Extract from respondent facts
  respondentFacts
    .filter((f) => f.date && f.category === 'event')
    .forEach((f, index) => {
      events.push({
        id: `respondent_event_${index + 1}`,
        date: f.date!,
        parsedDate: tryParseDate(f.date!),
        event: f.statement,
        source: 'respondent',
        sourceId: f.id,
        disputed: false,
      });
    });

  return events;
}

/**
 * Extract timeline events from evidence entities
 */
export function extractEventsFromEvidence(
  evidenceSummaries: EvidenceSummary[]
): TimelineEvent[] {
  const events: TimelineEvent[] = [];

  evidenceSummaries.forEach((evidence, evidenceIndex) => {
    // Get dates from extracted entities
    const dates = evidence.entities?.dates || [];

    dates.forEach((date, dateIndex) => {
      // Create an event for each date found in evidence
      events.push({
        id: `evidence_${evidenceIndex + 1}_date_${dateIndex + 1}`,
        date,
        parsedDate: tryParseDate(date),
        event: `Date referenced in ${evidence.fileName}`,
        source: 'evidence',
        sourceId: evidence.id,
        disputed: false,
        details: evidence.summary?.slice(0, 200),
      });
    });
  });

  return events;
}

/**
 * Try to parse a date string into a Date object
 */
function tryParseDate(dateStr: string): Date | undefined {
  // Try ISO format first
  const isoDate = new Date(dateStr);
  if (!isNaN(isoDate.getTime())) {
    return isoDate;
  }

  // Try common formats
  const formats = [
    /(\d{1,2})\/(\d{1,2})\/(\d{4})/, // MM/DD/YYYY
    /(\d{4})-(\d{1,2})-(\d{1,2})/, // YYYY-MM-DD
    /(\w+)\s+(\d{1,2}),?\s+(\d{4})/, // Month DD, YYYY
  ];

  for (const format of formats) {
    const match = dateStr.match(format);
    if (match) {
      const parsed = new Date(dateStr);
      if (!isNaN(parsed.getTime())) {
        return parsed;
      }
    }
  }

  return undefined;
}

/**
 * Parse timeline response from Claude
 */
function parseTimelineResponse(
  responseText: string,
  disputedFacts: DisputedFact[]
): TimelineResult {
  try {
    let jsonStr = responseText.trim();
    if (jsonStr.startsWith('```')) {
      jsonStr = jsonStr.replace(/```json?\n?/, '').replace(/```$/, '').trim();
    }

    const parsed = JSON.parse(jsonStr) as {
      events?: Array<{
        id?: string;
        date?: string;
        event?: string;
        source?: string;
        sourceId?: string;
        disputed?: boolean;
        details?: string;
      }>;
      startDate?: string;
      endDate?: string;
      undatedEvents?: Array<{
        id?: string;
        date?: string;
        event?: string;
        source?: string;
        sourceId?: string;
        disputed?: boolean;
      }>;
    };

    // Get disputed topics for marking events
    const disputedTopics = disputedFacts.map((d) => d.topic.toLowerCase());

    // Parse events
    const events: TimelineEvent[] = (parsed.events || [])
      .map((item, index) => {
        const source = (['claimant', 'respondent', 'evidence'].includes(
          item.source || ''
        )
          ? item.source
          : 'claimant') as 'claimant' | 'respondent' | 'evidence';

        // Check if event relates to a disputed fact
        const eventLower = (item.event || '').toLowerCase();
        const isDisputed =
          item.disputed ||
          disputedTopics.some((topic) => eventLower.includes(topic));

        return {
          id: item.id || `event_${index + 1}`,
          date: item.date || '',
          parsedDate: tryParseDate(item.date || ''),
          event: item.event || '',
          source,
          sourceId: item.sourceId || 'statement',
          disputed: isDisputed,
          details: item.details,
        };
      })
      .filter((e) => e.event.length > 0);

    // Parse undated events
    const undatedEvents: TimelineEvent[] = (parsed.undatedEvents || [])
      .map((item, index) => {
        const source = (['claimant', 'respondent', 'evidence'].includes(
          item.source || ''
        )
          ? item.source
          : 'claimant') as 'claimant' | 'respondent' | 'evidence';

        return {
          id: item.id || `undated_${index + 1}`,
          date: 'unknown',
          event: item.event || '',
          source,
          sourceId: item.sourceId || 'statement',
          disputed: item.disputed || false,
        };
      })
      .filter((e) => e.event.length > 0);

    // Sort events by parsed date
    events.sort((a, b) => {
      if (a.parsedDate && b.parsedDate) {
        return a.parsedDate.getTime() - b.parsedDate.getTime();
      }
      if (a.parsedDate) return -1;
      if (b.parsedDate) return 1;
      return 0;
    });

    return {
      events,
      startDate: parsed.startDate,
      endDate: parsed.endDate,
      undatedEvents,
    };
  } catch (error) {
    console.error('Failed to parse timeline response:', error);
    return { events: [], undatedEvents: [] };
  }
}

/**
 * Merge and deduplicate timeline events from multiple sources
 */
export function mergeTimelineEvents(
  ...eventSources: TimelineEvent[][]
): TimelineEvent[] {
  const allEvents = eventSources.flat();

  // Deduplicate by checking for similar events on same date
  const uniqueEvents: TimelineEvent[] = [];
  const seen = new Set<string>();

  for (const event of allEvents) {
    const key = `${event.date}_${event.event.slice(0, 50).toLowerCase()}`;
    if (!seen.has(key)) {
      seen.add(key);
      uniqueEvents.push(event);
    }
  }

  // Sort by date
  return uniqueEvents.sort((a, b) => {
    if (a.parsedDate && b.parsedDate) {
      return a.parsedDate.getTime() - b.parsedDate.getTime();
    }
    if (a.parsedDate) return -1;
    if (b.parsedDate) return 1;
    return a.date.localeCompare(b.date);
  });
}

/**
 * Format timeline for display
 */
export function formatTimelineForDisplay(events: TimelineEvent[]): string {
  if (events.length === 0) {
    return 'No timeline events identified.';
  }

  return events
    .map((e) => {
      const disputed = e.disputed ? ' [DISPUTED]' : '';
      return `${e.date}: ${e.event} (${e.source})${disputed}`;
    })
    .join('\n');
}

/**
 * Get timeline span in days
 */
export function getTimelineSpanDays(events: TimelineEvent[]): number | null {
  const datedEvents = events.filter((e) => e.parsedDate);
  if (datedEvents.length < 2) return null;

  const dates = datedEvents.map((e) => e.parsedDate!.getTime());
  const earliest = Math.min(...dates);
  const latest = Math.max(...dates);

  return Math.ceil((latest - earliest) / (1000 * 60 * 60 * 24));
}
