/**
 * Document Summarizer
 *
 * Generates concise summaries and key points from document text
 * using Claude Haiku for cost-effective processing.
 */

import Anthropic from '@anthropic-ai/sdk';

import type { SummarizationResult } from '@/types/documents';

import type { DocumentType } from '@prisma/client';

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
 * Document type-specific summarization prompts
 */
const SUMMARY_PROMPTS: Partial<Record<DocumentType, string>> = {
  CONTRACT: `Summarize this contract/agreement. Focus on:
- The parties involved
- Main obligations of each party
- Key terms and conditions
- Any notable clauses (penalties, termination, warranties)`,

  INVOICE: `Summarize this invoice. Focus on:
- Who issued it and to whom
- Total amount due
- What goods/services were provided
- Payment terms and due date`,

  RECEIPT: `Summarize this receipt. Focus on:
- What was purchased
- Total amount paid
- Date of transaction
- Payment method if mentioned`,

  CORRESPONDENCE: `Summarize this correspondence. Focus on:
- Who is communicating with whom
- The main subject/purpose
- Key points or requests made
- Any commitments or deadlines mentioned`,

  LEGAL_NOTICE: `Summarize this legal notice. Focus on:
- Who sent it and to whom
- The nature of the dispute or claim
- Specific demands or allegations
- Any deadlines or consequences mentioned`,

  BANK_STATEMENT: `Summarize this bank statement. Focus on:
- Account holder and period covered
- Beginning and ending balance
- Notable transactions
- Any fees or issues`,
};

/**
 * Summarize document text
 */
export async function summarizeDocument(
  text: string,
  documentType?: DocumentType
): Promise<SummarizationResult> {
  const client = getAnthropicClient();

  // Truncate text if too long
  const truncatedText = text.slice(0, 10000);

  // Get type-specific prompt or use generic
  const typePrompt = documentType ? SUMMARY_PROMPTS[documentType] : null;

  const prompt = `${typePrompt || 'Summarize this document, focusing on the most important information for understanding a legal dispute.'}

Document text:
"""
${truncatedText}
"""

Provide your response as a JSON object with:
- "summary": A concise 2-3 sentence summary of the document
- "keyPoints": An array of 3-5 bullet points highlighting the most important facts

Respond with only the JSON object, no other text.`;

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
    return parseSummaryResponse(responseText);
  } catch (error) {
    console.error('Document summarization failed:', error);
    return {
      summary: 'Unable to generate summary',
      keyPoints: [],
    };
  }
}

/**
 * Parse Claude's summarization response
 */
function parseSummaryResponse(responseText: string): SummarizationResult {
  try {
    let jsonStr = responseText.trim();
    if (jsonStr.startsWith('```')) {
      jsonStr = jsonStr
        .replace(/```json?\n?/, '')
        .replace(/```$/, '')
        .trim();
    }

    const parsed = JSON.parse(jsonStr) as {
      summary?: string;
      keyPoints?: string[];
    };

    return {
      summary: parsed.summary || 'Unable to generate summary',
      keyPoints: Array.isArray(parsed.keyPoints) ? parsed.keyPoints : [],
    };
  } catch {
    console.error('Failed to parse summary response:', responseText);

    // Try to extract summary from raw text
    const summary = responseText.slice(0, 500).trim();
    return {
      summary: summary || 'Unable to generate summary',
      keyPoints: [],
    };
  }
}

/**
 * Generate a quick summary without AI (for very short texts)
 */
export function generateQuickSummary(text: string, maxLength = 200): string {
  // Clean and truncate
  const cleaned = text
    .replace(/\s+/g, ' ')
    .trim()
    .slice(0, maxLength * 2);

  // Find a good breakpoint
  if (cleaned.length <= maxLength) {
    return cleaned;
  }

  // Try to break at sentence end
  const sentenceEnd = cleaned.lastIndexOf('.', maxLength);
  if (sentenceEnd > maxLength / 2) {
    return cleaned.slice(0, sentenceEnd + 1);
  }

  // Break at word boundary
  const lastSpace = cleaned.lastIndexOf(' ', maxLength);
  if (lastSpace > maxLength / 2) {
    return cleaned.slice(0, lastSpace) + '...';
  }

  return cleaned.slice(0, maxLength) + '...';
}

/**
 * Estimate summarization cost
 * Claude Haiku: $0.25 per million input tokens, $1.25 per million output tokens
 */
export function estimateSummarizationCost(textLength: number): number {
  // Rough estimate: ~4 chars per token
  const inputTokens = Math.ceil((textLength + 300) / 4); // +300 for prompt
  const outputTokens = 150; // ~600 chars for summary + key points

  const inputCost = (inputTokens / 1_000_000) * 0.25;
  const outputCost = (outputTokens / 1_000_000) * 1.25;

  return inputCost + outputCost;
}
