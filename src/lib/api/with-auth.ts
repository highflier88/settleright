import { headers } from 'next/headers';
import { type NextRequest, type NextResponse } from 'next/server';

import { type AuditAction } from '@prisma/client';

import { UnauthorizedError, ForbiddenError, RateLimitError } from '@/lib/api/errors';
import { errorResponse } from '@/lib/api/response';
import { getAuthUser } from '@/lib/auth';
import { rateLimit, rateLimitConfigs } from '@/lib/rate-limit';
import { hasPermission, type Permission } from '@/lib/rbac';
import { logAuditEvent } from '@/lib/services/audit';

import type { User } from '@prisma/client';

export interface AuthenticatedRequest extends NextRequest {
  user: User;
}

type RouteHandler = (
  request: AuthenticatedRequest,
  context?: { params: Record<string, string> }
) => Promise<NextResponse>;

interface WithAuthOptions {
  permissions?: Permission[];
  requireAll?: boolean; // If true, require ALL permissions; if false, require ANY
  rateLimit?: keyof typeof rateLimitConfigs | { limit: number; window: number };
  auditAction?: AuditAction;
  getCaseId?: (request: NextRequest, context?: { params: Record<string, string> }) => string | null;
  getMetadata?: (
    request: NextRequest,
    context?: { params: Record<string, string> }
  ) => Record<string, unknown>;
}

export function withAuth(handler: RouteHandler, options: WithAuthOptions = {}) {
  return async (
    request: NextRequest,
    context?: { params: Record<string, string> }
  ): Promise<NextResponse> => {
    try {
      // Rate limiting
      if (options.rateLimit) {
        const config =
          typeof options.rateLimit === 'string'
            ? rateLimitConfigs[options.rateLimit]
            : options.rateLimit;

        const headersList = headers();
        const ip =
          headersList.get('x-forwarded-for')?.split(',')[0] ||
          headersList.get('x-real-ip') ||
          'anonymous';

        const result = await rateLimit(ip, config);
        if (!result.success) {
          throw new RateLimitError();
        }
      }

      // Authentication
      const user = await getAuthUser();
      if (!user) {
        throw new UnauthorizedError('Authentication required');
      }

      // Authorization
      if (options.permissions && options.permissions.length > 0) {
        const hasAccess = options.requireAll
          ? options.permissions.every((p) => hasPermission(user.role, p))
          : options.permissions.some((p) => hasPermission(user.role, p));

        if (!hasAccess) {
          throw new ForbiddenError('Insufficient permissions');
        }
      }

      // Audit logging
      if (options.auditAction) {
        const headersList = headers();
        const ip = headersList.get('x-forwarded-for')?.split(',')[0] || 'unknown';
        const userAgent = headersList.get('user-agent') || 'unknown';

        const caseId = options.getCaseId?.(request, context) ?? null;
        const customMetadata = options.getMetadata?.(request, context) ?? {};

        // Fire and forget - don't block the request
        logAuditEvent({
          action: options.auditAction,
          userId: user.id,
          caseId,
          ipAddress: ip,
          userAgent,
          metadata: {
            method: request.method,
            path: request.nextUrl.pathname,
            ...customMetadata,
          },
        });
      }

      // Call the handler with the authenticated request
      const authenticatedRequest = request as AuthenticatedRequest;
      authenticatedRequest.user = user;

      return handler(authenticatedRequest, context);
    } catch (error) {
      return errorResponse(error as Error);
    }
  };
}

// Convenience wrappers for common patterns
export function withUser(handler: RouteHandler) {
  return withAuth(handler);
}

export function withArbitrator(handler: RouteHandler) {
  return withAuth(handler, {
    permissions: ['arbitrator:review'],
  });
}

export function withAdmin(handler: RouteHandler) {
  return withAuth(handler, {
    permissions: ['admin:users'],
  });
}
