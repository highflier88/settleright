import { NotificationType } from '@prisma/client';

import { prisma } from '@/lib/db';

import {
  sendEmail,
  sendWelcomeEmail,
  sendCaseInvitationEmail,
  sendDeadlineReminderEmail,
  sendEvidenceNotificationEmail,
  sendAwardIssuedEmail,
} from './email';
import {
  getUserNotificationPreferences,
  createInAppNotification,
  NotificationTemplates,
} from './notification';
import { sendSms, sendTemplatedSms } from './sms';

const APP_URL = process.env.NEXT_PUBLIC_APP_URL || 'https://settleright.ai';

// Dispatch result
interface DispatchResult {
  email?: { success: boolean; error?: string };
  sms?: { success: boolean; error?: string };
  inApp?: { success: boolean; notificationId?: string };
}

// Helper to get user with contact info
async function getUserWithContact(userId: string) {
  return prisma.user.findUnique({
    where: { id: userId },
    select: {
      id: true,
      email: true,
      name: true,
      phone: true,
    },
  });
}

// =============================================================================
// INVITATION NOTIFICATIONS
// =============================================================================

export async function notifyInvitationSent(
  recipientEmail: string,
  recipientName: string | undefined,
  data: {
    claimantName: string;
    caseReference: string;
    caseId: string;
    disputeType: string;
    claimAmount: string;
    invitationToken: string;
    expiresAt: Date;
  }
): Promise<DispatchResult> {
  const result: DispatchResult = {};
  const invitationUrl = `${APP_URL}/invitation/${data.invitationToken}`;

  // Send email
  const emailResult = await sendCaseInvitationEmail(recipientEmail, {
    recipientName,
    claimantName: data.claimantName,
    caseReference: data.caseReference,
    disputeAmount: data.claimAmount,
    disputeDescription: data.disputeType,
    invitationUrl,
    expiresAt: data.expiresAt.toLocaleDateString(),
  });
  result.email = { success: emailResult.success, error: emailResult.error };

  return result;
}

export async function notifyInvitationAccepted(
  claimantUserId: string,
  data: {
    caseReference: string;
    caseId: string;
    respondentName: string;
  }
): Promise<DispatchResult> {
  const result: DispatchResult = {};

  const user = await getUserWithContact(claimantUserId);
  if (!user) return result;

  const prefs = await getUserNotificationPreferences(claimantUserId);

  // In-app notification
  if (prefs.inAppEnabled && prefs.caseUpdates) {
    const notificationId = await createInAppNotification({
      userId: claimantUserId,
      type: NotificationType.IN_APP,
      templateId: NotificationTemplates.INVITATION_ACCEPTED,
      subject: 'Respondent Accepted',
      body: `${data.respondentName} has accepted the invitation for case ${data.caseReference}. You can now both sign the arbitration agreement.`,
    });
    result.inApp = { success: true, notificationId };
  }

  // Email
  if (prefs.emailEnabled && prefs.caseUpdates) {
    const emailResult = await sendEmail({
      to: user.email,
      subject: `Respondent Accepted - Case ${data.caseReference}`,
      text: `${data.respondentName} has accepted the invitation for case ${data.caseReference}. Next step: Sign the arbitration agreement.`,
      html: `
        <h2>Respondent Has Joined</h2>
        <p>Hi ${user.name || 'there'},</p>
        <p><strong>${data.respondentName}</strong> has accepted the invitation for case <strong>${data.caseReference}</strong>.</p>
        <p>Next step: Both parties need to sign the arbitration agreement.</p>
        <p><a href="${APP_URL}/dashboard/cases/${data.caseId}/agreement">Sign Agreement</a></p>
      `,
    });
    result.email = { success: emailResult.success, error: emailResult.error };
  }

  // SMS
  if (prefs.smsEnabled && prefs.caseUpdates && user.phone) {
    const smsResult = await sendSms(
      user.phone,
      `Settleright.ai: ${data.respondentName} accepted the invitation for case ${data.caseReference}. Sign the agreement to proceed.`,
      claimantUserId,
      'invitation_accepted'
    );
    result.sms = { success: smsResult.success, error: smsResult.error };
  }

  return result;
}

// =============================================================================
// AGREEMENT NOTIFICATIONS
// =============================================================================

