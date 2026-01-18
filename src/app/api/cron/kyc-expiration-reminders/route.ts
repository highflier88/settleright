import { type NextRequest, NextResponse } from 'next/server';

import { processExpirationReminders } from '@/lib/services/kyc-reminder';

// This cron job runs daily at 9 AM UTC to send KYC expiration reminders
// Configure in vercel.json: { "path": "/api/cron/kyc-expiration-reminders", "schedule": "0 9 * * *" }
// Note: Due to Vercel Hobby plan cron limit (2 crons), this may need to be triggered manually
// or via an external scheduler.

export async function GET(request: NextRequest) {
  // Verify cron secret
  const authHeader = request.headers.get('authorization');
  const cronSecret = process.env.CRON_SECRET;

  if (cronSecret && authHeader !== `Bearer ${cronSecret}`) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  try {
    console.log('Starting KYC expiration reminders processing...');

    const results = await processExpirationReminders();

    console.log('KYC expiration reminders processed:', results);

    return NextResponse.json({
      success: true,
      message: 'KYC expiration reminders processed',
      results: {
        thirtyDayReminders: results.thirtyDayReminders,
        fourteenDayReminders: results.fourteenDayReminders,
        sevenDayReminders: results.sevenDayReminders,
        expiredNotices: results.expiredNotices,
        markedExpired: results.markedExpired,
        totalEmailsSent:
          results.thirtyDayReminders +
          results.fourteenDayReminders +
          results.sevenDayReminders +
          results.expiredNotices,
      },
    });
  } catch (error) {
    console.error('Error processing KYC expiration reminders:', error);
    return NextResponse.json(
      { error: 'Failed to process expiration reminders' },
      { status: 500 }
    );
  }
}
