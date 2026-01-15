import { type NextRequest, NextResponse } from 'next/server';

import { KYCStatus } from '@prisma/client';

import { prisma } from '@/lib/db';

// This cron job runs daily to check for expired KYC verifications
// Configure in vercel.json: { "path": "/api/cron/check-expired-kyc", "schedule": "0 0 * * *" }

export async function GET(request: NextRequest) {
  // Verify cron secret
  const authHeader = request.headers.get('authorization');
  const cronSecret = process.env.CRON_SECRET;

  if (cronSecret && authHeader !== `Bearer ${cronSecret}`) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  try {
    // Find verifications that are VERIFIED but have expired
    const now = new Date();

    const expiredVerifications = await prisma.identityVerification.findMany({
      where: {
        status: KYCStatus.VERIFIED,
        expiresAt: {
          lt: now,
        },
      },
      select: {
        id: true,
        userId: true,
        expiresAt: true,
      },
    });

    if (expiredVerifications.length === 0) {
      return NextResponse.json({
        success: true,
        message: 'No expired verifications found',
        count: 0,
      });
    }

    // Update all expired verifications
    const updateResult = await prisma.identityVerification.updateMany({
      where: {
        id: {
          in: expiredVerifications.map((v) => v.id),
        },
      },
      data: {
        status: KYCStatus.EXPIRED,
      },
    });

    // Log the expiration
    console.log(`Marked ${updateResult.count} KYC verifications as expired`);

    // TODO: Send notification emails to users about expired verification
    // This can be added once the email service is set up

    return NextResponse.json({
      success: true,
      message: `Marked ${updateResult.count} verifications as expired`,
      count: updateResult.count,
      userIds: expiredVerifications.map((v) => v.userId),
    });
  } catch (error) {
    console.error('Error checking expired KYC:', error);
    return NextResponse.json(
      { error: 'Failed to check expired verifications' },
      { status: 500 }
    );
  }
}