export async function notifyAgreementSignedByOther(
  targetUserId: string,
  data: {
    caseReference: string;
    caseId: string;
    signerName: string;
  }
): Promise<DispatchResult> {
  const result: DispatchResult = {};

  const user = await getUserWithContact(targetUserId);
  if (!user) return result;

  const prefs = await getUserNotificationPreferences(targetUserId);

  // In-app notification
  if (prefs.inAppEnabled && prefs.caseUpdates) {
    const notificationId = await createInAppNotification({
      userId: targetUserId,
      type: NotificationType.IN_APP,
      templateId: NotificationTemplates.AGREEMENT_SIGNED_BY_OTHER,
      subject: 'Agreement Signed',
      body: `${data.signerName} has signed the arbitration agreement for case ${data.caseReference}. Please sign to proceed.`,
    });
    result.inApp = { success: true, notificationId };
  }

  // Email
  if (prefs.emailEnabled && prefs.caseUpdates) {
    const emailResult = await sendEmail({
      to: user.email,
      subject: `Other Party Signed Agreement - Case ${data.caseReference}`,
      text: `${data.signerName} has signed the agreement for case ${data.caseReference}. Please sign to proceed.`,
      html: `
        <h2>Other Party Has Signed</h2>
        <p>Hi ${user.name || 'there'},</p>
        <p><strong>${data.signerName}</strong> has signed the arbitration agreement for case <strong>${data.caseReference}</strong>.</p>
        <p>Please sign the agreement to begin the arbitration process.</p>
        <p><a href="${APP_URL}/dashboard/cases/${data.caseId}/agreement">Sign Agreement</a></p>
      `,
    });
    result.email = { success: emailResult.success, error: emailResult.error };
  }

  // SMS
  if (prefs.smsEnabled && prefs.caseUpdates && user.phone) {
    const smsResult = await sendTemplatedSms(
      user.phone,
      'agreementSigned',
      { caseReference: data.caseReference },
      targetUserId
    );
    result.sms = { success: smsResult.success, error: smsResult.error };
  }

  return result;
}

export async function notifyAgreementComplete(
  userIds: string[],
  data: {
    caseReference: string;
    caseId: string;
  }
): Promise<void> {
  for (const userId of userIds) {
    const user = await getUserWithContact(userId);
    if (!user) continue;

    const prefs = await getUserNotificationPreferences(userId);

    // In-app notification
    if (prefs.inAppEnabled && prefs.caseUpdates) {
      await createInAppNotification({
        userId,
        type: NotificationType.IN_APP,
        templateId: NotificationTemplates.AGREEMENT_COMPLETE,
        subject: 'Agreement Complete',
        body: `Both parties have signed the agreement for case ${data.caseReference}. You can now submit evidence and statements.`,
      });
    }

    // Email
    if (prefs.emailEnabled && prefs.caseUpdates) {
      await sendEmail({
        to: user.email,
        subject: `Agreement Complete - Case ${data.caseReference}`,
        text: `Both parties have signed the agreement for case ${data.caseReference}. You can now submit evidence and statements.`,
        html: `
          <h2>Agreement Complete</h2>
          <p>Hi ${user.name || 'there'},</p>
          <p>Both parties have signed the arbitration agreement for case <strong>${data.caseReference}</strong>.</p>
          <p>You can now submit your evidence and statement.</p>
          <p><a href="${APP_URL}/dashboard/cases/${data.caseId}">Go to Case Dashboard</a></p>
        `,
      });
    }
  }
}

// =============================================================================
// EVIDENCE NOTIFICATIONS
// =============================================================================

export async function notifyNewEvidence(
  targetUserId: string,
  data: {
    caseReference: string;
    caseId: string;
    uploaderName: string;
    fileName: string;
  }
): Promise<DispatchResult> {
  const result: DispatchResult = {};

  const user = await getUserWithContact(targetUserId);
  if (!user) return result;

  const prefs = await getUserNotificationPreferences(targetUserId);

  // In-app notification
  if (prefs.inAppEnabled && prefs.evidenceUploads) {
    const notificationId = await createInAppNotification({
      userId: targetUserId,
      type: NotificationType.IN_APP,
      templateId: NotificationTemplates.EVIDENCE_UPLOADED,
      subject: 'New Evidence',
      body: `${data.uploaderName} uploaded "${data.fileName}" in case ${data.caseReference}.`,
    });
    result.inApp = { success: true, notificationId };
  }

  // Email
  if (prefs.emailEnabled && prefs.evidenceUploads) {
    const emailResult = await sendEvidenceNotificationEmail(user.email, {
      recipientName: user.name || 'there',
      caseReference: data.caseReference,
      uploaderName: data.uploaderName,
      fileName: data.fileName,
      caseUrl: `${APP_URL}/dashboard/cases/${data.caseId}/evidence`,
    });
    result.email = { success: emailResult.success, error: emailResult.error };
  }

  // SMS
  if (prefs.smsEnabled && prefs.evidenceUploads && user.phone) {
    const smsResult = await sendTemplatedSms(
      user.phone,
      'newEvidence',
      { caseReference: data.caseReference },
      targetUserId
    );
    result.sms = { success: smsResult.success, error: smsResult.error };
  }

  return result;
}

