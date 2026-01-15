import { z } from 'zod';

import { ValidationError } from '@/lib/api/errors';

export function validateBody<T>(schema: z.Schema<T>, data: unknown): T {
  const result = schema.safeParse(data);
  if (!result.success) {
    const errors: Record<string, string[]> = {};
    for (const error of result.error.errors) {
      const path = error.path.join('.');
      if (!errors[path]) {
        errors[path] = [];
      }
      errors[path].push(error.message);
    }
    throw new ValidationError('Validation failed', errors);
  }
  return result.data;
}

export function validateQuery<T>(schema: z.Schema<T>, params: URLSearchParams): T {
  const data: Record<string, string | string[]> = {};
  params.forEach((value, key) => {
    const existing = data[key];
    if (existing) {
      if (Array.isArray(existing)) {
        existing.push(value);
      } else {
        data[key] = [existing, value];
      }
    } else {
      data[key] = value;
    }
  });
  return validateBody(schema, data);
}

// Common validation schemas
export const paginationSchema = z.object({
  page: z.coerce.number().int().min(1).default(1),
  perPage: z.coerce.number().int().min(1).max(100).default(20),
});

export const idSchema = z.object({
  id: z.string().cuid(),
});

export const emailSchema = z.string().email('Invalid email address');

export const phoneSchema = z.string().regex(
  /^\+?[1-9]\d{1,14}$/,
  'Invalid phone number format'
);

export const currencySchema = z.coerce
  .number()
  .min(0, 'Amount must be positive')
  .transform((val) => Math.round(val * 100) / 100);

export const jurisdictionSchema = z.string().regex(
  /^[A-Z]{2}(-[A-Z]{2,3})?$/,
  'Invalid jurisdiction format (e.g., US-CA)'
);
