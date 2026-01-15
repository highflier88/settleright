import { auth, currentUser } from '@clerk/nextjs/server';

import { prisma } from './db';
import { UnauthorizedError, ForbiddenError } from './api/errors';

import type { UserRole } from '@prisma/client';
import type { User } from '@prisma/client';

// Check if we're in test/load-test mode
const isTestMode = process.env.NODE_ENV === 'test' || process.env.LOAD_TEST_MODE === 'true';

// Test user for load testing (will be created on first use)
let testUser: User | null = null;

async function getOrCreateTestUser(): Promise<User> {
  if (testUser) return testUser;

  // Find or create a test user for load testing
  testUser = await prisma.user.upsert({
    where: { email: 'loadtest@settleright.ai' },
    update: {},
    create: {
      clerkId: 'test_clerk_id_loadtest',
      email: 'loadtest@settleright.ai',
      name: 'Load Test User',
      role: 'USER',
    },
  });

  // Ensure identity verification exists and is verified
  await prisma.identityVerification.upsert({
    where: { userId: testUser.id },
    update: { status: 'VERIFIED', verifiedAt: new Date() },
    create: {
      userId: testUser.id,
      status: 'VERIFIED',
      provider: 'test',
      verifiedAt: new Date(),
      verifiedName: 'Load Test User',
    },
  });

  return testUser;
}

export async function getAuthUser(): Promise<User | null> {
  // In test mode, return a test user
  if (isTestMode) {
    return getOrCreateTestUser();
  }

  const { userId: clerkId } = auth();
  if (!clerkId) return null;

  const user = await prisma.user.findUnique({
    where: { clerkId },
  });

  return user;
}

export async function requireAuth(): Promise<User> {
  const user = await getAuthUser();
  if (!user) {
    throw new UnauthorizedError('Authentication required');
  }
  return user;
}

export async function requireRole(roles: UserRole | UserRole[]): Promise<User> {
  const user = await requireAuth();
  const allowedRoles = Array.isArray(roles) ? roles : [roles];

  if (!allowedRoles.includes(user.role)) {
    throw new ForbiddenError('Insufficient permissions');
  }

  return user;
}

export async function syncUserFromClerk(): Promise<User> {
  const clerkUser = await currentUser();
  if (!clerkUser) {
    throw new UnauthorizedError('Not authenticated');
  }

  const email = clerkUser.emailAddresses[0]?.emailAddress;
  if (!email) {
    throw new UnauthorizedError('No email found');
  }

  const user = await prisma.user.upsert({
    where: { clerkId: clerkUser.id },
    update: {
      email,
      name: `${clerkUser.firstName ?? ''} ${clerkUser.lastName ?? ''}`.trim() || null,
      phone: clerkUser.phoneNumbers[0]?.phoneNumber ?? null,
      lastLoginAt: new Date(),
    },
    create: {
      clerkId: clerkUser.id,
      email,
      name: `${clerkUser.firstName ?? ''} ${clerkUser.lastName ?? ''}`.trim() || null,
      phone: clerkUser.phoneNumbers[0]?.phoneNumber ?? null,
    },
  });

  return user;
}

export function getClerkAuth() {
  return auth();
}
