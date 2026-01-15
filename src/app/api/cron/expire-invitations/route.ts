import { type NextRequest, NextResponse } from 'next/server';

import { expireOldInvitations } from '@/lib/services/invitation';

// This cron job runs daily to expire old invitations
// Configure in vercel.json: { "path": "/api/cron/expire-invitations", "schedule": "0 0 * * *" }

export async function GET(request: NextRequest) {
  // Verify cron secret
  const authHeader = request.headers.get('authorization');
  const cronSecret = process.env.CRON_SECRET;

  if (cronSecret && authHeader !== `Bearer ${cronSecret}`) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  try {
    const expiredCount = await expireOldInvitations();

    return NextResponse.json({
      success: true,
      message: `Expired ${expiredCount} invitations`,
      count: expiredCount,
    });
  } catch (error) {
    console.error('Error expiring invitations:', error);
    return NextResponse.json(
      { error: 'Failed to expire invitations' },
      { status: 500 }
    );
  }
}
