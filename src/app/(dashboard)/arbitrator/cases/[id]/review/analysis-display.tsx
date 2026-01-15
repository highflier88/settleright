'use client';

import { useState } from 'react';

import {
  Scale,
  CheckCircle,
  XCircle,
  AlertTriangle,
  ChevronDown,
  ChevronUp,
  Lightbulb,
  BookOpen,
  Gavel,
  TrendingUp,
  AlertCircle,
} from 'lucide-react';

import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from '@/components/ui/collapsible';
import { Progress } from '@/components/ui/progress';

import type { AnalysisJob } from '@/types/shared';
import type { JsonValue } from '@prisma/client/runtime/library';

interface AnalysisDisplayProps {
  caseId: string;
  analysisJob: AnalysisJob | null;
  jurisdiction: string;
  disputeType: string;
  claimedAmount: number | null;
}

interface LegalIssue {
  category: string;
  description: string;
  elements: Array<{ description: string; isSatisfied: boolean | null }>;
  applicableStatutes: string[];
  applicableCaseLaw?: string[];
}

interface BurdenAnalysis {
  issue: string;
  probability: number;
  reasoning: string;
}

interface BurdenOfProof {
  overallBurdenMet: boolean;
  analyses: BurdenAnalysis[];
}

interface DamagesItem {
  type: string;
  description: string;
  claimedAmount: number;
  supportedAmount: number;
  supported: boolean;
  basis: string;
}

interface DamagesCalculation {
  claimedTotal: number;
  supportedTotal: number;
  recommendedTotal: number;
  items: DamagesItem[];
  interestCalculation?: {
    rate: number;
    startDate: string;
    endDate: string;
    days: number;
    amount: number;
    statutoryBasis: string;
  };
}

interface ConclusionOfLaw {
  issue: string;
  conclusion: string;
  confidence: number;
}

interface AwardRecommendation {
  prevailingParty: 'claimant' | 'respondent' | 'split';
  awardAmount: number;
  reasoning: string;
}

function formatCurrency(amount: number): string {
  return new Intl.NumberFormat('en-US', {
    style: 'currency',
    currency: 'USD',
    minimumFractionDigits: 0,
    maximumFractionDigits: 2,
  }).format(amount);
}

function getStatusIcon(status: string | null) {
  switch (status) {
    case 'COMPLETED':
      return <CheckCircle className="h-4 w-4 text-green-600" />;
    case 'FAILED':
      return <XCircle className="h-4 w-4 text-destructive" />;
    case 'IN_PROGRESS':
      return <AlertTriangle className="h-4 w-4 text-amber-500" />;
    default:
      return <AlertCircle className="h-4 w-4 text-muted-foreground" />;
  }
}

function parseLegalIssues(data: JsonValue): LegalIssue[] {
  if (!data || !Array.isArray(data)) return [];
  return data as unknown as LegalIssue[];
}

function parseBurdenOfProof(data: JsonValue): BurdenOfProof | null {
  if (!data || typeof data !== 'object') return null;
  return data as unknown as BurdenOfProof;
}

function parseDamagesCalculation(data: JsonValue): DamagesCalculation | null {
  if (!data || typeof data !== 'object') return null;
  return data as unknown as DamagesCalculation;
}

function parseConclusionsOfLaw(data: JsonValue): ConclusionOfLaw[] {
  if (!data || !Array.isArray(data)) return [];
  return data as unknown as ConclusionOfLaw[];
}

function _parseAwardRecommendation(data: JsonValue): AwardRecommendation | null {
  if (!data || typeof data !== 'object') return null;
  return data as unknown as AwardRecommendation;
}

