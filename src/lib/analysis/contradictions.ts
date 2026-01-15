/**
 * Contradiction Detection Module
 *
 * Identifies and analyzes contradictions between party statements.
 * Uses Claude Sonnet for nuanced reasoning about conflicts.
 */

import Anthropic from '@anthropic-ai/sdk';

import { formatDisputedFactsForPrompt } from './fact-comparison';
import { buildContradictionPrompt, FACT_ANALYSIS_SYSTEM_PROMPT } from './prompts';

import type {
  Contradiction,
  ContradictionResult,
  ContradictionSeverity,
  DisputedFact,
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
 * Detect contradictions between parties
 */
export async function detectContradictions(
  disputedFacts: DisputedFact[],
  claimantStatement: string,
  respondentStatement: string,
  caseContext: string
): Promise<ContradictionResult> {
  // Can't detect contradictions without both statements
  if (!respondentStatement || respondentStatement.trim().length < 50) {
    return {
      contradictions: [],
      summary: 'Cannot analyze contradictions without respondent statement.',
      tokensUsed: 0,
    };
  }

  // If no disputed facts, there may still be subtle contradictions
  if (disputedFacts.length === 0) {
    return {
      contradictions: [],
      summary: 'No disputed facts identified between parties.',
      tokensUsed: 0,
    };
  }

  const client = getAnthropicClient();

  const disputedFactsStr = formatDisputedFactsForPrompt(disputedFacts);
  const truncatedClaimant = claimantStatement.slice(0, 8000);
  const truncatedRespondent = respondentStatement.slice(0, 8000);

  const prompt = buildContradictionPrompt(
    disputedFactsStr,
    truncatedClaimant,
    truncatedRespondent,
    caseContext
  );

  try {
    // Use Sonnet for nuanced contradiction analysis
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

    const responseText = response.content[0]?.type === 'text' ? response.content[0].text : '';

    const tokensUsed = (response.usage?.input_tokens || 0) + (response.usage?.output_tokens || 0);

    const result = parseContradictionResponse(responseText);

    return {
      ...result,
      tokensUsed,
    };
  } catch (error) {
    console.error('Contradiction detection failed:', error);
    return {
      contradictions: [],
      summary: 'Contradiction analysis failed due to an error.',
      tokensUsed: 0,
    };
  }
}

/**
 * Parse contradiction response from Claude
 */
function parseContradictionResponse(responseText: string): Omit<ContradictionResult, 'tokensUsed'> {
  try {
    let jsonStr = responseText.trim();
    if (jsonStr.startsWith('```')) {
      jsonStr = jsonStr
        .replace(/```json?\n?/, '')
        .replace(/```$/, '')
        .trim();
    }

    const parsed = JSON.parse(jsonStr) as {
      contradictions?: Array<{
        id?: string;
        topic?: string;
        claimantClaim?: string;
        respondentClaim?: string;
        severity?: string;
        analysis?: string;
        relatedFactIds?: string[];
        caseImpact?: string;
      }>;
      summary?: string;
    };

    const validSeverities: ContradictionSeverity[] = ['minor', 'moderate', 'major'];

    const contradictions: Contradiction[] = (parsed.contradictions || [])
      .map((item, index) => {
        const severity = validSeverities.includes(item.severity as ContradictionSeverity)
          ? (item.severity as ContradictionSeverity)
          : 'moderate';

        return {
          id: item.id || `contradiction_${index + 1}`,
          topic: item.topic || '',
          claimantClaim: item.claimantClaim || '',
          respondentClaim: item.respondentClaim || '',
          severity,
          analysis: item.analysis || '',
          relatedFactIds: Array.isArray(item.relatedFactIds) ? item.relatedFactIds : undefined,
          caseImpact: item.caseImpact,
        };
      })
      .filter(
        (c) => c.topic.length > 0 && c.claimantClaim.length > 0 && c.respondentClaim.length > 0
      );

    return {
      contradictions,
      summary: parsed.summary || generateSummary(contradictions),
    };
  } catch (error) {
    console.error('Failed to parse contradiction response:', error);
    return {
      contradictions: [],
      summary: 'Failed to parse contradiction analysis.',
    };
  }
}

/**
 * Generate a summary from contradictions
 */
function generateSummary(contradictions: Contradiction[]): string {
  if (contradictions.length === 0) {
    return 'No direct contradictions identified between the parties.';
  }

  const majorCount = contradictions.filter((c) => c.severity === 'major').length;
  const moderateCount = contradictions.filter((c) => c.severity === 'moderate').length;
  const minorCount = contradictions.filter((c) => c.severity === 'minor').length;

  const parts = [];

  if (majorCount > 0) {
    parts.push(`${majorCount} major contradiction${majorCount > 1 ? 's' : ''}`);
  }
  if (moderateCount > 0) {
    parts.push(`${moderateCount} moderate contradiction${moderateCount > 1 ? 's' : ''}`);
  }
  if (minorCount > 0) {
    parts.push(`${minorCount} minor contradiction${minorCount > 1 ? 's' : ''}`);
  }

  return `Identified ${parts.join(', ')} between the parties' accounts.`;
}

/**
 * Get contradictions by severity
 */
export function getContradictionsBySeverity(
  contradictions: Contradiction[],
  severity: ContradictionSeverity
): Contradiction[] {
  return contradictions.filter((c) => c.severity === severity);
}

/**
 * Get major contradictions that are most likely to affect case outcome
 */
export function getMajorContradictions(contradictions: Contradiction[]): Contradiction[] {
  return contradictions.filter((c) => c.severity === 'major');
}

/**
 * Calculate contradiction score for credibility assessment
 * Returns 0-1 where higher = more contradictions/issues
 */
export function calculateContradictionScore(contradictions: Contradiction[]): number {
  if (contradictions.length === 0) return 0;

  // Weight by severity
  const weights: Record<ContradictionSeverity, number> = {
    major: 1.0,
    moderate: 0.5,
    minor: 0.2,
  };

  const totalWeight = contradictions.reduce((sum, c) => sum + weights[c.severity], 0);

  // Normalize to 0-1 (assume max 5 major contradictions = 1.0)
  return Math.min(1, totalWeight / 5);
}

/**
 * Format contradictions for display or further analysis
 */
export function formatContradictionsForPrompt(contradictions: Contradiction[]): string {
  if (contradictions.length === 0) {
    return 'No contradictions identified.';
  }

  return contradictions
    .map((c, i) => {
      return [
        `${i + 1}. [${c.severity.toUpperCase()}] ${c.topic}`,
        `   Claimant says: ${c.claimantClaim}`,
        `   Respondent says: ${c.respondentClaim}`,
        `   Analysis: ${c.analysis}`,
        c.caseImpact ? `   Case Impact: ${c.caseImpact}` : null,
      ]
        .filter(Boolean)
        .join('\n');
    })
    .join('\n\n');
}

/**
 * Analyze pattern of contradictions
 */
export function analyzeContradictionPattern(contradictions: Contradiction[]): {
  dominantSeverity: ContradictionSeverity;
  topicsCovered: string[];
  overallAssessment: string;
} {
  if (contradictions.length === 0) {
    return {
      dominantSeverity: 'minor',
      topicsCovered: [],
      overallAssessment: 'No significant contradictions between parties.',
    };
  }

  // Find dominant severity
  const severityCounts: Record<ContradictionSeverity, number> = {
    major: 0,
    moderate: 0,
    minor: 0,
  };
  contradictions.forEach((c) => severityCounts[c.severity]++);

  let dominantSeverity: ContradictionSeverity = 'minor';
  if (severityCounts.major > 0) {
    dominantSeverity = 'major';
  } else if (severityCounts.moderate > 0) {
    dominantSeverity = 'moderate';
  }

  // Extract topics
  const topicsCovered = [...new Set(contradictions.map((c) => c.topic))];

  // Generate assessment
  let overallAssessment: string;
  if (severityCounts.major >= 2) {
    overallAssessment =
      'The parties have fundamentally different accounts of key events. Credibility assessment will be critical.';
  } else if (severityCounts.major === 1) {
    overallAssessment =
      'One major contradiction exists between the parties. This will be a key issue to resolve.';
  } else if (severityCounts.moderate >= 2) {
    overallAssessment =
      'Several moderate contradictions exist. Documentary evidence will help resolve these disputes.';
  } else {
    overallAssessment =
      'Contradictions are relatively minor. The parties largely agree on the main facts.';
  }

  return {
    dominantSeverity,
    topicsCovered,
    overallAssessment,
  };
}

/**
 * Estimate cost for contradiction detection
 * Claude Sonnet: $3 per million input tokens, $15 per million output tokens
 */
export function estimateContradictionCost(
  disputedFactsCount: number,
  statementLength: number
): number {
  const inputTokens = (disputedFactsCount * 200 + statementLength * 2) / 4 + 1000;
  const outputTokens = 1024;

  const inputCost = (inputTokens / 1_000_000) * 3;
  const outputCost = (outputTokens / 1_000_000) * 15;

  return inputCost + outputCost;
}
