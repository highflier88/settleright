import { z } from 'zod';

import { phoneSchema } from './index';

export const updateProfileSchema = z.object({
  name: z.string().min(2, 'Name must be at least 2 characters').max(100).optional(),
  phone: phoneSchema.optional().nullable(),
  addressStreet: z.string().max(200).optional().nullable(),
  addressCity: z.string().max(100).optional().nullable(),
  addressState: z.string().max(100).optional().nullable(),
  addressPostalCode: z.string().max(20).optional().nullable(),
  addressCountry: z.string().max(100).optional().nullable(),
});

export const notificationPreferencesSchema = z.object({
  emailEnabled: z.boolean().optional(),
  smsEnabled: z.boolean().optional(),
  inAppEnabled: z.boolean().optional(),
  caseUpdates: z.boolean().optional(),
  deadlineReminders: z.boolean().optional(),
  evidenceUploads: z.boolean().optional(),
  awardNotifications: z.boolean().optional(),
  marketingEmails: z.boolean().optional(),
});

export const initiateKycSchema = z.object({
  returnUrl: z.string().url('Invalid return URL'),
});

export type UpdateProfileInput = z.infer<typeof updateProfileSchema>;
export type NotificationPreferencesInput = z.infer<typeof notificationPreferencesSchema>;
export type InitiateKycInput = z.infer<typeof initiateKycSchema>;
