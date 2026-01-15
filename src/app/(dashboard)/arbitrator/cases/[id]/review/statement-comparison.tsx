'use client';

import { useState } from 'react';

import { format } from 'date-fns';
import {
  AlertCircle,
  CheckCircle,
  ChevronDown,
  ChevronUp,
  DollarSign,
  MessageSquare,
} from 'lucide-react';

import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from '@/components/ui/collapsible';
import { ScrollArea } from '@/components/ui/scroll-area';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import type { JsonValue, Statement } from '@/types/shared';

type StatementWithSubmitter = Statement & {
  submittedBy: { id: string; name: string | null };
};

interface ClaimItem {
  id: string;
  description: string;
  amount: number;
  category: string;
  supportingEvidenceIds?: string[];
}

interface _TimelineEntry {
  id: string;
  date: string;
  title: string;
  description: string;
  evidenceIds?: string[];
}

interface StatementComparisonProps {
  caseId: string;
  claimantName: string;
  respondentName: string;
  claimantStatement: StatementWithSubmitter | undefined;
  respondentStatement: StatementWithSubmitter | undefined;
  claimantId: string;
}

function parseClaimItems(claimItems: JsonValue): ClaimItem[] {
  if (!claimItems || !Array.isArray(claimItems)) return [];
  return claimItems as unknown as ClaimItem[];
}

function formatCurrency(amount: number): string {
  return new Intl.NumberFormat('en-US', {
    style: 'currency',
    currency: 'USD',
    minimumFractionDigits: 0,
    maximumFractionDigits: 2,
  }).format(amount);
}

function getCategoryLabel(category: string): string {
  const labels: Record<string, string> = {
    damages: 'Damages',
    fees: 'Fees',
    costs: 'Costs',
    interest: 'Interest',
    other: 'Other',
  };
  return labels[category] || category;
}

interface StatementPanelProps {
  statement: StatementWithSubmitter | undefined;
  partyName: string;
  partyType: 'claimant' | 'respondent';
  isClaimant: boolean;
}

function StatementPanel({ statement, partyName, partyType, isClaimant }: StatementPanelProps) {
  const [narrativeExpanded, setNarrativeExpanded] = useState(true);
  const [claimsExpanded, setClaimsExpanded] = useState(true);

  if (!statement) {
    return (
      <div className="flex h-64 flex-col items-center justify-center text-muted-foreground">
        <MessageSquare className="mb-4 h-12 w-12 opacity-50" />
        <p className="text-center">No statement submitted by {partyName}</p>
      </div>
    );
  }

  const claimItems = parseClaimItems(statement.claimItems);
  const totalClaimed = claimItems.reduce((sum, item) => sum + item.amount, 0);

  return (
    <div className="space-y-4">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <div className="flex items-center gap-2">
            <Badge variant={partyType === 'claimant' ? 'default' : 'secondary'}>
              {statement.type}
            </Badge>
            <span className="text-sm text-muted-foreground">Version {statement.version}</span>
          </div>
          <p className="mt-1 text-xs text-muted-foreground">
            Submitted {format(new Date(statement.submittedAt), 'MMMM d, yyyy h:mm a')}
          </p>
        </div>
      </div>

      {/* Narrative */}
      <Collapsible open={narrativeExpanded} onOpenChange={setNarrativeExpanded}>
        <CollapsibleTrigger asChild>
          <Button variant="ghost" className="h-auto w-full justify-between p-2">
            <span className="font-medium">Narrative Statement</span>
            {narrativeExpanded ? (
              <ChevronUp className="h-4 w-4" />
            ) : (
              <ChevronDown className="h-4 w-4" />
            )}
          </Button>
        </CollapsibleTrigger>
        <CollapsibleContent>
          <ScrollArea className="h-[300px] rounded-md border p-4">
            <div className="prose prose-sm max-w-none">
              <p className="whitespace-pre-wrap">{statement.content}</p>
            </div>
          </ScrollArea>
        </CollapsibleContent>
      </Collapsible>

      {/* Claim Items (only for claimant) */}
      {isClaimant && claimItems.length > 0 && (
        <Collapsible open={claimsExpanded} onOpenChange={setClaimsExpanded}>
          <CollapsibleTrigger asChild>
            <Button variant="ghost" className="h-auto w-full justify-between p-2">
              <div className="flex items-center gap-2">
                <span className="font-medium">Claimed Damages</span>
                <Badge variant="outline">{formatCurrency(totalClaimed)}</Badge>
              </div>
              {claimsExpanded ? (
                <ChevronUp className="h-4 w-4" />
              ) : (
                <ChevronDown className="h-4 w-4" />
              )}
            </Button>
          </CollapsibleTrigger>
          <CollapsibleContent>
            <div className="rounded-md border">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Description</TableHead>
                    <TableHead>Category</TableHead>
                    <TableHead className="text-right">Amount</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {claimItems.map((item) => (
                    <TableRow key={item.id}>
                      <TableCell className="font-medium">{item.description}</TableCell>
                      <TableCell>
                        <Badge variant="outline">{getCategoryLabel(item.category)}</Badge>
                      </TableCell>
                      <TableCell className="text-right">{formatCurrency(item.amount)}</TableCell>
                    </TableRow>
                  ))}
                  <TableRow className="bg-muted/50">
                    <TableCell colSpan={2} className="font-bold">
                      Total Claimed
                    </TableCell>
                    <TableCell className="text-right font-bold">
                      {formatCurrency(totalClaimed)}
                    </TableCell>
                  </TableRow>
                </TableBody>
              </Table>
            </div>
          </CollapsibleContent>
        </Collapsible>
      )}
    </div>
  );
}

