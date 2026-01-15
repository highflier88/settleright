/**
 * Admin Arbitrator Credentials API
 *
 * GET /api/admin/arbitrators/credentials - Get pending verifications
 * POST /api/admin/arbitrators/credentials - Verify credentials
 */

import { type NextRequest, NextResponse } from 'next/server';

import {
  getPendingVerifications,
  getExpiringCredentials,
  verifyCredentials,
  type AdminVerificationInput,
} from '@/lib/arbitrator';
import { requireRole } from '@/lib/auth';

import type { CredentialVerificationStatus } from '@prisma/client';

export async function GET(request: NextRequest) {
  try {
    // Verify admin role
    await requireRole('ADMIN');

    const { searchParams } = new URL(request.url);
    const view = searchParams.get('view') || 'pending';
    const limit = parseInt(searchParams.get('limit') || '50');
    const offset = parseInt(searchParams.get('offset') || '0');

    if (view === 'expiring') {
      const daysUntilExpiry = parseInt(searchParams.get('days') || '30');
      const expiring = await getExpiringCredentials(daysUntilExpiry);

      return NextResponse.json({
        success: true,
        data: {
          credentials: expiring,
          count: expiring.length,
        },
      });
    }

    // Default: pending verifications
    const pending = await getPendingVerifications({ limit, offset });

    return NextResponse.json({
      success: true,
      data: {
        credentials: pending,
        count: pending.length,
      },
    });
  } catch (error) {
    console.error('[Admin Credentials API] GET error:', error);
    const message = error instanceof Error ? error.message : 'Failed to get credentials';
    const status = message.includes('required') || message.includes('Insufficient') ? 401 : 500;
    return NextResponse.json({ success: false, error: message }, { status });
  }
}

export async function POST(request: NextRequest) {
  try {
    // Verify admin role
    const user = await requireRole('ADMIN');

    const body = (await request.json()) as {
      arbitratorProfileId: string;
      status: CredentialVerificationStatus;
      notes?: string;
      expiresAt?: string;
    };

    if (!body.arbitratorProfileId) {
      return NextResponse.json(
        { success: false, error: 'Arbitrator profile ID is required' },
        { status: 400 }
      );
    }

    if (!body.status) {
      return NextResponse.json(
        { success: false, error: 'Verification status is required' },
        { status: 400 }
      );
    }

    const validStatuses: CredentialVerificationStatus[] = [
      'PENDING',
      'IN_REVIEW',
      'VERIFIED',
      'REJECTED',
      'EXPIRED',
    ];
    if (!validStatuses.includes(body.status)) {
      return NextResponse.json(
        { success: false, error: 'Invalid verification status' },
        { status: 400 }
      );
    }

    const input: AdminVerificationInput = {
      arbitratorProfileId: body.arbitratorProfileId,
      adminUserId: user.id,
      status: body.status,
      notes: body.notes,
      expiresAt: body.expiresAt ? new Date(body.expiresAt) : undefined,
    };

    const result = await verifyCredentials(input);

    return NextResponse.json({
      success: true,
      data: result,
    });
  } catch (error) {
    console.error('[Admin Credentials API] POST error:', error);
    const message = error instanceof Error ? error.message : 'Failed to verify credentials';
    const status = message.includes('required') || message.includes('Insufficient') ? 401 : 500;
    return NextResponse.json({ success: false, error: message }, { status });
  }
}
