'use client';

import { Clock, AlertTriangle, CheckCircle } from 'lucide-react';

import { Badge } from '@/components/ui/badge';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Progress } from '@/components/ui/progress';
import { cn } from '@/lib/utils';

import { ExtensionRequestForm } from './extension-request-form';

interface DeadlineInfo {
  type: 'response' | 'evidence' | 'rebuttal';
  deadline: Date;
  isPassed: boolean;
  hoursRemaining: number;
  daysRemaining: number;
  canExtend: boolean;
  extensionsUsed: number;
}

interface DeadlineDashboardProps {
  caseId: string;
  deadlines: {
    response?: DeadlineInfo;
    evidence?: DeadlineInfo;
    rebuttal?: DeadlineInfo;
  };
  maxExtensionDays: number;
}

const deadlineLabels: Record<string, string> = {
  response: 'Response Deadline',
  evidence: 'Evidence Submission',
  rebuttal: 'Rebuttal Statement',
};

const deadlineDescriptions: Record<string, string> = {
  response: 'Deadline for the respondent to accept the invitation',
  evidence: 'Deadline for submitting evidence and initial statements',
  rebuttal: 'Deadline for submitting rebuttal statements',
};

function getUrgencyColor(deadline: DeadlineInfo): string {
  if (deadline.isPassed) return 'text-muted-foreground';
  if (deadline.hoursRemaining <= 24) return 'text-destructive';
  if (deadline.daysRemaining <= 3) return 'text-amber-600';
  return 'text-primary';
}

function getUrgencyBadge(deadline: DeadlineInfo): React.ReactNode {
  if (deadline.isPassed) {
    return (
      <Badge variant="secondary" className="gap-1">
        <CheckCircle className="h-3 w-3" />
        Passed
      </Badge>
    );
  }
  if (deadline.hoursRemaining <= 24) {
    return (
      <Badge variant="destructive" className="gap-1">
        <AlertTriangle className="h-3 w-3" />
        Due Today
      </Badge>
    );
  }
  if (deadline.daysRemaining <= 3) {
    return (
      <Badge variant="outline" className="gap-1 border-amber-500 text-amber-600">
        <Clock className="h-3 w-3" />
        Due Soon
      </Badge>
    );
  }
  return (
    <Badge variant="outline" className="gap-1">
      <Clock className="h-3 w-3" />
      Upcoming
    </Badge>
  );
}

function formatTimeRemaining(deadline: DeadlineInfo): string {
  if (deadline.isPassed) {
    return 'Deadline has passed';
  }
  if (deadline.hoursRemaining < 1) {
    return 'Less than 1 hour remaining';
  }
  if (deadline.hoursRemaining < 24) {
    return `${deadline.hoursRemaining} hours remaining`;
  }
  if (deadline.daysRemaining === 1) {
    return '1 day remaining';
  }
  return `${deadline.daysRemaining} days remaining`;
}

function calculateProgress(deadline: DeadlineInfo, totalDays: number): number {
  if (deadline.isPassed) return 100;
  const elapsed = totalDays - deadline.daysRemaining;
  return Math.min(100, Math.max(0, (elapsed / totalDays) * 100));
}

