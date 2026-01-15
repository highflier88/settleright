import { NextResponse, type NextRequest } from 'next/server';

// Check if we're in test/load-test mode or if Clerk is not configured
const isTestMode = process.env.NODE_ENV === 'test' || process.env.LOAD_TEST_MODE === 'true';
const isClerkConfigured = !!process.env.NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY;

// Test mode middleware - bypasses authentication
function testModeMiddleware(_request: NextRequest) {
  // In test mode, allow all requests through
  return NextResponse.next();
}

// Only use Clerk when properly configured
async function middleware(request: NextRequest) {
  // In test mode or when Clerk is not configured, bypass authentication
  if (isTestMode || !isClerkConfigured) {
    return testModeMiddleware(request);
  }

  // Dynamically import and use Clerk middleware only when configured
  const { clerkMiddleware, createRouteMatcher } = await import('@clerk/nextjs/server');

  // Define public routes that don't require authentication
  const isPublicRoute = createRouteMatcher([
    '/',
    '/sign-in(.*)',
    '/sign-up(.*)',
    '/how-it-works',
    '/pricing',
    '/privacy',
    '/terms',
    '/legal/(.*)',
    '/contact',
    '/api/webhooks/(.*)',
    '/api/cron/(.*)',
    '/api/health',
    '/invitation/(.*)',
  ]);

  // Create and run Clerk middleware
  const clerkHandler = clerkMiddleware((auth, req) => {
    // Allow public routes without authentication
    if (isPublicRoute(req)) {
      return;
    }

    // Protect all other routes - redirect to sign-in if not authenticated
    const { userId } = auth();
    if (!userId) {
      const signInUrl = new URL('/sign-in', req.url);
      signInUrl.searchParams.set('redirect_url', req.url);
      return Response.redirect(signInUrl);
    }
    return;
  });

  // eslint-disable-next-line @typescript-eslint/no-unsafe-argument, @typescript-eslint/no-explicit-any
  return clerkHandler(request, {} as any);
}

export default middleware;

export const config = {
  matcher: [
    // Skip Next.js internals and all static files
    '/((?!_next|[^?]*\\.(?:html?|css|js(?!on)|jpe?g|webp|png|gif|svg|ttf|woff2?|ico|csv|docx?|xlsx?|zip|webmanifest)).*)',
    // Always run for API routes
    '/(api|trpc)(.*)',
  ],
};
