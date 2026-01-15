'use client';

import { useState } from 'react';

import { AlertTriangle, Loader2 } from 'lucide-react';

import { Badge as _Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
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

interface EscalationFormProps {
  isOpen: boolean;
  onClose: () => void;
  onSubmit: (input: EscalationInput) => Promise<void>;
  isLoading: boolean;
}

interface EscalationInput {
  reason: EscalationReason;
  reasonDetails?: string;
  urgency?: EscalationUrgency;
}

type EscalationReason =
  | 'COMPLEX_LEGAL_ISSUES'
  | 'CONFLICTING_EVIDENCE'
  | 'HIGH_VALUE_CLAIM'
  | 'NOVEL_LEGAL_QUESTION'
  | 'CREDIBILITY_CONCERNS'
  | 'PROCEDURAL_ISSUES'
  | 'AI_CONFIDENCE_LOW'
  | 'OTHER';

type EscalationUrgency = 'LOW' | 'NORMAL' | 'HIGH' | 'URGENT';

const ESCALATION_REASONS = [
  {
    value: 'COMPLEX_LEGAL_ISSUES',
    label: 'Complex Legal Issues',
    description: 'Case involves complex or nuanced legal questions',
  },
  {
    value: 'CONFLICTING_EVIDENCE',
    label: 'Conflicting Evidence',
    description: 'Significant conflicts in the evidence that are difficult to resolve',
  },
  {
    value: 'HIGH_VALUE_CLAIM',
    label: 'High Value Claim',
    description: 'Claim amount exceeds typical thresholds',
  },
  {
    value: 'NOVEL_LEGAL_QUESTION',
    label: 'Novel Legal Question',
    description: 'Case involves novel or first-impression legal issues',
  },
  {
    value: 'CREDIBILITY_CONCERNS',
    label: 'Credibility Concerns',
    description: 'Significant concerns about party credibility',
  },
  {
    value: 'PROCEDURAL_ISSUES',
    label: 'Procedural Issues',
    description: 'Procedural or due process concerns',
  },
  {
    value: 'AI_CONFIDENCE_LOW',
    label: 'Low AI Confidence',
    description: 'AI analysis has low confidence score',
  },
  {
    value: 'OTHER',
    label: 'Other',
    description: 'Other reasons not covered above',
  },
];

const URGENCY_OPTIONS = [
  { value: 'LOW', label: 'Low', color: 'bg-slate-500' },
  { value: 'NORMAL', label: 'Normal', color: 'bg-blue-500' },
  { value: 'HIGH', label: 'High', color: 'bg-amber-500' },
  { value: 'URGENT', label: 'Urgent', color: 'bg-red-500' },
];

export function EscalationForm({ isOpen, onClose, onSubmit, isLoading }: EscalationFormProps) {
  const [reason, setReason] = useState<EscalationReason | ''>('');
  const [reasonDetails, setReasonDetails] = useState('');
  const [urgency, setUrgency] = useState<EscalationUrgency>('NORMAL');

  const handleSubmit = async () => {
    if (!reason) {
      return;
    }

    await onSubmit({
      reason,
      reasonDetails: reasonDetails || undefined,
      urgency,
    });
  };

  const isValid = reason !== '';

  return (
    <Dialog open={isOpen} onOpenChange={(open) => !open && onClose()}>
      <DialogContent className="sm:max-w-lg">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2 text-purple-600">
            <AlertTriangle className="h-5 w-5" />
            Escalate to Senior Arbitrator
          </DialogTitle>
          <DialogDescription>
            Escalate this case for review by a more experienced arbitrator. A senior arbitrator will
            be notified and assigned to review the award.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-6 py-4">
          {/* Reason */}
          <div className="space-y-2">
            <Label>Reason for Escalation *</Label>
            <Select value={reason} onValueChange={(v) => setReason(v as EscalationReason)}>
              <SelectTrigger>
                <SelectValue placeholder="Select reason..." />
              </SelectTrigger>
              <SelectContent>
                {ESCALATION_REASONS.map((r) => (
                  <SelectItem key={r.value} value={r.value}>
                    <div>
                      <span className="font-medium">{r.label}</span>
                    </div>
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
            {reason && (
              <p className="text-sm text-muted-foreground">
                {ESCALATION_REASONS.find((r) => r.value === reason)?.description}
              </p>
            )}
          </div>

          {/* Urgency */}
          <div className="space-y-2">
            <Label>Urgency Level</Label>
            <div className="flex flex-wrap gap-2">
              {URGENCY_OPTIONS.map((u) => (
                <Button
                  key={u.value}
                  type="button"
                  variant={urgency === u.value ? 'default' : 'outline'}
                  size="sm"
                  onClick={() => setUrgency(u.value as EscalationUrgency)}
                  className={urgency === u.value ? u.color : ''}
                >
                  {u.label}
                </Button>
              ))}
            </div>
          </div>

          {/* Details */}
          <div className="space-y-2">
            <Label htmlFor="details">Additional Details (Optional)</Label>
            <Textarea
              id="details"
              placeholder="Provide additional context for the senior arbitrator..."
              value={reasonDetails}
              onChange={(e) => setReasonDetails(e.target.value)}
              rows={4}
            />
          </div>

          {/* Info Box */}
          <div className="rounded-lg border border-purple-200 bg-purple-50 p-4 dark:border-purple-900 dark:bg-purple-950">
            <h4 className="mb-2 font-medium text-purple-800 dark:text-purple-200">
              What happens next?
            </h4>
            <ul className="space-y-1 text-sm text-purple-700 dark:text-purple-300">
              <li>- A senior arbitrator will be assigned to review this case</li>
              <li>- They will receive a notification with your escalation details</li>
              <li>- You will be notified when the escalation is resolved</li>
              <li>- The case will remain in your queue until resolved</li>
            </ul>
          </div>
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={onClose} disabled={isLoading}>
            Cancel
          </Button>
          <Button
            onClick={handleSubmit}
            disabled={!isValid || isLoading}
            className="bg-purple-600 hover:bg-purple-700"
          >
            {isLoading ? (
              <>
                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                Escalating...
              </>
            ) : (
              <>
                <AlertTriangle className="mr-2 h-4 w-4" />
                Escalate Case
              </>
            )}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
