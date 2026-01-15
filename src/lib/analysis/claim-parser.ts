/**
 * Claim Parser Module
 *
 * Parses structured claims from party statements and claim items.
 * Extracts specific demands, amounts, and bases for claims.
 */

import Anthropic from '@anthropic-ai/sdk';

import { FACT_ANALYSIS_SYSTEM_PROMPT } from './prompts';

import type { ExtractedFact, ParsedClaim } from './types';

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
 * Claim type mapping
 */
type ClaimType = ParsedClaim['type'];

const VALID_CLAIM_TYPES: ClaimType[] = [
  'damages',
  'breach',
  'performance',
  'refund',
  'compensation',
  'other',
];

/**
 * Parse claims from statement and optional structured claim items
 */
export async function parseClaims(
  statement: string,
  claimItems: unknown,
  extractedFacts: ExtractedFact[],
  caseContext: string
): Promise<{ claims: ParsedClaim[]; tokensUsed: number }> {
  const client = getAnthropicClient();

  // First, try to extract from structured claim items if available
  const structuredClaims = parseStructuredClaimItems(claimItems);

  // If we have good structured claims, use those as base
  if (structuredClaims.length > 0) {
    // Enhance with fact references
    const enhancedClaims = linkClaimsToFacts(structuredClaims, extractedFacts);
    return { claims: enhancedClaims, tokensUsed: 0 };
  }

  // Otherwise, use Claude to extract claims from statement
  const truncatedStatement = statement.slice(0, 8000);

  const prompt = buildClaimParserPrompt(truncatedStatement, extractedFacts, caseContext);

  try {
    const response = await client.messages.create({
      model: 'claude-3-haiku-20240307',
      max_tokens: 1024,
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

    const claims = parseClaimResponse(responseText);

    return { claims, tokensUsed };
  } catch (error) {
    console.error('Claim parsing failed:', error);
    return { claims: [], tokensUsed: 0 };
  }
}

/**
 * Build prompt for claim parsing
 */
function buildClaimParserPrompt(
  statement: string,
  extractedFacts: ExtractedFact[],
  caseContext: string
): string {
  const claimFacts = extractedFacts
    .filter((f) => f.category === 'claim')
    .map((f) => `- ${f.statement}${f.amount ? ` ($${f.amount})` : ''}`)
    .join('\n');

  return `You are parsing specific claims from a party's statement in a dispute.

CASE CONTEXT:
${caseContext}

PARTY'S STATEMENT:
"""
${statement}
"""

CLAIM-RELATED FACTS EXTRACTED:
${claimFacts || 'None identified'}

TASK:
Identify and structure all specific claims being made. For each claim:
1. Determine the type: damages, breach, performance, refund, compensation, or other
2. Describe what is being claimed
3. Identify any monetary amount
4. Note the basis or justification for the claim
5. Link to supporting fact IDs if applicable

RESPOND WITH A JSON ARRAY:
[
  {
    "id": "claim_1",
    "type": "damages|breach|performance|refund|compensation|other",
    "description": "What is being claimed",
    "amount": 1000.00,
    "basis": "Legal or factual basis for the claim",
    "supportingFactIds": ["fact_1", "fact_2"]
  }
]

Identify 1-5 specific claims.
Respond with ONLY the JSON array, no other text.`;
}

/**
 * Parse structured claim items from database JSON
 */
function parseStructuredClaimItems(claimItems: unknown): ParsedClaim[] {
  if (!claimItems || !Array.isArray(claimItems)) {
    return [];
  }

  const claims: ParsedClaim[] = [];

  claimItems.forEach((item, index) => {
    if (typeof item !== 'object' || item === null) {
      return;
    }

    const itemObj = item as Record<string, unknown>;

    // Try to extract common claim item fields
    const description =
      typeof itemObj.description === 'string'
        ? itemObj.description
        : typeof itemObj.item === 'string'
          ? itemObj.item
          : typeof itemObj.claim === 'string'
            ? itemObj.claim
            : '';

    const amount =
      typeof itemObj.amount === 'number'
        ? itemObj.amount
        : typeof itemObj.amount === 'string'
          ? parseFloat(itemObj.amount)
          : undefined;

    const typeStr = typeof itemObj.type === 'string' ? itemObj.type.toLowerCase() : '';
    const type: ClaimType = VALID_CLAIM_TYPES.includes(typeStr as ClaimType)
      ? (typeStr as ClaimType)
      : inferClaimType(description);

    if (!description) {
      return;
    }

    const claim: ParsedClaim = {
      id: `claim_${index + 1}`,
      type,
      description,
    };

    if (amount !== undefined && !isNaN(amount)) {
      claim.amount = amount;
    }

    if (typeof itemObj.basis === 'string') {
      claim.basis = itemObj.basis;
    }

    claims.push(claim);
  });

  return claims;
}

/**
 * Infer claim type from description
 */
function inferClaimType(description: string): ClaimType {
  const lower = description.toLowerCase();

  if (lower.includes('refund') || lower.includes('return')) {
    return 'refund';
  }
  if (lower.includes('damage') || lower.includes('loss') || lower.includes('harm')) {
    return 'damages';
  }
  if (lower.includes('breach') || lower.includes('violat') || lower.includes('fail')) {
    return 'breach';
  }
  if (lower.includes('perform') || lower.includes('complet') || lower.includes('deliver')) {
    return 'performance';
  }
  if (lower.includes('compensat') || lower.includes('reimburse') || lower.includes('pay')) {
    return 'compensation';
  }

  return 'other';
}

/**
 * Link parsed claims to extracted facts
 */
function linkClaimsToFacts(claims: ParsedClaim[], facts: ExtractedFact[]): ParsedClaim[] {
  return claims.map((claim) => {
    // Find facts that might support this claim
    const supportingFactIds = facts
      .filter((fact) => {
        // Match by category
        if (fact.category !== 'claim') return false;

        // Match by amount if both have amounts
        if (claim.amount && fact.amount) {
          if (Math.abs(claim.amount - fact.amount) < 0.01) {
            return true;
          }
        }

        // Match by description similarity (simple keyword matching)
        const claimWords = claim.description.toLowerCase().split(/\s+/);
        const factWords = fact.statement.toLowerCase().split(/\s+/);
        const commonWords = claimWords.filter((w) =>
          factWords.some((fw) => fw.includes(w) || w.includes(fw))
        );

        return commonWords.length >= 2;
      })
      .map((fact) => fact.id);

    return {
      ...claim,
      supportingFactIds: supportingFactIds.length > 0 ? supportingFactIds : claim.supportingFactIds,
    };
  });
}

/**
 * Parse Claude response into ParsedClaim array
 */
function parseClaimResponse(responseText: string): ParsedClaim[] {
  try {
    let jsonStr = responseText.trim();
    if (jsonStr.startsWith('```')) {
      jsonStr = jsonStr
        .replace(/```json?\n?/, '')
        .replace(/```$/, '')
        .trim();
    }

    const parsed = JSON.parse(jsonStr) as Array<{
      id?: string;
      type?: string;
      description?: string;
      amount?: number;
      basis?: string;
      supportingFactIds?: string[];
    }>;

    if (!Array.isArray(parsed)) {
      return [];
    }

    return parsed
      .map((item, index) => {
        const type = VALID_CLAIM_TYPES.includes(item.type as ClaimType)
          ? (item.type as ClaimType)
          : 'other';

        return {
          id: item.id || `claim_${index + 1}`,
          type,
          description: item.description || '',
          amount: typeof item.amount === 'number' ? item.amount : undefined,
          basis: item.basis,
          supportingFactIds: Array.isArray(item.supportingFactIds)
            ? item.supportingFactIds
            : undefined,
        };
      })
      .filter((claim) => claim.description.length > 0);
  } catch (error) {
    console.error('Failed to parse claim response:', error);
    return [];
  }
}

/**
 * Calculate total claimed amount from parsed claims
 */
export function calculateTotalClaimedAmount(claims: ParsedClaim[]): number {
  return claims.reduce((total, claim) => total + (claim.amount || 0), 0);
}

/**
 * Format claims for display or further analysis
 */
export function formatClaimsForPrompt(claims: ParsedClaim[]): string {
  if (claims.length === 0) {
    return 'No specific claims identified.';
  }

  return claims
    .map((claim, i) => {
      const parts = [
        `${i + 1}. [${claim.type.toUpperCase()}] ${claim.description}`,
        claim.amount ? `   Amount: $${claim.amount.toLocaleString()}` : null,
        claim.basis ? `   Basis: ${claim.basis}` : null,
      ];
      return parts.filter(Boolean).join('\n');
    })
    .join('\n\n');
}
