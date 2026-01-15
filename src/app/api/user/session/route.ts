import { headers } from 'next/headers';

import { successResponse, errorResponse } from '@/lib/api';
import { requireAuth } from '@/lib/auth';
import { getCurrentSession, getSessionMetadata, parseUserAgent } from '@/lib/session';

export async function GET() {
  try {
    const user = await requireAuth();
    const session = getCurrentSession();

    if (!session) {
      return successResponse({
        active: false,
        user: null,
        session: null,
      });
    }

    const headersList = headers();
    const userAgent = headersList.get('user-agent');
    const ip =
      headersList.get('x-forwarded-for')?.split(',')[0] ||
      headersList.get('x-real-ip') ||
      'unknown';

    // Try to get extended session metadata from KV
    const sessionMetadata = await getSessionMetadata(session.sessionId);

    return successResponse({
      active: true,
      user: {
        id: user.id,
        email: user.email,
        name: user.name,
        role: user.role,
      },
      session: {
        id: session.sessionId,
        createdAt: sessionMetadata?.createdAt
          ? new Date(sessionMetadata.createdAt).toISOString()
          : null,
        lastActiveAt: sessionMetadata?.lastActiveAt
          ? new Date(sessionMetadata.lastActiveAt).toISOString()
          : new Date().toISOString(),
        device: sessionMetadata?.deviceInfo ?? parseUserAgent(userAgent),
        ipAddress: sessionMetadata?.ipAddress ?? ip,
      },
    });
  } catch (error) {
    return errorResponse(error as Error);
  }
}
