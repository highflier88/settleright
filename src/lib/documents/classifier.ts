/**
 * Document Classifier
 *
 * Classifies documents into predefined categories using Claude AI.
 * Uses Claude Haiku for fast, cost-effective classification.
 */

import Anthropic from '@anthropic-ai/sdk';

import type { ClassificationResult } from '@/types/documents';

import type { DocumentType } from '@prisma/client';

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
 * Document type descriptions for classification
 */
const DOCUMENT_TYPE_DESCRIPTIONS: Record<DocumentType, string> = {
  CONTRACT:
    'Legal agreement, contract, terms of service, lease agreement, or similar binding document',
  INVOICE: 'Invoice, bill for services or goods, itemized charges',
  RECEIPT: 'Receipt, proof of payment, transaction confirmation',
  CORRESPONDENCE: 'Email, letter, message, or other written communication between parties',
  LEGAL_NOTICE:
    'Demand letter, cease and desist, legal notice, court filing, or formal legal communication',
  BANK_STATEMENT: 'Bank statement, financial statement, account summary, or transaction history',
  PHOTO_EVIDENCE:
    'Photograph of physical evidence, damaged goods, conditions, or visual documentation',
  OTHER: 'Document that does not fit into other categories',
};

/**
 * Classify a document based on its text content
 */
export async function classifyDocument(text: string): Promise<ClassificationResult> {
  const client = getAnthropicClient();

  // Truncate text if too long (to stay within token limits)
  const truncatedText = text.slice(0, 8000);

  const typeList = Object.entries(DOCUMENT_TYPE_DESCRIPTIONS)
    .map(([type, desc]) => `- ${type}: ${desc}`)
    .join('\n');

  const prompt = `Classify the following document into exactly one of these categories:

${typeList}

Document text:
"""
${truncatedText}
"""

Respond with a JSON object containing:
- "type": The document type (must be one of: ${Object.keys(DOCUMENT_TYPE_DESCRIPTIONS).join(', ')})
- "confidence": A number between 0 and 1 indicating how confident you are
- "reasoning": A brief explanation (1-2 sentences) of why you chose this classification

Respond with only the JSON object, no other text.`;

  try {
    const response = await client.messages.create({
      model: 'claude-3-haiku-20240307',
      max_tokens: 256,
      messages: [
        {
          role: 'user',
          content: prompt,
        },
      ],
    });

    // Extract text from response
    const responseText = response.content[0]?.type === 'text' ? response.content[0].text : '';

    // Parse JSON response
    const result = parseClassificationResponse(responseText);
    return result;
  } catch (error) {
    console.error('Document classification failed:', error);
    return {
      documentType: 'OTHER',
      confidence: 0,
      reasoning: 'Classification failed due to an error',
    };
  }
}

/**
 * Parse the Claude response into a ClassificationResult
 */
function parseClassificationResponse(responseText: string): ClassificationResult {
  try {
    // Extract JSON from response (handle potential markdown code blocks)
    let jsonStr = responseText.trim();
    if (jsonStr.startsWith('```')) {
      jsonStr = jsonStr
        .replace(/```json?\n?/, '')
        .replace(/```$/, '')
        .trim();
    }

    const parsed = JSON.parse(jsonStr) as {
      type?: string;
      confidence?: number;
      reasoning?: string;
    };

    // Validate document type
    const validTypes: DocumentType[] = [
      'CONTRACT',
      'INVOICE',
      'RECEIPT',
      'CORRESPONDENCE',
      'LEGAL_NOTICE',
      'BANK_STATEMENT',
      'PHOTO_EVIDENCE',
      'OTHER',
    ];

    const documentType = validTypes.includes(parsed.type as DocumentType)
      ? (parsed.type as DocumentType)
      : 'OTHER';

    return {
      documentType,
      confidence: Math.min(1, Math.max(0, parsed.confidence || 0)),
      reasoning: parsed.reasoning,
    };
  } catch {
    console.error('Failed to parse classification response:', responseText);
    return {
      documentType: 'OTHER',
      confidence: 0,
      reasoning: 'Failed to parse classification response',
    };
  }
}

/**
 * Classify document based on filename hints (quick pre-classification)
 */
export function classifyByFilename(fileName: string): DocumentType | null {
  const lowerName = fileName.toLowerCase();

  // Check for common patterns
  if (
    lowerName.includes('contract') ||
    lowerName.includes('agreement') ||
    lowerName.includes('terms')
  ) {
    return 'CONTRACT';
  }
  if (lowerName.includes('invoice') || lowerName.includes('bill')) {
    return 'INVOICE';
  }
  if (lowerName.includes('receipt')) {
    return 'RECEIPT';
  }
  if (lowerName.includes('statement') || lowerName.includes('bank')) {
    return 'BANK_STATEMENT';
  }
  if (
    lowerName.includes('letter') ||
    lowerName.includes('email') ||
    lowerName.includes('correspondence')
  ) {
    return 'CORRESPONDENCE';
  }
  if (lowerName.includes('notice') || lowerName.includes('demand') || lowerName.includes('legal')) {
    return 'LEGAL_NOTICE';
  }
  if (
    lowerName.includes('photo') ||
    lowerName.includes('image') ||
    lowerName.includes('evidence') ||
    lowerName.includes('damage')
  ) {
    return 'PHOTO_EVIDENCE';
  }

  return null;
}

/**
 * Estimate classification cost
 * Claude Haiku: $0.25 per million input tokens, $1.25 per million output tokens
 */
export function estimateClassificationCost(textLength: number): number {
  // Rough estimate: ~4 chars per token
  const inputTokens = Math.ceil((textLength + 500) / 4); // +500 for prompt
  const outputTokens = 64; // ~256 chars max

  const inputCost = (inputTokens / 1_000_000) * 0.25;
  const outputCost = (outputTokens / 1_000_000) * 1.25;

  return inputCost + outputCost;
}
