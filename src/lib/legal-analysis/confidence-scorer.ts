/**
 * Confidence Scorer
 *
 * Scores the overall confidence in legal analysis results
 * based on evidence quality, legal precedent, and other factors.
 */

import Anthropic from '@anthropic-ai/sdk';

import { buildConfidencePrompt, LEGAL_ANALYSIS_SYSTEM_PROMPT } from './prompts';

import type {
  BurdenOfProofResult,
  CitationUsage,
  ConfidenceFactors,
  ContradictionInput,
  DamagesCalculation,
  LegalIssue,
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
 * Score confidence in the legal analysis
 */
export async function scoreConfidence(params: {
  issues: LegalIssue[];
  burdenOfProof: BurdenOfProofResult;
  damagesCalculation: DamagesCalculation;
  contradictions: ContradictionInput[];
  citationsUsed: CitationUsage[];
  evidenceCount: number;
  credibilityDelta: number;
}): Promise<{
  overallConfidence: number;
  factors: ConfidenceFactors;
  tokensUsed: number;
}> {
  const {
    issues,
    burdenOfProof,
    damagesCalculation,
    contradictions,
    citationsUsed,
    evidenceCount,
    credibilityDelta,
  } = params;

  // Calculate metrics for prompt
  const elementsTotal = issues.reduce((sum, issue) => sum + issue.elements.length, 0);
  const elementsSatisfied = issues.reduce(
    (sum, issue) => sum + issue.elements.filter((e) => e.isSatisfied === true).length,
    0
  );

  const client = getAnthropicClient();

  const prompt = buildConfidencePrompt({
    issueCount: issues.length,
    elementsSatisfied,
    elementsTotal,
    evidenceCount,
    contradictionCount: contradictions.length,
    credibilityDelta,
    citationsUsed: citationsUsed.length,
    damagesSupported: damagesCalculation.supportedTotal,
    damagesClaimed: damagesCalculation.claimedTotal,
  });

  try {
    const response = await client.messages.create({
      model: 'claude-3-haiku-20240307', // Use Haiku for cost-effective scoring
      max_tokens: 1024,
      system: LEGAL_ANALYSIS_SYSTEM_PROMPT,
      messages: [
        {
          role: 'user',
          content: prompt,
        },
      ],
    });

    const responseText = response.content[0]?.type === 'text' ? response.content[0].text : '';

    const tokensUsed = (response.usage?.input_tokens || 0) + (response.usage?.output_tokens || 0);

    const result = parseConfidenceResponse(responseText);

    return { ...result, tokensUsed };
  } catch (error) {
    console.error('Confidence scoring failed:', error);

    // Calculate heuristic confidence
    const factors = calculateHeuristicFactors({
      issues,
      burdenOfProof,
      damagesCalculation,
      contradictions,
      citationsUsed,
      evidenceCount,
      credibilityDelta,
    });

    const overallConfidence = calculateOverallConfidence(factors);

    return { overallConfidence, factors, tokensUsed: 0 };
  }
}

/**
 * Parse the LLM confidence response
 */
function parseConfidenceResponse(responseText: string): {
  overallConfidence: number;
  factors: ConfidenceFactors;
} {
  try {
    const jsonMatch = responseText.match(/\{[\s\S]*\}/);
    if (!jsonMatch) {
      throw new Error('No JSON found in confidence response');
    }

    const parsed = JSON.parse(jsonMatch[0]) as {
      overallConfidence?: number;
      factors?: {
        evidenceQuality?: number;
        legalPrecedentStrength?: number;
        factualCertainty?: number;
        jurisdictionalClarity?: number;
        issueComplexity?: number;
      };
    };

    const factors: ConfidenceFactors = {
      evidenceQuality: clamp(parsed.factors?.evidenceQuality || 0.5),
      legalPrecedentStrength: clamp(parsed.factors?.legalPrecedentStrength || 0.5),
      factualCertainty: clamp(parsed.factors?.factualCertainty || 0.5),
      jurisdictionalClarity: clamp(parsed.factors?.jurisdictionalClarity || 0.5),
      issueComplexity: clamp(parsed.factors?.issueComplexity || 0.5),
    };

    const overallConfidence =
      parsed.overallConfidence !== undefined
        ? clamp(parsed.overallConfidence)
        : calculateOverallConfidence(factors);

    return { overallConfidence, factors };
  } catch (error) {
    console.error('Failed to parse confidence response:', error);
    return {
      overallConfidence: 0.5,
      factors: {
        evidenceQuality: 0.5,
        legalPrecedentStrength: 0.5,
        factualCertainty: 0.5,
        jurisdictionalClarity: 0.5,
        issueComplexity: 0.5,
      },
    };
  }
}

/**
 * Calculate heuristic confidence factors
 */
function calculateHeuristicFactors(params: {
  issues: LegalIssue[];
  burdenOfProof: BurdenOfProofResult;
  damagesCalculation: DamagesCalculation;
  contradictions: ContradictionInput[];
  citationsUsed: CitationUsage[];
  evidenceCount: number;
  credibilityDelta: number;
}): ConfidenceFactors {
  const {
    issues,
    burdenOfProof,
    damagesCalculation,
    contradictions,
    citationsUsed,
    evidenceCount,
    credibilityDelta: _credibilityDelta,
  } = params;

  // Evidence quality: based on count and damages support ratio
  const damagesRatio =
    damagesCalculation.claimedTotal > 0
      ? damagesCalculation.supportedTotal / damagesCalculation.claimedTotal
      : 0;
  const evidenceQuality = Math.min(1, (evidenceCount / 10) * 0.5 + damagesRatio * 0.5);

  // Legal precedent: based on citations used
  const legalPrecedentStrength = Math.min(1, citationsUsed.length / 15);

  // Factual certainty: reduced by contradictions, improved by burden analyses
  const contradictionPenalty = Math.min(0.3, contradictions.length * 0.05);
  const burdenBonus = burdenOfProof.overallBurdenMet ? 0.2 : 0;
  const avgBurdenProbability =
    burdenOfProof.analyses.length > 0
      ? burdenOfProof.analyses.reduce((sum, a) => sum + a.probability, 0) /
        burdenOfProof.analyses.length
      : 0.5;
  const factualCertainty = Math.max(0.2, avgBurdenProbability - contradictionPenalty + burdenBonus);

  // Jurisdictional clarity: California is well-defined
  const jurisdictionalClarity = 0.85;

  // Issue complexity: more issues = more complex
  const issueComplexity = Math.max(0.3, 1 - issues.length * 0.1);

  return {
    evidenceQuality: clamp(evidenceQuality),
    legalPrecedentStrength: clamp(legalPrecedentStrength),
    factualCertainty: clamp(factualCertainty),
    jurisdictionalClarity: clamp(jurisdictionalClarity),
    issueComplexity: clamp(issueComplexity),
  };
}

/**
 * Calculate overall confidence from factors
 */
function calculateOverallConfidence(factors: ConfidenceFactors): number {
  // Weighted average of factors
  const weights = {
    evidenceQuality: 0.25,
    legalPrecedentStrength: 0.15,
    factualCertainty: 0.3,
    jurisdictionalClarity: 0.15,
    issueComplexity: 0.15,
  };

  const weighted =
    factors.evidenceQuality * weights.evidenceQuality +
    factors.legalPrecedentStrength * weights.legalPrecedentStrength +
    factors.factualCertainty * weights.factualCertainty +
    factors.jurisdictionalClarity * weights.jurisdictionalClarity +
    factors.issueComplexity * weights.issueComplexity;

  return Math.round(weighted * 100) / 100;
}

/**
 * Clamp value between 0 and 1
 */
function clamp(value: number): number {
  return Math.max(0, Math.min(1, value));
}

/**
 * Get confidence level description
 */
export function getConfidenceLevel(confidence: number): {
  level: 'low' | 'moderate' | 'high' | 'very_high';
  description: string;
} {
  if (confidence >= 0.85) {
    return {
      level: 'very_high',
      description: 'Analysis is highly reliable with strong evidence and clear legal basis',
    };
  }
  if (confidence >= 0.7) {
    return {
      level: 'high',
      description: 'Analysis is reliable with good evidence support',
    };
  }
  if (confidence >= 0.5) {
    return {
      level: 'moderate',
      description: 'Analysis has reasonable support but some uncertainty exists',
    };
  }
  return {
    level: 'low',
    description: 'Analysis has significant uncertainty due to limited evidence or legal complexity',
  };
}

/**
 * Get factor-specific recommendations
 */
export function getConfidenceRecommendations(factors: ConfidenceFactors): string[] {
  const recommendations: string[] = [];

  if (factors.evidenceQuality < 0.5) {
    recommendations.push('Consider requesting additional documentary evidence to support claims');
  }

  if (factors.legalPrecedentStrength < 0.5) {
    recommendations.push('Review additional case law to strengthen legal analysis');
  }

  if (factors.factualCertainty < 0.5) {
    recommendations.push('Key facts are disputed; credibility determination is critical');
  }

  if (factors.issueComplexity < 0.4) {
    recommendations.push('Multiple complex legal issues present; consider phased analysis');
  }

  return recommendations;
}

/**
 * Track citations used in analysis
 */
export function trackCitation(
  citation: string,
  type: CitationUsage['type'],
  usedFor: string
): CitationUsage {
  // Normalize citation
  const normalized = citation.replace(/\s+/g, ' ').replace(/§\s+/, '§ ').trim();

  return {
    citation,
    normalized,
    type,
    usedFor,
    verified: false, // Would be verified against legal database
  };
}

/**
 * Aggregate citations from analysis
 */
export function aggregateCitations(
  issues: LegalIssue[],
  damagesCalculation: DamagesCalculation
): CitationUsage[] {
  const citations: CitationUsage[] = [];
  const seen = new Set<string>();

  // From issues
  for (const issue of issues) {
    for (const statute of issue.applicableStatutes) {
      if (!seen.has(statute)) {
        seen.add(statute);
        citations.push(trackCitation(statute, 'statute', `Issue: ${issue.category}`));
      }
    }
    for (const caseCite of issue.applicableCaseLaw) {
      if (!seen.has(caseCite)) {
        seen.add(caseCite);
        citations.push(trackCitation(caseCite, 'case_law', `Issue: ${issue.category}`));
      }
    }
  }

  // From damages
  for (const item of damagesCalculation.items) {
    if (item.basis && item.basis.includes('§') && !seen.has(item.basis)) {
      seen.add(item.basis);
      citations.push(trackCitation(item.basis, 'statute', `Damages: ${item.type}`));
    }
  }

  // From interest calculation
  if (
    damagesCalculation.interestCalculation?.statutoryBasis &&
    !seen.has(damagesCalculation.interestCalculation.statutoryBasis)
  ) {
    citations.push(
      trackCitation(
        damagesCalculation.interestCalculation.statutoryBasis,
        'statute',
        'Prejudgment interest'
      )
    );
  }

  return citations;
}
