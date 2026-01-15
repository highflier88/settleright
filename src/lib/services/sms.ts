import { NotificationType } from '@prisma/client';

import { prisma } from '@/lib/db';

// Twilio configuration
const TWILIO_ACCOUNT_SID = process.env.TWILIO_ACCOUNT_SID;
const TWILIO_AUTH_TOKEN = process.env.TWILIO_AUTH_TOKEN;
const TWILIO_FROM_NUMBER = process.env.TWILIO_FROM_NUMBER;

export interface SendSmsResult {
  success: boolean;
  messageId?: string;
  error?: string;
}

// Format phone number to E.164 format
function formatPhoneNumber(phone: string): string {
  // Remove all non-digit characters
  const digits = phone.replace(/\D/g, '');

  // If it starts with 1 and is 11 digits, assume US
  if (digits.length === 11 && digits.startsWith('1')) {
    return `+${digits}`;
  }

  // If it's 10 digits, assume US and add +1
  if (digits.length === 10) {
    return `+1${digits}`;
  }

  // Otherwise, assume it already includes country code
  return `+${digits}`;
}

// Send SMS via Twilio
export async function sendSms(
  to: string,
  message: string,
  userId?: string,
  templateId?: string
): Promise<SendSmsResult> {
  // Validate configuration
  if (!TWILIO_ACCOUNT_SID || !TWILIO_AUTH_TOKEN || !TWILIO_FROM_NUMBER) {
    console.log('[SMS] Twilio not configured, skipping:', { to, message: message.substring(0, 50) });
    return { success: true, messageId: 'dev-mode' };
  }

  try {
    const formattedTo = formatPhoneNumber(to);

    // Make Twilio API call
    const response = await fetch(
      `https://api.twilio.com/2010-04-01/Accounts/${TWILIO_ACCOUNT_SID}/Messages.json`,
      {
        method: 'POST',
        headers: {
          'Authorization': `Basic ${Buffer.from(`${TWILIO_ACCOUNT_SID}:${TWILIO_AUTH_TOKEN}`).toString('base64')}`,
          'Content-Type': 'application/x-www-form-urlencoded',
        },
        body: new URLSearchParams({
          To: formattedTo,
          From: TWILIO_FROM_NUMBER,
          Body: message,
        }),
      }
    );

    const data = await response.json() as { sid?: string; message?: string };

    // Log notification
    if (userId) {
      await prisma.notification.create({
        data: {
          userId,
          type: NotificationType.SMS,
          templateId: templateId || 'sms_generic',
          body: message,
          externalId: data.sid,
          deliveredAt: response.ok ? new Date() : undefined,
          failedAt: response.ok ? undefined : new Date(),
          failureReason: response.ok ? undefined : data.message,
        },
      });
    }

    if (!response.ok) {
      console.error('[SMS] Twilio error:', data);
      return { success: false, error: data.message || 'Failed to send SMS' };
    }

    return { success: true, messageId: data.sid };
  } catch (error) {
    console.error('[SMS] Failed to send:', error);
    return {
      success: false,
      error: error instanceof Error ? error.message : 'Failed to send SMS',
    };
  }
}

// SMS Templates
export const SmsTemplates = {
  // Invitation
  invitationSent: (data: { caseReference: string; link: string }) =>
    `Settleright.ai: You've been invited to arbitration case ${data.caseReference}. View: ${data.link}`,

  invitationReminder: (data: { caseReference: string; expiresIn: string; link: string }) =>
    `Settleright.ai: Reminder - Your invitation to case ${data.caseReference} expires in ${data.expiresIn}. Respond: ${data.link}`,

  // Agreement
  agreementReady: (data: { caseReference: string; link: string }) =>
    `Settleright.ai: The agreement for case ${data.caseReference} is ready for signature. Sign: ${data.link}`,

  agreementSigned: (data: { caseReference: string }) =>
    `Settleright.ai: The other party has signed the agreement for case ${data.caseReference}. Please sign to proceed.`,

  // Deadlines
  deadline24h: (data: { caseReference: string; deadlineType: string }) =>
    `Settleright.ai: URGENT - ${data.deadlineType} deadline for case ${data.caseReference} is in 24 hours.`,

  deadlinePassed: (data: { caseReference: string; deadlineType: string }) =>
    `Settleright.ai: The ${data.deadlineType} deadline for case ${data.caseReference} has passed.`,

  // Evidence & Statement
  newEvidence: (data: { caseReference: string }) =>
    `Settleright.ai: New evidence uploaded in case ${data.caseReference}. Log in to view.`,

  newStatement: (data: { caseReference: string }) =>
    `Settleright.ai: New statement submitted in case ${data.caseReference}. Log in to view.`,

  // Award
  awardIssued: (data: { caseReference: string }) =>
    `Settleright.ai: The arbitration award for case ${data.caseReference} has been issued. Log in to view.`,

  // KYC
  kycApproved: () =>
    `Settleright.ai: Your identity verification is complete. You can now participate in arbitration cases.`,

  kycFailed: () =>
    `Settleright.ai: Your identity verification was not successful. Please try again.`,
};

// Send templated SMS
export async function sendTemplatedSms(
  to: string,
  template: keyof typeof SmsTemplates,
  data: Record<string, string>,
  userId?: string
): Promise<SendSmsResult> {
  const templateFn = SmsTemplates[template] as (data: Record<string, string>) => string;
  const message = templateFn(data);
  return sendSms(to, message, userId, template);
}
