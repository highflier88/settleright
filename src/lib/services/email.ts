import sgMail from '@sendgrid/mail';

// Initialize SendGrid
const apiKey = process.env.SENDGRID_API_KEY;
if (apiKey) {
  sgMail.setApiKey(apiKey);
}

const fromEmail = process.env.SENDGRID_FROM_EMAIL ?? 'noreply@settleright.ai';
const fromName = process.env.SENDGRID_FROM_NAME ?? 'Settleright.ai';

export interface SendEmailResult {
  success: boolean;
  messageId?: string;
  error?: string;
}

export interface EmailOptions {
  to: string | string[];
  subject: string;
  text?: string;
  html?: string;
  templateId?: string;
  dynamicTemplateData?: Record<string, unknown>;
  attachments?: Array<{
    content: string;
    filename: string;
    type: string;
    disposition?: 'attachment' | 'inline';
  }>;
}

// Send a basic email
export async function sendEmail(options: EmailOptions): Promise<SendEmailResult> {
  if (!apiKey) {
    console.error('SendGrid API key not configured');
    return { success: false, error: 'Email service not configured' };
  }

  // Skip in development if configured
  if (process.env.SKIP_EMAIL === 'true') {
    console.log(`[DEV] Would send email to ${String(options.to)}:`, {
      subject: options.subject,
      templateId: options.templateId,
    });
    return { success: true, messageId: 'dev-skipped' };
  }

  try {
    const msg: sgMail.MailDataRequired = {
      to: options.to,
      from: {
        email: fromEmail,
        name: fromName,
      },
      subject: options.subject,
      text: options.text ?? '',
      html: options.html,
    };

    if (options.templateId) {
      msg.templateId = options.templateId;
      msg.dynamicTemplateData = options.dynamicTemplateData;
    }

    if (options.attachments) {
      msg.attachments = options.attachments;
    }

    const [response] = await sgMail.send(msg);

    return {
      success: true,
      messageId: (response.headers as Record<string, string>)['x-message-id'],
    };
  } catch (error) {
    console.error('Failed to send email:', error);
    return {
      success: false,
      error: error instanceof Error ? error.message : 'Failed to send email',
    };
  }
}

// Email template IDs (configured in SendGrid dashboard)
export const EMAIL_TEMPLATES = {
  welcome: process.env.SENDGRID_TEMPLATE_WELCOME,
  caseInvitation: process.env.SENDGRID_TEMPLATE_CASE_INVITATION,
  evidenceNotification: process.env.SENDGRID_TEMPLATE_EVIDENCE_NOTIFICATION,
  deadlineReminder: process.env.SENDGRID_TEMPLATE_DEADLINE_REMINDER,
  awardIssued: process.env.SENDGRID_TEMPLATE_AWARD_ISSUED,
} as const;

// Pre-built email functions for common scenarios

export async function sendWelcomeEmail(
  to: string,
  data: { name: string; loginUrl: string }
): Promise<SendEmailResult> {
  if (EMAIL_TEMPLATES.welcome) {
    return sendEmail({
      to,
      subject: 'Welcome to Settleright.ai',
      templateId: EMAIL_TEMPLATES.welcome,
      dynamicTemplateData: data,
    });
  }

  // Fallback to plain text
  return sendEmail({
    to,
    subject: 'Welcome to Settleright.ai',
    text: `Hi ${data.name},\n\nWelcome to Settleright.ai! Your account has been created successfully.\n\nLog in to get started: ${data.loginUrl}\n\nBest,\nThe Settleright.ai Team`,
    html: `
      <h2>Welcome to Settleright.ai!</h2>
      <p>Hi ${data.name},</p>
      <p>Your account has been created successfully.</p>
      <p><a href="${data.loginUrl}">Log in to get started</a></p>
      <p>Best,<br>The Settleright.ai Team</p>
    `,
  });
}

export async function sendCaseInvitationEmail(
  to: string,
  data: {
    recipientName?: string;
    claimantName: string;
    caseReference: string;
    disputeAmount: string;
    disputeDescription: string;
    invitationUrl: string;
    expiresAt: string;
  }
): Promise<SendEmailResult> {
  if (EMAIL_TEMPLATES.caseInvitation) {
    return sendEmail({
      to,
      subject: `You've been invited to respond to case ${data.caseReference}`,
      templateId: EMAIL_TEMPLATES.caseInvitation,
      dynamicTemplateData: data,
    });
  }

  return sendEmail({
    to,
    subject: `You've been invited to respond to case ${data.caseReference}`,
    text: `
${data.recipientName ? `Dear ${data.recipientName},` : 'Hello,'}

${data.claimantName} has initiated an arbitration case against you on Settleright.ai.

Case Reference: ${data.caseReference}
Dispute Amount: ${data.disputeAmount}
Description: ${data.disputeDescription}

You are invited to participate in binding arbitration to resolve this dispute quickly and affordably.

Please respond by visiting: ${data.invitationUrl}

This invitation expires on ${data.expiresAt}.

If you believe you received this in error, please contact support@settleright.ai.

Best,
The Settleright.ai Team
    `,
    html: `
      <h2>You've Been Invited to Arbitration</h2>
      <p>${data.recipientName ? `Dear ${data.recipientName},` : 'Hello,'}</p>
      <p><strong>${data.claimantName}</strong> has initiated an arbitration case against you on Settleright.ai.</p>
      <table style="margin: 20px 0;">
        <tr><td><strong>Case Reference:</strong></td><td>${data.caseReference}</td></tr>
        <tr><td><strong>Dispute Amount:</strong></td><td>${data.disputeAmount}</td></tr>
        <tr><td><strong>Description:</strong></td><td>${data.disputeDescription}</td></tr>
      </table>
      <p>You are invited to participate in binding arbitration to resolve this dispute quickly and affordably.</p>
      <p><a href="${data.invitationUrl}" style="display: inline-block; padding: 12px 24px; background: #0066cc; color: white; text-decoration: none; border-radius: 6px;">Respond to Case</a></p>
      <p style="color: #666; font-size: 14px;">This invitation expires on ${data.expiresAt}.</p>
      <p style="color: #666; font-size: 14px;">If you believe you received this in error, please contact support@settleright.ai.</p>
      <p>Best,<br>The Settleright.ai Team</p>
    `,
  });
}

