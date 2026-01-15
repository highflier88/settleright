import { auth } from '@clerk/nextjs/server';

import { setSession, getSession, deleteSession } from './storage/kv';
import { prisma } from './db';

export interface SessionMetadata {
  userId: string;
  clerkSessionId: string;
  createdAt: number;
  lastActiveAt: number;
  ipAddress?: string;
  userAgent?: string;
  deviceInfo?: {
    browser?: string;
    os?: string;
    device?: string;
  };
}

const SESSION_TTL = 60 * 60 * 24 * 7; // 7 days

export async function createSessionMetadata(
  metadata: Omit<SessionMetadata, 'createdAt' | 'lastActiveAt'>
): Promise<void> {
  const sessionData: SessionMetadata = {
    ...metadata,
    createdAt: Date.now(),
    lastActiveAt: Date.now(),
  };

  await setSession(metadata.clerkSessionId, sessionData, SESSION_TTL);
}

export async function getSessionMetadata(
  sessionId: string
): Promise<SessionMetadata | null> {
  return getSession<SessionMetadata>(sessionId);
}

export async function updateSessionActivity(sessionId: string): Promise<void> {
  const session = await getSessionMetadata(sessionId);
  if (session) {
    await setSession(
      sessionId,
      { ...session, lastActiveAt: Date.now() },
      SESSION_TTL
    );
  }
}

export async function terminateSession(sessionId: string): Promise<void> {
  await deleteSession(sessionId);
}

export function getUserActiveSessions(_userId: string): SessionMetadata[] {
  // In production, you'd want to maintain a set of session IDs per user
  // This is a simplified version that relies on Clerk's session management
  // For full session listing, we'd need to store a user -> sessions mapping in KV
  return [];
}

export async function terminateAllUserSessions(
  userId: string,
  exceptSessionId?: string
): Promise<void> {
  const sessions = getUserActiveSessions(userId);
  await Promise.all(
    sessions
      .filter((s) => s.clerkSessionId !== exceptSessionId)
      .map((s) => terminateSession(s.clerkSessionId))
  );
}

// Get current session info from Clerk
export function getCurrentSession() {
  const { sessionId, userId } = auth();

  if (!sessionId || !userId) {
    return null;
  }

  return {
    sessionId,
    clerkUserId: userId,
  };
}

// Validate that a user session is still valid and active
export async function validateSession(): Promise<boolean> {
  const session = getCurrentSession();
  if (!session) {
    return false;
  }

  // Check if user exists in our database
  const user = await prisma.user.findUnique({
    where: { clerkId: session.clerkUserId },
    select: { id: true },
  });

  return !!user;
}

// Parse user agent string for device info
export function parseUserAgent(userAgent: string | null): SessionMetadata['deviceInfo'] {
  if (!userAgent) return undefined;

  const deviceInfo: SessionMetadata['deviceInfo'] = {};

  // Basic browser detection
  if (userAgent.includes('Chrome')) {
    deviceInfo.browser = 'Chrome';
  } else if (userAgent.includes('Firefox')) {
    deviceInfo.browser = 'Firefox';
  } else if (userAgent.includes('Safari')) {
    deviceInfo.browser = 'Safari';
  } else if (userAgent.includes('Edge')) {
    deviceInfo.browser = 'Edge';
  }

  // Basic OS detection
  if (userAgent.includes('Windows')) {
    deviceInfo.os = 'Windows';
  } else if (userAgent.includes('Mac')) {
    deviceInfo.os = 'macOS';
  } else if (userAgent.includes('Linux')) {
    deviceInfo.os = 'Linux';
  } else if (userAgent.includes('Android')) {
    deviceInfo.os = 'Android';
  } else if (userAgent.includes('iOS') || userAgent.includes('iPhone')) {
    deviceInfo.os = 'iOS';
  }

  // Basic device detection
  if (userAgent.includes('Mobile')) {
    deviceInfo.device = 'Mobile';
  } else if (userAgent.includes('Tablet')) {
    deviceInfo.device = 'Tablet';
  } else {
    deviceInfo.device = 'Desktop';
  }

  return deviceInfo;
}
