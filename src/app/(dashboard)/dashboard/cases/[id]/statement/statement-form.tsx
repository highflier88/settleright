'use client';

import { useState } from 'react';

import { useRouter } from 'next/navigation';

import { zodResolver } from '@hookform/resolvers/zod';
import {
  FileText,
  Plus,
  Trash2,
  Calendar,
  DollarSign,
  Loader2,
  ChevronDown,
  ChevronUp,
} from 'lucide-react';
import { useForm, useFieldArray } from 'react-hook-form';
import { toast } from 'sonner';
import * as z from 'zod';

import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from '@/components/ui/collapsible';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { Textarea } from '@/components/ui/textarea';

const claimCategories = [
  { value: 'damages', label: 'Damages' },
  { value: 'fees', label: 'Fees' },
  { value: 'costs', label: 'Costs' },
  { value: 'interest', label: 'Interest' },
  { value: 'other', label: 'Other' },
] as const;

const timelineEntrySchema = z.object({
  id: z.string(),
  date: z.string().min(1, 'Date is required'),
  title: z.string().min(1, 'Title is required').max(200),
  description: z.string().max(1000).optional(),
});

const claimItemSchema = z.object({
  id: z.string(),
  description: z.string().min(1, 'Description is required').max(500),
  amount: z.coerce.number().min(0, 'Amount must be non-negative'),
  category: z.enum(['damages', 'fees', 'costs', 'interest', 'other']),
});

const statementSchema = z.object({
  narrative: z.string().min(100, 'Statement must be at least 100 characters').max(50000),
  timeline: z.array(timelineEntrySchema).optional(),
  claimItems: z.array(claimItemSchema).optional(),
});

type StatementFormData = z.infer<typeof statementSchema>;

interface StatementSubmissionFormProps {
  caseId: string;
  caseReference: string;
  userRole: 'claimant' | 'respondent';
  type: 'INITIAL' | 'REBUTTAL';
  claimAmount: number;
  existingContent?: StatementFormData;
  statementId?: string; // For editing
}

function generateId(): string {
  return Math.random().toString(36).substring(2, 9);
}