export function AnalysisDisplay({
  caseId: _caseId,
  analysisJob,
  jurisdiction,
  disputeType,
  claimedAmount,
}: AnalysisDisplayProps) {
  const [legalExpanded, setLegalExpanded] = useState(true);
  const [burdenExpanded, setBurdenExpanded] = useState(true);
  const [damagesExpanded, setDamagesExpanded] = useState(true);
  const [conclusionsExpanded, setConclusionsExpanded] = useState(true);

  if (!analysisJob) {
    return (
      <Card>
        <CardContent className="flex h-64 flex-col items-center justify-center">
          <Scale className="mb-4 h-12 w-12 text-muted-foreground" />
          <p className="text-muted-foreground">No analysis has been performed yet</p>
          <p className="mt-2 text-sm text-muted-foreground">
            Analysis will be generated once evidence submission is complete
          </p>
        </CardContent>
      </Card>
    );
  }

  const legalIssues = parseLegalIssues(analysisJob.legalIssues);
  const burdenOfProof = parseBurdenOfProof(analysisJob.burdenOfProof);
  const damagesCalculation = parseDamagesCalculation(analysisJob.damagesCalculation);
  const conclusionsOfLaw = parseConclusionsOfLaw(analysisJob.conclusionsOfLaw);

  // Derive award recommendation from damages calculation and burden of proof
  const awardRecommendation: AwardRecommendation | null =
    damagesCalculation && burdenOfProof
      ? {
          prevailingParty: burdenOfProof.overallBurdenMet ? 'claimant' : 'respondent',
          awardAmount: damagesCalculation.recommendedTotal,
          reasoning: burdenOfProof.overallBurdenMet
            ? `Based on the evidence, claimant has met their burden of proof. Recommended award: ${formatCurrency(damagesCalculation.recommendedTotal)}.`
            : 'Claimant has not met their burden of proof. Award to respondent.',
        }
      : null;

  return (
    <div className="space-y-4">
      {/* Analysis Status */}
      <div className="grid gap-4 md:grid-cols-4">
        <Card>
          <CardContent className="pt-4">
            <div className="flex items-center gap-2">
              {getStatusIcon(analysisJob.status)}
              <div>
                <p className="font-medium">Fact Analysis</p>
                <p className="text-sm text-muted-foreground">{analysisJob.status}</p>
              </div>
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-4">
            <div className="flex items-center gap-2">
              {getStatusIcon(analysisJob.legalAnalysisStatus)}
              <div>
                <p className="font-medium">Legal Analysis</p>
                <p className="text-sm text-muted-foreground">
                  {analysisJob.legalAnalysisStatus || 'PENDING'}
                </p>
              </div>
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-4">
            <div className="flex items-center gap-2">
              <BookOpen className="h-4 w-4 text-muted-foreground" />
              <div>
                <p className="font-medium">{jurisdiction}</p>
                <p className="text-sm text-muted-foreground">Jurisdiction</p>
              </div>
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-4">
            <div className="flex items-center gap-2">
              <Gavel className="h-4 w-4 text-muted-foreground" />
              <div>
                <p className="font-medium">{disputeType}</p>
                <p className="text-sm text-muted-foreground">Dispute Type</p>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Award Recommendation Summary */}
      {awardRecommendation && (
        <Card className="border-primary/50 bg-primary/5">
          <CardHeader className="pb-3">
            <CardTitle className="flex items-center gap-2">
              <TrendingUp className="h-5 w-5" />
              AI Award Recommendation
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="mb-4 grid gap-4 md:grid-cols-3">
              <div className="rounded-lg border bg-background p-4 text-center">
                <p className="text-sm text-muted-foreground">Recommended Award</p>
                <p className="text-2xl font-bold text-primary">
                  {formatCurrency(awardRecommendation.awardAmount)}
                </p>
              </div>
              <div className="rounded-lg border bg-background p-4 text-center">
                <p className="text-sm text-muted-foreground">Prevailing Party</p>
                <p className="text-xl font-semibold capitalize">
                  {awardRecommendation.prevailingParty}
                </p>
              </div>
              <div className="rounded-lg border bg-background p-4 text-center">
                <p className="text-sm text-muted-foreground">Claimed Amount</p>
                <p className="text-xl font-semibold">
                  {claimedAmount ? formatCurrency(claimedAmount) : 'N/A'}
                </p>
              </div>
            </div>
            <div className="rounded-lg border bg-background p-4">
              <p className="mb-2 flex items-center gap-2 text-sm font-medium">
                <Lightbulb className="h-4 w-4" />
                Reasoning
              </p>
              <p className="text-sm text-muted-foreground">{awardRecommendation.reasoning}</p>
            </div>
          </CardContent>
        </Card>
      )}

      {/* Legal Issues */}
      {legalIssues.length > 0 && (
        <Collapsible open={legalExpanded} onOpenChange={setLegalExpanded}>
          <Card>
            <CardHeader className="pb-3">
              <CollapsibleTrigger asChild>
                <Button
                  variant="ghost"
                  className="h-auto w-full justify-between p-0 hover:bg-transparent"
                >
                  <CardTitle className="flex items-center gap-2">
                    <Scale className="h-5 w-5" />
                    Legal Issues Identified ({legalIssues.length})
                  </CardTitle>
                  {legalExpanded ? (
                    <ChevronUp className="h-4 w-4" />
                  ) : (
                    <ChevronDown className="h-4 w-4" />
                  )}
                </Button>
              </CollapsibleTrigger>
            </CardHeader>
            <CollapsibleContent>
              <CardContent className="space-y-4">
                {legalIssues.map((issue, index) => (
                  <div key={index} className="rounded-lg border p-4">
                    <div className="mb-2 flex items-start justify-between">
                      <div>
                        <Badge variant="outline" className="mb-1">
                          {issue.category}
                        </Badge>
                        <p className="font-medium">{issue.description}</p>
                      </div>
                    </div>

                    {/* Elements */}
                    {issue.elements && issue.elements.length > 0 && (
                      <div className="mt-3">
                        <p className="mb-2 text-sm font-medium">Legal Elements:</p>
                        <div className="space-y-1">
                          {issue.elements.map((element, elemIndex) => (
                            <div key={elemIndex} className="flex items-center gap-2 text-sm">
                              {element.isSatisfied === true ? (
                                <CheckCircle className="h-4 w-4 text-green-600" />
                              ) : element.isSatisfied === false ? (
                                <XCircle className="h-4 w-4 text-destructive" />
                              ) : (
                                <AlertCircle className="h-4 w-4 text-amber-500" />
                              )}
                              <span
                                className={
                                  element.isSatisfied === false ? 'text-muted-foreground' : ''
                                }
                              >
                                {element.description}
                              </span>
                            </div>
                          ))}
                        </div>
                      </div>
                    )}

                    {/* Citations */}
                    {issue.applicableStatutes && issue.applicableStatutes.length > 0 && (
                      <div className="mt-3 flex flex-wrap gap-1">
                        {issue.applicableStatutes.map((statute, statIndex) => (
                          <Badge key={statIndex} variant="secondary" className="text-xs">
                            {statute}
                          </Badge>
                        ))}
                      </div>
                    )}
                  </div>
                ))}
              </CardContent>
            </CollapsibleContent>
          </Card>
        </Collapsible>
      )}

      {/* Burden of Proof */}
      {burdenOfProof && (
        <Collapsible open={burdenExpanded} onOpenChange={setBurdenExpanded}>
          <Card>
            <CardHeader className="pb-3">
              <CollapsibleTrigger asChild>
                <Button
                  variant="ghost"
                  className="h-auto w-full justify-between p-0 hover:bg-transparent"
                >
                  <CardTitle className="flex items-center gap-2">
                    <Scale className="h-5 w-5" />
                    Burden of Proof Analysis
                    <Badge variant={burdenOfProof.overallBurdenMet ? 'default' : 'secondary'}>
                      {burdenOfProof.overallBurdenMet ? 'Met' : 'Not Met'}
                    </Badge>
                  </CardTitle>
                  {burdenExpanded ? (
                    <ChevronUp className="h-4 w-4" />
                  ) : (
                    <ChevronDown className="h-4 w-4" />
                  )}
                </Button>
              </CollapsibleTrigger>
            </CardHeader>
            <CollapsibleContent>
              <CardContent className="space-y-4">
                {burdenOfProof.analyses.map((analysis, index) => (
                  <div key={index} className="rounded-lg border p-4">
                    <div className="mb-2 flex items-center justify-between">
                      <p className="font-medium">{analysis.issue}</p>
                      <div className="flex items-center gap-2">
                        <span className="text-sm text-muted-foreground">
                          {Math.round(analysis.probability * 100)}%
                        </span>
                        <Progress value={analysis.probability * 100} className="h-2 w-20" />
                      </div>
                    </div>
                    <p className="text-sm text-muted-foreground">{analysis.reasoning}</p>
                  </div>
                ))}
              </CardContent>
            </CollapsibleContent>
          </Card>
        </Collapsible>
      )}

      {/* Damages Calculation */}
      {damagesCalculation && (
        <Collapsible open={damagesExpanded} onOpenChange={setDamagesExpanded}>
          <Card>
            <CardHeader className="pb-3">
              <CollapsibleTrigger asChild>
                <Button
                  variant="ghost"
                  className="h-auto w-full justify-between p-0 hover:bg-transparent"
                >
                  <CardTitle className="flex items-center gap-2">
                    Damages Calculation
                    <Badge variant="outline">
                      {formatCurrency(damagesCalculation.recommendedTotal)}
                    </Badge>
                  </CardTitle>
                  {damagesExpanded ? (
                    <ChevronUp className="h-4 w-4" />
                  ) : (
                    <ChevronDown className="h-4 w-4" />
                  )}
                </Button>
              </CollapsibleTrigger>
            </CardHeader>
            <CollapsibleContent>
              <CardContent>
                <div className="mb-4 grid gap-4 md:grid-cols-3">
                  <div className="rounded-lg border p-3 text-center">
                    <p className="text-sm text-muted-foreground">Claimed</p>
                    <p className="text-lg font-semibold">
                      {formatCurrency(damagesCalculation.claimedTotal)}
                    </p>
                  </div>
                  <div className="rounded-lg border p-3 text-center">
                    <p className="text-sm text-muted-foreground">Supported</p>
                    <p className="text-lg font-semibold">
                      {formatCurrency(damagesCalculation.supportedTotal)}
                    </p>
                  </div>
                  <div className="rounded-lg border bg-primary/5 p-3 text-center">
                    <p className="text-sm text-muted-foreground">Recommended</p>
                    <p className="text-lg font-semibold text-primary">
                      {formatCurrency(damagesCalculation.recommendedTotal)}
                    </p>
                  </div>
                </div>

                {damagesCalculation.items && damagesCalculation.items.length > 0 && (
                  <div className="space-y-2">
                    {damagesCalculation.items.map((item, index) => (
                      <div
                        key={index}
                        className="flex items-center justify-between rounded-lg border p-3"
                      >
                        <div className="flex items-center gap-2">
                          {item.supported ? (
                            <CheckCircle className="h-4 w-4 text-green-600" />
                          ) : (
                            <XCircle className="h-4 w-4 text-destructive" />
                          )}
                          <div>
                            <p className="text-sm font-medium">{item.description}</p>
                            <p className="text-xs text-muted-foreground">{item.basis}</p>
                          </div>
                        </div>
                        <div className="text-right">
                          <p className="text-sm">Claimed: {formatCurrency(item.claimedAmount)}</p>
                          <p className="text-sm font-medium">
                            Supported: {formatCurrency(item.supportedAmount)}
                          </p>
                        </div>
                      </div>
                    ))}
                  </div>
                )}

                {damagesCalculation.interestCalculation && (
                  <div className="mt-4 rounded-lg border bg-muted/30 p-3">
                    <p className="mb-2 text-sm font-medium">Interest Calculation</p>
                    <div className="grid gap-2 text-sm">
                      <p>
                        Rate: {(damagesCalculation.interestCalculation.rate * 100).toFixed(1)}% per
                        annum
                      </p>
                      <p>Period: {damagesCalculation.interestCalculation.days} days</p>
                      <p className="font-medium">
                        Interest Amount:{' '}
                        {formatCurrency(damagesCalculation.interestCalculation.amount)}
                      </p>
                      <p className="text-xs text-muted-foreground">
                        {damagesCalculation.interestCalculation.statutoryBasis}
                      </p>
                    </div>
                  </div>
                )}
              </CardContent>
            </CollapsibleContent>
          </Card>
        </Collapsible>
      )}

      {/* Conclusions of Law */}
      {conclusionsOfLaw.length > 0 && (
        <Collapsible open={conclusionsExpanded} onOpenChange={setConclusionsExpanded}>
          <Card>
            <CardHeader className="pb-3">
              <CollapsibleTrigger asChild>
                <Button
                  variant="ghost"
                  className="h-auto w-full justify-between p-0 hover:bg-transparent"
                >
                  <CardTitle className="flex items-center gap-2">
                    <BookOpen className="h-5 w-5" />
                    Conclusions of Law ({conclusionsOfLaw.length})
                  </CardTitle>
                  {conclusionsExpanded ? (
                    <ChevronUp className="h-4 w-4" />
                  ) : (
                    <ChevronDown className="h-4 w-4" />
                  )}
                </Button>
              </CollapsibleTrigger>
            </CardHeader>
            <CollapsibleContent>
              <CardContent className="space-y-3">
                {conclusionsOfLaw.map((conclusion, index) => (
                  <div key={index} className="rounded-lg border p-4">
                    <div className="mb-2 flex items-center justify-between">
                      <Badge variant="outline">{conclusion.issue}</Badge>
                      <div className="flex items-center gap-2">
                        <span className="text-xs text-muted-foreground">Confidence</span>
                        <Progress value={conclusion.confidence * 100} className="h-2 w-16" />
                        <span className="text-xs">{Math.round(conclusion.confidence * 100)}%</span>
                      </div>
                    </div>
                    <p className="text-sm">{conclusion.conclusion}</p>
                  </div>
                ))}
              </CardContent>
            </CollapsibleContent>
          </Card>
        </Collapsible>
      )}
    </div>
  );
}
