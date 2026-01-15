import Link from 'next/link';

import { SignUp } from '@clerk/nextjs';

import type { Metadata } from 'next';

export const metadata: Metadata = {
  title: 'Sign Up',
  description: 'Create your Settleright.ai account',
};

export default function SignUpPage() {
  return (
    <>
      <div className="flex flex-col space-y-2 text-center">
        <Link href="/" className="mx-auto">
          <h1 className="text-2xl font-semibold tracking-tight">Settleright.ai</h1>
        </Link>
        <p className="text-sm text-muted-foreground">
          Create an account to start resolving disputes
        </p>
      </div>
      <SignUp
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
        Already have an account?{' '}
        <Link href="/sign-in" className="text-primary underline-offset-4 hover:underline">
          Sign in
        </Link>
      </p>
    </>
  );
}