export function StatementComparison({
  caseId: _caseId,
  claimantName,
  respondentName,
  claimantStatement,
  respondentStatement,
  claimantId: _claimantId,
}: StatementComparisonProps) {
  const claimantClaims = claimantStatement ? parseClaimItems(claimantStatement.claimItems) : [];
  const totalClaimed = claimantClaims.reduce((sum, item) => sum + item.amount, 0);

  return (
    <div className="space-y-4">
      {/* Summary Cards */}
      <div className="grid gap-4 md:grid-cols-3">
        <Card>
          <CardContent className="pt-4">
            <div className="flex items-center gap-2">
              {claimantStatement ? (
                <CheckCircle className="h-5 w-5 text-green-600" />
              ) : (
                <AlertCircle className="h-5 w-5 text-amber-500" />
              )}
              <div>
                <p className="font-medium">{claimantName}</p>
                <p className="text-sm text-muted-foreground">
                  {claimantStatement ? 'Statement Submitted' : 'Pending'}
                </p>
              </div>
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-4">
            <div className="flex items-center gap-2">
              {respondentStatement ? (
                <CheckCircle className="h-5 w-5 text-green-600" />
              ) : (
                <AlertCircle className="h-5 w-5 text-amber-500" />
              )}
              <div>
                <p className="font-medium">{respondentName}</p>
                <p className="text-sm text-muted-foreground">
                  {respondentStatement ? 'Statement Submitted' : 'Pending'}
                </p>
              </div>
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-4">
            <div className="flex items-center gap-2">
              <DollarSign className="h-5 w-5 text-muted-foreground" />
              <div>
                <p className="font-medium">{formatCurrency(totalClaimed)}</p>
                <p className="text-sm text-muted-foreground">Total Claimed</p>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Side-by-Side Statements */}
      <div className="grid gap-4 md:grid-cols-2">
        {/* Claimant Statement */}
        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="flex items-center gap-2 text-lg">
              <Badge variant="default">{claimantName}</Badge>
              Statement
            </CardTitle>
            <CardDescription>Initial claim and narrative from the claimant</CardDescription>
          </CardHeader>
          <CardContent>
            <StatementPanel
              statement={claimantStatement}
              partyName={claimantName}
              partyType="claimant"
              isClaimant={true}
            />
          </CardContent>
        </Card>

        {/* Respondent Statement */}
        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="flex items-center gap-2 text-lg">
              <Badge variant="secondary">{respondentName}</Badge>
              Statement
            </CardTitle>
            <CardDescription>Response and defense from the respondent</CardDescription>
          </CardHeader>
          <CardContent>
            <StatementPanel
              statement={respondentStatement}
              partyName={respondentName}
              partyType="respondent"
              isClaimant={false}
            />
          </CardContent>
        </Card>
      </div>

      {/* Claims Summary Table */}
      {claimantClaims.length > 0 && (
        <Card>
          <CardHeader>
            <CardTitle>Claims Summary</CardTitle>
            <CardDescription>Breakdown of claimed damages and amounts</CardDescription>
          </CardHeader>
          <CardContent>
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead className="w-[50px]">#</TableHead>
                  <TableHead>Description</TableHead>
                  <TableHead>Category</TableHead>
                  <TableHead className="text-right">Claimed Amount</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {claimantClaims.map((item, index) => (
                  <TableRow key={item.id}>
                    <TableCell className="font-medium">{index + 1}</TableCell>
                    <TableCell>{item.description}</TableCell>
                    <TableCell>
                      <Badge variant="outline">{getCategoryLabel(item.category)}</Badge>
                    </TableCell>
                    <TableCell className="text-right font-medium">
                      {formatCurrency(item.amount)}
                    </TableCell>
                  </TableRow>
                ))}
                <TableRow className="bg-muted/50 font-bold">
                  <TableCell colSpan={3}>Total</TableCell>
                  <TableCell className="text-right">{formatCurrency(totalClaimed)}</TableCell>
                </TableRow>
              </TableBody>
            </Table>
          </CardContent>
        </Card>
      )}
    </div>
  );
}
