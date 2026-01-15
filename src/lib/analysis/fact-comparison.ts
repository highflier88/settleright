/**
 * Fact Comparison Module
 *
 * Compares extracted facts between parties to identify
 * disputed and undisputed facts.
 */

import Anthropic from '@anthropic-ai/sdk';

import { formatFactsForPrompt } from './fact-extraction';
import { buildFactComparisonPrompt, FACT_ANALYSIS_SYSTEM_PROMPT } from './prompts';

import type {
  DisputedFact,
  ExtractedFact,
  FactComparisonResult,
  PartySource,
  UndisputedFact,
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
 * Compare facts between claimant and respondent
 */
export async function compareFacts(
  claimantFacts: ExtractedFact[],
  respondentFacts: ExtractedFact[],
  caseContext: string
): Promise<FactComparisonResult> {
  // If no respondent facts, all claimant facts are undisputed by default
  if (respondentFacts.length === 0) {
    return createDefaultComparison(claimantFacts);
  }

  const client = getAnthropicClient();

  const claimantFactsStr = formatFactsForPrompt(claimantFacts);
  const respondentFactsStr = formatFactsForPrompt(respondentFacts);

  const prompt = buildFactComparisonPrompt(
    claimantFactsStr,
    respondentFactsStr,
    caseContext
  );

  try {
    const response = await client.messages.create({
      model: 'claude-3-5-sonnet-20241022',
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

    const result = parseComparisonResponse(responseText);

    return {
      ...result,
      tokensUsed,
    };
  } catch (error) {
    console.error('Fact comparison failed:', error);
    return createDefaultComparison(claimantFacts);
  }
}

/**
 * Create default comparison when respondent hasn't responded
 */
function createDefaultComparison(claimantFacts: ExtractedFact[]): FactComparisonResult {
  // All claimant facts are considered undisputed (not yet contested)
  const undisputed: UndisputedFact[] = claimantFacts.map((fact, index) => ({
    id: `undisputed_${index + 1}`,
    fact: fact.statement,
    agreedBy: ['claimant'] as PartySource[],
    supportingEvidence: fact.supportingEvidence,
    materialityScore: fact.confidence,
  }));

  return {
    disputed: [],
    undisputed,
    tokensUsed: 0,
  };
}

/**
 * Parse the Claude response into FactComparisonResult
 */
function parseComparisonResponse(responseText: string): FactComparisonResult {
  try {
    let jsonStr = responseText.trim();
    if (jsonStr.startsWith('```')) {
      jsonStr = jsonStr.replace(/```json?\n?/, '').replace(/```$/, '').trim();
    }

    const parsed = JSON.parse(jsonStr) as {
      disputed?: Array<{
        id?: string;
        topic?: string;
        claimantPosition?: string;
        respondentPosition?: string;
        relevantEvidence?: string[];
        materialityScore?: number;
        analysis?: string;
      }>;
      undisputed?: Array<{
        id?: string;
        fact?: string;
        agreedBy?: string[];
        supportingEvidence?: string[];
        materialityScore?: number;
      }>;
    };

    // Parse disputed facts
    const disputed: DisputedFact[] = (parsed.disputed || [])
      .map((item, index) => ({
        id: item.id || `dispute_${index + 1}`,
        topic: item.topic || '',
        claimantPosition: item.claimantPosition || '',
        respondentPosition: item.respondentPosition || '',
        relevantEvidence: Array.isArray(item.relevantEvidence)
          ? item.relevantEvidence
          : [],
        materialityScore: Math.min(1, Math.max(0, item.materialityScore || 0.5)),
        analysis: item.analysis,
      }))
      .filter(
        (d) =>
          d.topic.length > 0 &&
          d.claimantPosition.length > 0 &&
          d.respondentPosition.length > 0
      );

    // Parse undisputed facts
    const validParties: PartySource[] = ['claimant', 'respondent'];
    const undisputed: UndisputedFact[] = (parsed.undisputed || [])
      .map((item, index) => ({
        id: item.id || `agreed_${index + 1}`,
        fact: item.fact || '',
        agreedBy: Array.isArray(item.agreedBy)
          ? (item.agreedBy.filter((p) =>
              validParties.includes(p as PartySource)
            ) as PartySource[])
          : ['claimant'] as PartySource[],
        supportingEvidence: Array.isArray(item.supportingEvidence)
          ? item.supportingEvidence
          : undefined,
        materialityScore: Math.min(1, Math.max(0, item.materialityScore || 0.5)),
      }))
      .filter((u) => u.fact.length > 0);

    return { disputed, undisputed };
  } catch (error) {
    console.error('Failed to parse comparison response:', error);
    return { disputed: [], undisputed: [] };
  }
}

/**
 * Format disputed facts for use in prompts
 */
export function formatDisputedFactsForPrompt(disputed: DisputedFact[]): string {
  if (disputed.length === 0) {
    return 'No disputed facts identified.';
  }

  return disputed
    .map((d, i) => {
      return [
        `${i + 1}. ${d.topic}`,
        `   Claimant: ${d.claimantPosition}`,
        `   Respondent: ${d.respondentPosition}`,
        `   Materiality: ${(d.materialityScore * 100).toFixed(0)}%`,
        d.analysis ? `   Analysis: ${d.analysis}` : null,
      ]
        .filter(Boolean)
        .join('\n');
    })
    .join('\n\n');
}

/**
 * Format undisputed facts for use in prompts
 */
export function formatUndisputedFactsForPrompt(undisputed: UndisputedFact[]): string {
  if (undisputed.length === 0) {
    return 'No undisputed facts identified.';
  }

  return undisputed
    .map((u, i) => {
      return `${i + 1}. ${u.fact} (Agreed by: ${u.agreedBy.join(', ')})`;
    })
    .join('\n');
}

/**
 * Get high-materiality disputed facts
 */
export function getHighMaterialityDisputes(
  disputed: DisputedFact[],
  threshold: number = 0.7
): DisputedFact[] {
  return disputed
    .filter((d) => d.materialityScore >= threshold)
    .sort((a, b) => b.materialityScore - a.materialityScore);
}

/**
 * Calculate overall dispute score for the case
 * Higher score = more contentious case
 */
export function calculateDisputeScore(
  disputed: DisputedFact[],
  undisputed: UndisputedFact[]
): number {
  const totalFacts = disputed.length + undisputed.length;
  if (totalFacts === 0) return 0;

  // Weight by materiality
  const disputedWeight = disputed.reduce(
    (sum, d) => sum + d.materialityScore,
    0
  );
  const undisputedWeight = undisputed.reduce(
    (sum, u) => sum + u.materialityScore,
    0
  );

  const totalWeight = disputedWeight + undisputedWeight;
  if (totalWeight === 0) return 0;

  return disputedWeight / totalWeight;
}

/**
 * Estimate cost for fact comparison
 * Claude Sonnet: $3 per million input tokens, $15 per million output tokens
 */
export function estimateComparisonCost(
  claimantFactsCount: number,
  respondentFactsCount: number
): number {
  // Estimate tokens based on facts count
  const inputTokens = (claimantFactsCount + respondentFactsCount) * 150 + 1000;
  const outputTokens = 1024;

  const inputCost = (inputTokens / 1_000_000) * 3;
  const outputCost = (outputTokens / 1_000_000) * 15;

  return inputCost + outputCost;
}
