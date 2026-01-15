/**
 * Credibility Scoring Module
 *
 * Assesses the credibility of each party's account based on
 * evidence support, consistency, specificity, and plausibility.
 */

import Anthropic from '@anthropic-ai/sdk';

import { formatContradictionsForPrompt } from './contradictions';
import { formatFactsForPrompt } from './fact-extraction';
import { buildCredibilityPrompt, FACT_ANALYSIS_SYSTEM_PROMPT } from './prompts';

import type {
  Contradiction,
  CredibilityFactors,
  CredibilityResult,
  EvidenceSummary,
  ExtractedFact,
  PartyCredibilityScore,
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
 * Assess credibility of both parties
 */
export async function assessCredibility(
  claimantStatement: string,
  respondentStatement: string,
  claimantFacts: ExtractedFact[],
  respondentFacts: ExtractedFact[],
  contradictions: Contradiction[],
  evidenceSummaries: EvidenceSummary[],
  caseContext: string
): Promise<CredibilityResult> {
  // If no respondent statement, provide limited assessment
  if (!respondentStatement || respondentStatement.trim().length < 50) {
    return createClaimantOnlyAssessment(
      claimantFacts,
      evidenceSummaries.filter((e) => e.submittedBy === 'claimant')
    );
  }

  const client = getAnthropicClient();

  const claimantFactsStr = formatFactsForPrompt(claimantFacts);
  const respondentFactsStr = formatFactsForPrompt(respondentFacts);
  const contradictionsStr = formatContradictionsForPrompt(contradictions);

  const truncatedClaimant = claimantStatement.slice(0, 6000);
  const truncatedRespondent = respondentStatement.slice(0, 6000);

  const prompt = buildCredibilityPrompt(
    truncatedClaimant,
    truncatedRespondent,
    claimantFactsStr,
    respondentFactsStr,
    contradictionsStr,
    evidenceSummaries,
    caseContext
  );

  try {
    // Use Sonnet for nuanced credibility assessment
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

    const result = parseCredibilityResponse(responseText);

    return {
      ...result,
      tokensUsed,
    };
  } catch (error) {
    console.error('Credibility assessment failed:', error);
    return createDefaultAssessment();
  }
}

/**
 * Create assessment when only claimant has submitted
 */
function createClaimantOnlyAssessment(
  claimantFacts: ExtractedFact[],
  claimantEvidence: EvidenceSummary[]
): CredibilityResult {
  // Calculate basic scores based on what we have
  const evidenceSupport = Math.min(1, claimantEvidence.length * 0.2);
  const specificity = calculateSpecificityScore(claimantFacts);

  const claimantScore: PartyCredibilityScore = {
    overall: (evidenceSupport + specificity + 0.5) / 3, // Conservative without comparison
    factors: {
      evidenceSupport,
      internalConsistency: 0.7, // Assumed without analysis
      externalConsistency: 0.5, // Cannot assess without respondent
      specificity,
      plausibility: 0.6, // Conservative
    },
    reasoning:
      'Limited assessment based on claimant submission only. Full credibility analysis requires respondent statement.',
    strengths: claimantEvidence.length > 0 ? ['Has supporting documentation'] : [],
    weaknesses: ['Respondent has not yet responded for comparison'],
  };

  return {
    claimant: claimantScore,
    respondent: {
      overall: 0,
      factors: {
        evidenceSupport: 0,
        internalConsistency: 0,
        externalConsistency: 0,
        specificity: 0,
        plausibility: 0,
      },
      reasoning: 'Respondent has not submitted a statement.',
      strengths: [],
      weaknesses: ['No statement submitted'],
    },
    comparison: 'Cannot compare parties until respondent submits statement.',
    tokensUsed: 0,
  };
}

/**
 * Create default assessment on error
 */
function createDefaultAssessment(): CredibilityResult {
  const defaultScore: PartyCredibilityScore = {
    overall: 0.5,
    factors: {
      evidenceSupport: 0.5,
      internalConsistency: 0.5,
      externalConsistency: 0.5,
      specificity: 0.5,
      plausibility: 0.5,
    },
    reasoning: 'Unable to complete credibility assessment.',
    strengths: [],
    weaknesses: [],
  };

  return {
    claimant: defaultScore,
    respondent: defaultScore,
    comparison: 'Credibility assessment could not be completed.',
    tokensUsed: 0,
  };
}

/**
 * Calculate specificity score from facts
 */
function calculateSpecificityScore(facts: ExtractedFact[]): number {
  if (facts.length === 0) return 0;

  let specificityPoints = 0;

  facts.forEach((fact) => {
    // Award points for specific details
    if (fact.date) specificityPoints += 0.2;
    if (fact.amount) specificityPoints += 0.2;
    if (fact.supportingEvidence?.length) specificityPoints += 0.3;
    if (fact.statement.length > 100) specificityPoints += 0.1;
  });

  // Average and normalize
  return Math.min(1, specificityPoints / facts.length);
}

/**
 * Parse credibility response from Claude
 */
function parseCredibilityResponse(
  responseText: string
): Omit<CredibilityResult, 'tokensUsed'> {
  try {
    let jsonStr = responseText.trim();
    if (jsonStr.startsWith('```')) {
      jsonStr = jsonStr.replace(/```json?\n?/, '').replace(/```$/, '').trim();
    }

    const parsed = JSON.parse(jsonStr) as {
      claimant?: {
        overall?: number;
        factors?: Partial<CredibilityFactors>;
        reasoning?: string;
        strengths?: string[];
        weaknesses?: string[];
      };
      respondent?: {
        overall?: number;
        factors?: Partial<CredibilityFactors>;
        reasoning?: string;
        strengths?: string[];
        weaknesses?: string[];
      };
      comparison?: string;
    };

    const parsePartyScore = (
      party: typeof parsed.claimant
    ): PartyCredibilityScore => {
      const factors: CredibilityFactors = {
        evidenceSupport: normalizeScore(party?.factors?.evidenceSupport),
        internalConsistency: normalizeScore(party?.factors?.internalConsistency),
        externalConsistency: normalizeScore(party?.factors?.externalConsistency),
        specificity: normalizeScore(party?.factors?.specificity),
        plausibility: normalizeScore(party?.factors?.plausibility),
      };

      // Calculate weighted overall if not provided
      const calculatedOverall =
        factors.evidenceSupport * 0.3 +
        factors.internalConsistency * 0.2 +
        factors.externalConsistency * 0.2 +
        factors.specificity * 0.15 +
        factors.plausibility * 0.15;

      return {
        overall: normalizeScore(party?.overall) || calculatedOverall,
        factors,
        reasoning: party?.reasoning || '',
        strengths: Array.isArray(party?.strengths) ? party.strengths : [],
        weaknesses: Array.isArray(party?.weaknesses) ? party.weaknesses : [],
      };
    };

    return {
      claimant: parsePartyScore(parsed.claimant),
      respondent: parsePartyScore(parsed.respondent),
      comparison: parsed.comparison || '',
    };
  } catch (error) {
    console.error('Failed to parse credibility response:', error);
    return createDefaultAssessment();
  }
}

/**
 * Normalize a score to 0-1 range
 */
function normalizeScore(value: unknown): number {
  if (typeof value !== 'number') return 0.5;
  return Math.min(1, Math.max(0, value));
}

/**
 * Calculate heuristic credibility adjustments
 * These are applied on top of Claude's assessment
 */
export function calculateCredibilityAdjustments(
  facts: ExtractedFact[],
  evidence: EvidenceSummary[],
  contradictions: Contradiction[]
): {
  evidenceBonus: number;
  contradictionPenalty: number;
  specificsBonus: number;
} {
  // Evidence bonus: more corroborating evidence = higher credibility
  const evidenceBonus = Math.min(0.1, evidence.length * 0.02);

  // Contradiction penalty: being on the wrong side of contradictions
  const majorContradictions = contradictions.filter(
    (c) => c.severity === 'major'
  ).length;
  const contradictionPenalty = Math.min(0.2, majorContradictions * 0.1);

  // Specifics bonus: more specific details = higher credibility
  const factsWithDates = facts.filter((f) => f.date).length;
  const factsWithAmounts = facts.filter((f) => f.amount).length;
  const specificsBonus = Math.min(
    0.1,
    (factsWithDates + factsWithAmounts) * 0.02
  );

  return {
    evidenceBonus,
    contradictionPenalty,
    specificsBonus,
  };
}

/**
 * Format credibility assessment for display
 */
export function formatCredibilityForDisplay(result: CredibilityResult): string {
  const formatParty = (name: string, score: PartyCredibilityScore): string => {
    const factors = Object.entries(score.factors)
      .map(([key, value]) => `  ${formatFactorName(key)}: ${(value * 100).toFixed(0)}%`)
      .join('\n');

    return [
      `${name}:`,
      `  Overall: ${(score.overall * 100).toFixed(0)}%`,
      factors,
      `  Strengths: ${score.strengths.join(', ') || 'None identified'}`,
      `  Weaknesses: ${score.weaknesses.join(', ') || 'None identified'}`,
    ].join('\n');
  };

  return [
    formatParty('Claimant', result.claimant),
    '',
    formatParty('Respondent', result.respondent),
    '',
    `Comparison: ${result.comparison}`,
  ].join('\n');
}

/**
 * Format factor name for display
 */
function formatFactorName(key: string): string {
  const names: Record<string, string> = {
    evidenceSupport: 'Evidence Support',
    internalConsistency: 'Internal Consistency',
    externalConsistency: 'External Consistency',
    specificity: 'Specificity',
    plausibility: 'Plausibility',
  };
  return names[key] || key;
}

/**
 * Determine which party has stronger credibility
 */
export function compareCredibility(
  result: CredibilityResult
): 'claimant' | 'respondent' | 'equal' {
  const diff = result.claimant.overall - result.respondent.overall;

  if (Math.abs(diff) < 0.1) return 'equal';
  return diff > 0 ? 'claimant' : 'respondent';
}

/**
 * Estimate cost for credibility assessment
 * Claude Sonnet: $3 per million input tokens, $15 per million output tokens
 */
export function estimateCredibilityCost(
  statementLengths: number,
  factsCount: number
): number {
  const inputTokens = statementLengths / 4 + factsCount * 100 + 2000;
  const outputTokens = 1024;

  const inputCost = (inputTokens / 1_000_000) * 3;
  const outputCost = (outputTokens / 1_000_000) * 15;

  return inputCost + outputCost;
}