// =============================================================================
// STATEMENT NOTIFICATIONS
// =============================================================================

export async function notifyNewStatement(
  targetUserId: string,
  data: {
    caseReference: string;
    caseId: string;
    submitterName: string;
    statementType: string;
  }
): Promise<DispatchResult> {
  const result: DispatchResult = {};

  const user = await getUserWithContact(targetUserId);
  if (!user) return result;

  const prefs = await getUserNotificationPreferences(targetUserId);

  // In-app notification
  if (prefs.inAppEnabled && prefs.caseUpdates) {
    const notificationId = await createInAppNotification({
      userId: targetUserId,
      type: NotificationType.IN_APP,
      templateId: NotificationTemplates.STATEMENT_SUBMITTED,
      subject: 'New Statement',
      body: `${data.submitterName} submitted a ${data.statementType.toLowerCase()} statement in case ${data.caseReference}.`,
    });
    result.inApp = { success: true, notificationId };
  }

  // Email
  if (prefs.emailEnabled && prefs.caseUpdates) {
    const emailResult = await sendEmail({
      to: user.email,
      subject: `New Statement - Case ${data.caseReference}`,
      text: `${data.submitterName} submitted a ${data.statementType.toLowerCase()} statement in case ${data.caseReference}.`,
      html: `
        <h2>New Statement Submitted</h2>
        <p>Hi ${user.name || 'there'},</p>
        <p><strong>${data.submitterName}</strong> has submitted a ${data.statementType.toLowerCase()} statement in case <strong>${data.caseReference}</strong>.</p>
        <p><a href="${APP_URL}/dashboard/cases/${data.caseId}/statement">View Statements</a></p>
      `,
    });
    result.email = { success: emailResult.success, error: emailResult.error };
  }

  // SMS
  if (prefs.smsEnabled && prefs.caseUpdates && user.phone) {
    const smsResult = await sendTemplatedSms(
      user.phone,
      'newStatement',
      { caseReference: data.caseReference },
      targetUserId
    );
    result.sms = { success: smsResult.success, error: smsResult.error };
  }

  return result;
}

// =============================================================================
// DEADLINE NOTIFICATIONS
// =============================================================================

export async function notifyDeadlineApproaching(
  userId: string,
  data: {
    caseReference: string;
    caseId: string;
    deadlineType: string;
    deadlineDate: Date;
    hoursRemaining: number;
  }
): Promise<DispatchResult> {
  const result: DispatchResult = {};

  const user = await getUserWithContact(userId);
  if (!user) return result;

  const prefs = await getUserNotificationPreferences(userId);
  const templateId =
    data.hoursRemaining <= 24
      ? NotificationTemplates.DEADLINE_24H_WARNING
      : NotificationTemplates.EVIDENCE_DEADLINE_REMINDER;

  const isUrgent = data.hoursRemaining <= 24;

  // In-app notification
  if (prefs.inAppEnabled && prefs.deadlineReminders) {
    const notificationId = await createInAppNotification({
      userId,
      type: NotificationType.IN_APP,
      templateId,
      subject: isUrgent ? 'URGENT: Deadline Tomorrow' : 'Deadline Reminder',
      body: `${isUrgent ? 'URGENT: ' : ''}${data.deadlineType} deadline for case ${data.caseReference} is ${data.deadlineDate.toLocaleDateString()}.`,
    });
    result.inApp = { success: true, notificationId };
  }

  // Email
  if (prefs.emailEnabled && prefs.deadlineReminders) {
    const emailResult = await sendDeadlineReminderEmail(user.email, {
      recipientName: user.name || 'there',
      caseReference: data.caseReference,
      deadlineType: data.deadlineType,
      deadlineDate:
        data.deadlineDate.toLocaleDateString() + ' at ' + data.deadlineDate.toLocaleTimeString(),
      caseUrl: `${APP_URL}/dashboard/cases/${data.caseId}`,
    });
    result.email = { success: emailResult.success, error: emailResult.error };
  }

  // SMS (only for urgent deadlines)
  if (isUrgent && prefs.smsEnabled && prefs.deadlineReminders && user.phone) {
    const smsResult = await sendTemplatedSms(
      user.phone,
      'deadline24h',
      { caseReference: data.caseReference, deadlineType: data.deadlineType },
      userId
    );
    result.sms = { success: smsResult.success, error: smsResult.error };
  }

  return result;
}

// =============================================================================
// AWARD NOTIFICATIONS
// =============================================================================

