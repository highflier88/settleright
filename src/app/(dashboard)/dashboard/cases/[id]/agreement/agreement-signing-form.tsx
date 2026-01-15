'use client';

import { useState } from 'react';

import { useRouter } from 'next/navigation';

import { Pen, CheckCircle, AlertTriangle } from 'lucide-react';
import { toast } from 'sonner';

import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Label } from '@/components/ui/label';
import { Switch } from '@/components/ui/switch';

interface AgreementSigningFormProps {
  caseId: string;
  caseReference: string;
  userRole: 'CLAIMANT' | 'RESPONDENT';
  userHasSigned: boolean;
}

export function AgreementSigningForm({
  caseId,
  caseReference,
  userRole,
  userHasSigned,
}: AgreementSigningFormProps) {
  const router = useRouter();
  const [isSigning, setIsSigning] = useState(false);
  const [acceptedTerms, setAcceptedTerms] = useState(false);
  const [acceptedWaiver, setAcceptedWaiver] = useState(false);
  const [acceptedAI, setAcceptedAI] = useState(false);

  const canSign = acceptedTerms && acceptedWaiver && acceptedAI && !userHasSigned;

  const handleSign = async () => {
    if (!canSign) return;

    setIsSigning(true);

    try {
      // Generate a simple device fingerprint
      const deviceFingerprint = btoa(
        JSON.stringify({
          userAgent: navigator.userAgent,
          language: navigator.language,
          platform: navigator.platform,
          screenResolution: `${screen.width}x${screen.height}`,
          timezone: Intl.DateTimeFormat().resolvedOptions().timeZone,
          timestamp: Date.now(),
        })
      );

      const response = await fetch(`/api/cases/${caseId}/agreement`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ deviceFingerprint }),
      });

      if (!response.ok) {
        const error = (await response.json()) as { error?: { message?: string } };
        throw new Error(error.error?.message || 'Failed to sign agreement');
      }

      const result = (await response.json()) as { data: { agreementComplete: boolean } };

      if (result.data.agreementComplete) {
        toast.success('Agreement complete! Both parties have signed.');
      } else {
        toast.success('Agreement signed successfully. Waiting for the other party.');
      }

      router.refresh();
    } catch (error) {
      toast.error(error instanceof Error ? error.message : 'Something went wrong');
    } finally {
      setIsSigning(false);
    }
  };

  if (userHasSigned) {
    return (
      <Card className="border-green-500 bg-green-50 dark:bg-green-950">
        <CardContent className="py-6">
          <div className="flex items-center gap-3">
            <CheckCircle className="h-6 w-6 text-green-600" />
            <div>
              <p className="font-medium text-green-800 dark:text-green-200">
                You have signed this agreement
              </p>
              <p className="text-sm text-green-700 dark:text-green-300">
                Waiting for the other party to sign.
              </p>
            </div>
          </div>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <Pen className="h-5 w-5" />
          Sign Agreement
        </CardTitle>
        <CardDescription>
          As the {userRole === 'CLAIMANT' ? 'Claimant' : 'Respondent'}, please review and
          acknowledge the following before signing.
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-6">
        {/* Acknowledgments */}
        <div className="space-y-4">
          <div className="flex items-start space-x-3">
            <Switch id="terms" checked={acceptedTerms} onCheckedChange={setAcceptedTerms} />
            <Label htmlFor="terms" className="cursor-pointer text-sm leading-relaxed">
              I have read and understand the Submission Agreement for Binding Arbitration. I agree
              to be bound by its terms, including the{' '}
              <a
                href="/legal/procedural-rules"
                target="_blank"
                className="text-primary hover:underline"
              >
                Procedural Rules
              </a>
              .
            </Label>
          </div>

          <div className="flex items-start space-x-3">
            <Switch id="waiver" checked={acceptedWaiver} onCheckedChange={setAcceptedWaiver} />
            <Label htmlFor="waiver" className="cursor-pointer text-sm leading-relaxed">
              I understand and voluntarily waive my right to a jury trial and my right to
              participate in any class action related to this dispute.
            </Label>
          </div>

          <div className="flex items-start space-x-3">
            <Switch id="ai" checked={acceptedAI} onCheckedChange={setAcceptedAI} />
            <Label htmlFor="ai" className="cursor-pointer text-sm leading-relaxed">
              I acknowledge that AI will assist in analyzing this case, with final decisions
              reviewed and approved by a human arbitrator.
            </Label>
          </div>
        </div>

        {/* Warning */}
        <div className="flex items-start gap-3 rounded-lg border border-amber-200 bg-amber-50 p-4 dark:border-amber-900 dark:bg-amber-950">
          <AlertTriangle className="mt-0.5 h-5 w-5 flex-shrink-0 text-amber-600" />
          <div className="text-sm text-amber-800 dark:text-amber-200">
            <p className="font-medium">This is a legally binding agreement</p>
            <p className="mt-1 text-amber-700 dark:text-amber-300">
              Once signed, this agreement cannot be revoked. The arbitration award will be final and
              binding. If you have any concerns, please consult with a legal professional before
              signing.
            </p>
          </div>
        </div>

        {/* Consent Text */}
        <div className="rounded-lg bg-muted p-4">
          <p className="mb-2 text-sm font-medium">
            By clicking &quot;Sign Agreement&quot;, you confirm:
          </p>
          <p className="text-sm italic text-muted-foreground">
            &quot;I, as the {userRole === 'CLAIMANT' ? 'Claimant' : 'Respondent'} in Case{' '}
            {caseReference}, have read and understand the Submission Agreement for Binding
            Arbitration. I voluntarily agree to be bound by its terms, including the waiver of jury
            trial and class action rights. I understand that the arbitration award will be final and
            binding.&quot;
          </p>
        </div>

        {/* Sign Button */}
        <Button onClick={handleSign} disabled={!canSign || isSigning} className="w-full" size="lg">
          {isSigning ? (
            'Signing...'
          ) : (
            <>
              <Pen className="mr-2 h-4 w-4" />
              Sign Agreement
            </>
          )}
        </Button>

        <p className="text-center text-xs text-muted-foreground">
          Your signature will be recorded with timestamp, IP address, and device information for
          legal purposes.
        </p>
      </CardContent>
    </Card>
  );
}
