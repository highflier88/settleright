import { z } from 'zod';

import { emailSchema, phoneSchema, jurisdictionSchema, currencySchema } from './index';

const DISPUTE_TYPES = ['CONTRACT', 'PAYMENT', 'SERVICE', 'GOODS', 'OTHER'] as const;

export const createCaseSchema = z.object({
  disputeType: z.enum(DISPUTE_TYPES),
  jurisdiction: jurisdictionSchema,
  description: z
    .string()
    .min(50, 'Description must be at least 50 characters')
    .max(10000, 'Description must be less than 10000 characters'),
  amount: currencySchema.refine((val) => val > 0, 'Amount must be greater than 0'),
  respondent: z.object({
    email: emailSchema,
    name: z.string().min(2, 'Name must be at least 2 characters').optional(),
    phone: phoneSchema.optional(),
  }),
});

export const updateCaseSchema = z.object({
  description: z.string().min(50).max(10000).optional(),
  amount: currencySchema.optional(),
});

export const submitStatementSchema = z.object({
  content: z
    .string()
    .min(100, 'Statement must be at least 100 characters')
    .max(25000, 'Statement must be less than 25000 characters'),
  claimItems: z
    .array(
      z.object({
        description: z.string().min(1),
        amount: currencySchema,
      })
    )
    .optional(),
});

export const inviteRespondentSchema = z.object({
  email: emailSchema,
  name: z.string().min(2).optional(),
  phone: phoneSchema.optional(),
});

export type CreateCaseInput = z.infer<typeof createCaseSchema>;
export type UpdateCaseInput = z.infer<typeof updateCaseSchema>;
export type SubmitStatementInput = z.infer<typeof submitStatementSchema>;
export type InviteRespondentInput = z.infer<typeof inviteRespondentSchema>;
