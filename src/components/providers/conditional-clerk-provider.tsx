'use client';

import { ClerkProvider } from '@clerk/nextjs';

// Check if Clerk is configured at build time
const isClerkConfigured = !!process.env.NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY;

export function ConditionalClerkProvider({ children }: { children: React.ReactNode }) {
  // If Clerk is not configured, just render children without the provider
  if (!isClerkConfigured) {
    return <>{children}</>;
  }

  // If Clerk is configured, wrap with ClerkProvider
  return <ClerkProvider>{children}</ClerkProvider>;
}
