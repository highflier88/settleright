/**
 * Legal Issue Classifier
 *
 * Classifies legal issues from case facts and identifies
 * the elements that must be proven for each issue.
 */

import Anthropic from '@anthropic-ai/sdk';

import {
  buildIssueClassificationPrompt,
  CLRA_ELEMENTS,
  CONTRACT_ELEMENTS,
  FRAUD_ELEMENTS,
  LEGAL_ANALYSIS_SYSTEM_PROMPT,
} from './prompts';
import { getApplicableStatutes } from './rules';

import type {
  DisputedFactInput,
  IssueClassificationResult,
  LegalElement,
  LegalIssue,
  LegalIssueCategory,
  UndisputedFactInput,
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
 * Get default elements for an issue category
 */
function getDefaultElements(category: LegalIssueCategory): LegalElement[] {
  let baseElements: Array<{ name: string; description: string }>;

  switch (category) {
    case 'breach_of_contract':
      baseElements = CONTRACT_ELEMENTS;
      break;
    case 'fraud':
      baseElements = FRAUD_ELEMENTS;
      break;
    case 'consumer_protection':
      baseElements = CLRA_ELEMENTS;
      break;
    case 'warranty':
      baseElements = [
        { name: 'Warranty Existed', description: 'Express or implied warranty was made' },
        { name: 'Breach of Warranty', description: 'The product/service failed to meet the warranty' },
        { name: 'Notice', description: 'Claimant provided timely notice of breach' },
        { name: 'Damages', description: 'Claimant suffered damages from the breach' },
      ];
      break;
    case 'negligence':
      baseElements = [
        { name: 'Duty of Care', description: 'Respondent owed a duty of care to claimant' },
        { name: 'Breach of Duty', description: 'Respondent breached that duty' },
        { name: 'Causation', description: 'Breach caused claimant\'s harm' },
        { name: 'Damages', description: 'Claimant suffered damages' },
      ];
      break;
    case 'unjust_enrichment':
      baseElements = [
        { name: 'Benefit Conferred', description: 'Claimant conferred a benefit on respondent' },
        { name: 'Knowledge', description: 'Respondent knew of the benefit' },
        { name: 'Retention Unjust', description: 'Retention of benefit without payment is unjust' },
      ];
      break;
    default:
      baseElements = [
        { name: 'Liability', description: 'Respondent is legally liable' },
        { name: 'Damages', description: 'Claimant suffered damages' },
      ];
  }

  return baseElements.map((elem, index) => ({
    id: `elem-${index + 1}`,
    name: elem.name,
    description: elem.description,
    isSatisfied: null,
    supportingFacts: [],
    opposingFacts: [],
    analysis: '',
    confidence: 0,
  }));
}

/**
 * Classify legal issues from case facts
 */
export async function classifyLegalIssues(params: {
  caseDescription: string;
  disputeType: string;
  claimedAmount: number;
  disputedFacts: DisputedFactInput[];
  undisputedFacts: UndisputedFactInput[];
  jurisdiction: string;
  legalContext?: string;
}): Promise<IssueClassificationResult> {
  const {
    caseDescription,
    disputeType,
    claimedAmount,
    disputedFacts,
    undisputedFacts,
    jurisdiction,
    legalContext,
  } = params;

  const client = getAnthropicClient();

  const prompt = buildIssueClassificationPrompt({
    caseDescription: caseDescription.slice(0, 3000),
    disputeType,
    claimedAmount,
    disputedFacts: disputedFacts.slice(0, 10).map((f) => ({
      topic: f.topic,
      claimantPosition: f.claimantPosition,
      respondentPosition: f.respondentPosition,
      materialityScore: f.materialityScore,
    })),
    undisputedFacts: undisputedFacts.slice(0, 10).map((f) => ({
      fact: f.fact,
      materialityScore: f.materialityScore,
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

    const responseText =
      response.content[0]?.type === 'text' ? response.content[0].text : '';

    const tokensUsed =
      (response.usage?.input_tokens || 0) + (response.usage?.output_tokens || 0);

    const issues = parseIssueClassificationResponse(
      responseText,
      disputeType,
      jurisdiction
    );

    return { issues, tokensUsed };
  } catch (error) {
    console.error('Issue classification failed:', error);

    // Return default issues based on dispute type
    const issues = getDefaultIssues(disputeType, jurisdiction);
    return { issues, tokensUsed: 0 };
  }
}

/**
 * Parse the LLM response into legal issues
 */
function parseIssueClassificationResponse(
  responseText: string,
  disputeType: string,
  jurisdiction: string
): LegalIssue[] {
  try {
    // Extract JSON from response
    const jsonMatch = responseText.match(/\{[\s\S]*\}/);
    if (!jsonMatch) {
      console.warn('No JSON found in issue classification response');
      return getDefaultIssues(disputeType, jurisdiction);
    }

    const parsed = JSON.parse(jsonMatch[0]) as {
      issues?: Array<{
        id?: string;
        category?: string;
        description?: string;
        elements?: Array<{
          id?: string;
          name?: string;
          description?: string;
          isSatisfied?: boolean | null;
          supportingFacts?: string[];
          opposingFacts?: string[];
          analysis?: string;
          confidence?: number;
        }>;
        applicableStatutes?: string[];
        applicableCaseLaw?: string[];
        materialityScore?: number;
        analysisNotes?: string;
      }>;
    };

    if (!parsed.issues || !Array.isArray(parsed.issues)) {
      return getDefaultIssues(disputeType, jurisdiction);
    }

    return parsed.issues.map((issue, index) => {
      const category = validateCategory(issue.category);

      // Use provided elements or default ones
      let elements: LegalElement[];
      if (issue.elements && Array.isArray(issue.elements) && issue.elements.length > 0) {
        elements = issue.elements.map((elem, elemIndex) => ({
          id: elem.id || `elem-${elemIndex + 1}`,
          name: elem.name || `Element ${elemIndex + 1}`,
          description: elem.description || '',
          isSatisfied: elem.isSatisfied ?? null,
          supportingFacts: elem.supportingFacts || [],
          opposingFacts: elem.opposingFacts || [],
          analysis: elem.analysis || '',
          confidence: Math.max(0, Math.min(1, elem.confidence || 0)),
        }));
      } else {
        elements = getDefaultElements(category);
      }

      // Supplement with jurisdiction-specific statutes
      const statutes = issue.applicableStatutes || [];
      const jurisdictionStatutes = getApplicableStatutes(
        jurisdiction,
        disputeType,
        [category]
      );
      const allStatutes = [...new Set([...statutes, ...jurisdictionStatutes])];

      return {
        id: issue.id || `issue-${index + 1}`,
        category,
        description: issue.description || `${category} issue`,
        elements,
        applicableStatutes: allStatutes,
        applicableCaseLaw: issue.applicableCaseLaw || [],
        materialityScore: Math.max(0, Math.min(1, issue.materialityScore || 0.5)),
        analysisNotes: issue.analysisNotes,
      };
    });
  } catch (error) {
    console.error('Failed to parse issue classification response:', error);
    return getDefaultIssues(disputeType, jurisdiction);
  }
}

/**
 * Validate and normalize issue category
 */
function validateCategory(category?: string): LegalIssueCategory {
  const validCategories: LegalIssueCategory[] = [
    'breach_of_contract',
    'consumer_protection',
    'warranty',
    'fraud',
    'negligence',
    'unjust_enrichment',
    'statutory_violation',
    'payment_dispute',
    'service_dispute',
    'property_damage',
  ];

  const normalized = category?.toLowerCase().replace(/\s+/g, '_');
  if (normalized && validCategories.includes(normalized as LegalIssueCategory)) {
    return normalized as LegalIssueCategory;
  }

  return 'breach_of_contract';
}

/**
 * Get default issues based on dispute type
 */
function getDefaultIssues(
  disputeType: string,
  jurisdiction: string
): LegalIssue[] {
  const issues: LegalIssue[] = [];
  const type = disputeType.toUpperCase();

  // Primary issue based on dispute type
  if (type === 'CONTRACT' || type === 'SERVICE' || type === 'GOODS') {
    issues.push({
      id: 'issue-1',
      category: 'breach_of_contract',
      description: 'Whether respondent breached the contract with claimant',
      elements: getDefaultElements('breach_of_contract'),
      applicableStatutes: getApplicableStatutes(jurisdiction, disputeType, ['breach_of_contract']),
      applicableCaseLaw: [],
      materialityScore: 0.9,
    });
  }

  // Add consumer protection for service/goods disputes
  if (type === 'SERVICE' || type === 'GOODS') {
    issues.push({
      id: 'issue-2',
      category: 'consumer_protection',
      description: 'Whether respondent violated consumer protection statutes',
      elements: getDefaultElements('consumer_protection'),
      applicableStatutes: getApplicableStatutes(jurisdiction, disputeType, ['consumer_protection']),
      applicableCaseLaw: [],
      materialityScore: 0.7,
    });
  }

  // Payment dispute
  if (type === 'PAYMENT') {
    issues.push({
      id: 'issue-1',
      category: 'payment_dispute',
      description: 'Whether respondent owes claimant the disputed payment amount',
      elements: getDefaultElements('payment_dispute'),
      applicableStatutes: getApplicableStatutes(jurisdiction, disputeType, ['payment_dispute']),
      applicableCaseLaw: [],
      materialityScore: 0.9,
    });
  }

  // Property dispute
  if (type === 'PROPERTY') {
    issues.push({
      id: 'issue-1',
      category: 'property_damage',
      description: 'Whether respondent is liable for property damage',
      elements: getDefaultElements('property_damage'),
      applicableStatutes: getApplicableStatutes(jurisdiction, disputeType, ['property_damage']),
      applicableCaseLaw: [],
      materialityScore: 0.9,
    });
  }

  // Ensure at least one issue
  if (issues.length === 0) {
    issues.push({
      id: 'issue-1',
      category: 'breach_of_contract',
      description: 'Primary legal issue in dispute',
      elements: getDefaultElements('breach_of_contract'),
      applicableStatutes: getApplicableStatutes(jurisdiction, disputeType, []),
      applicableCaseLaw: [],
      materialityScore: 0.8,
    });
  }

  return issues;
}