function DeadlineCard({
  caseId,
  deadline,
  maxExtensionDays,
  totalDays = 14,
}: {
  caseId: string;
  deadline: DeadlineInfo;
  maxExtensionDays: number;
  totalDays?: number;
}) {
  const progress = calculateProgress(deadline, totalDays);

  return (
    <div className="space-y-3 rounded-lg border p-4">
      <div className="flex items-start justify-between">
        <div>
          <div className="flex items-center gap-2">
            <h4 className="font-medium">{deadlineLabels[deadline.type]}</h4>
            {getUrgencyBadge(deadline)}
          </div>
          <p className="mt-1 text-sm text-muted-foreground">
            {deadlineDescriptions[deadline.type]}
          </p>
        </div>
      </div>

      {/* Progress bar */}
      <div className="space-y-1">
        <Progress
          value={progress}
          className={cn(
            'h-2',
            deadline.isPassed && 'opacity-50',
            deadline.hoursRemaining <= 24 && !deadline.isPassed && '[&>div]:bg-destructive'
          )}
        />
      </div>

      {/* Deadline details */}
      <div className="flex items-center justify-between text-sm">
        <div className={cn('font-medium', getUrgencyColor(deadline))}>
          {formatTimeRemaining(deadline)}
        </div>
        <div className="text-muted-foreground">
          {deadline.deadline.toLocaleDateString('en-US', {
            month: 'short',
            day: 'numeric',
            hour: 'numeric',
            minute: '2-digit',
          })}
        </div>
      </div>

      {/* Extension button */}
      {deadline.canExtend && !deadline.isPassed && (
        <div className="border-t pt-2">
          <ExtensionRequestForm
            caseId={caseId}
            deadlineType={deadline.type as 'evidence' | 'rebuttal'}
            currentDeadline={deadline.deadline}
            maxExtensionDays={maxExtensionDays}
          />
        </div>
      )}
    </div>
  );
}

export function DeadlineDashboard({ caseId, deadlines, maxExtensionDays }: DeadlineDashboardProps) {
  const activeDeadlines = Object.entries(deadlines).filter(([_, d]) => d !== undefined);

  if (activeDeadlines.length === 0) {
    return null;
  }

  // Find the most urgent deadline
  const urgentDeadline = activeDeadlines
    .filter(([_, d]) => !d.isPassed)
    .sort((a, b) => a[1].hoursRemaining - b[1].hoursRemaining)[0];

  return (
    <Card>
      <CardHeader>
        <div className="flex items-center justify-between">
          <div>
            <CardTitle className="flex items-center gap-2">
              <Clock className="h-5 w-5" />
              Deadlines
            </CardTitle>
            <CardDescription>Track important dates for this case</CardDescription>
          </div>
          {urgentDeadline && urgentDeadline[1].hoursRemaining <= 72 && (
            <Badge
              variant={urgentDeadline[1].hoursRemaining <= 24 ? 'destructive' : 'outline'}
              className="gap-1"
            >
              <AlertTriangle className="h-3 w-3" />
              {urgentDeadline[1].hoursRemaining <= 24 ? 'Urgent deadline' : 'Deadline approaching'}
            </Badge>
          )}
        </div>
      </CardHeader>
      <CardContent className="space-y-4">
        {activeDeadlines.map(([key, deadline]) => (
          <DeadlineCard
            key={key}
            caseId={caseId}
            deadline={deadline}
            maxExtensionDays={maxExtensionDays}
          />
        ))}
      </CardContent>
    </Card>
  );
}

// Simple deadline summary for compact display
export function DeadlineSummary({ deadline, label }: { deadline: DeadlineInfo; label?: string }) {
  return (
    <div className="flex items-center gap-2">
      <div
        className={cn(
          'h-2 w-2 flex-shrink-0 rounded-full',
          deadline.isPassed && 'bg-muted-foreground',
          !deadline.isPassed && deadline.hoursRemaining <= 24 && 'animate-pulse bg-destructive',
          !deadline.isPassed &&
            deadline.hoursRemaining > 24 &&
            deadline.daysRemaining <= 3 &&
            'bg-amber-500',
          !deadline.isPassed && deadline.daysRemaining > 3 && 'bg-green-500'
        )}
      />
      <span className="text-sm">
        {label || deadlineLabels[deadline.type]}:{' '}
        <span className={cn('font-medium', getUrgencyColor(deadline))}>
          {deadline.isPassed
            ? 'Passed'
            : deadline.deadline.toLocaleDateString('en-US', {
                month: 'short',
                day: 'numeric',
              })}
        </span>
      </span>
    </div>
  );
}
