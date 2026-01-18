'use client';

import { useState } from 'react';

import { useRouter } from 'next/navigation';

import { toast } from 'sonner';

import { Button } from '@/components/ui/button';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from '@/components/ui/dialog';
import { Label } from '@/components/ui/label';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { Textarea } from '@/components/ui/textarea';
import type { KYCStatus } from '@/types/shared';

interface KYCOverrideDialogProps {
  verificationId: string;
  currentStatus: KYCStatus;
}

const KYC_STATUSES: KYCStatus[] = ['NOT_STARTED', 'PENDING', 'VERIFIED', 'FAILED', 'EXPIRED'];

const KYC_STATUS_LABELS: Record<KYCStatus, string> = {
  NOT_STARTED: 'Not Started',
  PENDING: 'Pending',
  VERIFIED: 'Verified',
  FAILED: 'Failed',
  EXPIRED: 'Expired',
};

export function KYCOverrideDialog({ verificationId, currentStatus }: KYCOverrideDialogProps) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [newStatus, setNewStatus] = useState<KYCStatus | ''>('');
  const [reason, setReason] = useState('');
  const [notes, setNotes] = useState('');

  const handleSubmit = async () => {
    if (!newStatus || !reason) {
      toast.error('Please select a status and provide a reason');
      return;
    }

    setIsLoading(true);

    try {
      const response = await fetch(`/api/admin/kyc/${verificationId}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          action: 'override',
          newStatus,
          reason,
          notes: notes || undefined,
        }),
      });

      if (!response.ok) {
        const data = (await response.json()) as { error?: { message?: string } };
        throw new Error(data.error?.message ?? 'Failed to override status');
      }

      toast.success('Status updated successfully');
      setOpen(false);
      router.refresh();
    } catch (error) {
      toast.error(error instanceof Error ? error.message : 'Something went wrong');
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button variant="outline">Override Status</Button>
      </DialogTrigger>
      <DialogContent className="sm:max-w-[425px]">
        <DialogHeader>
          <DialogTitle>Override KYC Status</DialogTitle>
          <DialogDescription>
            Manually change the verification status. This action will be logged for audit purposes.
          </DialogDescription>
        </DialogHeader>
        <div className="grid gap-4 py-4">
          <div className="grid gap-2">
            <Label htmlFor="status">New Status</Label>
            <Select value={newStatus} onValueChange={(v) => setNewStatus(v as KYCStatus)}>
              <SelectTrigger>
                <SelectValue placeholder="Select status" />
              </SelectTrigger>
              <SelectContent>
                {KYC_STATUSES.filter((s) => s !== currentStatus).map((status) => (
                  <SelectItem key={status} value={status}>
                    {KYC_STATUS_LABELS[status]}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <div className="grid gap-2">
            <Label htmlFor="reason">Reason *</Label>
            <Textarea
              id="reason"
              placeholder="Why are you overriding the status?"
              value={reason}
              onChange={(e) => setReason(e.target.value)}
            />
          </div>
          <div className="grid gap-2">
            <Label htmlFor="notes">Additional Notes (optional)</Label>
            <Textarea
              id="notes"
              placeholder="Any additional context..."
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
            />
          </div>
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={() => setOpen(false)} disabled={isLoading}>
            Cancel
          </Button>
          <Button onClick={handleSubmit} disabled={isLoading || !newStatus || !reason}>
            {isLoading ? 'Saving...' : 'Override Status'}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