export async function notifyAwardIssued(
  userId: string,
  data: {
    caseReference: string;
    caseId: string;
    prevailingParty: string;
    awardAmount?: string;
  }
): Promise<DispatchResult> {
  const result: DispatchResult = {};

  const user = await getUserWithContact(userId);
  if (!user) return result;

  const prefs = await getUserNotificationPreferences(userId);

  // In-app notification
  if (prefs.inAppEnabled && prefs.awardNotifications) {
    const notificationId = await createInAppNotification({
      userId,
      type: NotificationType.IN_APP,
      templateId: NotificationTemplates.AWARD_ISSUED,
      subject: 'Award Issued',
      body: `The arbitration award for case ${data.caseReference} has been issued. Prevailing party: ${data.prevailingParty}.`,
    });
    result.inApp = { success: true, notificationId };
  }

  // Email
  if (prefs.emailEnabled && prefs.awardNotifications) {
    const awardSummary = data.awardAmount
      ? `<p><strong>Award Amount:</strong> ${data.awardAmount}</p><p><strong>Prevailing Party:</strong> ${data.prevailingParty}</p>`
      : `<p><strong>Prevailing Party:</strong> ${data.prevailingParty}</p>`;

    const emailResult = await sendAwardIssuedEmail(user.email, {
      recipientName: user.name || 'there',
      caseReference: data.caseReference,
      awardSummary,
      caseUrl: `${APP_URL}/dashboard/cases/${data.caseId}`,
    });
    result.email = { success: emailResult.success, error: emailResult.error };
  }

  // SMS
  if (prefs.smsEnabled && prefs.awardNotifications && user.phone) {
    const smsResult = await sendTemplatedSms(
      user.phone,
      'awardIssued',
      { caseReference: data.caseReference },
      userId
    );
    result.sms = { success: smsResult.success, error: smsResult.error };
  }

  return result;
}

// =============================================================================
// KYC NOTIFICATIONS
// =============================================================================

export async function notifyKycResult(userId: string, success: boolean): Promise<DispatchResult> {
  const result: DispatchResult = {};

  const user = await getUserWithContact(userId);
  if (!user) return result;

  const prefs = await getUserNotificationPreferences(userId);
  const templateId = success
    ? NotificationTemplates.KYC_APPROVED
    : NotificationTemplates.KYC_FAILED;

  // In-app notification
  if (prefs.inAppEnabled) {
    const notificationId = await createInAppNotification({
      userId,
      type: NotificationType.IN_APP,
      templateId,
      subject: success ? 'Identity Verified' : 'Verification Failed',
      body: success
        ? 'Your identity has been verified. You can now participate in arbitration cases.'
        : 'Your identity verification was not successful. Please try again.',
    });
    result.inApp = { success: true, notificationId };
  }

  // Email
  if (prefs.emailEnabled) {
    const emailResult = await sendEmail({
      to: user.email,
      subject: success ? 'Identity Verification Approved' : 'Identity Verification Failed',
      text: success
        ? 'Your identity has been verified. You can now participate in arbitration cases.'
        : 'Your identity verification was not successful. Please try again.',
      html: success
        ? `
          <h2>Identity Verified</h2>
          <p>Hi ${user.name || 'there'},</p>
          <p>Your identity has been successfully verified. You can now participate in arbitration cases.</p>
          <p><a href="${APP_URL}/dashboard">Go to Dashboard</a></p>
        `
        : `
          <h2>Verification Failed</h2>
          <p>Hi ${user.name || 'there'},</p>
          <p>Your identity verification was not successful. Please try again with clear photos of your valid government-issued ID.</p>
          <p><a href="${APP_URL}/dashboard/settings">Retry Verification</a></p>
        `,
    });
    result.email = { success: emailResult.success, error: emailResult.error };
  }

  // SMS
  if (prefs.smsEnabled && user.phone) {
    const smsResult = await sendTemplatedSms(
      user.phone,
      success ? 'kycApproved' : 'kycFailed',
      {},
      userId
    );
    result.sms = { success: smsResult.success, error: smsResult.error };
  }

  return result;
}

// =============================================================================
// WELCOME NOTIFICATION
// =============================================================================

export async function notifyWelcome(userId: string): Promise<DispatchResult> {
  const result: DispatchResult = {};

  const user = await getUserWithContact(userId);
  if (!user) return result;

  // In-app notification
  await createInAppNotification({
    userId,
    type: NotificationType.IN_APP,
    templateId: NotificationTemplates.WELCOME,
    subject: 'Welcome to Settleright.ai',
    body: 'Welcome! Complete your identity verification to get started with arbitration.',
  });
  result.inApp = { success: true };

  // Email
  const emailResult = await sendWelcomeEmail(user.email, {
    name: user.name || 'there',
    loginUrl: `${APP_URL}/dashboard`,
  });
  result.email = { success: emailResult.success, error: emailResult.error };

  return result;
}
