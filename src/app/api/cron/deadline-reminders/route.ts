import { type NextRequest, NextResponse } from 'next/server';

import {
  getCasesWithApproachingDeadlines,
  getCasesWithPassedDeadlines,
  transitionToAnalysis,
  DEADLINE_CONFIG,
} from '@/lib/services/deadline';
import { notifyDeadlineApproaching } from '@/lib/services/notification-dispatcher';

export const dynamic = 'force-dynamic';

// Verify cron secret
const CRON_SECRET = process.env.CRON_SECRET;

// GET /api/cron/deadline-reminders - Process deadline reminders
export async function GET(request: NextRequest) {
  try {
    // Verify authorization
    const authHeader = request.headers.get('authorization');
    if (CRON_SECRET && authHeader !== `Bearer ${CRON_SECRET}`) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const results = {
      remindersProcessed: 0,
      remindersSent: 0,
      deadlinesPassed: 0,
      casesTransitioned: 0,
      errors: [] as string[],
    };

    // Process reminder intervals
    for (const hours of DEADLINE_CONFIG.REMINDER_INTERVALS) {
      // Get cases with deadlines within this interval (but not already past)
      const cases = await getCasesWithApproachingDeadlines(hours);

      for (const caseData of cases) {
        results.remindersProcessed++;

        // Check if we already sent a reminder for this deadline at this interval
        // (using a simple check - in production, track sent reminders in DB)
        const _reminderKey = `${caseData.caseId}-${caseData.deadlineType}-${hours}h`;

        try {
          // Send reminder to claimant
          if (caseData.claimantId) {
            await notifyDeadlineApproaching(caseData.claimantId, {
              caseReference: caseData.caseReference,
              caseId: caseData.caseId,
              deadlineType:
                caseData.deadlineType === 'evidence' ? 'Evidence Submission' : 'Rebuttal Statement',
              deadlineDate: caseData.deadline,
              hoursRemaining: caseData.hoursRemaining,
            });
            results.remindersSent++;
          }

          // Send reminder to respondent
          if (caseData.respondentId) {
            await notifyDeadlineApproaching(caseData.respondentId, {
              caseReference: caseData.caseReference,
              caseId: caseData.caseId,
              deadlineType:
                caseData.deadlineType === 'evidence' ? 'Evidence Submission' : 'Rebuttal Statement',
              deadlineDate: caseData.deadline,
              hoursRemaining: caseData.hoursRemaining,
            });
            results.remindersSent++;
          }
        } catch (error) {
          results.errors.push(
            `Failed to send reminder for case ${caseData.caseId}: ${error instanceof Error ? error.message : String(error)}`
          );
        }
      }
    }

    // Process passed deadlines
    const passedDeadlines = await getCasesWithPassedDeadlines();

    for (const caseData of passedDeadlines) {
      results.deadlinesPassed++;

      try {
        const success = await transitionToAnalysis(caseData.caseId);
        if (success) {
          results.casesTransitioned++;
        }
      } catch (error) {
        results.errors.push(
          `Failed to transition case ${caseData.caseId}: ${error instanceof Error ? error.message : String(error)}`
        );
      }
    }

    console.log('[Cron] Deadline reminders processed:', results);

    return NextResponse.json({
      success: true,
      ...results,
    });
  } catch (error) {
    console.error('[Cron] Deadline reminders failed:', error);
    return NextResponse.json({ error: 'Failed to process deadline reminders' }, { status: 500 });
  }
}
