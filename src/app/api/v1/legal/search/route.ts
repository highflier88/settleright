/**
 * Legal Search API
 *
 * POST /api/v1/legal/search
 *
 * Semantic search over legal documents including statutes,
 * case law, and regulations.
 */

import { NextResponse } from 'next/server';
import { z } from 'zod';

import { withAuth } from '@/lib/api/with-auth';
import { searchLegalDocuments } from '@/lib/legal/retrieval';

import type { DisputeType, LegalSourceType } from '@prisma/client';

// Request validation
const searchRequestSchema = z.object({
  query: z.string().min(3, 'Query must be at least 3 characters').max(500),
  jurisdiction: z.string().min(2).default('US-CA'),
  disputeType: z.enum(['CONTRACT', 'PAYMENT', 'SERVICE', 'GOODS', 'OTHER']).optional(),
  disputeAmount: z.number().min(0).optional(),
  sourceTypes: z.array(z.enum(['STATUTE', 'CASE_LAW', 'REGULATION', 'COURT_RULE'])).optional(),
  topK: z.number().min(1).max(50).default(10),
  includeFullText: z.boolean().default(false),
});

export const POST = withAuth(async (request) => {
  try {
    const body: unknown = await request.json();

    // Validate request
    const validationResult = searchRequestSchema.safeParse(body);
    if (!validationResult.success) {
      return NextResponse.json(
        {
          success: false,
          error: {
            code: 'VALIDATION_ERROR',
            message: 'Invalid request parameters',
            details: validationResult.error.flatten(),
          },
        },
        { status: 400 }
      );
    }

    const params = validationResult.data;

    // Perform search
    const results = await searchLegalDocuments({
      query: params.query,
      jurisdiction: params.jurisdiction,
      disputeType: params.disputeType as DisputeType | undefined,
      disputeAmount: params.disputeAmount,
      sourceTypes: params.sourceTypes as LegalSourceType[] | undefined,
      topK: params.topK,
      includeFullText: params.includeFullText,
    });

    return NextResponse.json({
      success: true,
      data: results,
    });
  } catch (error) {
    console.error('Legal search error:', error);

    return NextResponse.json(
      {
        success: false,
        error: {
          code: 'SEARCH_FAILED',
          message: 'Failed to perform legal search',
        },
      },
      { status: 500 }
    );
  }
});