export function StatementSubmissionForm({
  caseId,
  caseReference: _caseReference,
  userRole,
  type,
  claimAmount,
  existingContent,
  statementId,
}: StatementSubmissionFormProps) {
  const router = useRouter();
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [showTimeline, setShowTimeline] = useState(
    existingContent?.timeline && existingContent.timeline.length > 0
  );
  const [showClaims, setShowClaims] = useState(
    existingContent?.claimItems && existingContent.claimItems.length > 0
  );

  const isEditing = !!statementId;

  const {
    register,
    control,
    handleSubmit,
    watch,
    formState: { errors },
  } = useForm<StatementFormData>({
    resolver: zodResolver(statementSchema),
    defaultValues: existingContent ?? {
      narrative: '',
      timeline: [],
      claimItems: [],
    },
  });

  const {
    fields: timelineFields,
    append: appendTimeline,
    remove: removeTimeline,
  } = useFieldArray({
    control,
    name: 'timeline',
  });

  const {
    fields: claimFields,
    append: appendClaim,
    remove: removeClaim,
  } = useFieldArray({
    control,
    name: 'claimItems',
  });

  const watchedClaims = watch('claimItems');
  const totalClaimedAmount = watchedClaims?.reduce((sum, item) => sum + (item.amount || 0), 0) ?? 0;

  const onSubmit = async (data: StatementFormData) => {
    setIsSubmitting(true);

    try {
      const url = isEditing
        ? `/api/cases/${caseId}/statements/${statementId}`
        : `/api/cases/${caseId}/statements`;

      const method = isEditing ? 'PUT' : 'POST';

      const response = await fetch(url, {
        method,
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          type,
          content: {
            narrative: data.narrative,
            timeline: data.timeline,
            claimItems: data.claimItems,
          },
        }),
      });

      if (!response.ok) {
        const error = (await response.json()) as { error?: { message?: string } };
        throw new Error(error.error?.message || 'Failed to submit statement');
      }

      toast.success(
        isEditing ? 'Statement updated successfully' : 'Statement submitted successfully'
      );

      router.push(`/dashboard/cases/${caseId}/statement`);
      router.refresh();
    } catch (error) {
      toast.error(error instanceof Error ? error.message : 'Something went wrong');
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <form onSubmit={handleSubmit(onSubmit)} className="space-y-6">
      {/* Main Statement Card */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <FileText className="h-5 w-5" />
            {isEditing ? 'Edit' : 'Submit'} {type === 'INITIAL' ? 'Initial' : 'Rebuttal'} Statement
          </CardTitle>
          <CardDescription>
            {type === 'INITIAL'
              ? 'Present your position and the facts supporting your case.'
              : 'Respond to the other party&apos;s statement and provide clarifications.'}
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div>
            <Label htmlFor="narrative">
              Statement Narrative <span className="text-destructive">*</span>
            </Label>
            <Textarea
              id="narrative"
              {...register('narrative')}
              placeholder={
                type === 'INITIAL'
                  ? 'Describe your position on this dispute. Include relevant facts, your understanding of events, and the basis for your claims or defenses...'
                  : 'Address the points raised in the other party&apos;s statement. Clarify any misunderstandings and provide additional context...'
              }
              className="mt-2 min-h-[300px]"
            />
            {errors.narrative && (
              <p className="mt-1 text-sm text-destructive">{errors.narrative.message}</p>
            )}
            <p className="mt-1 text-xs text-muted-foreground">
              Minimum 100 characters. Be clear and specific.
            </p>
          </div>
        </CardContent>
      </Card>

      {/* Timeline Section */}
      <Collapsible open={showTimeline} onOpenChange={setShowTimeline}>
        <Card>
          <CardHeader>
            <CollapsibleTrigger asChild>
              <div className="flex cursor-pointer items-center justify-between">
                <div>
                  <CardTitle className="flex items-center gap-2">
                    <Calendar className="h-5 w-5" />
                    Timeline of Events
                    <span className="text-sm font-normal text-muted-foreground">(Optional)</span>
                  </CardTitle>
                  <CardDescription>Add key dates and events relevant to your case</CardDescription>
                </div>
                <Button variant="ghost" size="sm">
                  {showTimeline ? (
                    <ChevronUp className="h-4 w-4" />
                  ) : (
                    <ChevronDown className="h-4 w-4" />
                  )}
                </Button>
              </div>
            </CollapsibleTrigger>
          </CardHeader>
          <CollapsibleContent>
            <CardContent className="space-y-4">
              {timelineFields.map((field, index) => (
                <div key={field.id} className="flex items-start gap-4 rounded-lg border p-4">
                  <div className="flex-1 space-y-3">
                    <div className="grid grid-cols-2 gap-4">
                      <div>
                        <Label htmlFor={`timeline.${index}.date`}>Date</Label>
                        <Input
                          type="date"
                          {...register(`timeline.${index}.date`)}
                          className="mt-1"
                        />
                        {errors.timeline?.[index]?.date && (
                          <p className="mt-1 text-sm text-destructive">
                            {errors.timeline[index]?.date?.message}
                          </p>
                        )}
                      </div>
                      <div>
                        <Label htmlFor={`timeline.${index}.title`}>Event Title</Label>
                        <Input
                          {...register(`timeline.${index}.title`)}
                          placeholder="e.g., Contract Signed"
                          className="mt-1"
                        />
                        {errors.timeline?.[index]?.title && (
                          <p className="mt-1 text-sm text-destructive">
                            {errors.timeline[index]?.title?.message}
                          </p>
                        )}
                      </div>
                    </div>
                    <div>
                      <Label htmlFor={`timeline.${index}.description`}>Description</Label>
                      <Textarea
                        {...register(`timeline.${index}.description`)}
                        placeholder="Describe what happened..."
                        className="mt-1"
                        rows={2}
                      />
                    </div>
                  </div>
                  <Button
                    type="button"
                    variant="ghost"
                    size="sm"
                    onClick={() => removeTimeline(index)}
                    className="text-destructive hover:text-destructive"
                  >
                    <Trash2 className="h-4 w-4" />
                  </Button>
                </div>
              ))}

              <Button
                type="button"
                variant="outline"
                onClick={() =>
                  appendTimeline({
                    id: generateId(),
                    date: '',
                    title: '',
                    description: '',
                  })
                }
              >
                <Plus className="mr-2 h-4 w-4" />
                Add Timeline Entry
              </Button>
            </CardContent>
          </CollapsibleContent>
        </Card>
      </Collapsible>

      {/* Claim Items Section (for claimants) */}
      {userRole === 'claimant' && (
        <Collapsible open={showClaims} onOpenChange={setShowClaims}>
          <Card>
            <CardHeader>
              <CollapsibleTrigger asChild>
                <div className="flex cursor-pointer items-center justify-between">
                  <div>
                    <CardTitle className="flex items-center gap-2">
                      <DollarSign className="h-5 w-5" />
                      Claim Itemization
                      <span className="text-sm font-normal text-muted-foreground">(Optional)</span>
                    </CardTitle>
                    <CardDescription>
                      Break down your claim into specific items and amounts
                    </CardDescription>
                  </div>
                  <Button variant="ghost" size="sm">
                    {showClaims ? (
                      <ChevronUp className="h-4 w-4" />
                    ) : (
                      <ChevronDown className="h-4 w-4" />
                    )}
                  </Button>
                </div>
              </CollapsibleTrigger>
            </CardHeader>
            <CollapsibleContent>
              <CardContent className="space-y-4">
                {claimFields.map((field, index) => (
                  <div key={field.id} className="flex items-start gap-4 rounded-lg border p-4">
                    <div className="flex-1 space-y-3">
                      <div className="grid grid-cols-3 gap-4">
                        <div className="col-span-2">
                          <Label htmlFor={`claimItems.${index}.description`}>Description</Label>
                          <Input
                            {...register(`claimItems.${index}.description`)}
                            placeholder="e.g., Unpaid invoice #123"
                            className="mt-1"
                          />
                          {errors.claimItems?.[index]?.description && (
                            <p className="mt-1 text-sm text-destructive">
                              {errors.claimItems[index]?.description?.message}
                            </p>
                          )}
                        </div>
                        <div>
                          <Label htmlFor={`claimItems.${index}.amount`}>Amount ($)</Label>
                          <Input
                            type="number"
                            step="0.01"
                            min="0"
                            {...register(`claimItems.${index}.amount`)}
                            className="mt-1"
                          />
                          {errors.claimItems?.[index]?.amount && (
                            <p className="mt-1 text-sm text-destructive">
                              {errors.claimItems[index]?.amount?.message}
                            </p>
                          )}
                        </div>
                      </div>
                      <div>
                        <Label htmlFor={`claimItems.${index}.category`}>Category</Label>
                        <Select
                          defaultValue={field.category}
                          onValueChange={(value) => {
                            const event = {
                              target: { name: `claimItems.${index}.category`, value },
                            };
                            void register(`claimItems.${index}.category`).onChange(event);
                          }}
                        >
                          <SelectTrigger className="mt-1">
                            <SelectValue placeholder="Select category" />
                          </SelectTrigger>
                          <SelectContent>
                            {claimCategories.map((cat) => (
                              <SelectItem key={cat.value} value={cat.value}>
                                {cat.label}
                              </SelectItem>
                            ))}
                          </SelectContent>
                        </Select>
                      </div>
                    </div>
                    <Button
                      type="button"
                      variant="ghost"
                      size="sm"
                      onClick={() => removeClaim(index)}
                      className="text-destructive hover:text-destructive"
                    >
                      <Trash2 className="h-4 w-4" />
                    </Button>
                  </div>
                ))}

                {claimFields.length > 0 && (
                  <div className="flex items-center justify-between rounded-lg bg-muted p-4">
                    <span className="font-medium">Total Claimed Amount</span>
                    <span className="text-xl font-bold">
                      ${totalClaimedAmount.toLocaleString('en-US', { minimumFractionDigits: 2 })}
                    </span>
                  </div>
                )}

                {totalClaimedAmount !== claimAmount && claimFields.length > 0 && (
                  <p className="text-sm text-amber-600">
                    Note: Itemized total (${totalClaimedAmount.toLocaleString()}) differs from case
                    claim amount (${claimAmount.toLocaleString()})
                  </p>
                )}

                <Button
                  type="button"
                  variant="outline"
                  onClick={() =>
                    appendClaim({
                      id: generateId(),
                      description: '',
                      amount: 0,
                      category: 'damages',
                    })
                  }
                >
                  <Plus className="mr-2 h-4 w-4" />
                  Add Claim Item
                </Button>
              </CardContent>
            </CollapsibleContent>
          </Card>
        </Collapsible>
      )}

      {/* Submit Button */}
      <div className="flex items-center justify-between">
        <p className="text-sm text-muted-foreground">
          You can edit your statement until the deadline.
        </p>
        <Button type="submit" disabled={isSubmitting} size="lg">
          {isSubmitting ? (
            <>
              <Loader2 className="mr-2 h-4 w-4 animate-spin" />
              {isEditing ? 'Updating...' : 'Submitting...'}
            </>
          ) : (
            <>
              <FileText className="mr-2 h-4 w-4" />
              {isEditing ? 'Update Statement' : 'Submit Statement'}
            </>
          )}
        </Button>
      </div>
    </form>
  );
}
