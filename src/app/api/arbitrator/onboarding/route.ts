/**
 * Arbitrator Onboarding API
 *
 * GET /api/arbitrator/onboarding - Get onboarding status/progress
 * POST /api/arbitrator/onboarding - Complete onboarding
 * PATCH /api/arbitrator/onboarding - Save progress
 */

import { type NextRequest, NextResponse } from 'next/server';

import { auth } from '@clerk/nextjs/server';


import {
  initializeOnboarding,
  completeOnboarding,
  saveOnboardingProgress,
  getOnboardingProgress,
  getArbitratorProfile,
  canBecomeArbitrator,
  getAvailableJurisdictions,
  getAvailableSpecialties,
  type ArbitratorOnboardingInput,
} from '@/lib/arbitrator';
import { prisma } from '@/lib/db';

import type { DisputeType } from '@prisma/client';

export async function GET(_request: NextRequest) {
  try {
    const { userId: clerkId } = auth();

    if (!clerkId) {
      return NextResponse.json(
        { success: false, error: 'Unauthorized' },
        { status: 401 }
      );
    }

    // Get user
    const user = await prisma.user.findUnique({
      where: { clerkId },
    });

    if (!user) {
      return NextResponse.json(
        { success: false, error: 'User not found' },
        { status: 404 }
      );
    }

    // Check eligibility
    const eligibility = await canBecomeArbitrator(user.id);

    // Get current progress
    const profile = await getArbitratorProfile(user.id);
    const progress = await getOnboardingProgress(user.id);

    // Get available options for the form
    const jurisdictions = getAvailableJurisdictions();
    const specialties = getAvailableSpecialties();

    return NextResponse.json({
      success: true,
      data: {
        eligible: eligibility.eligible,
        eligibilityReason: eligibility.reason,
        profile,
        progress,
        options: {
          jurisdictions,
          specialties,
        },
      },
    });
  } catch (error) {
    console.error('[Arbitrator Onboarding API] GET error:', error);
    const message = error instanceof Error ? error.message : 'Failed to get onboarding status';
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

    // Get user
    const user = await prisma.user.findUnique({
      where: { clerkId },
    });

    if (!user) {
      return NextResponse.json(
        { success: false, error: 'User not found' },
        { status: 404 }
      );
    }

    // Check eligibility
    const eligibility = await canBecomeArbitrator(user.id);
    if (!eligibility.eligible) {
      return NextResponse.json(
        { success: false, error: eligibility.reason || 'Not eligible to become an arbitrator' },
        { status: 400 }
      );
    }

    const body = await request.json() as {
      barNumber: string;
      barState: string;
      isRetiredJudge: boolean;
      yearsExperience: number;
      lawSchool?: string;
      graduationYear?: number;
      biography?: string;
      jurisdictions: string[];
      specialties: DisputeType[];
      maxCasesPerWeek?: number;
      agreedToTerms: boolean;
    };

    // Validate required fields
    if (!body.barNumber || !body.barState) {
      return NextResponse.json(
        { success: false, error: 'Bar number and state are required' },
        { status: 400 }
      );
    }

    if (!body.jurisdictions || body.jurisdictions.length === 0) {
      return NextResponse.json(
        { success: false, error: 'At least one jurisdiction is required' },
        { status: 400 }
      );
    }

    if (!body.specialties || body.specialties.length === 0) {
      return NextResponse.json(
        { success: false, error: 'At least one specialty is required' },
        { status: 400 }
      );
    }

    if (!body.agreedToTerms) {
      return NextResponse.json(
        { success: false, error: 'Must agree to terms and conditions' },
        { status: 400 }
      );
    }

    // Complete onboarding
    const input: ArbitratorOnboardingInput = {
      userId: user.id,
      barNumber: body.barNumber,
      barState: body.barState,
      isRetiredJudge: body.isRetiredJudge || false,
      yearsExperience: body.yearsExperience,
      lawSchool: body.lawSchool,
      graduationYear: body.graduationYear,
      biography: body.biography,
      jurisdictions: body.jurisdictions,
      specialties: body.specialties,
      maxCasesPerWeek: body.maxCasesPerWeek || 10,
      agreedToTerms: body.agreedToTerms,
    };

    const result = await completeOnboarding(input);

    // Update user role to ARBITRATOR
    await prisma.user.update({
      where: { id: user.id },
      data: { role: 'ARBITRATOR' },
    });

    return NextResponse.json({
      success: true,
      data: result,
    });
  } catch (error) {
    console.error('[Arbitrator Onboarding API] POST error:', error);
    const message = error instanceof Error ? error.message : 'Failed to complete onboarding';
    return NextResponse.json(
      { success: false, error: message },
      { status: 500 }
    );
  }
}

export async function PATCH(request: NextRequest) {
  try {
    const { userId: clerkId } = auth();

    if (!clerkId) {
      return NextResponse.json(
        { success: false, error: 'Unauthorized' },
        { status: 401 }
      );
    }

    // Get user
    const user = await prisma.user.findUnique({
      where: { clerkId },
    });

    if (!user) {
      return NextResponse.json(
        { success: false, error: 'User not found' },
        { status: 404 }
      );
    }

    // Initialize onboarding if needed
    await initializeOnboarding(user.id);

    const body = await request.json() as Partial<ArbitratorOnboardingInput>;

    // Save progress
    await saveOnboardingProgress(user.id, body);

    // Get updated progress
    const progress = await getOnboardingProgress(user.id);

    return NextResponse.json({
      success: true,
      data: { progress },
    });
  } catch (error) {
    console.error('[Arbitrator Onboarding API] PATCH error:', error);
    const message = error instanceof Error ? error.message : 'Failed to save progress';
    return NextResponse.json(
      { success: false, error: message },
      { status: 500 }
    );
  }
}
