/**
 * Arbitrator Credentials API
 *
 * GET /api/arbitrator/credentials - Get credential status
 * POST /api/arbitrator/credentials - Submit credentials for verification
 */

import { type NextRequest, NextResponse } from 'next/server';

import { auth } from '@clerk/nextjs/server';

import {
  getCredentialStatus,
  submitCredentials,
  areCredentialsValid,
  getBarVerificationUrl,
} from '@/lib/arbitrator';
import { prisma } from '@/lib/db';

export async function GET(_request: NextRequest) {
  try {
    const { userId: clerkId } = auth();

    if (!clerkId) {
      return NextResponse.json(
        { success: false, error: 'Unauthorized' },
        { status: 401 }
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
        { success: false, error: 'Arbitrator profile not found' },
        { status: 404 }
      );
    }

    // Get credential status
    const status = await getCredentialStatus(user.arbitratorProfile.id);
    const validity = await areCredentialsValid(user.arbitratorProfile.id);

    // Get verification URL if applicable
    const verificationUrl = user.arbitratorProfile.barState
      ? getBarVerificationUrl(user.arbitratorProfile.barState)
      : null;

    return NextResponse.json({
      success: true,
      data: {
        ...status,
        isValid: validity.valid,
        validityReason: validity.reason,
        barNumber: user.arbitratorProfile.barNumber,
        barState: user.arbitratorProfile.barState,
        verificationUrl,
      },
    });
  } catch (error) {
    console.error('[Arbitrator Credentials API] GET error:', error);
    const message = error instanceof Error ? error.message : 'Failed to get credential status';
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

    const body = await request.json() as {
      barNumber: string;
      barState: string;
      isRetiredJudge?: boolean;
    };

    if (!body.barNumber || !body.barState) {
      return NextResponse.json(
        { success: false, error: 'Bar number and state are required' },
        { status: 400 }
      );
    }

    // Submit credentials
    const result = await submitCredentials({
      arbitratorProfileId: user.arbitratorProfile.id,
      barNumber: body.barNumber,
      barState: body.barState,
      isRetiredJudge: body.isRetiredJudge,
    });

    return NextResponse.json({
      success: true,
      data: result,
    });
  } catch (error) {
    console.error('[Arbitrator Credentials API] POST error:', error);
    const message = error instanceof Error ? error.message : 'Failed to submit credentials';
    return NextResponse.json(
      { success: false, error: message },
      { status: 500 }
    );
  }
}
