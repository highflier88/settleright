/**
 * Auth Mock Helpers
 *
 * Provides utilities for mocking authentication in tests.
 */

import { createUser, createArbitrator, createAdmin } from '../factories/user';
import { generateId } from '../factories/utils';

import type { UserRole } from '@prisma/client';

export interface MockAuthSession {
  userId: string;
  sessionId: string;
  claims: {
    sub: string;
    email: string;
    email_verified: boolean;
    name: string;
    role: UserRole;
  };
}

export interface MockClerkUser {
  id: string;
  primaryEmailAddress: {
    emailAddress: string;
  };
  firstName: string | null;
  lastName: string | null;
  publicMetadata: {
    role?: UserRole;
  };
}

/**
 * Create a mock Clerk auth object
 */
export function createMockClerkAuth(userId?: string) {
  const id = userId ?? generateId();
  return {
    userId: id,
    sessionId: `sess_${generateId()}`,
    getToken: jest.fn().mockResolvedValue(`token_${generateId()}`),
  };
}

/**
 * Create a mock Clerk user
 */
export function createMockClerkUser(
  options: Partial<MockClerkUser> = {}
): MockClerkUser {
  return {
    id: options.id ?? generateId(),
    primaryEmailAddress: {
      emailAddress: options.primaryEmailAddress?.emailAddress ?? 'test@example.com',
    },
    firstName: options.firstName ?? 'Test',
    lastName: options.lastName ?? 'User',
    publicMetadata: {
      role: options.publicMetadata?.role ?? 'USER',
    },
  };
}

/**
 * Create a mock auth session
 */
export function createMockAuthSession(
  options: Partial<MockAuthSession> = {}
): MockAuthSession {
  const userId = options.userId ?? generateId();
  return {
    userId,
    sessionId: options.sessionId ?? `sess_${generateId()}`,
    claims: {
      sub: userId,
      email: options.claims?.email ?? 'test@example.com',
      email_verified: options.claims?.email_verified ?? true,
      name: options.claims?.name ?? 'Test User',
      role: options.claims?.role ?? 'USER',
    },
  };
}

/**
 * Create a mock authenticated context for testing
 */
export function createMockAuthContext(role: UserRole = 'USER') {
  const user =
    role === 'ADMIN'
      ? createAdmin()
      : role === 'ARBITRATOR'
        ? createArbitrator()
        : createUser({ role });

  return {
    user,
    session: createMockAuthSession({
      userId: user.id,
      claims: {
        sub: user.id,
        email: user.email,
        email_verified: user.emailVerified,
        name: user.name ?? 'Test User',
        role: user.role,
      },
    }),
    clerkUser: createMockClerkUser({
      id: user.clerkId,
      primaryEmailAddress: { emailAddress: user.email },
      firstName: user.name?.split(' ')[0] ?? null,
      lastName: user.name?.split(' ').slice(1).join(' ') ?? null,
      publicMetadata: { role: user.role },
    }),
  };
}

/**
 * Setup Clerk mocks for authenticated requests
 */
export function setupClerkMocks(role: UserRole = 'USER') {
  const context = createMockAuthContext(role);

  // Mock currentUser
  jest.mock('@clerk/nextjs', () => ({
    currentUser: jest.fn().mockResolvedValue(context.clerkUser),
    auth: jest.fn().mockReturnValue(createMockClerkAuth(context.user.id)),
    clerkClient: {
      users: {
        getUser: jest.fn().mockResolvedValue(context.clerkUser),
        updateUserMetadata: jest.fn().mockResolvedValue(context.clerkUser),
      },
    },
  }));

  return context;
}

/**
 * Mock the getServerSession function
 */
export function mockGetServerSession(session: MockAuthSession | null) {
  return jest.fn().mockResolvedValue(session);
}

/**
 * Mock withAuth middleware to pass through with user
 */
export function createMockWithAuth(user: { id: string; role: UserRole; email: string }) {
  return (handler: (req: unknown, ctx: unknown) => Promise<unknown>) => {
    return async (req: unknown, ctx: unknown) => {
      const authenticatedReq = { ...(req as object), user };
      return handler(authenticatedReq, ctx);
    };
  };
}
