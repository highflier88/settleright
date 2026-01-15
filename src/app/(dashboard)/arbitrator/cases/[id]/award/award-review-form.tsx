'use client';

import { useState } from 'react';

import { useRouter } from 'next/navigation';

import {
  CheckCircle,
  Edit,
  XCircle,
  AlertTriangle,
  Gavel,
  Loader2,
} from 'lucide-react';
import { toast } from 'sonner';

import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from '@/components/ui/alert-dialog';
import { Button } from '@/components/ui/button';
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from '@/components/ui/card';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';

import { AwardEditor } from './award-editor';
import { EscalationForm } from './escalation-form';
import { RejectFeedbackForm } from './reject-feedback-form';

type ReviewDecision = 'APPROVE' | 'MODIFY' | 'REJECT' | 'ESCALATE';

interface FindingOfFact {
  id: string;
  finding: string;
  basis: {
    type: string;
    sourceDocuments?: string[];
    explanation?: string;
  };
  evidenceReferences: string[];
}

interface ConclusionOfLaw {
  id: string;
  conclusion: string;
  legalBasis: string;
  findingReferences: string[];
  precedents?: string[];
}

interface AwardDecision {
  prevailingParty: 'CLAIMANT' | 'RESPONDENT' | 'SPLIT';
  awardAmount: number | null;
  interestAmount?: number | null;
  totalAward?: number | null;
  orderText: string;
  costs?: string;
}

interface DraftAwardData {
  findingsOfFact: FindingOfFact[];
  conclusionsOfLaw: ConclusionOfLaw[];
  decision: AwardDecision;
  reasoning: string;
}

interface AwardReviewFormProps {
  caseId: string;
  draftAwardId: string;
  currentStatus: string | null;
  currentNotes: string | null;
  isApproved: boolean;
  draftAward?: DraftAwardData;
}

interface RejectionFeedback {
  category: 'legal_error' | 'factual_error' | 'procedural_error' | 'calculation_error' | 'other';
  description: string;
  affectedSections: string[];
  suggestedCorrections?: string;
  severity: 'minor' | 'moderate' | 'major';
}

interface EscalationInput {
  reason: string;
  reasonDetails?: string;
  urgency?: string;
}

interface AwardModification {
  findingsOfFact?: FindingOfFact[];
  conclusionsOfLaw?: ConclusionOfLaw[];
  decision?: Partial<AwardDecision>;
  reasoning?: string;
}

