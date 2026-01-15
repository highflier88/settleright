'use client';

import { useState } from 'react';

import { Edit, Save, Loader2, Plus, Trash2, GripVertical } from 'lucide-react';

import {
  Accordion,
  AccordionContent,
  AccordionItem,
  AccordionTrigger,
} from '@/components/ui/accordion';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
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

interface AwardEditorProps {
  isOpen: boolean;
  onClose: () => void;
  onSubmit: (modifications: AwardModification, summary: string) => Promise<void>;
  isLoading: boolean;
  draftAward: {
    findingsOfFact: FindingOfFact[];
    conclusionsOfLaw: ConclusionOfLaw[];
    decision: AwardDecision;
    reasoning: string;
  };
}

interface AwardModification {
  findingsOfFact?: FindingOfFact[];
  conclusionsOfLaw?: ConclusionOfLaw[];
  decision?: Partial<AwardDecision>;
  reasoning?: string;
}

export function AwardEditor({
  isOpen,
  onClose,
  onSubmit,
  isLoading,
  draftAward,
}: AwardEditorProps) {
  // Deep clone the draft award for editing
  const [findings, setFindings] = useState<FindingOfFact[]>(
    JSON.parse(JSON.stringify(draftAward.findingsOfFact)) as FindingOfFact[]
  );
  const [conclusions, setConclusions] = useState<ConclusionOfLaw[]>(
    JSON.parse(JSON.stringify(draftAward.conclusionsOfLaw)) as ConclusionOfLaw[]
  );
  const [decision, setDecision] = useState<AwardDecision>(
    JSON.parse(JSON.stringify(draftAward.decision)) as AwardDecision
  );
  const [reasoning, setReasoning] = useState(draftAward.reasoning);
  const [changeSummary, setChangeSummary] = useState('');

  // Track which sections have been modified
  const [modifiedSections, setModifiedSections] = useState<Set<string>>(new Set());

  const markModified = (section: string) => {
    setModifiedSections((prev) => new Set(prev).add(section));
  };

  // Finding handlers
  const updateFinding = (index: number, field: keyof FindingOfFact, value: string) => {
    setFindings((prev) =>
      prev.map((f, i) => {
        if (i !== index) return f;
        if (field === 'finding') {
          return { ...f, finding: value };
        }
        return f;
      })
    );
    markModified('findings');
  };

  const addFinding = () => {
    const newFinding: FindingOfFact = {
      id: `finding-${Date.now()}`,
      finding: '',
      basis: { type: 'DOCUMENTARY' },
      evidenceReferences: [],
    };
    setFindings([...findings, newFinding]);
    markModified('findings');
  };

  const removeFinding = (index: number) => {
    setFindings(findings.filter((_, i) => i !== index));
    markModified('findings');
  };

  // Conclusion handlers
  const updateConclusion = (index: number, field: keyof ConclusionOfLaw, value: string) => {
    setConclusions((prev) =>
      prev.map((c, i) => {
        if (i !== index) return c;
        if (field === 'conclusion') {
          return { ...c, conclusion: value };
        } else if (field === 'legalBasis') {
          return { ...c, legalBasis: value };
        }
        return c;
      })
    );
    markModified('conclusions');
  };

  const addConclusion = () => {
    const newConclusion: ConclusionOfLaw = {
      id: `conclusion-${Date.now()}`,
      conclusion: '',
      legalBasis: '',
      findingReferences: [],
    };
    setConclusions([...conclusions, newConclusion]);
    markModified('conclusions');
  };

  const removeConclusion = (index: number) => {
    setConclusions(conclusions.filter((_, i) => i !== index));
    markModified('conclusions');
  };

  // Decision handlers
  const updateDecision = <K extends keyof AwardDecision>(field: K, value: AwardDecision[K]) => {
    setDecision({ ...decision, [field]: value });
    markModified('decision');
  };

  const handleSubmit = async () => {
    if (!changeSummary.trim()) {
      return;
    }

    const modifications: AwardModification = {};

    if (modifiedSections.has('findings')) {
      modifications.findingsOfFact = findings;
    }
    if (modifiedSections.has('conclusions')) {
      modifications.conclusionsOfLaw = conclusions;
    }
    if (modifiedSections.has('decision')) {
      modifications.decision = decision;
    }
    if (modifiedSections.has('reasoning')) {
      modifications.reasoning = reasoning;
    }

    await onSubmit(modifications, changeSummary);
  };

  const hasChanges = modifiedSections.size > 0;
  const isValid = hasChanges && changeSummary.trim().length > 0;

  return (
    <Dialog open={isOpen} onOpenChange={(open) => !open && onClose()}>
      <DialogContent className="max-h-[90vh] overflow-y-auto sm:max-w-4xl">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2 text-blue-600">
            <Edit className="h-5 w-5" />
            Edit Award
          </DialogTitle>
          <DialogDescription>
            Make modifications to the draft award. All changes will be tracked and versioned.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4 py-4">
          {/* Modified sections indicator */}
          {modifiedSections.size > 0 && (
            <div className="flex flex-wrap gap-2">
              <span className="text-sm text-muted-foreground">Modified:</span>
              {Array.from(modifiedSections).map((section) => (
                <Badge key={section} variant="secondary">
                  {section}
                </Badge>
              ))}
            </div>
          )}

          <Accordion type="multiple" defaultValue={['decision']} className="w-full">
            {/* Decision Section */}
            <AccordionItem value="decision">
              <AccordionTrigger className="text-lg font-semibold">
                Decision & Award
                {modifiedSections.has('decision') && (
                  <Badge variant="outline" className="ml-2 text-blue-600">
                    Modified
                  </Badge>
                )}
              </AccordionTrigger>
              <AccordionContent className="space-y-4 pt-4">
                <div className="grid grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <Label>Prevailing Party</Label>
                    <Select
                      value={decision.prevailingParty}
                      onValueChange={(v) =>
                        updateDecision('prevailingParty', v as 'CLAIMANT' | 'RESPONDENT' | 'SPLIT')
                      }
                    >
                      <SelectTrigger>
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="CLAIMANT">Claimant</SelectItem>
                        <SelectItem value="RESPONDENT">Respondent</SelectItem>
                        <SelectItem value="SPLIT">Split Decision</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>

                  <div className="space-y-2">
                    <Label>Award Amount ($)</Label>
                    <Input
                      type="number"
                      step="0.01"
                      value={decision.awardAmount ?? ''}
                      onChange={(e) =>
                        updateDecision(
                          'awardAmount',
                          e.target.value ? parseFloat(e.target.value) : null
                        )
                      }
                      placeholder="0.00"
                    />
                  </div>

                  <div className="space-y-2">
                    <Label>Interest Amount ($)</Label>
                    <Input
                      type="number"
                      step="0.01"
                      value={decision.interestAmount ?? ''}
                      onChange={(e) =>
                        updateDecision(
                          'interestAmount',
                          e.target.value ? parseFloat(e.target.value) : null
                        )
                      }
                      placeholder="0.00"
                    />
                  </div>

                  <div className="space-y-2">
                    <Label>Total Award ($)</Label>
                    <Input
                      type="number"
                      step="0.01"
                      value={decision.totalAward ?? ''}
                      onChange={(e) =>
                        updateDecision(
                          'totalAward',
                          e.target.value ? parseFloat(e.target.value) : null
                        )
                      }
                      placeholder="0.00"
                    />
                  </div>
                </div>

                <div className="space-y-2">
                  <Label>Order Text</Label>
                  <Textarea
                    value={decision.orderText}
                    onChange={(e) => updateDecision('orderText', e.target.value)}
                    rows={4}
                    placeholder="Enter the formal order text..."
                  />
                </div>

                <div className="space-y-2">
                  <Label>Cost Allocation</Label>
                  <Textarea
                    value={decision.costs ?? ''}
                    onChange={(e) => updateDecision('costs', e.target.value)}
                    rows={2}
                    placeholder="Each party shall bear their own costs..."
                  />
                </div>
              </AccordionContent>
            </AccordionItem>

            {/* Findings of Fact */}
            <AccordionItem value="findings">
              <AccordionTrigger className="text-lg font-semibold">
                Findings of Fact ({findings.length})
                {modifiedSections.has('findings') && (
                  <Badge variant="outline" className="ml-2 text-blue-600">
                    Modified
                  </Badge>
                )}
              </AccordionTrigger>
              <AccordionContent className="space-y-4 pt-4">
                {findings.map((finding, index) => (
                  <div key={finding.id} className="space-y-3 rounded-lg border bg-muted/30 p-4">
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-2">
                        <GripVertical className="h-4 w-4 text-muted-foreground" />
                        <span className="font-medium">Finding {index + 1}</span>
                      </div>
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={() => removeFinding(index)}
                        className="text-destructive hover:text-destructive"
                      >
                        <Trash2 className="h-4 w-4" />
                      </Button>
                    </div>
                    <Textarea
                      value={finding.finding}
                      onChange={(e) => updateFinding(index, 'finding', e.target.value)}
                      rows={3}
                      placeholder="Enter finding of fact..."
                    />
                  </div>
                ))}
                <Button variant="outline" onClick={addFinding} className="w-full">
                  <Plus className="mr-2 h-4 w-4" />
                  Add Finding
                </Button>
              </AccordionContent>
            </AccordionItem>

            {/* Conclusions of Law */}
            <AccordionItem value="conclusions">
              <AccordionTrigger className="text-lg font-semibold">
                Conclusions of Law ({conclusions.length})
                {modifiedSections.has('conclusions') && (
                  <Badge variant="outline" className="ml-2 text-blue-600">
                    Modified
                  </Badge>
                )}
              </AccordionTrigger>
              <AccordionContent className="space-y-4 pt-4">
                {conclusions.map((conclusion, index) => (
                  <div key={conclusion.id} className="space-y-3 rounded-lg border bg-muted/30 p-4">
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-2">
                        <GripVertical className="h-4 w-4 text-muted-foreground" />
                        <span className="font-medium">Conclusion {index + 1}</span>
                      </div>
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={() => removeConclusion(index)}
                        className="text-destructive hover:text-destructive"
                      >
                        <Trash2 className="h-4 w-4" />
                      </Button>
                    </div>
                    <div className="space-y-2">
                      <Label className="text-sm">Conclusion</Label>
                      <Textarea
                        value={conclusion.conclusion}
                        onChange={(e) => updateConclusion(index, 'conclusion', e.target.value)}
                        rows={3}
                        placeholder="Enter conclusion of law..."
                      />
                    </div>
                    <div className="space-y-2">
                      <Label className="text-sm">Legal Basis</Label>
                      <Textarea
                        value={conclusion.legalBasis}
                        onChange={(e) => updateConclusion(index, 'legalBasis', e.target.value)}
                        rows={2}
                        placeholder="Citation or legal basis..."
                      />
                    </div>
                  </div>
                ))}
                <Button variant="outline" onClick={addConclusion} className="w-full">
                  <Plus className="mr-2 h-4 w-4" />
                  Add Conclusion
                </Button>
              </AccordionContent>
            </AccordionItem>

            {/* Reasoning */}
            <AccordionItem value="reasoning">
              <AccordionTrigger className="text-lg font-semibold">
                Reasoning
                {modifiedSections.has('reasoning') && (
                  <Badge variant="outline" className="ml-2 text-blue-600">
                    Modified
                  </Badge>
                )}
              </AccordionTrigger>
              <AccordionContent className="pt-4">
                <Textarea
                  value={reasoning}
                  onChange={(e) => {
                    setReasoning(e.target.value);
                    markModified('reasoning');
                  }}
                  rows={8}
                  placeholder="Enter the award reasoning..."
                />
              </AccordionContent>
            </AccordionItem>
          </Accordion>

          {/* Change Summary */}
          <div className="space-y-2 border-t pt-4">
            <Label htmlFor="changeSummary">Change Summary *</Label>
            <Textarea
              id="changeSummary"
              placeholder="Describe the changes you made and why..."
              value={changeSummary}
              onChange={(e) => setChangeSummary(e.target.value)}
              rows={3}
            />
            <p className="text-xs text-muted-foreground">
              This summary will be recorded in the revision history.
            </p>
          </div>
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={onClose} disabled={isLoading}>
            Cancel
          </Button>
          <Button
            onClick={handleSubmit}
            disabled={!isValid || isLoading}
            className="bg-blue-600 hover:bg-blue-700"
          >
            {isLoading ? (
              <>
                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                Saving...
              </>
            ) : (
              <>
                <Save className="mr-2 h-4 w-4" />
                Save Changes
              </>
            )}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
