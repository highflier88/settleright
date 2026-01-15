/**
 * Burden of Proof Analyzer
 *
 * Analyzes whether parties have met their burden of proof
 * for each legal element considering evidence and credibility.
 */

import Anthropic from '@anthropic-ai/sdk';

import { buildBurdenAnalysisPrompt, LEGAL_ANALYSIS_SYSTEM_PROMPT } from './prompts';
import { getBurdenStandard } from './rules';

import type {
  BurdenAnalysis,
  BurdenOfProofResult,
  BurdenOfProofStandard,
  ContradictionInput,
  CredibilityInput,
  ExtractedFactInput,
  LegalIssue,
  ShiftingBurden,
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
 * Analyze burden of proof for all legal issues
 */
export async function analyzeBurdenOfProof(params: {
  issues: LegalIssue[];
  extractedFacts: {
    claimant: ExtractedFactInput[];
    respondent: ExtractedFactInput[];
  };
  credibilityScores: CredibilityInput;
  contradictions: ContradictionInput[];
  jurisdiction: string;
  legalContext?: string;
}): Promise<BurdenOfProofResult> {
  const { issues, extractedFacts, credibilityScores, contradictions, jurisdiction, legalContext } =
    params;

  const client = getAnthropicClient();

  const prompt = buildBurdenAnalysisPrompt({
    issues: issues.map((issue) => ({
      id: issue.id,
      category: issue.category,
      description: issue.description,
      elements: issue.elements.map((elem) => ({
        id: elem.id,
        name: elem.name,
        description: elem.description,
      })),
    })),
    extractedFacts: {
      claimant: extractedFacts.claimant.slice(0, 15).map((f) => ({
        id: f.id,
        statement: f.statement,
        confidence: f.confidence,
      })),
      respondent: extractedFacts.respondent.slice(0, 15).map((f) => ({
        id: f.id,
        statement: f.statement,
        confidence: f.confidence,
      })),
    },
    credibilityScores,
    contradictions: contradictions.slice(0, 10).map((c) => ({
      topic: c.topic,
      severity: c.severity,
      analysis: c.analysis,
    })),
    legalContext,
  });

  try {
    const response = await client.messages.create({
      model: 'claude-sonnet-4-20250514',
      max_tokens: 4096,
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

    const result = parseBurdenAnalysisResponse(responseText, issues, jurisdiction);

    return { ...result, tokensUsed };
  } catch (error) {
    console.error('Burden analysis failed:', error);

    // Return default analysis
    return getDefaultBurdenAnalysis(issues, credibilityScores, jurisdiction);
  }
}

/**
 * Parse the LLM response into burden analysis result
 */
function parseBurdenAnalysisResponse(
  responseText: string,
  issues: LegalIssue[],
  jurisdiction: string
): BurdenOfProofResult {
  try {
    const jsonMatch = responseText.match(/\{[\s\S]*\}/);
    if (!jsonMatch) {
      console.warn('No JSON found in burden analysis response');
      return getDefaultBurdenAnalysis(
        issues,
        { claimant: { overall: 0.5 }, respondent: { overall: 0.5 } },
        jurisdiction
      );
    }

    const parsed = JSON.parse(jsonMatch[0]) as {
      overallBurdenMet?: boolean;
      analyses?: Array<{
        party?: string;
        standard?: string;
        issue?: string;
        isMet?: boolean | null;
        probability?: number;
        reasoning?: string;
        keyEvidence?: string[];
        weaknesses?: string[];
      }>;
      shiftingBurdens?: Array<{
        fromParty?: string;
        toParty?: string;
        trigger?: string;
        newBurden?: string;
      }>;
      summary?: string;
    };

    const analyses: BurdenAnalysis[] = (parsed.analyses || []).map((analysis) => ({
      party: validateParty(analysis.party),
      standard: validateStandard(analysis.standard),
      issue: analysis.issue || '',
      isMet: analysis.isMet ?? null,
      probability: Math.max(0, Math.min(1, analysis.probability || 0.5)),
      reasoning: analysis.reasoning || '',
      keyEvidence: analysis.keyEvidence || [],
      weaknesses: analysis.weaknesses || [],
    }));

    const shiftingBurdens: ShiftingBurden[] = (parsed.shiftingBurdens || [])
      .filter((sb) => sb.fromParty && sb.toParty)
      .map((sb) => ({
        fromParty: validateParty(sb.fromParty),
        toParty: validateParty(sb.toParty),
        trigger: sb.trigger || '',
        newBurden: sb.newBurden || '',
      }));

    // Calculate overall burden met based on analyses
    const overallBurdenMet =
      parsed.overallBurdenMet ??
      analyses.filter((a) => a.party === 'claimant').every((a) => a.isMet === true);

    return {
      overallBurdenMet,
      analyses,
      shiftingBurdens: shiftingBurdens.length > 0 ? shiftingBurdens : undefined,
      summary: parsed.summary || generateSummary(analyses, overallBurdenMet),
    };
  } catch (error) {
    console.error('Failed to parse burden analysis response:', error);
    return getDefaultBurdenAnalysis(
      issues,
      { claimant: { overall: 0.5 }, respondent: { overall: 0.5 } },
      jurisdiction
    );
  }
}

/**
 * Validate party value
 */
function validateParty(party?: string): 'claimant' | 'respondent' {
  if (party?.toLowerCase() === 'respondent') {
    return 'respondent';
  }
  return 'claimant';
}

/**
 * Validate burden standard
 */
function validateStandard(standard?: string): BurdenOfProofStandard {
  const normalized = standard?.toLowerCase().replace(/\s+/g, '_');
  if (normalized === 'clear_and_convincing') {
    return 'clear_and_convincing';
  }
  if (normalized === 'beyond_reasonable_doubt') {
    return 'beyond_reasonable_doubt';
  }
  return 'preponderance';
}

/**
 * Generate summary from analyses
 */
function generateSummary(analyses: BurdenAnalysis[], overallBurdenMet: boolean): string {
  const claimantAnalyses = analyses.filter((a) => a.party === 'claimant');
  const metCount = claimantAnalyses.filter((a) => a.isMet === true).length;
  const totalCount = claimantAnalyses.length;

  if (overallBurdenMet) {
    return `Claimant has met the burden of proof on ${metCount} of ${totalCount} analyzed elements. The preponderance of evidence supports claimant's claims.`;
  } else {
    return `Claimant has not fully met the burden of proof. Only ${metCount} of ${totalCount} elements were sufficiently proven.`;
  }
}

/**
 * Get default burden analysis when LLM fails
 */
function getDefaultBurdenAnalysis(
  issues: LegalIssue[],
  credibilityScores: CredibilityInput,
  jurisdiction: string
): BurdenOfProofResult {
  const analyses: BurdenAnalysis[] = [];

  // Analyze each issue's elements
  for (const issue of issues) {
    const standard = getBurdenStandard(jurisdiction, issue.category);

    for (const element of issue.elements) {
      // Use credibility as a rough proxy for probability
      const probability = credibilityScores.claimant.overall;

      // Determine if met based on standard
      let isMet: boolean | null = null;
      if (standard === 'preponderance') {
        isMet = probability > 0.5;
      } else if (standard === 'clear_and_convincing') {
        isMet = probability > 0.75;
      }

      analyses.push({
        party: 'claimant',
        standard,
        issue: `${issue.description} - ${element.name}`,
        isMet,
        probability,
        reasoning: 'Analysis based on available evidence and credibility scores.',
        keyEvidence: [],
        weaknesses: isMet ? [] : ['Insufficient evidence to meet burden of proof'],
      });
    }
  }

  const overallBurdenMet = analyses.every((a) => a.isMet === true);

  return {
    overallBurdenMet,
    analyses,
    summary: generateSummary(analyses, overallBurdenMet),
  };
}

/**
 * Check if a specific element's burden is met
 */
export function isElementBurdenMet(elementId: string, analyses: BurdenAnalysis[]): boolean | null {
  const analysis = analyses.find(
    (a) => a.issue.includes(elementId) || a.keyEvidence.includes(elementId)
  );
  return analysis?.isMet ?? null;
}

/**
 * Get the applicable burden standard for an issue
 */
export function getApplicableBurdenStandard(
  issueCategory: string,
  jurisdiction: string
): { standard: BurdenOfProofStandard; description: string } {
  const standard = getBurdenStandard(jurisdiction, issueCategory);

  const descriptions: Record<BurdenOfProofStandard, string> = {
    preponderance: 'More likely than not (greater than 50% probability)',
    clear_and_convincing:
      'Highly probable, substantially more likely than not (approximately 75%+)',
    beyond_reasonable_doubt: 'No reasonable doubt (approximately 95%+, typically criminal only)',
  };

  return {
    standard,
    description: descriptions[standard],
  };
}

/**
 * Summarize burden analysis for a specific party
 */
export function summarizePartyBurden(
  party: 'claimant' | 'respondent',
  analyses: BurdenAnalysis[]
): {
  totalElements: number;
  elementsMet: number;
  elementsNotMet: number;
  elementsUnknown: number;
  averageProbability: number;
} {
  const partyAnalyses = analyses.filter((a) => a.party === party);

  const elementsMet = partyAnalyses.filter((a) => a.isMet === true).length;
  const elementsNotMet = partyAnalyses.filter((a) => a.isMet === false).length;
  const elementsUnknown = partyAnalyses.filter((a) => a.isMet === null).length;

  const avgProbability =
    partyAnalyses.length > 0
      ? partyAnalyses.reduce((sum, a) => sum + a.probability, 0) / partyAnalyses.length
      : 0;

  return {
    totalElements: partyAnalyses.length,
    elementsMet,
    elementsNotMet,
    elementsUnknown,
    averageProbability: Math.round(avgProbability * 100) / 100,
  };
}
