'use client';

import { useState } from 'react';

import { useRouter } from 'next/navigation';

import { zodResolver } from '@hookform/resolvers/zod';
import { ArrowLeft, ArrowRight, Check, FileText, Users, Scale, Send } from 'lucide-react';
import { useForm } from 'react-hook-form';
import { toast } from 'sonner';
import { z } from 'zod';

import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
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
import { type User } from '@/types/shared';

// Jurisdictions supported
const JURISDICTIONS = [
  { code: 'US-CA', name: 'California, United States' },
  { code: 'US-NY', name: 'New York, United States' },
  { code: 'US-TX', name: 'Texas, United States' },
  { code: 'US-FL', name: 'Florida, United States' },
  { code: 'US-WA', name: 'Washington, United States' },
  { code: 'US-IL', name: 'Illinois, United States' },
  { code: 'US-PA', name: 'Pennsylvania, United States' },
  { code: 'US-OH', name: 'Ohio, United States' },
  { code: 'US-GA', name: 'Georgia, United States' },
  { code: 'US-NC', name: 'North Carolina, United States' },
];

// Dispute types with descriptions
const DISPUTE_TYPES = [
  {
    value: 'CONTRACT',
    label: 'Contract Dispute',
    description: 'Breach of contract, contract interpretation, or performance issues',
  },
  {
    value: 'PAYMENT',
    label: 'Payment Dispute',
    description: 'Unpaid invoices, disputed charges, or refund issues',
  },
  {
    value: 'SERVICE',
    label: 'Service Dispute',
    description: 'Service quality issues, warranty claims, or professional services',
  },
  {
    value: 'GOODS',
    label: 'Goods Dispute',
    description: 'Product defects, delivery issues, or returns',
  },
  {
    value: 'OTHER',
    label: 'Other',
    description: 'Other types of civil disputes',
  },
];

// Form schema
const formSchema = z.object({
  disputeType: z.nativeEnum(DisputeType),
  jurisdiction: z.string().min(1, 'Please select a jurisdiction'),
  description: z
    .string()
    .min(50, 'Description must be at least 50 characters')
    .max(10000, 'Description must be less than 10,000 characters'),
  amount: z.coerce
    .number()
    .min(500, 'Minimum claim amount is $500')
    .max(25000, 'Maximum claim amount is $25,000'),
  respondentEmail: z.string().email('Please enter a valid email address'),
  respondentName: z.string().optional(),
  respondentPhone: z
    .string()
    .regex(/^\+?[1-9]\d{1,14}$/, 'Please enter a valid phone number')
    .optional()
    .or(z.literal('')),
});

type FormData = z.infer<typeof formSchema>;

interface NewCaseFormProps {
  user: User;
}

const STEPS = [
  { id: 'type', title: 'Dispute Type', icon: FileText },
  { id: 'details', title: 'Case Details', icon: Scale },
  { id: 'respondent', title: 'Respondent', icon: Users },
  { id: 'review', title: 'Review & Submit', icon: Send },
];

