/**
 * API Contract Validator
 *
 * Utilities for validating API responses against schemas.
 */

import { z } from 'zod';

export interface ValidationResult {
  valid: boolean;
  errors: string[];
}

/**
 * Validate data against a Zod schema
 */
export function validateSchema<T extends z.ZodType>(schema: T, data: unknown): ValidationResult {
  const result = schema.safeParse(data);

  if (result.success) {
    return { valid: true, errors: [] };
  }

  const errors = result.error.issues.map((issue) => {
    const path = issue.path.join('.');
    return `${path}: ${issue.message}`;
  });

  return { valid: false, errors };
}

/**
 * Assert that data matches a schema (throws on failure)
 */
export function assertSchema<T extends z.ZodType>(
  schema: T,
  data: unknown,
  context?: string
): asserts data is z.infer<T> {
  const result = validateSchema(schema, data);

  if (!result.valid) {
    const contextPrefix = context ? `[${context}] ` : '';
    const errorMessage = `${contextPrefix}Schema validation failed:\n${result.errors.join('\n')}`;
    throw new Error(errorMessage);
  }
}

/**
 * Create a Jest matcher for schema validation
 */
export function toMatchSchema<T extends z.ZodType>(
  received: unknown,
  schema: T
): jest.CustomMatcherResult {
  const result = validateSchema(schema, received);

  if (result.valid) {
    return {
      pass: true,
      message: () => 'Expected data not to match schema',
    };
  }

  return {
    pass: false,
    message: () =>
      `Expected data to match schema:\n${result.errors.join('\n')}\n\nReceived: ${JSON.stringify(received, null, 2)}`,
  };
}

/**
 * Validate API response structure
 */
export function validateApiResponse(response: unknown): { isSuccess: boolean; isError: boolean } {
  const successCheck = z.object({ success: z.literal(true) }).safeParse(response);
  const errorCheck = z.object({ success: z.literal(false) }).safeParse(response);

  return {
    isSuccess: successCheck.success,
    isError: errorCheck.success,
  };
}

/**
 * Check if response contains required fields for success response
 */
export function isValidSuccessResponse(response: unknown): boolean {
  const schema = z.object({
    success: z.literal(true),
    data: z.unknown(),
  });
  return schema.safeParse(response).success;
}

/**
 * Check if response contains required fields for error response
 */
export function isValidErrorResponse(response: unknown): boolean {
  const schema = z.object({
    success: z.literal(false),
    error: z.object({
      message: z.string(),
    }),
  });
  return schema.safeParse(response).success;
}
