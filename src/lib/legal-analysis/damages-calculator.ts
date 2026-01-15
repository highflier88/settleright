/**
 * Damages Calculator
 *
 * Calculates damages based on evidence and applies
 * jurisdiction-specific rules for interest and caps.
 */

import Anthropic from '@anthropic-ai/sdk';

import { buildDamagesPrompt, LEGAL_ANALYSIS_SYSTEM_PROMPT } from './prompts';
import { calculateInterest, getDamagesCaps, getSpecialRules } from './rules';

import type {
  DamagesAdjustment,
  DamagesCalculation,
  DamagesItem,
  DamagesType,
  ExtractedFactInput,
  InterestCalculation,
  LegalEvidenceSummary,
  MitigationAnalysis,
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
 * Calculate damages for a case
 */
export async function calculateDamages(params: {
  claimedAmount: number;
  damagesClaimed: Array<{
    description: string;
    amount: number;
    category?: string;
  }>;
  extractedFacts: {
    claimant: ExtractedFactInput[];
    respondent: ExtractedFactInput[];
  };
  evidenceSummaries: LegalEvidenceSummary[];
  jurisdiction: string;
  isContractClaim: boolean;
  breachDate?: string;
  legalContext?: string;
}): Promise<DamagesCalculation> {
  const {
    claimedAmount,
    damagesClaimed,
    extractedFacts,
    evidenceSummaries,
    jurisdiction,
    isContractClaim,
    breachDate,
    legalContext,
  } = params;

  const client = getAnthropicClient();

  const prompt = buildDamagesPrompt({
    claimedAmount,
    damagesClaimed,
    extractedFacts: {
      claimant: extractedFacts.claimant.slice(0, 20).map((f) => ({
        id: f.id,
        statement: f.statement,
        amount: f.amount,
      })),
      respondent: extractedFacts.respondent.slice(0, 20).map((f) => ({
        id: f.id,
        statement: f.statement,
        amount: f.amount,
      })),
    },
    evidenceSummaries: evidenceSummaries.slice(0, 10).map((e) => ({
      id: e.id,
      fileName: e.fileName,
      summary: e.summary,
      submittedBy: e.submittedBy,
    })),
    jurisdiction,
    isContractClaim,
    breachDate,
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

    const result = parseDamagesResponse(
      responseText,
      claimedAmount,
      jurisdiction,
      isContractClaim,
      breachDate
    );

    return { ...result, tokensUsed };
  } catch (error) {
    console.error('Damages calculation failed:', error);

    return getDefaultDamagesCalculation(
      claimedAmount,
      damagesClaimed,
      jurisdiction,
      isContractClaim,
      breachDate
    );
  }
}

/**
 * Parse the LLM response into damages calculation
 */
function parseDamagesResponse(
  responseText: string,
  claimedAmount: number,
  jurisdiction: string,
  isContractClaim: boolean,
  breachDate?: string
): DamagesCalculation {
  try {
    const jsonMatch = responseText.match(/\{[\s\S]*\}/);
    if (!jsonMatch) {
      console.warn('No JSON found in damages response');
      return getDefaultDamagesCalculation(
        claimedAmount,
        [],
        jurisdiction,
        isContractClaim,
        breachDate
      );
    }

    const parsed = JSON.parse(jsonMatch[0]) as {
      claimedTotal?: number;
      supportedTotal?: number;
      recommendedTotal?: number;
      items?: Array<{
        id?: string;
        type?: string;
        description?: string;
        claimedAmount?: number;
        supportedAmount?: number;
        calculatedAmount?: number;
        basis?: string;
        evidenceSupport?: string[];
        adjustments?: Array<{
          type?: string;
          description?: string;
          amount?: number;
          legalBasis?: string;
        }>;
        confidence?: number;
      }>;
      mitigation?: {
        didClaimantMitigate?: boolean;
        mitigationEfforts?: string[];
        failureToMitigate?: string | null;
        reduction?: number;
      };
      interestCalculation?: {
        principal?: number;
        rate?: number;
        startDate?: string;
        endDate?: string;
        days?: number;
        interestAmount?: number;
        statutoryBasis?: string;
      };
      summary?: string;
    };

    // Parse items
    const items: DamagesItem[] = (parsed.items || []).map((item, index) => ({
      id: item.id || `dmg-${index + 1}`,
      type: validateDamagesType(item.type),
      description: item.description || '',
      claimedAmount: item.claimedAmount || 0,
      supportedAmount: item.supportedAmount || 0,
      calculatedAmount: item.calculatedAmount || 0,
      basis: item.basis || '',
      evidenceSupport: item.evidenceSupport || [],
      adjustments: (item.adjustments || []).map((adj) => ({
        type: validateAdjustmentType(adj.type),
        description: adj.description || '',
        amount: adj.amount || 0,
        legalBasis: adj.legalBasis,
      })),
      confidence: Math.max(0, Math.min(1, item.confidence || 0.5)),
    }));

    // Parse mitigation
    const mitigation: MitigationAnalysis = parsed.mitigation
      ? {
          didClaimantMitigate: parsed.mitigation.didClaimantMitigate ?? true,
          mitigationEfforts: parsed.mitigation.mitigationEfforts || [],
          failureToMitigate: parsed.mitigation.failureToMitigate || undefined,
          reduction: parsed.mitigation.reduction || 0,
        }
      : {
          didClaimantMitigate: true,
          mitigationEfforts: [],
          reduction: 0,
        };

    // Calculate or use provided interest
    let interestCalculation: InterestCalculation | undefined;
    if (parsed.interestCalculation && parsed.interestCalculation.interestAmount) {
      const startDateValue = (parsed.interestCalculation.startDate || breachDate || '');
      const endDateValue = (parsed.interestCalculation.endDate || new Date().toISOString().split('T')[0]) as string;
      interestCalculation = {
        principal: parsed.interestCalculation.principal || 0,
        rate: parsed.interestCalculation.rate || 0.1,
        startDate: startDateValue,
        endDate: endDateValue,
        days: parsed.interestCalculation.days || 0,
        interestAmount: parsed.interestCalculation.interestAmount,
        statutoryBasis: parsed.interestCalculation.statutoryBasis,
      };
    } else if (breachDate && isContractClaim) {
      // Calculate interest using rules engine
      const supportedTotal = parsed.supportedTotal || claimedAmount * 0.5;
      interestCalculation = calculatePrejudgmentInterest(
        supportedTotal,
        breachDate,
        jurisdiction,
        isContractClaim
      );
    }

    // Calculate totals
    const supportedTotal =
      parsed.supportedTotal ||
      items.reduce((sum, item) => sum + item.supportedAmount, 0);

    const recommendedTotal =
      parsed.recommendedTotal ||
      items.reduce((sum, item) => sum + item.calculatedAmount, 0) +
        (interestCalculation?.interestAmount || 0);

    return {
      claimedTotal: parsed.claimedTotal || claimedAmount,
      supportedTotal,
      recommendedTotal,
      items,
      mitigation,
      interestCalculation,
      summary:
        parsed.summary ||
        `Damages analysis: $${supportedTotal.toLocaleString()} supported of $${claimedAmount.toLocaleString()} claimed.`,
    };
  } catch (error) {
    console.error('Failed to parse damages response:', error);
    return getDefaultDamagesCalculation(
      claimedAmount,
      [],
      jurisdiction,
      isContractClaim,
      breachDate
    );
  }
}

/**
 * Validate damages type
 */
function validateDamagesType(type?: string): DamagesType {
  const validTypes: DamagesType[] = [
    'compensatory',
    'consequential',
    'incidental',
    'restitution',
    'statutory',
    'punitive',
  ];

  const normalized = type?.toLowerCase();
  if (normalized && validTypes.includes(normalized as DamagesType)) {
    return normalized as DamagesType;
  }

  return 'compensatory';
}

/**
 * Validate adjustment type
 */
function validateAdjustmentType(
  type?: string
): DamagesAdjustment['type'] {
  const validTypes: Array<DamagesAdjustment['type']> = [
    'mitigation',
    'limitation',
    'offset',
    'statutory_cap',
    'interest',
  ];

  const normalized = type?.toLowerCase().replace(/\s+/g, '_');
  if (normalized && validTypes.includes(normalized as DamagesAdjustment['type'])) {
    return normalized as DamagesAdjustment['type'];
  }

  return 'limitation';
}

/**
 * Calculate prejudgment interest
 */
function calculatePrejudgmentInterest(
  principal: number,
  breachDate: string,
  jurisdiction: string,
  isContractClaim: boolean
): InterestCalculation {
  const startDateObj = new Date(breachDate);
  const endDateObj = new Date();

  const result = calculateInterest(jurisdiction, {
    principal,
    startDate: startDateObj,
    endDate: endDateObj,
    isContractClaim,
  });

  return {
    principal,
    rate: result.rate,
    startDate: breachDate,
    endDate: endDateObj.toISOString().split('T')[0] ?? '',
    days: result.days,
    interestAmount: result.amount,
    statutoryBasis: result.statutoryBasis,
  };
}

/**
 * Get default damages calculation
 */
function getDefaultDamagesCalculation(
  claimedAmount: number,
  damagesClaimed: Array<{ description: string; amount: number; category?: string }>,
  jurisdiction: string,
  isContractClaim: boolean,
  breachDate?: string
): DamagesCalculation {
  // Default: support 50% of claimed with moderate confidence
  const supportedTotal = Math.round(claimedAmount * 0.5);

  const items: DamagesItem[] =
    damagesClaimed.length > 0
      ? damagesClaimed.map((d, index) => ({
          id: `dmg-${index + 1}`,
          type: 'compensatory' as DamagesType,
          description: d.description,
          claimedAmount: d.amount,
          supportedAmount: Math.round(d.amount * 0.5),
          calculatedAmount: Math.round(d.amount * 0.5),
          basis: 'Based on available evidence',
          evidenceSupport: [],
          adjustments: [],
          confidence: 0.5,
        }))
      : [
          {
            id: 'dmg-1',
            type: 'compensatory',
            description: 'General damages',
            claimedAmount,
            supportedAmount: supportedTotal,
            calculatedAmount: supportedTotal,
            basis: 'Pending detailed evidence review',
            evidenceSupport: [],
            adjustments: [],
            confidence: 0.5,
          },
        ];

  // Calculate interest if applicable
  let interestCalculation: InterestCalculation | undefined;
  if (breachDate && isContractClaim) {
    interestCalculation = calculatePrejudgmentInterest(
      supportedTotal,
      breachDate,
      jurisdiction,
      isContractClaim
    );
  }

  const recommendedTotal = supportedTotal + (interestCalculation?.interestAmount || 0);

  return {
    claimedTotal: claimedAmount,
    supportedTotal,
    recommendedTotal,
    items,
    mitigation: {
      didClaimantMitigate: true,
      mitigationEfforts: [],
      reduction: 0,
    },
    interestCalculation,
    summary: `Default analysis: $${supportedTotal.toLocaleString()} of $${claimedAmount.toLocaleString()} supported pending detailed review.`,
  };
}

/**
 * Apply statutory caps to damages
 */
export function applyDamagesCaps(
  damages: DamagesCalculation,
  jurisdiction: string,
  disputeType: string
): DamagesCalculation {
  const caps = getDamagesCaps(jurisdiction, disputeType);
  const capped = { ...damages };

  for (const cap of caps) {
    if (cap.type === 'statutory' && cap.maxAmount) {
      // Check each item for statutory cap
      capped.items = capped.items.map((item) => {
        if (item.type === 'statutory' && item.calculatedAmount > cap.maxAmount!) {
          return {
            ...item,
            calculatedAmount: cap.maxAmount!,
            adjustments: [
              ...item.adjustments,
              {
                type: 'statutory_cap' as const,
                description: `Capped at statutory maximum`,
                amount: cap.maxAmount! - item.calculatedAmount,
                legalBasis: cap.statutoryBasis,
              },
            ],
          };
        }
        return item;
      });
    }

    if (cap.type === 'punitive' && cap.maxMultiplier) {
      // Cap punitive damages at multiplier of compensatory
      const compensatoryTotal = capped.items
        .filter((i) => i.type === 'compensatory')
        .reduce((sum, i) => sum + i.calculatedAmount, 0);

      const maxPunitive = compensatoryTotal * cap.maxMultiplier;

      capped.items = capped.items.map((item) => {
        if (item.type === 'punitive' && item.calculatedAmount > maxPunitive) {
          return {
            ...item,
            calculatedAmount: maxPunitive,
            adjustments: [
              ...item.adjustments,
              {
                type: 'statutory_cap' as const,
                description: `Capped at ${cap.maxMultiplier}x compensatory damages`,
                amount: maxPunitive - item.calculatedAmount,
                legalBasis: cap.conditions.join('; '),
              },
            ],
          };
        }
        return item;
      });
    }
  }

  // Recalculate recommended total
  capped.recommendedTotal =
    capped.items.reduce((sum, item) => sum + item.calculatedAmount, 0) +
    (capped.interestCalculation?.interestAmount || 0);

  return capped;
}

/**
 * Check for CLRA minimum damages
 */
export function applyClraMinimum(
  damages: DamagesCalculation,
  jurisdiction: string,
  hasClraViolation: boolean
): DamagesCalculation {
  if (jurisdiction !== 'US-CA' || !hasClraViolation) {
    return damages;
  }

  const clraRules = getSpecialRules(jurisdiction, 'consumer_protection');
  const minRule = clraRules.find((r) => r.id === 'clra_minimum_damages');

  if (!minRule) {
    return damages;
  }

  // CLRA minimum is $1,000
  const CLRA_MINIMUM = 1000;

  if (damages.recommendedTotal < CLRA_MINIMUM) {
    return {
      ...damages,
      recommendedTotal: CLRA_MINIMUM,
      items: [
        ...damages.items,
        {
          id: 'dmg-clra-min',
          type: 'statutory',
          description: 'CLRA minimum damages',
          claimedAmount: CLRA_MINIMUM,
          supportedAmount: CLRA_MINIMUM,
          calculatedAmount: CLRA_MINIMUM - damages.recommendedTotal,
          basis: minRule.statutoryBasis || 'Cal. Civ. Code § 1780(a)(1)',
          evidenceSupport: [],
          adjustments: [],
          confidence: 1.0,
        },
      ],
      summary: damages.summary + ` CLRA minimum of $${CLRA_MINIMUM} applies.`,
    };
  }

  return damages;
}