export function AwardReviewForm({
  caseId,
  draftAwardId: _draftAwardId,
  currentStatus,
  currentNotes,
  isApproved,
  draftAward,
}: AwardReviewFormProps) {
  const router = useRouter();
  const [isLoading, setIsLoading] = useState(false);
  const [isFinalizing, setIsFinalizing] = useState(false);
  const [reviewNotes, setReviewNotes] = useState(currentNotes || '');
  const [selectedDecision, setSelectedDecision] = useState<ReviewDecision | null>(
    currentStatus as ReviewDecision | null
  );

  // Dialog states
  const [showRejectDialog, setShowRejectDialog] = useState(false);
  const [showEscalateDialog, setShowEscalateDialog] = useState(false);
  const [showEditorDialog, setShowEditorDialog] = useState(false);

  const handleApprove = async () => {
    setIsLoading(true);
    setSelectedDecision('APPROVE');

    try {
      const response = await fetch(`/api/cases/${caseId}/draft-award`, {
        method: 'PATCH',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          reviewStatus: 'APPROVE',
          reviewNotes: reviewNotes || undefined,
        }),
      });

      if (!response.ok) {
        const error = (await response.json()) as { error?: { message?: string } };
        throw new Error(error.error?.message || 'Failed to approve award');
      }

      toast.success('Award approved successfully');
      router.refresh();
    } catch (error) {
      toast.error(error instanceof Error ? error.message : 'Something went wrong');
      setSelectedDecision(currentStatus as ReviewDecision | null);
    } finally {
      setIsLoading(false);
    }
  };

  const handleModify = async (modifications: AwardModification, changeSummary: string) => {
    setIsLoading(true);
    setSelectedDecision('MODIFY');

    try {
      const response = await fetch(`/api/cases/${caseId}/draft-award`, {
        method: 'PATCH',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          reviewStatus: 'MODIFY',
          modifications,
          changeSummary,
        }),
      });

      if (!response.ok) {
        const error = (await response.json()) as { error?: { message?: string } };
        throw new Error(error.error?.message || 'Failed to modify award');
      }

      const result = (await response.json()) as { data?: { version?: number } };
      toast.success(`Award modified successfully (v${result.data?.version})`);
      setShowEditorDialog(false);
      router.refresh();
    } catch (error) {
      toast.error(error instanceof Error ? error.message : 'Something went wrong');
      setSelectedDecision(currentStatus as ReviewDecision | null);
    } finally {
      setIsLoading(false);
    }
  };

  const handleReject = async (feedback: RejectionFeedback) => {
    setIsLoading(true);
    setSelectedDecision('REJECT');

    try {
      const response = await fetch(`/api/cases/${caseId}/draft-award`, {
        method: 'PATCH',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          reviewStatus: 'REJECT',
          rejectionFeedback: feedback,
        }),
      });

      if (!response.ok) {
        const error = (await response.json()) as { error?: { message?: string } };
        throw new Error(error.error?.message || 'Failed to reject award');
      }

      toast.success('Award rejected with feedback');
      setShowRejectDialog(false);
      router.refresh();
    } catch (error) {
      toast.error(error instanceof Error ? error.message : 'Something went wrong');
      setSelectedDecision(currentStatus as ReviewDecision | null);
    } finally {
      setIsLoading(false);
    }
  };

  const handleEscalate = async (input: EscalationInput) => {
    setIsLoading(true);
    setSelectedDecision('ESCALATE');

    try {
      const response = await fetch(`/api/cases/${caseId}/draft-award`, {
        method: 'PATCH',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          reviewStatus: 'ESCALATE',
          escalation: input,
        }),
      });

      if (!response.ok) {
        const error = (await response.json()) as { error?: { message?: string } };
        throw new Error(error.error?.message || 'Failed to escalate award');
      }

      const result = (await response.json()) as { data?: { assignedToName?: string } };
      toast.success(
        result.data?.assignedToName
          ? `Escalated to ${result.data.assignedToName}`
          : 'Case escalated successfully'
      );
      setShowEscalateDialog(false);
      router.refresh();
    } catch (error) {
      toast.error(error instanceof Error ? error.message : 'Something went wrong');
      setSelectedDecision(currentStatus as ReviewDecision | null);
    } finally {
      setIsLoading(false);
    }
  };

  const handleFinalizeAward = async () => {
    setIsFinalizing(true);

    try {
      const response = await fetch(`/api/cases/${caseId}/award`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
      });

      if (!response.ok) {
        const error = (await response.json()) as { error?: { message?: string } };
        throw new Error(error.error?.message || 'Failed to finalize award');
      }

      toast.success('Award issued successfully');
      router.push(`/arbitrator/cases/${caseId}`);
      router.refresh();
    } catch (error) {
      toast.error(error instanceof Error ? error.message : 'Something went wrong');
    } finally {
      setIsFinalizing(false);
    }
  };

  const reviewOptions = [
    {
      decision: 'APPROVE' as ReviewDecision,
      label: 'Approve',
      description: 'The draft award is accurate and ready for finalization',
      icon: CheckCircle,
      onClick: handleApprove,
    },
    {
      decision: 'MODIFY' as ReviewDecision,
      label: 'Edit & Sign',
      description: 'Make modifications to the award before approval',
      icon: Edit,
      onClick: () => setShowEditorDialog(true),
    },
    {
      decision: 'REJECT' as ReviewDecision,
      label: 'Reject',
      description: 'The award is fundamentally flawed and needs regeneration',
      icon: XCircle,
      onClick: () => setShowRejectDialog(true),
    },
    {
      decision: 'ESCALATE' as ReviewDecision,
      label: 'Escalate',
      description: 'Requires senior arbitrator review or additional guidance',
      icon: AlertTriangle,
      onClick: () => setShowEscalateDialog(true),
    },
  ];

  // Default draft award data if not provided
  const defaultDraftAward: DraftAwardData = draftAward || {
    findingsOfFact: [],
    conclusionsOfLaw: [],
    decision: {
      prevailingParty: 'CLAIMANT',
      awardAmount: null,
      orderText: '',
    },
    reasoning: '',
  };

  return (
    <>
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Gavel className="h-5 w-5" />
            Review & Decision
          </CardTitle>
          <CardDescription>
            Review the draft award and submit your decision
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-6">
          {/* Review Notes */}
          <div className="space-y-2">
            <Label htmlFor="reviewNotes">Review Notes (Optional)</Label>
            <Textarea
              id="reviewNotes"
              placeholder="Add any notes or comments about the draft award..."
              value={reviewNotes}
              onChange={(e) => setReviewNotes(e.target.value)}
              rows={4}
              disabled={isLoading || isFinalizing}
            />
            <p className="text-xs text-muted-foreground">
              These notes will be recorded with your review decision.
            </p>
          </div>

          {/* Review Options */}
          <div className="grid gap-3 md:grid-cols-2">
            {reviewOptions.map((option) => {
              const Icon = option.icon;
              const isSelected = selectedDecision === option.decision;

              return (
                <button
                  key={option.decision}
                  onClick={option.onClick}
                  disabled={isLoading || isFinalizing}
                  className={`flex items-start gap-3 rounded-lg border-2 p-4 text-left transition-all hover:shadow-md ${
                    isSelected
                      ? 'border-primary bg-primary/5'
                      : 'border-muted hover:border-muted-foreground/20'
                  } ${isLoading ? 'opacity-50 cursor-not-allowed' : ''}`}
                >
                  <Icon
                    className={`h-5 w-5 mt-0.5 ${
                      option.decision === 'APPROVE'
                        ? 'text-green-600'
                        : option.decision === 'MODIFY'
                          ? 'text-blue-600'
                          : option.decision === 'REJECT'
                            ? 'text-destructive'
                            : 'text-purple-600'
                    }`}
                  />
                  <div>
                    <p className="font-medium">{option.label}</p>
                    <p className="text-sm text-muted-foreground">
                      {option.description}
                    </p>
                  </div>
                  {isSelected && isLoading && (
                    <Loader2 className="h-4 w-4 ml-auto animate-spin" />
                  )}
                </button>
              );
            })}
          </div>

          {/* Finalize Button (only shown if approved) */}
          {isApproved && (
            <div className="border-t pt-6">
              <div className="rounded-lg border border-green-200 bg-green-50 p-4 mb-4 dark:border-green-900 dark:bg-green-950">
                <div className="flex items-center gap-2 text-green-800 dark:text-green-200">
                  <CheckCircle className="h-5 w-5" />
                  <span className="font-medium">Award Approved</span>
                </div>
                <p className="text-sm text-green-700 dark:text-green-300 mt-1">
                  You have approved this draft award. Click below to generate the
                  final PDF document and notify the parties.
                </p>
              </div>

              <AlertDialog>
                <AlertDialogTrigger asChild>
                  <Button
                    size="lg"
                    className="w-full bg-green-600 hover:bg-green-700"
                    disabled={isFinalizing}
                  >
                    {isFinalizing ? (
                      <>
                        <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                        Issuing Award...
                      </>
                    ) : (
                      <>
                        <Gavel className="h-4 w-4 mr-2" />
                        Issue Final Award
                      </>
                    )}
                  </Button>
                </AlertDialogTrigger>
                <AlertDialogContent>
                  <AlertDialogHeader>
                    <AlertDialogTitle>Issue Final Award?</AlertDialogTitle>
                    <AlertDialogDescription>
                      This action will:
                      <ul className="list-disc list-inside mt-2 space-y-1">
                        <li>Generate a formal PDF award document</li>
                        <li>Digitally sign the award with your credentials</li>
                        <li>Send notifications to both parties</li>
                        <li>Mark the case as DECIDED</li>
                      </ul>
                      <p className="mt-3 font-medium">
                        This action cannot be undone. The award will be final and
                        binding.
                      </p>
                    </AlertDialogDescription>
                  </AlertDialogHeader>
                  <AlertDialogFooter>
                    <AlertDialogCancel>Cancel</AlertDialogCancel>
                    <AlertDialogAction
                      onClick={handleFinalizeAward}
                      className="bg-green-600 hover:bg-green-700"
                    >
                      Issue Award
                    </AlertDialogAction>
                  </AlertDialogFooter>
                </AlertDialogContent>
              </AlertDialog>
            </div>
          )}

          {/* Help text for non-approved states */}
          {!isApproved && selectedDecision && (
            <div className="rounded-lg border border-amber-200 bg-amber-50 p-4 dark:border-amber-900 dark:bg-amber-950">
              <p className="text-sm text-amber-800 dark:text-amber-200">
                {selectedDecision === 'MODIFY' && (
                  <>
                    The award has been marked for modification. Your changes have
                    been saved and a new version has been created.
                  </>
                )}
                {selectedDecision === 'REJECT' && (
                  <>
                    The award has been rejected. The AI analysis will be reviewed
                    and a new draft award will be generated based on your feedback.
                  </>
                )}
                {selectedDecision === 'ESCALATE' && (
                  <>
                    This case has been escalated for senior review. A supervisor
                    will be notified to assist with this case.
                  </>
                )}
              </p>
            </div>
          )}
        </CardContent>
      </Card>

      {/* Reject Feedback Dialog */}
      <RejectFeedbackForm
        isOpen={showRejectDialog}
        onClose={() => setShowRejectDialog(false)}
        onSubmit={handleReject}
        isLoading={isLoading}
      />

      {/* Escalation Dialog */}
      <EscalationForm
        isOpen={showEscalateDialog}
        onClose={() => setShowEscalateDialog(false)}
        onSubmit={handleEscalate}
        isLoading={isLoading}
      />

      {/* Award Editor Dialog */}
      <AwardEditor
        isOpen={showEditorDialog}
        onClose={() => setShowEditorDialog(false)}
        onSubmit={handleModify}
        isLoading={isLoading}
        draftAward={defaultDraftAward}
      />
    </>
  );
}
