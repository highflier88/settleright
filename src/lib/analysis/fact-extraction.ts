/**
 * Fact Extraction Module
 *
 * Extracts key facts from party statements using Claude AI.
 * Uses Claude Haiku for fast, cost-effective extraction.
 */

import Anthropic from '@anthropic-ai/sdk';

import { buildFactExtractionPrompt, FACT_ANALYSIS_SYSTEM_PROMPT } from './prompts';

import type {
  EvidenceSummary,
  ExtractedFact,
  ExtractedFactsResult,
  FactCategory,
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
 * Extract facts from a single party's statement
 */
export async function extractFactsFromStatement(
  partyType: 'claimant' | 'respondent',
  statement: string,
  caseContext: string,
  evidenceSummaries: EvidenceSummary[]
): Promise<{ facts: ExtractedFact[]; tokensUsed: number }> {
  const client = getAnthropicClient();

  // Truncate statement if too long
  const truncatedStatement = statement.slice(0, 12000);

  const prompt = buildFactExtractionPrompt(
    partyType,
    truncatedStatement,
    caseContext,
    evidenceSummaries
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

    // Extract text from response
    const responseText =
      response.content[0]?.type === 'text' ? response.content[0].text : '';

    // Calculate tokens used
    const tokensUsed =
      (response.usage?.input_tokens || 0) + (response.usage?.output_tokens || 0);

    // Parse the response
    const facts = parseFactExtractionResponse(responseText, partyType);

    return { facts, tokensUsed };
  } catch (error) {
    console.error(`Fact extraction failed for ${partyType}:`, error);
    return { facts: [], tokensUsed: 0 };
  }
}

/**
 * Extract facts from both parties
 */
export async function extractFacts(
  claimantStatement: string,
  respondentStatement: string | undefined,
  caseContext: string,
  evidenceSummaries: EvidenceSummary[]
): Promise<ExtractedFactsResult> {
  // Extract claimant facts
  const claimantResult = await extractFactsFromStatement(
    'claimant',
    claimantStatement,
    caseContext,
    evidenceSummaries
  );

  // Extract respondent facts if statement exists
  let respondentResult: { facts: ExtractedFact[]; tokensUsed: number } = {
    facts: [],
    tokensUsed: 0,
  };

  if (respondentStatement && respondentStatement.trim().length > 50) {
    respondentResult = await extractFactsFromStatement(
      'respondent',
      respondentStatement,
      caseContext,
      evidenceSummaries
    );
  }

  return {
    claimant: claimantResult.facts,
    respondent: respondentResult.facts,
    tokensUsed: claimantResult.tokensUsed + respondentResult.tokensUsed,
  };
}

/**
 * Parse the Claude response into ExtractedFact array
 */
function parseFactExtractionResponse(
  responseText: string,
  partyType: 'claimant' | 'respondent'
): ExtractedFact[] {
  try {
    // Extract JSON from response (handle potential markdown code blocks)
    let jsonStr = responseText.trim();
    if (jsonStr.startsWith('```')) {
      jsonStr = jsonStr.replace(/```json?\n?/, '').replace(/```$/, '').trim();
    }

    const parsed = JSON.parse(jsonStr) as Array<{
      id?: string;
      statement?: string;
      category?: string;
      date?: string;
      amount?: number;
      supportingEvidence?: string[];
      confidence?: number;
      context?: string;
    }>;

    if (!Array.isArray(parsed)) {
      console.error('Fact extraction response is not an array');
      return [];
    }

    // Valid categories
    const validCategories: FactCategory[] = [
      'event',
      'claim',
      'admission',
      'denial',
      'allegation',
    ];

    return parsed
      .map((item, index) => {
        // Validate and normalize category
        const category = validCategories.includes(item.category as FactCategory)
          ? (item.category as FactCategory)
          : 'claim';

        return {
          id: item.id || `${partyType}_fact_${index + 1}`,
          statement: item.statement || '',
          category,
          date: item.date,
          amount: typeof item.amount === 'number' ? item.amount : undefined,
          supportingEvidence: Array.isArray(item.supportingEvidence)
            ? item.supportingEvidence
            : undefined,
          confidence: Math.min(1, Math.max(0, item.confidence || 0.5)),
          context: item.context,
        };
      })
      .filter((fact) => fact.statement.length > 0);
  } catch (error) {
    console.error('Failed to parse fact extraction response:', error);
    return [];
  }
}

/**
 * Format extracted facts as string for use in other prompts
 */
export function formatFactsForPrompt(facts: ExtractedFact[]): string {
  if (facts.length === 0) {
    return 'No facts extracted.';
  }

  return facts
    .map((fact, i) => {
      const parts = [
        `${i + 1}. [${fact.category.toUpperCase()}] ${fact.statement}`,
        fact.date ? `   Date: ${fact.date}` : null,
        fact.amount ? `   Amount: $${fact.amount.toLocaleString()}` : null,
        fact.supportingEvidence?.length
          ? `   Evidence: ${fact.supportingEvidence.join(', ')}`
          : null,
      ];
      return parts.filter(Boolean).join('\n');
    })
    .join('\n\n');
}

/**
 * Estimate cost for fact extraction
 * Claude Haiku: $0.25 per million input tokens, $1.25 per million output tokens
 */
export function estimateFactExtractionCost(
  claimantStatementLength: number,
  respondentStatementLength: number
): number {
  // Rough estimate: ~4 chars per token
  const claimantInputTokens = Math.ceil((claimantStatementLength + 2000) / 4);
  const respondentInputTokens = respondentStatementLength > 0
    ? Math.ceil((respondentStatementLength + 2000) / 4)
    : 0;

  const totalInputTokens = claimantInputTokens + respondentInputTokens;
  const outputTokens = 1024 * 2; // ~2048 tokens output for both

  const inputCost = (totalInputTokens / 1_000_000) * 0.25;
  const outputCost = (outputTokens / 1_000_000) * 1.25;

  return inputCost + outputCost;
}
