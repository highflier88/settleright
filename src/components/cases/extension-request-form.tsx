'use client';

import { useState } from 'react';

import { useRouter } from 'next/navigation';

import { Clock, AlertTriangle, Loader2 } from 'lucide-react';
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

interface ExtensionRequestFormProps {
  caseId: string;
  deadlineType: 'evidence' | 'rebuttal';
  currentDeadline: Date;
  maxExtensionDays: number;
}

export function ExtensionRequestForm({
  caseId,
  deadlineType,
  currentDeadline,
  maxExtensionDays,
}: ExtensionRequestFormProps) {
  const router = useRouter();
  const [isOpen, setIsOpen] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [requestedDays, setRequestedDays] = useState<string>('');
  const [reason, setReason] = useState('');

  const handleSubmit = async () => {
    if (!requestedDays || !reason) {
      toast.error('Please fill in all fields');
      return;
    }

    if (reason.length < 10) {
      toast.error('Please provide a more detailed reason (minimum 10 characters)');
      return;
    }

    setIsSubmitting(true);

    try {
      const response = await fetch(`/api/cases/${caseId}/extension`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          deadlineType,
          requestedDays: parseInt(requestedDays, 10),
          reason,
        }),
      });

      const data = (await response.json()) as { error?: { message?: string } };

      if (!response.ok) {
        throw new Error(data.error?.message ?? 'Failed to request extension');
      }

      toast.success('Extension granted! Your new deadline has been set.');
      setIsOpen(false);
      router.refresh();
    } catch (error) {
      toast.error(error instanceof Error ? error.message : 'Something went wrong');
    } finally {
      setIsSubmitting(false);
    }
  };

  const calculateNewDeadline = () => {
    if (!requestedDays) return null;
    const newDate = new Date(currentDeadline);
    newDate.setDate(newDate.getDate() + parseInt(requestedDays, 10));
    return newDate;
  };

  const newDeadline = calculateNewDeadline();

  return (
    <Dialog open={isOpen} onOpenChange={setIsOpen}>
      <DialogTrigger asChild>
        <Button variant="outline" size="sm">
          <Clock className="mr-2 h-4 w-4" />
          Request Extension
        </Button>
      </DialogTrigger>
      <DialogContent className="sm:max-w-[425px]">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Clock className="h-5 w-5" />
            Request Deadline Extension
          </DialogTitle>
          <DialogDescription>
            Request additional time for{' '}
            {deadlineType === 'evidence' ? 'evidence submission' : 'rebuttal statement'}.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4 py-4">
          {/* Current Deadline */}
          <div className="rounded-lg border bg-muted/50 p-3">
            <p className="text-sm text-muted-foreground">Current Deadline</p>
            <p className="font-medium">
              {currentDeadline.toLocaleDateString('en-US', {
                weekday: 'long',
                year: 'numeric',
                month: 'long',
                day: 'numeric',
                hour: 'numeric',
                minute: '2-digit',
              })}
            </p>
          </div>

          {/* Extension Duration */}
          <div className="space-y-2">
            <Label htmlFor="days">Extension Duration</Label>
            <Select value={requestedDays} onValueChange={setRequestedDays}>
              <SelectTrigger id="days">
                <SelectValue placeholder="Select days" />
              </SelectTrigger>
              <SelectContent>
                {Array.from({ length: maxExtensionDays }, (_, i) => i + 1).map((days) => (
                  <SelectItem key={days} value={days.toString()}>
                    {days} day{days > 1 ? 's' : ''}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          {/* New Deadline Preview */}
          {newDeadline && (
            <div className="rounded-lg border border-green-200 bg-green-50 p-3 dark:border-green-800 dark:bg-green-950">
              <p className="text-sm text-green-700 dark:text-green-300">New Deadline</p>
              <p className="font-medium text-green-800 dark:text-green-200">
                {newDeadline.toLocaleDateString('en-US', {
                  weekday: 'long',
                  year: 'numeric',
                  month: 'long',
                  day: 'numeric',
                  hour: 'numeric',
                  minute: '2-digit',
                })}
              </p>
            </div>
          )}

          {/* Reason */}
          <div className="space-y-2">
            <Label htmlFor="reason">Reason for Extension</Label>
            <Textarea
              id="reason"
              placeholder="Please explain why you need additional time..."
              value={reason}
              onChange={(e) => setReason(e.target.value)}
              rows={3}
            />
            <p className="text-xs text-muted-foreground">
              Minimum 10 characters. Your reason will be recorded in the case audit log.
            </p>
          </div>

          {/* Warning */}
          <div className="flex items-start gap-2 rounded-lg border border-amber-200 bg-amber-50 p-3 dark:border-amber-800 dark:bg-amber-950">
            <AlertTriangle className="mt-0.5 h-5 w-5 flex-shrink-0 text-amber-600" />
            <div className="text-sm text-amber-800 dark:text-amber-200">
              <p className="font-medium">Please note</p>
              <p className="text-amber-700 dark:text-amber-300">
                Extensions affect both parties&apos; deadlines. The other party will be notified of
                the new deadline.
              </p>
            </div>
          </div>
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={() => setIsOpen(false)} disabled={isSubmitting}>
            Cancel
          </Button>
          <Button
            onClick={handleSubmit}
            disabled={isSubmitting || !requestedDays || reason.length < 10}
          >
            {isSubmitting ? (
              <>
                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                Requesting...
              </>
            ) : (
              'Request Extension'
            )}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