export async function sendEvidenceNotificationEmail(
  to: string,
  data: {
    recipientName: string;
    caseReference: string;
    uploaderName: string;
    fileName: string;
    caseUrl: string;
  }
): Promise<SendEmailResult> {
  if (EMAIL_TEMPLATES.evidenceNotification) {
    return sendEmail({
      to,
      subject: `New evidence uploaded in case ${data.caseReference}`,
      templateId: EMAIL_TEMPLATES.evidenceNotification,
      dynamicTemplateData: data,
    });
  }

  return sendEmail({
    to,
    subject: `New evidence uploaded in case ${data.caseReference}`,
    text: `
Hi ${data.recipientName},

${data.uploaderName} has uploaded new evidence in case ${data.caseReference}.

File: ${data.fileName}

Log in to review: ${data.caseUrl}

Best,
The Settleright.ai Team
    `,
    html: `
      <h2>New Evidence Uploaded</h2>
      <p>Hi ${data.recipientName},</p>
      <p><strong>${data.uploaderName}</strong> has uploaded new evidence in case <strong>${data.caseReference}</strong>.</p>
      <p>File: ${data.fileName}</p>
      <p><a href="${data.caseUrl}">Log in to review</a></p>
      <p>Best,<br>The Settleright.ai Team</p>
    `,
  });
}

export async function sendDeadlineReminderEmail(
  to: string,
  data: {
    recipientName: string;
    caseReference: string;
    deadlineType: string;
    deadlineDate: string;
    caseUrl: string;
  }
): Promise<SendEmailResult> {
  if (EMAIL_TEMPLATES.deadlineReminder) {
    return sendEmail({
      to,
      subject: `Deadline reminder: ${data.deadlineType} for case ${data.caseReference}`,
      templateId: EMAIL_TEMPLATES.deadlineReminder,
      dynamicTemplateData: data,
    });
  }

  return sendEmail({
    to,
    subject: `Deadline reminder: ${data.deadlineType} for case ${data.caseReference}`,
    text: `
Hi ${data.recipientName},

This is a reminder that the ${data.deadlineType} deadline for case ${data.caseReference} is approaching.

Deadline: ${data.deadlineDate}

Please take action before the deadline: ${data.caseUrl}

Best,
The Settleright.ai Team
    `,
    html: `
      <h2>Deadline Reminder</h2>
      <p>Hi ${data.recipientName},</p>
      <p>This is a reminder that the <strong>${data.deadlineType}</strong> deadline for case <strong>${data.caseReference}</strong> is approaching.</p>
      <p><strong>Deadline: ${data.deadlineDate}</strong></p>
      <p><a href="${data.caseUrl}">Take Action</a></p>
      <p>Best,<br>The Settleright.ai Team</p>
    `,
  });
}

export async function sendAwardIssuedEmail(
  to: string,
  data: {
    recipientName: string;
    caseReference: string;
    awardSummary: string;
    caseUrl: string;
  }
): Promise<SendEmailResult> {
  if (EMAIL_TEMPLATES.awardIssued) {
    return sendEmail({
      to,
      subject: `Arbitration award issued for case ${data.caseReference}`,
      templateId: EMAIL_TEMPLATES.awardIssued,
      dynamicTemplateData: data,
    });
  }

  return sendEmail({
    to,
    subject: `Arbitration award issued for case ${data.caseReference}`,
    text: `
Hi ${data.recipientName},

The arbitration award for case ${data.caseReference} has been issued.

${data.awardSummary}

Log in to view the full award and download the official document: ${data.caseUrl}

This award is final and legally binding.

Best,
The Settleright.ai Team
    `,
    html: `
      <h2>Arbitration Award Issued</h2>
      <p>Hi ${data.recipientName},</p>
      <p>The arbitration award for case <strong>${data.caseReference}</strong> has been issued.</p>
      <div style="background: #f5f5f5; padding: 16px; border-radius: 8px; margin: 16px 0;">
        ${data.awardSummary}
      </div>
      <p><a href="${data.caseUrl}">View Full Award</a></p>
      <p style="color: #666; font-size: 14px;">This award is final and legally binding.</p>
      <p>Best,<br>The Settleright.ai Team</p>
    `,
  });
}