export function NewCaseForm({ user: _user }: NewCaseFormProps) {
  const router = useRouter();
  const [currentStep, setCurrentStep] = useState(0);
  const [isSubmitting, setIsSubmitting] = useState(false);

  const {
    register,
    handleSubmit,
    watch,
    setValue,
    trigger,
    formState: { errors },
  } = useForm<FormData>({
    resolver: zodResolver(formSchema),
    defaultValues: {
      disputeType: undefined,
      jurisdiction: '',
      description: '',
      amount: undefined,
      respondentEmail: '',
      respondentName: '',
      respondentPhone: '',
    },
  });

  const formData = watch();

  // Calculate filing fee
  const calculateFee = (amount: number): number => {
    if (!amount || amount <= 0) return 0;
    if (amount <= 1000) return 49;
    if (amount <= 5000) return 99;
    if (amount <= 10000) return 149;
    if (amount <= 25000) return 249;
    return 349;
  };

  const filingFee = calculateFee(formData.amount);

  // Step validation
  const validateStep = async (step: number): Promise<boolean> => {
    switch (step) {
      case 0:
        return trigger(['disputeType', 'jurisdiction']);
      case 1:
        return trigger(['description', 'amount']);
      case 2:
        return trigger(['respondentEmail', 'respondentName', 'respondentPhone']);
      default:
        return true;
    }
  };

  const nextStep = async () => {
    const isValid = await validateStep(currentStep);
    if (isValid && currentStep < STEPS.length - 1) {
      setCurrentStep(currentStep + 1);
    }
  };

  const prevStep = () => {
    if (currentStep > 0) {
      setCurrentStep(currentStep - 1);
    }
  };

  const onSubmit = async (data: FormData) => {
    setIsSubmitting(true);

    try {
      const response = await fetch('/api/cases', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          disputeType: data.disputeType,
          jurisdiction: data.jurisdiction,
          description: data.description,
          amount: data.amount,
          respondent: {
            email: data.respondentEmail,
            name: data.respondentName || undefined,
            phone: data.respondentPhone || undefined,
          },
        }),
      });

      if (!response.ok) {
        const error = (await response.json()) as { error?: { message?: string } };
        throw new Error(error.error?.message || 'Failed to create case');
      }

      const result = (await response.json()) as { data: { case: { id: string } } };

      toast.success('Case created successfully! The respondent has been notified.');
      router.push(`/dashboard/cases/${result.data.case.id}`);
    } catch (error) {
      toast.error(error instanceof Error ? error.message : 'Something went wrong');
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="space-y-8">
      {/* Progress Steps */}
      <div className="flex justify-between">
        {STEPS.map((step, index) => (
          <div
            key={step.id}
            className={`flex flex-1 items-center ${
              index < STEPS.length - 1 ? 'after:h-0.5 after:flex-1 after:bg-border' : ''
            }`}
          >
            <div className="flex flex-col items-center gap-2">
              <div
                className={`flex h-10 w-10 items-center justify-center rounded-full border-2 transition-colors ${
                  index < currentStep
                    ? 'border-primary bg-primary text-primary-foreground'
                    : index === currentStep
                      ? 'border-primary text-primary'
                      : 'border-muted text-muted-foreground'
                }`}
              >
                {index < currentStep ? (
                  <Check className="h-5 w-5" />
                ) : (
                  <step.icon className="h-5 w-5" />
                )}
              </div>
              <span
                className={`text-xs font-medium ${
                  index <= currentStep ? 'text-foreground' : 'text-muted-foreground'
                }`}
              >
                {step.title}
              </span>
            </div>
          </div>
        ))}
      </div>

      <form onSubmit={handleSubmit(onSubmit)}>
        {/* Step 1: Dispute Type & Jurisdiction */}
        {currentStep === 0 && (
          <Card>
            <CardHeader>
              <CardTitle>What type of dispute do you have?</CardTitle>
              <CardDescription>
                Select the category that best describes your dispute and the applicable
                jurisdiction.
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-6">
              <div className="space-y-3">
                <Label>Dispute Type</Label>
                <div className="grid gap-3">
                  {DISPUTE_TYPES.map((type) => (
                    <label
                      key={type.value}
                      className={`flex cursor-pointer items-start gap-4 rounded-lg border p-4 transition-colors hover:bg-muted/50 ${
                        formData.disputeType === type.value
                          ? 'border-primary bg-primary/5'
                          : 'border-input'
                      }`}
                    >
                      <input
                        type="radio"
                        value={type.value}
                        {...register('disputeType')}
                        className="mt-1"
                      />
                      <div>
                        <div className="font-medium">{type.label}</div>
                        <div className="text-sm text-muted-foreground">{type.description}</div>
                      </div>
                    </label>
                  ))}
                </div>
                {errors.disputeType && (
                  <p className="text-sm text-destructive">{errors.disputeType.message}</p>
                )}
              </div>

              <div className="space-y-2">
                <Label htmlFor="jurisdiction">Applicable Jurisdiction</Label>
                <Select
                  value={formData.jurisdiction}
                  onValueChange={(value) => setValue('jurisdiction', value)}
                >
                  <SelectTrigger>
                    <SelectValue placeholder="Select jurisdiction" />
                  </SelectTrigger>
                  <SelectContent>
                    {JURISDICTIONS.map((j) => (
                      <SelectItem key={j.code} value={j.code}>
                        {j.name}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
                {errors.jurisdiction && (
                  <p className="text-sm text-destructive">{errors.jurisdiction.message}</p>
                )}
                <p className="text-xs text-muted-foreground">
                  Choose the state where the dispute occurred or where the contract was executed.
                </p>
              </div>
            </CardContent>
          </Card>
        )}

        {/* Step 2: Case Details */}
        {currentStep === 1 && (
          <Card>
            <CardHeader>
              <CardTitle>Describe your dispute</CardTitle>
              <CardDescription>
                Provide a clear summary of your claim and the amount you&apos;re seeking.
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-6">
              <div className="space-y-2">
                <Label htmlFor="description">Description of Dispute</Label>
                <Textarea
                  id="description"
                  {...register('description')}
                  placeholder="Describe the dispute in detail. Include relevant dates, parties involved, and what you are claiming..."
                  rows={8}
                />
                <div className="flex justify-between text-xs text-muted-foreground">
                  <span>{formData.description?.length ?? 0} / 10,000 characters</span>
                  <span>Minimum 50 characters</span>
                </div>
                {errors.description && (
                  <p className="text-sm text-destructive">{errors.description.message}</p>
                )}
              </div>

              <div className="space-y-2">
                <Label htmlFor="amount">Claim Amount (USD)</Label>
                <div className="relative">
                  <span className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground">
                    $
                  </span>
                  <Input
                    id="amount"
                    type="number"
                    {...register('amount')}
                    className="pl-7"
                    placeholder="0.00"
                    min={500}
                    max={25000}
                  />
                </div>
                {errors.amount && (
                  <p className="text-sm text-destructive">{errors.amount.message}</p>
                )}
                <p className="text-xs text-muted-foreground">
                  Claims between $500 and $25,000 are eligible for arbitration.
                </p>
              </div>

              {formData.amount > 0 && (
                <div className="rounded-lg bg-muted p-4">
                  <div className="flex justify-between">
                    <span className="text-sm">Filing Fee</span>
                    <span className="font-medium">${filingFee}</span>
                  </div>
                  <p className="mt-2 text-xs text-muted-foreground">
                    The filing fee is non-refundable and covers case administration.
                  </p>
                </div>
              )}
            </CardContent>
          </Card>
        )}

        {/* Step 3: Respondent Information */}
        {currentStep === 2 && (
          <Card>
            <CardHeader>
              <CardTitle>Who are you filing against?</CardTitle>
              <CardDescription>
                Enter the contact information for the other party. They will receive an invitation
                to participate in the arbitration.
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-6">
              <div className="space-y-2">
                <Label htmlFor="respondentEmail">Email Address *</Label>
                <Input
                  id="respondentEmail"
                  type="email"
                  {...register('respondentEmail')}
                  placeholder="respondent@example.com"
                />
                {errors.respondentEmail && (
                  <p className="text-sm text-destructive">{errors.respondentEmail.message}</p>
                )}
              </div>

              <div className="space-y-2">
                <Label htmlFor="respondentName">Full Name (Optional)</Label>
                <Input id="respondentName" {...register('respondentName')} placeholder="John Doe" />
                {errors.respondentName && (
                  <p className="text-sm text-destructive">{errors.respondentName.message}</p>
                )}
              </div>

              <div className="space-y-2">
                <Label htmlFor="respondentPhone">Phone Number (Optional)</Label>
                <Input
                  id="respondentPhone"
                  type="tel"
                  {...register('respondentPhone')}
                  placeholder="+1 555 123 4567"
                />
                {errors.respondentPhone && (
                  <p className="text-sm text-destructive">{errors.respondentPhone.message}</p>
                )}
                <p className="text-xs text-muted-foreground">
                  If provided, we&apos;ll also send an SMS notification.
                </p>
              </div>
            </CardContent>
          </Card>
        )}

        {/* Step 4: Review */}
        {currentStep === 3 && (
          <Card>
            <CardHeader>
              <CardTitle>Review Your Case</CardTitle>
              <CardDescription>
                Please review all the information before submitting.
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-6">
              <div className="space-y-4">
                <div className="flex justify-between border-b pb-2">
                  <span className="text-muted-foreground">Dispute Type</span>
                  <span className="font-medium">
                    {DISPUTE_TYPES.find((t) => t.value === formData.disputeType)?.label}
                  </span>
                </div>

                <div className="flex justify-between border-b pb-2">
                  <span className="text-muted-foreground">Jurisdiction</span>
                  <span className="font-medium">
                    {JURISDICTIONS.find((j) => j.code === formData.jurisdiction)?.name}
                  </span>
                </div>

                <div className="flex justify-between border-b pb-2">
                  <span className="text-muted-foreground">Claim Amount</span>
                  <span className="font-medium">${formData.amount?.toLocaleString() ?? 0}</span>
                </div>

                <div className="border-b pb-2">
                  <span className="text-muted-foreground">Description</span>
                  <p className="mt-1 text-sm">{formData.description}</p>
                </div>

                <div className="border-b pb-2">
                  <span className="text-muted-foreground">Respondent</span>
                  <p className="mt-1 text-sm">
                    {formData.respondentName && `${formData.respondentName} - `}
                    {formData.respondentEmail}
                    {formData.respondentPhone && ` (${formData.respondentPhone})`}
                  </p>
                </div>
              </div>

              <div className="rounded-lg border border-primary/20 bg-primary/5 p-4">
                <div className="flex justify-between text-lg font-semibold">
                  <span>Filing Fee</span>
                  <span>${filingFee}</span>
                </div>
                <p className="mt-2 text-sm text-muted-foreground">
                  By submitting this case, you agree to our{' '}
                  <a href="/legal/terms-of-service" className="text-primary hover:underline">
                    Terms of Service
                  </a>{' '}
                  and{' '}
                  <a href="/legal/procedural-rules" className="text-primary hover:underline">
                    Procedural Rules
                  </a>
                  .
                </p>
              </div>
            </CardContent>
          </Card>
        )}

        {/* Navigation Buttons */}
        <div className="flex justify-between pt-6">
          <Button type="button" variant="outline" onClick={prevStep} disabled={currentStep === 0}>
            <ArrowLeft className="mr-2 h-4 w-4" />
            Back
          </Button>

          {currentStep < STEPS.length - 1 ? (
            <Button type="button" onClick={nextStep}>
              Next
              <ArrowRight className="ml-2 h-4 w-4" />
            </Button>
          ) : (
            <Button type="submit" disabled={isSubmitting}>
              {isSubmitting ? 'Submitting...' : 'Submit Case'}
              <Send className="ml-2 h-4 w-4" />
            </Button>
          )}
        </div>
      </form>
    </div>
  );
}
