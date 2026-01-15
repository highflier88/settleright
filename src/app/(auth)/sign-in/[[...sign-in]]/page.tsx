import { SignIn } from '@clerk/nextjs';
import Link from 'next/link';

import type { Metadata } from 'next';

export const metadata: Metadata = {
  title: 'Sign In',
  description: 'Sign in to your Settleright.ai account',
};

export default function SignInPage() {
  return (
    <>
      <div className="flex flex-col space-y-2 text-center">
        <Link href="/" className="mx-auto">
          <h1 className="text-2xl font-semibold tracking-tight">Settleright.ai</h1>
        </Link>
        <p className="text-sm text-muted-foreground">
          Sign in to access your dispute resolution dashboard
        </p>
      </div>
      <SignIn
        appearance={{
          elements: {
            rootBox: 'mx-auto w-full',
            card: 'shadow-none border rounded-lg',
            headerTitle: 'hidden',
            headerSubtitle: 'hidden',
            socialButtonsBlockButton:
              'bg-background border hover:bg-muted text-foreground',
            formButtonPrimary:
              'bg-primary hover:bg-primary/90 text-primary-foreground',
            footerActionLink: 'text-primary hover:text-primary/90',
            formFieldInput:
              'bg-background border-input focus:ring-2 focus:ring-ring',
            dividerLine: 'bg-border',
            dividerText: 'text-muted-foreground',
          },
        }}
      />
      <p className="px-8 text-center text-sm text-muted-foreground">
        Don&apos;t have an account?{' '}
        <Link href="/sign-up" className="text-primary underline-offset-4 hover:underline">
          Sign up
        </Link>
      </p>
    </>
  );
}
