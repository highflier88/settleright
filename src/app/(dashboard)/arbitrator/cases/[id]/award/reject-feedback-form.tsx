'use client';

import { useState } from 'react';

import { XCircle, Loader2 } from 'lucide-react';

import { Button } from '@/components/ui/button';
import { Checkbox } from '@/components/ui/checkbox';
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

interface RejectFeedbackFormProps {
  isOpen: boolean;
  onClose: () => void;
  onSubmit: (feedback: RejectionFeedback) => Promise<void>;
  isLoading: boolean;
}

interface RejectionFeedback {
  category: 'legal_error' | 'factual_error' | 'procedural_error' | 'calculation_error' | 'other';
  description: string;
  affectedSections: string[];
  suggestedCorrections?: string;
  severity: 'minor' | 'moderate' | 'major';
}

const REJECTION_CATEGORIES = [
  { value: 'legal_error', label: 'Legal Error', description: 'Incorrect legal analysis or citation' },
  { value: 'factual_error', label: 'Factual Error', description: 'Misstatement or misinterpretation of facts' },
  { value: 'procedural_error', label: 'Procedural Error', description: 'Procedural issues with the analysis' },
  { value: 'calculation_error', label: 'Calculation Error', description: 'Errors in damages or amounts' },
  { value: 'other', label: 'Other', description: 'Other issues not covered above' },
];

const AFFECTED_SECTIONS = [
  { id: 'findings', label: 'Findings of Fact' },
  { id: 'conclusions', label: 'Conclusions of Law' },
  { id: 'decision', label: 'Decision/Order' },
  { id: 'damages', label: 'Damages Calculation' },
  { id: 'reasoning', label: 'Reasoning' },
];

const SEVERITY_OPTIONS = [
  { value: 'minor', label: 'Minor', description: 'Small corrections needed' },
  { value: 'moderate', label: 'Moderate', description: 'Significant revisions required' },
  { value: 'major', label: 'Major', description: 'Fundamental issues requiring regeneration' },
];

export function RejectFeedbackForm({
  isOpen,
  onClose,
  onSubmit,
  isLoading,
}: RejectFeedbackFormProps) {
  const [category, setCategory] = useState<RejectionFeedback['category'] | ''>('');
  const [description, setDescription] = useState('');
  const [affectedSections, setAffectedSections] = useState<string[]>([]);
  const [suggestedCorrections, setSuggestedCorrections] = useState('');
  const [severity, setSeverity] = useState<RejectionFeedback['severity'] | ''>('');

  const handleSectionToggle = (sectionId: string) => {
    setAffectedSections((prev) =>
      prev.includes(sectionId)
        ? prev.filter((s) => s !== sectionId)
        : [...prev, sectionId]
    );
  };

  const handleSubmit = async () => {
    if (!category || !description || affectedSections.length === 0 || !severity) {
      return;
    }

    await onSubmit({
      category,
      description,
      affectedSections,
      suggestedCorrections: suggestedCorrections || undefined,
      severity,
    });
  };

  const isValid = category && description && affectedSections.length > 0 && severity;

  return (
    <Dialog open={isOpen} onOpenChange={(open) => !open && onClose()}>
      <DialogContent className="sm:max-w-lg">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2 text-destructive">
            <XCircle className="h-5 w-5" />
            Reject Draft Award
          </DialogTitle>
          <DialogDescription>
            Please provide detailed feedback on why this award is being rejected.
            This information will be used to improve the next draft.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-6 py-4">
          {/* Category */}
          <div className="space-y-2">
            <Label>Error Category *</Label>
            <Select
              value={category}
              onValueChange={(v) => setCategory(v as RejectionFeedback['category'])}
            >
              <SelectTrigger>
                <SelectValue placeholder="Select category..." />
              </SelectTrigger>
              <SelectContent>
                {REJECTION_CATEGORIES.map((cat) => (
                  <SelectItem key={cat.value} value={cat.value}>
                    <div>
                      <span className="font-medium">{cat.label}</span>
                      <span className="text-muted-foreground text-sm ml-2">
                        - {cat.description}
                      </span>
                    </div>
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          {/* Severity */}
          <div className="space-y-2">
            <Label>Severity *</Label>
            <Select
              value={severity}
              onValueChange={(v) => setSeverity(v as RejectionFeedback['severity'])}
            >
              <SelectTrigger>
                <SelectValue placeholder="Select severity..." />
              </SelectTrigger>
              <SelectContent>
                {SEVERITY_OPTIONS.map((sev) => (
                  <SelectItem key={sev.value} value={sev.value}>
                    <div>
                      <span className="font-medium">{sev.label}</span>
                      <span className="text-muted-foreground text-sm ml-2">
                        - {sev.description}
                      </span>
                    </div>
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          {/* Affected Sections */}
          <div className="space-y-2">
            <Label>Affected Sections *</Label>
            <div className="grid grid-cols-2 gap-2">
              {AFFECTED_SECTIONS.map((section) => (
                <div key={section.id} className="flex items-center space-x-2">
                  <Checkbox
                    id={section.id}
                    checked={affectedSections.includes(section.id)}
                    onCheckedChange={() => handleSectionToggle(section.id)}
                  />
                  <label
                    htmlFor={section.id}
                    className="text-sm font-medium leading-none cursor-pointer"
                  >
                    {section.label}
                  </label>
                </div>
              ))}
            </div>
          </div>

          {/* Description */}
          <div className="space-y-2">
            <Label htmlFor="description">Description of Issue *</Label>
            <Textarea
              id="description"
              placeholder="Describe the issue in detail..."
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              rows={4}
            />
          </div>

          {/* Suggested Corrections */}
          <div className="space-y-2">
            <Label htmlFor="corrections">Suggested Corrections (Optional)</Label>
            <Textarea
              id="corrections"
              placeholder="Suggest how this should be corrected..."
              value={suggestedCorrections}
              onChange={(e) => setSuggestedCorrections(e.target.value)}
              rows={3}
            />
          </div>
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={onClose} disabled={isLoading}>
            Cancel
          </Button>
          <Button
            variant="destructive"
            onClick={handleSubmit}
            disabled={!isValid || isLoading}
          >
            {isLoading ? (
              <>
                <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                Submitting...
              </>
            ) : (
              <>
                <XCircle className="h-4 w-4 mr-2" />
                Reject Award
              </>
            )}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
