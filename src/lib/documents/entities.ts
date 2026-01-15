/**
 * Entity Extractor
 *
 * Extracts structured data from document text including:
 * - Dates
 * - Monetary amounts
 * - Party names (using Claude for complex extraction)
 * - Email addresses
 * - Phone numbers
 * - Addresses
 */

import Anthropic from '@anthropic-ai/sdk';

import type {
  ExtractedEntities,
  ExtractedDate,
  ExtractedAmount,
  ExtractedParty,
} from '@/types/documents';

// Singleton Anthropic client
let anthropicClient: Anthropic | null = null;

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
 * Extract all entities from document text
 */
export async function extractEntities(text: string): Promise<ExtractedEntities> {
  // Run regex-based extractions in parallel with AI party extraction
  const [dates, amounts, emails, phones, parties] = await Promise.all([
    Promise.resolve(extractDates(text)),
    Promise.resolve(extractAmounts(text)),
    Promise.resolve(extractEmails(text)),
    Promise.resolve(extractPhones(text)),
    extractParties(text),
  ]);

  // Address extraction is complex, skip for now
  const addresses: string[] = [];

  return {
    dates,
    amounts,
    parties,
    addresses,
    emails,
    phones,
  };
}

/**
 * Extract dates from text using regex patterns
 */
export function extractDates(text: string): ExtractedDate[] {
  const dates: ExtractedDate[] = [];
  const seenDates = new Set<string>();

  // Date patterns
  const patterns = [
    // MM/DD/YYYY or MM-DD-YYYY
    /\b(\d{1,2})[\/\-](\d{1,2})[\/\-](\d{4})\b/g,
    // YYYY-MM-DD (ISO format)
    /\b(\d{4})-(\d{2})-(\d{2})\b/g,
    // Month DD, YYYY (January 1, 2024)
    /\b(January|February|March|April|May|June|July|August|September|October|November|December)\s+(\d{1,2}),?\s+(\d{4})\b/gi,
    // DD Month YYYY (1 January 2024)
    /\b(\d{1,2})\s+(January|February|March|April|May|June|July|August|September|October|November|December)\s+(\d{4})\b/gi,
    // Mon DD, YYYY (Jan 1, 2024)
    /\b(Jan|Feb|Mar|Apr|May|Jun|Jul|Aug|Sep|Oct|Nov|Dec)[a-z]*\.?\s+(\d{1,2}),?\s+(\d{4})\b/gi,
  ];

  for (const pattern of patterns) {
    let match;
    while ((match = pattern.exec(text)) !== null) {
      const raw = match[0];
      const normalized = normalizeDate(raw);

      if (normalized && !seenDates.has(normalized)) {
        seenDates.add(normalized);

        // Get surrounding context
        const start = Math.max(0, match.index - 30);
        const end = Math.min(text.length, match.index + raw.length + 30);
        const context = text.slice(start, end).replace(/\s+/g, ' ').trim();

        dates.push({
          value: raw,
          normalized,
          context,
        });
      }
    }
  }

  return dates;
}

/**
 * Normalize a date string to ISO format
 */
function normalizeDate(dateStr: string): string | null {
  try {
    const date = new Date(dateStr);
    if (!isNaN(date.getTime())) {
      return date.toISOString().split('T')[0] || null;
    }
    return null;
  } catch {
    return null;
  }
}

/**
 * Extract monetary amounts from text
 */
export function extractAmounts(text: string): ExtractedAmount[] {
  const amounts: ExtractedAmount[] = [];
  const seenAmounts = new Set<string>();

  // Amount patterns
  const patterns = [
    // $1,234.56 or $1234.56
    /\$\s?([\d,]+\.?\d*)/g,
    // 1,234.56 USD or 1234.56 USD
    /([\d,]+\.?\d*)\s*(?:USD|dollars?)/gi,
    // Written amounts like "one thousand dollars"
    // (skipping for now - too complex)
  ];

  for (const pattern of patterns) {
    let match;
    while ((match = pattern.exec(text)) !== null) {
      const raw = match[0];
      const numStr = match[1]?.replace(/,/g, '') || '';
      const value = parseFloat(numStr);

      if (!isNaN(value) && value > 0 && !seenAmounts.has(raw)) {
        seenAmounts.add(raw);

        // Get surrounding context
        const start = Math.max(0, match.index - 30);
        const end = Math.min(text.length, match.index + raw.length + 30);
        const context = text.slice(start, end).replace(/\s+/g, ' ').trim();

        amounts.push({
          value,
          currency: 'USD',
          raw,
          context,
        });
      }
    }
  }

  // Sort by value descending (larger amounts usually more significant)
  amounts.sort((a, b) => b.value - a.value);

  return amounts;
}

