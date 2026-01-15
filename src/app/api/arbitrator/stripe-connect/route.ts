/**
 * Arbitrator Stripe Connect API
 *
 * GET /api/arbitrator/stripe-connect - Get Connect account status
 * POST /api/arbitrator/stripe-connect - Create/setup Connect account
 */

import { type NextRequest, NextResponse } from 'next/server';

import { auth } from '@clerk/nextjs/server';

import {
  createConnectAccount,
  getAccountStatus,
  getDetailedAccountStatus,
  generateDashboardLink,
  isStripeConnectConfigured,
} from '@/lib/arbitrator';
import { prisma } from '@/lib/db';

export async function GET(request: NextRequest) {
  try {
    const { userId: clerkId } = auth();

    if (!clerkId) {
      return NextResponse.json(
        { success: false, error: 'Unauthorized' },
        { status: 401 }
      );
    }

    // Check configuration
    if (!isStripeConnectConfigured()) {
      return NextResponse.json({
        success: true,
        data: {
          configured: false,
          message: 'Stripe Connect is not configured',
        },
      });
    }

    // Get user and profile
    const user = await prisma.user.findUnique({
      where: { clerkId },
      include: { arbitratorProfile: true },
    });

    if (!user) {
      return NextResponse.json(
        { success: false, error: 'User not found' },
        { status: 404 }
      );
    }

    if (!user.arbitratorProfile) {
      return NextResponse.json(
        { success: false, error: 'Arbitrator profile not found' },
        { status: 404 }
      );
    }

    const { searchParams } = new URL(request.url);
    const detailed = searchParams.get('detailed') === 'true';

    if (detailed) {
      const status = await getDetailedAccountStatus(user.arbitratorProfile.id);
      return NextResponse.json({
        success: true,
        data: {
          configured: true,
          ...status,
        },
      });
    }

    const status = await getAccountStatus(user.arbitratorProfile.id);

    return NextResponse.json({
      success: true,
      data: {
        configured: true,
        ...status,
      },
    });
  } catch (error) {
    console.error('[Stripe Connect API] GET error:', error);
    const message = error instanceof Error ? error.message : 'Failed to get account status';
    return NextResponse.json(
      { success: false, error: message },
      { status: 500 }
    );
  }
}

export async function POST(request: NextRequest) {
  try {
    const { userId: clerkId } = auth();

    if (!clerkId) {
      return NextResponse.json(
        { success: false, error: 'Unauthorized' },
        { status: 401 }
      );
    }

    // Check configuration
    if (!isStripeConnectConfigured()) {
      return NextResponse.json(
        { success: false, error: 'Stripe Connect is not configured' },
        { status: 500 }
      );
    }

    // Get user and profile
    const user = await prisma.user.findUnique({
      where: { clerkId },
      include: { arbitratorProfile: true },
    });

    if (!user) {
      return NextResponse.json(
        { success: false, error: 'User not found' },
        { status: 404 }
      );
    }

    if (!user.arbitratorProfile) {
      return NextResponse.json(
        { success: false, error: 'Arbitrator profile not found. Complete onboarding first.' },
        { status: 400 }
      );
    }

    // Check onboarding status
    if (user.arbitratorProfile.onboardingStatus !== 'COMPLETED') {
      return NextResponse.json(
        { success: false, error: 'Complete arbitrator onboarding first' },
        { status: 400 }
      );
    }

    const body = await request.json() as { action?: string };

    // If action is 'dashboard', generate dashboard link
    if (body.action === 'dashboard') {
      if (!user.arbitratorProfile.stripeConnectId) {
        return NextResponse.json(
          { success: false, error: 'No Stripe Connect account found' },
          { status: 400 }
        );
      }

      const dashboardUrl = await generateDashboardLink(
        user.arbitratorProfile.stripeConnectId
      );

      return NextResponse.json({
        success: true,
        data: { dashboardUrl },
      });
    }

    // Default: create/get account
    const result = await createConnectAccount(user.arbitratorProfile.id);

    return NextResponse.json({
      success: true,
      data: result,
    });
  } catch (error) {
    console.error('[Stripe Connect API] POST error:', error);
    const message = error instanceof Error ? error.message : 'Failed to setup Stripe Connect';
    return NextResponse.json(
      { success: false, error: message },
      { status: 500 }
    );
  }
}
