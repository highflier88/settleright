'use client';

import { useState } from 'react';

import Link from 'next/link';

import { format } from 'date-fns';
import { Gavel, FileText, Scale, AlertTriangle, ChevronRight, ExternalLink } from 'lucide-react';

import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Progress } from '@/components/ui/progress';
import { ScrollArea } from '@/components/ui/scroll-area';

import type { DraftAward } from '@prisma/client';
import type { JsonValue } from '@prisma/client/runtime/library';

interface AwardDisplayProps {
  caseId: string;
  draftAward: DraftAward | null;
  claimantName: string;
  respondentName: string;
  claimedAmount: number | null;
}

interface FindingOfFact {
  id: string;
  number: number;
  finding: string;
  basis: string;
  supportingEvidence: string[];
  credibilityNote?: string;
  date?: string;
  amount?: number;
}

interface ConclusionOfLaw {
  id: string;
  number: number;
  issue: string;
  conclusion: string;
  legalBasis: string[];
  supportingFindings: number[];
}

function formatCurrency(amount: number): string {
  return new Intl.NumberFormat('en-US', {
    style: 'currency',
    currency: 'USD',
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  }).format(amount);
}

function parseFindings(data: JsonValue): FindingOfFact[] {
  if (!data || !Array.isArray(data)) return [];
  return data as unknown as FindingOfFact[];
}

function parseConclusions(data: JsonValue): ConclusionOfLaw[] {
  if (!data || !Array.isArray(data)) return [];
  return data as unknown as ConclusionOfLaw[];
}

function getReviewStatusBadge(status: string | null) {
  switch (status) {
    case 'APPROVE':
      return (
        <Badge variant="default" className="bg-green-600">
          Approved
        </Badge>
      );
    case 'MODIFY':
      return (
        <Badge variant="default" className="bg-blue-600">
          Modified
        </Badge>
      );
    case 'REJECT':
      return <Badge variant="destructive">Rejected</Badge>;
    case 'ESCALATE':
      return (
        <Badge variant="default" className="bg-purple-600">
          Escalated
        </Badge>
      );
    default:
      return <Badge variant="outline">Pending Review</Badge>;
  }
}

function getBasisLabel(basis: string): string {
  const labels: Record<string, string> = {
    undisputed: 'Undisputed Fact',
    proven: 'Proven by Evidence',
    credibility: 'Credibility Determination',
  };
  return labels[basis] || basis;
}

