'use client';

import { useState } from 'react';

import Link from 'next/link';
import { useRouter } from 'next/navigation';

import { LogIn, UserPlus, Check, AlertCircle } from 'lucide-react';
import { toast } from 'sonner';

import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';

interface InvitationActionsProps {
  token: string;
  invitationEmail: string;
  isLoggedIn: boolean;
  isCorrectEmail: boolean;
  userEmail?: string;
}

export function InvitationActions({
  token,
  invitationEmail,
  isLoggedIn,
  isCorrectEmail,
  userEmail,
}: InvitationActionsProps) {
  const router = useRouter();
  const [isAccepting, setIsAccepting] = useState(false);

  const handleAcceptInvitation = async () => {
    setIsAccepting(true);

    try {
      const response = await fetch(`/api/invitations/${token}`, {
        method: 'POST',
      });

      if (!response.ok) {
        const error = (await response.json()) as { error?: { message?: string } };
        throw new Error(error.error?.message || 'Failed to accept invitation');
      }

      const result = (await response.json()) as { data: { case: { id: string } } };

      toast.success('Invitation accepted! Redirecting to the case...');
      router.push(`/dashboard/cases/${result.data.case.id}`);
    } catch (error) {
      toast.error(error instanceof Error ? error.message : 'Something went wrong');
    } finally {
      setIsAccepting(false);
    }
  };

  // User is logged in with the correct email
  if (isLoggedIn && isCorrectEmail) {
    return (
      <Card className="border-primary">
        <CardHeader>
          <CardTitle className="flex items-center gap-2 text-primary">
            <Check className="h-5 w-5" />
            Ready to Respond
          </CardTitle>
          <CardDescription>
            You&apos;re logged in as {userEmail}. Click below to accept the invitation and join
            the case.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <Button
            onClick={handleAcceptInvitation}
            disabled={isAccepting}
            className="w-full"
            size="lg"
          >
            {isAccepting ? 'Accepting...' : 'Accept Invitation & Join Case'}
          </Button>
        </CardContent>
      </Card>
    );
  }

  // User is logged in but with a different email
  if (isLoggedIn && !isCorrectEmail) {
    return (
      <Card className="border-amber-500">
        <CardHeader>
          <CardTitle className="flex items-center gap-2 text-amber-600">
            <AlertCircle className="h-5 w-5" />
            Wrong Account
          </CardTitle>
          <CardDescription>
            You&apos;re currently logged in as <strong>{userEmail}</strong>, but this invitation
            was sent to <strong>{invitationEmail}</strong>.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <p className="text-sm text-muted-foreground">
            Please log out and log in with the correct email address, or create a new
            account with that email.
          </p>
          <div className="flex gap-3">
            <Button variant="outline" className="flex-1" asChild>
              <Link href="/sign-out">Log Out</Link>
            </Button>
            <Button className="flex-1" asChild>
              <Link href={`/sign-in?redirect_url=/invitation/${token}`}>
                Switch Account
              </Link>
            </Button>
          </div>
        </CardContent>
      </Card>
    );
  }

  // User is not logged in
  return (
    <Card>
      <CardHeader>
        <CardTitle>Accept This Invitation</CardTitle>
        <CardDescription>
          To respond to this case, you&apos;ll need to create an account or log in with the
          email address: <strong>{invitationEmail}</strong>
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="grid gap-3 md:grid-cols-2">
          <Button asChild size="lg" className="w-full">
            <Link href={`/sign-up?email=${encodeURIComponent(invitationEmail)}&redirect_url=/invitation/${token}`}>
              <UserPlus className="mr-2 h-4 w-4" />
              Create Account
            </Link>
          </Button>
          <Button asChild variant="outline" size="lg" className="w-full">
            <Link href={`/sign-in?redirect_url=/invitation/${token}`}>
              <LogIn className="mr-2 h-4 w-4" />
              Log In
            </Link>
          </Button>
        </div>
        <p className="text-xs text-muted-foreground text-center">
          By creating an account, you agree to our{' '}
          <a href="/legal/terms-of-service" className="text-primary hover:underline">
            Terms of Service
          </a>{' '}
          and{' '}
          <a href="/legal/privacy-policy" className="text-primary hover:underline">
            Privacy Policy
          </a>
          .
        </p>
      </CardContent>
    </Card>
  );
}
