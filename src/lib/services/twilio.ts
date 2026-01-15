import twilio from 'twilio';

const accountSid = process.env.TWILIO_ACCOUNT_SID;
const authToken = process.env.TWILIO_AUTH_TOKEN;
const verifyServiceSid = process.env.TWILIO_VERIFY_SERVICE_SID;
const fromNumber = process.env.TWILIO_PHONE_NUMBER;

// Initialize Twilio client
const client = accountSid && authToken ? twilio(accountSid, authToken) : null;

export interface SendVerificationResult {
  success: boolean;
  status?: string;
  error?: string;
}

export interface CheckVerificationResult {
  success: boolean;
  valid: boolean;
  status?: string;
  error?: string;
}

export interface SendSmsResult {
  success: boolean;
  messageSid?: string;
  error?: string;
}

// Send phone verification code using Twilio Verify
export async function sendPhoneVerification(
  phoneNumber: string
): Promise<SendVerificationResult> {
  if (!client || !verifyServiceSid) {
    console.error('Twilio not configured');
    return { success: false, error: 'SMS service not configured' };
  }

  try {
    const verification = await client.verify.v2
      .services(verifyServiceSid)
      .verifications.create({
        to: phoneNumber,
        channel: 'sms',
      });

    return {
      success: true,
      status: verification.status,
    };
  } catch (error) {
    console.error('Failed to send phone verification:', error);
    return {
      success: false,
      error: error instanceof Error ? error.message : 'Failed to send verification',
    };
  }
}

// Check phone verification code
export async function checkPhoneVerification(
  phoneNumber: string,
  code: string
): Promise<CheckVerificationResult> {
  if (!client || !verifyServiceSid) {
    console.error('Twilio not configured');
    return { success: false, valid: false, error: 'SMS service not configured' };
  }

  try {
    const verification = await client.verify.v2
      .services(verifyServiceSid)
      .verificationChecks.create({
        to: phoneNumber,
        code,
      });

    return {
      success: true,
      valid: verification.status === 'approved',
      status: verification.status,
    };
  } catch (error) {
    console.error('Failed to check phone verification:', error);
    return {
      success: false,
      valid: false,
      error: error instanceof Error ? error.message : 'Failed to verify code',
    };
  }
}

// Send a simple SMS message
export async function sendSms(
  to: string,
  body: string
): Promise<SendSmsResult> {
  if (!client || !fromNumber) {
    console.error('Twilio not configured');
    return { success: false, error: 'SMS service not configured' };
  }

  // Skip in development if configured
  if (process.env.SKIP_SMS === 'true') {
    console.log(`[DEV] Would send SMS to ${to}: ${body}`);
    return { success: true, messageSid: 'dev-skipped' };
  }

  try {
    const message = await client.messages.create({
      to,
      from: fromNumber,
      body,
    });

    return {
      success: true,
      messageSid: message.sid,
    };
  } catch (error) {
    console.error('Failed to send SMS:', error);
    return {
      success: false,
      error: error instanceof Error ? error.message : 'Failed to send SMS',
    };
  }
}

// Send notification SMS templates
export const smsTemplates = {
  caseInvitation: (caseRef: string, link: string) =>
    `You've been invited to respond to case ${caseRef} on Settleright.ai. View details: ${link}`,

  deadlineReminder: (caseRef: string, deadline: string, action: string) =>
    `Reminder: ${action} deadline for case ${caseRef} is ${deadline}. Log in to Settleright.ai to take action.`,

  evidenceSubmitted: (caseRef: string, partyName: string) =>
    `New evidence submitted in case ${caseRef} by ${partyName}. Log in to review.`,

  awardIssued: (caseRef: string) =>
    `The arbitration award for case ${caseRef} has been issued. Log in to Settleright.ai to view.`,

  verificationCode: (code: string) =>
    `Your Settleright.ai verification code is: ${code}. This code expires in 10 minutes.`,
};

// Send templated notification
export async function sendNotificationSms(
  to: string,
  template: keyof typeof smsTemplates,
  ...args: Parameters<(typeof smsTemplates)[typeof template]>
): Promise<SendSmsResult> {
  const templateFn = smsTemplates[template] as (...args: unknown[]) => string;
  const body = templateFn(...args);
  return sendSms(to, body);
}