export function AwardDisplay({
  caseId,
  draftAward,
  claimantName,
  respondentName,
  claimedAmount,
}: AwardDisplayProps) {
  const [selectedFinding, setSelectedFinding] = useState<FindingOfFact | null>(null);
  const [selectedConclusion, setSelectedConclusion] = useState<ConclusionOfLaw | null>(null);

  if (!draftAward) {
    return (
      <Card>
        <CardContent className="flex h-64 flex-col items-center justify-center">
          <Gavel className="mb-4 h-12 w-12 text-muted-foreground" />
          <p className="text-muted-foreground">No draft award has been generated yet</p>
          <p className="mt-2 text-sm text-muted-foreground">
            The award will be generated once the AI analysis is complete
          </p>
        </CardContent>
      </Card>
    );
  }

  const findings = parseFindings(draftAward.findingsOfFact);
  const conclusions = parseConclusions(draftAward.conclusionsOfLaw);
  const confidencePercent = Math.round((draftAward.confidence || 0) * 100);

  return (
    <div className="space-y-4">
      {/* Award Summary */}
      <Card className="border-primary/50">
        <CardHeader className="pb-3">
          <div className="flex items-center justify-between">
            <CardTitle className="flex items-center gap-2">
              <Gavel className="h-5 w-5" />
              Draft Award Summary
            </CardTitle>
            {getReviewStatusBadge(draftAward.reviewStatus)}
          </div>
          <CardDescription>
            Generated {format(new Date(draftAward.generatedAt), 'MMMM d, yyyy h:mm a')}
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div className="mb-4 grid gap-4 md:grid-cols-4">
            <div className="rounded-lg border p-4 text-center">
              <p className="text-sm text-muted-foreground">Award Amount</p>
              <p className="text-2xl font-bold text-primary">
                {draftAward.awardAmount ? formatCurrency(Number(draftAward.awardAmount)) : 'N/A'}
              </p>
            </div>
            <div className="rounded-lg border p-4 text-center">
              <p className="text-sm text-muted-foreground">Claimed Amount</p>
              <p className="text-xl font-semibold">
                {claimedAmount ? formatCurrency(claimedAmount) : 'N/A'}
              </p>
            </div>
            <div className="rounded-lg border p-4 text-center">
              <p className="text-sm text-muted-foreground">Prevailing Party</p>
              <p className="text-xl font-semibold capitalize">
                {draftAward.prevailingParty === 'CLAIMANT'
                  ? claimantName
                  : draftAward.prevailingParty === 'RESPONDENT'
                    ? respondentName
                    : draftAward.prevailingParty?.toLowerCase() || 'N/A'}
              </p>
            </div>
            <div className="rounded-lg border p-4 text-center">
              <p className="text-sm text-muted-foreground">AI Confidence</p>
              <div className="mt-1 flex items-center justify-center gap-2">
                <Progress value={confidencePercent} className="h-2 w-16" />
                <span className="font-semibold">{confidencePercent}%</span>
              </div>
            </div>
          </div>

          {/* Action Button */}
          <div className="flex justify-end">
            <Link href={`/arbitrator/cases/${caseId}/award`}>
              <Button>
                Review & Finalize Award
                <ExternalLink className="ml-2 h-4 w-4" />
              </Button>
            </Link>
          </div>
        </CardContent>
      </Card>

      {/* Decision Narrative */}
      <Card>
        <CardHeader className="pb-3">
          <CardTitle>Decision Narrative</CardTitle>
          <CardDescription>Summary of the award decision</CardDescription>
        </CardHeader>
        <CardContent>
          <ScrollArea className="h-[200px] rounded-md border p-4">
            <p className="whitespace-pre-wrap">{draftAward.decision}</p>
          </ScrollArea>
        </CardContent>
      </Card>

      {/* Split View: Findings and Conclusions */}
      <div className="grid gap-4 md:grid-cols-2">
        {/* Findings of Fact */}
        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="flex items-center gap-2">
              <FileText className="h-5 w-5" />
              Findings of Fact ({findings.length})
            </CardTitle>
            <CardDescription>Factual determinations based on evidence</CardDescription>
          </CardHeader>
          <CardContent>
            <ScrollArea className="h-[400px] pr-4">
              {findings.length === 0 ? (
                <div className="flex h-32 flex-col items-center justify-center text-muted-foreground">
                  <FileText className="mb-2 h-8 w-8 opacity-50" />
                  <p className="text-sm">No findings available</p>
                </div>
              ) : (
                <div className="space-y-2">
                  {findings.map((finding) => (
                    <button
                      type="button"
                      key={finding.id}
                      className={`w-full cursor-pointer rounded-lg border p-3 text-left transition-all hover:shadow-md ${
                        selectedFinding?.id === finding.id
                          ? 'border-primary bg-primary/5 ring-1 ring-primary'
                          : 'hover:border-muted-foreground/30'
                      }`}
                      onClick={() =>
                        setSelectedFinding(selectedFinding?.id === finding.id ? null : finding)
                      }
                    >
                      <div className="flex items-start gap-2">
                        <span className="flex h-6 w-6 flex-shrink-0 items-center justify-center rounded-full bg-primary/10 text-xs font-medium text-primary">
                          {finding.number}
                        </span>
                        <div className="min-w-0 flex-1">
                          <p className="line-clamp-2 text-sm">{finding.finding}</p>
                          <div className="mt-1 flex items-center gap-2">
                            <Badge variant="outline" className="text-xs">
                              {getBasisLabel(finding.basis)}
                            </Badge>
                            {finding.amount && (
                              <span className="text-xs text-muted-foreground">
                                {formatCurrency(finding.amount)}
                              </span>
                            )}
                          </div>
                        </div>
                        <ChevronRight className="h-4 w-4 flex-shrink-0 text-muted-foreground" />
                      </div>
                    </button>
                  ))}
                </div>
              )}
            </ScrollArea>
          </CardContent>
        </Card>

        {/* Conclusions of Law */}
        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="flex items-center gap-2">
              <Scale className="h-5 w-5" />
              Conclusions of Law ({conclusions.length})
            </CardTitle>
            <CardDescription>Legal conclusions based on applicable law</CardDescription>
          </CardHeader>
          <CardContent>
            <ScrollArea className="h-[400px] pr-4">
              {conclusions.length === 0 ? (
                <div className="flex h-32 flex-col items-center justify-center text-muted-foreground">
                  <Scale className="mb-2 h-8 w-8 opacity-50" />
                  <p className="text-sm">No conclusions available</p>
                </div>
              ) : (
                <div className="space-y-2">
                  {conclusions.map((conclusion) => (
                    <button
                      type="button"
                      key={conclusion.id}
                      className={`w-full cursor-pointer rounded-lg border p-3 text-left transition-all hover:shadow-md ${
                        selectedConclusion?.id === conclusion.id
                          ? 'border-primary bg-primary/5 ring-1 ring-primary'
                          : 'hover:border-muted-foreground/30'
                      }`}
                      onClick={() =>
                        setSelectedConclusion(
                          selectedConclusion?.id === conclusion.id ? null : conclusion
                        )
                      }
                    >
                      <div className="flex items-start gap-2">
                        <span className="flex h-6 w-6 flex-shrink-0 items-center justify-center rounded-full bg-primary/10 text-xs font-medium text-primary">
                          {conclusion.number}
                        </span>
                        <div className="min-w-0 flex-1">
                          <p className="mb-1 text-xs font-medium text-muted-foreground">
                            {conclusion.issue}
                          </p>
                          <p className="line-clamp-2 text-sm">{conclusion.conclusion}</p>
                          {conclusion.legalBasis && conclusion.legalBasis.length > 0 && (
                            <div className="mt-1 flex flex-wrap gap-1">
                              {conclusion.legalBasis.slice(0, 2).map((basis, i) => (
                                <Badge key={i} variant="secondary" className="text-xs">
                                  {basis}
                                </Badge>
                              ))}
                              {conclusion.legalBasis.length > 2 && (
                                <Badge variant="secondary" className="text-xs">
                                  +{conclusion.legalBasis.length - 2}
                                </Badge>
                              )}
                            </div>
                          )}
                        </div>
                        <ChevronRight className="h-4 w-4 flex-shrink-0 text-muted-foreground" />
                      </div>
                    </button>
                  ))}
                </div>
              )}
            </ScrollArea>
          </CardContent>
        </Card>
      </div>

      {/* Detail Panels */}
      {(selectedFinding || selectedConclusion) && (
        <Card>
          <CardHeader className="pb-3">
            <CardTitle>
              {selectedFinding
                ? `Finding #${selectedFinding.number} Details`
                : `Conclusion #${selectedConclusion?.number} Details`}
            </CardTitle>
          </CardHeader>
          <CardContent>
            {selectedFinding && (
              <div className="space-y-4">
                <div>
                  <h4 className="mb-1 text-sm font-medium">Finding</h4>
                  <p className="text-sm">{selectedFinding.finding}</p>
                </div>
                <div className="grid gap-4 md:grid-cols-3">
                  <div>
                    <h4 className="mb-1 text-sm font-medium">Basis</h4>
                    <Badge variant="outline">{getBasisLabel(selectedFinding.basis)}</Badge>
                  </div>
                  {selectedFinding.date && (
                    <div>
                      <h4 className="mb-1 text-sm font-medium">Date</h4>
                      <p className="text-sm">{selectedFinding.date}</p>
                    </div>
                  )}
                  {selectedFinding.amount && (
                    <div>
                      <h4 className="mb-1 text-sm font-medium">Amount</h4>
                      <p className="text-sm font-semibold">
                        {formatCurrency(selectedFinding.amount)}
                      </p>
                    </div>
                  )}
                </div>
                {selectedFinding.credibilityNote && (
                  <div className="rounded-lg border bg-amber-50 p-3 dark:bg-amber-950/30">
                    <h4 className="mb-1 flex items-center gap-2 text-sm font-medium">
                      <AlertTriangle className="h-4 w-4 text-amber-600" />
                      Credibility Note
                    </h4>
                    <p className="text-sm text-amber-800 dark:text-amber-200">
                      {selectedFinding.credibilityNote}
                    </p>
                  </div>
                )}
                {selectedFinding.supportingEvidence &&
                  selectedFinding.supportingEvidence.length > 0 && (
                    <div>
                      <h4 className="mb-1 text-sm font-medium">Supporting Evidence</h4>
                      <div className="flex flex-wrap gap-1">
                        {selectedFinding.supportingEvidence.map((evidenceId, i) => (
                          <Badge key={i} variant="secondary" className="text-xs">
                            Evidence #{i + 1}
                          </Badge>
                        ))}
                      </div>
                    </div>
                  )}
              </div>
            )}

            {selectedConclusion && (
              <div className="space-y-4">
                <div>
                  <h4 className="mb-1 text-sm font-medium">Legal Issue</h4>
                  <Badge variant="outline">{selectedConclusion.issue}</Badge>
                </div>
                <div>
                  <h4 className="mb-1 text-sm font-medium">Conclusion</h4>
                  <p className="text-sm">{selectedConclusion.conclusion}</p>
                </div>
                {selectedConclusion.legalBasis && selectedConclusion.legalBasis.length > 0 && (
                  <div>
                    <h4 className="mb-1 text-sm font-medium">Legal Citations</h4>
                    <div className="flex flex-wrap gap-1">
                      {selectedConclusion.legalBasis.map((basis, i) => (
                        <Badge key={i} variant="secondary">
                          {basis}
                        </Badge>
                      ))}
                    </div>
                  </div>
                )}
                {selectedConclusion.supportingFindings &&
                  selectedConclusion.supportingFindings.length > 0 && (
                    <div>
                      <h4 className="mb-1 text-sm font-medium">Based on Findings</h4>
                      <div className="flex flex-wrap gap-1">
                        {selectedConclusion.supportingFindings.map((findingNum, i) => (
                          <Badge key={i} variant="outline" className="text-xs">
                            Finding #{findingNum}
                          </Badge>
                        ))}
                      </div>
                    </div>
                  )}
              </div>
            )}
          </CardContent>
        </Card>
      )}

      {/* Full Reasoning */}
      <Card>
        <CardHeader className="pb-3">
          <CardTitle>Full Reasoning</CardTitle>
          <CardDescription>Complete reasoning behind the award recommendation</CardDescription>
        </CardHeader>
        <CardContent>
          <ScrollArea className="h-[300px] rounded-md border p-4">
            <div className="prose prose-sm max-w-none">
              <p className="whitespace-pre-wrap">{draftAward.reasoning}</p>
            </div>
          </ScrollArea>
        </CardContent>
      </Card>
    </div>
  );
}
