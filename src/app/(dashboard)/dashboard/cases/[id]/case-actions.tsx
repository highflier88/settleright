'use client';

import { useState } from 'react';

import { useRouter } from 'next/navigation';

import { MoreVertical, RefreshCw, XCircle, Trash2, Download } from 'lucide-react';
import { toast } from 'sonner';

import { Button } from '@/components/ui/button';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';

import type { CaseStatus, InvitationStatus } from '@prisma/client';

interface CaseActionsProps {
  caseId: string;
  status: CaseStatus;
  isClaimant: boolean;
  hasInvitation: boolean;
  invitationStatus?: InvitationStatus;
}

export function CaseActions({
  caseId,
  status,
  isClaimant,
  hasInvitation,
  invitationStatus,
}: CaseActionsProps) {
  const router = useRouter();
  const [isLoading, setIsLoading] = useState(false);

  const canResendInvitation =
    isClaimant &&
    hasInvitation &&
    invitationStatus !== 'ACCEPTED' &&
    invitationStatus !== 'CANCELLED';

  const canWithdrawCase =
    isClaimant && ['DRAFT', 'PENDING_RESPONDENT', 'PENDING_AGREEMENT'].includes(status);

  const handleResendInvitation = async () => {
    setIsLoading(true);
    try {
      const response = await fetch(`/api/cases/${caseId}/invitation`, {
        method: 'POST',
      });

      if (!response.ok) {
        const error = (await response.json()) as { error?: { message?: string } };
        throw new Error(error.error?.message || 'Failed to resend invitation');
      }

      toast.success('Invitation resent successfully');
      router.refresh();
    } catch (error) {
      toast.error(error instanceof Error ? error.message : 'Something went wrong');
    } finally {
      setIsLoading(false);
    }
  };

  const handleCancelInvitation = async () => {
    if (!confirm('Are you sure you want to cancel the invitation?')) {
      return;
    }

    setIsLoading(true);
    try {
      const response = await fetch(`/api/cases/${caseId}/invitation`, {
        method: 'DELETE',
      });

      if (!response.ok) {
        const error = (await response.json()) as { error?: { message?: string } };
        throw new Error(error.error?.message || 'Failed to cancel invitation');
      }

      toast.success('Invitation cancelled');
      router.refresh();
    } catch (error) {
      toast.error(error instanceof Error ? error.message : 'Something went wrong');
    } finally {
      setIsLoading(false);
    }
  };

  const handleWithdrawCase = async () => {
    if (!confirm('Are you sure you want to withdraw this case? This action cannot be undone.')) {
      return;
    }

    setIsLoading(true);
    try {
      const response = await fetch(`/api/cases/${caseId}`, {
        method: 'DELETE',
      });

      if (!response.ok) {
        const error = (await response.json()) as { error?: { message?: string } };
        throw new Error(error.error?.message || 'Failed to withdraw case');
      }

      toast.success('Case withdrawn successfully');
      router.push('/dashboard/cases');
    } catch (error) {
      toast.error(error instanceof Error ? error.message : 'Something went wrong');
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button variant="outline" size="icon" disabled={isLoading}>
          <MoreVertical className="h-4 w-4" />
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end">
        {canResendInvitation && (
          <DropdownMenuItem onClick={handleResendInvitation}>
            <RefreshCw className="mr-2 h-4 w-4" />
            Resend Invitation
          </DropdownMenuItem>
        )}

        {canResendInvitation && (
          <DropdownMenuItem onClick={handleCancelInvitation}>
            <XCircle className="mr-2 h-4 w-4" />
            Cancel Invitation
          </DropdownMenuItem>
        )}

        <DropdownMenuItem>
          <Download className="mr-2 h-4 w-4" />
          Download Case Summary
        </DropdownMenuItem>

        {canWithdrawCase && (
          <>
            <DropdownMenuSeparator />
            <DropdownMenuItem
              onClick={handleWithdrawCase}
              className="text-destructive focus:text-destructive"
            >
              <Trash2 className="mr-2 h-4 w-4" />
              Withdraw Case
            </DropdownMenuItem>
          </>
        )}
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