/**
 * Extract email addresses from text
 */
export function extractEmails(text: string): string[] {
  const emailPattern = /\b[A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\.[A-Z|a-z]{2,}\b/g;
  const emails = new Set<string>();

  let match;
  while ((match = emailPattern.exec(text)) !== null) {
    emails.add(match[0].toLowerCase());
  }

  return Array.from(emails);
}

/**
 * Extract phone numbers from text
 */
export function extractPhones(text: string): string[] {
  // US phone number patterns
  const phonePatterns = [
    // (123) 456-7890
    /\(\d{3}\)\s?\d{3}[-.\s]?\d{4}/g,
    // 123-456-7890 or 123.456.7890
    /\b\d{3}[-.\s]\d{3}[-.\s]\d{4}\b/g,
    // +1 123 456 7890
    /\+1\s?\d{3}\s?\d{3}\s?\d{4}/g,
  ];

  const phones = new Set<string>();

  for (const pattern of phonePatterns) {
    let match;
    while ((match = pattern.exec(text)) !== null) {
      // Normalize phone number
      const normalized = match[0].replace(/[^\d+]/g, '');
      if (normalized.length >= 10) {
        phones.add(match[0]);
      }
    }
  }

  return Array.from(phones);
}

/**
 * Extract party names using Claude AI
 */
export async function extractParties(text: string): Promise<ExtractedParty[]> {
  const client = getAnthropicClient();

  // Truncate text if too long
  const truncatedText = text.slice(0, 6000);

  const prompt = `Extract the names of parties (people and organizations) mentioned in this document. Focus on parties involved in the dispute, transaction, or agreement.

Document text:
"""
${truncatedText}
"""

Respond with a JSON array of objects, each with:
- "name": The party's name
- "type": Either "person" or "organization"
- "role": Their role if apparent (e.g., "buyer", "seller", "claimant", "defendant", "landlord", "tenant")

Only include parties that are clearly named. Respond with only the JSON array, no other text. If no parties found, return [].`;

  try {
    const response = await client.messages.create({
      model: 'claude-3-haiku-20240307',
      max_tokens: 512,
      messages: [
        {
          role: 'user',
          content: prompt,
        },
      ],
    });

    const responseText = response.content[0]?.type === 'text' ? response.content[0].text : '';
    return parsePartiesResponse(responseText);
  } catch (error) {
    console.error('Party extraction failed:', error);
    return [];
  }
}

/**
 * Parse Claude's party extraction response
 */
function parsePartiesResponse(responseText: string): ExtractedParty[] {
  try {
    let jsonStr = responseText.trim();
    if (jsonStr.startsWith('```')) {
      jsonStr = jsonStr
        .replace(/```json?\n?/, '')
        .replace(/```$/, '')
        .trim();
    }

    const parsed = JSON.parse(jsonStr) as Array<{
      name?: string;
      type?: string;
      role?: string;
    }>;

    if (!Array.isArray(parsed)) {
      return [];
    }

    return parsed
      .filter((p) => p.name && typeof p.name === 'string')
      .map((p) => ({
        name: p.name as string,
        type: p.type === 'person' || p.type === 'organization' ? p.type : 'unknown',
        role: p.role,
      }));
  } catch {
    console.error('Failed to parse parties response:', responseText);
    return [];
  }
}

/**
 * Quick entity extraction (regex only, no AI)
 */
export function extractEntitiesQuick(
  text: string
): Omit<ExtractedEntities, 'parties'> & { parties: ExtractedParty[] } {
  return {
    dates: extractDates(text),
    amounts: extractAmounts(text),
    parties: [], // Skip AI extraction
    addresses: [],
    emails: extractEmails(text),
    phones: extractPhones(text),
  };
}
