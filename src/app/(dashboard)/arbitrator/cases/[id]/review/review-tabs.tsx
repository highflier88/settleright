'use client';

import { useState } from 'react';

import {
  FileText,
  MessageSquare,
  Scale,
  Gavel,
  StickyNote,
} from 'lucide-react';

import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';

import { AnalysisDisplay } from './analysis-display';
import { AwardDisplay } from './award-display';
import { EvidenceComparison } from './evidence-comparison';
import { NotesPanel } from './notes-panel';
import { StatementComparison } from './statement-comparison';

import type { Evidence, Statement, DraftAward, AnalysisJob } from '@prisma/client';

interface Party {
  id: string;
  name: string | null;
  email: string;
}

interface CaseData {
  id: string;
  referenceNumber: string;
  status: string;
  disputeType: string;
  jurisdiction: string;
  amount: number | null;
  description: string;
  claimant: Party | null;
  respondent: Party | null;
  claimantId: string;
  respondentId: string | null;
}

type EvidenceWithSubmitter = Evidence & {
  submittedBy: { id: string; name: string | null };
};

type StatementWithSubmitter = Statement & {
  submittedBy: { id: string; name: string | null };
};

interface ReviewTabsProps {
  caseId: string;
  caseData: CaseData;
  claimantEvidence: EvidenceWithSubmitter[];
  respondentEvidence: EvidenceWithSubmitter[];
  claimantStatement: StatementWithSubmitter | undefined;
  respondentStatement: StatementWithSubmitter | undefined;
  draftAward: DraftAward | null;
  analysisJob: AnalysisJob | null;
}

export function ReviewTabs({
  caseId,
  caseData,
  claimantEvidence,
  respondentEvidence,
  claimantStatement,
  respondentStatement,
  draftAward,
  analysisJob,
}: ReviewTabsProps) {
  const [activeTab, setActiveTab] = useState('evidence');

  return (
    <Tabs value={activeTab} onValueChange={setActiveTab} className="w-full">
      <TabsList className="grid w-full grid-cols-5">
        <TabsTrigger value="evidence" className="flex items-center gap-2">
          <FileText className="h-4 w-4" />
          <span className="hidden sm:inline">Evidence</span>
        </TabsTrigger>
        <TabsTrigger value="statements" className="flex items-center gap-2">
          <MessageSquare className="h-4 w-4" />
          <span className="hidden sm:inline">Statements</span>
        </TabsTrigger>
        <TabsTrigger value="analysis" className="flex items-center gap-2">
          <Scale className="h-4 w-4" />
          <span className="hidden sm:inline">Analysis</span>
        </TabsTrigger>
        <TabsTrigger value="award" className="flex items-center gap-2">
          <Gavel className="h-4 w-4" />
          <span className="hidden sm:inline">Award</span>
        </TabsTrigger>
        <TabsTrigger value="notes" className="flex items-center gap-2">
          <StickyNote className="h-4 w-4" />
          <span className="hidden sm:inline">Notes</span>
        </TabsTrigger>
      </TabsList>

      <TabsContent value="evidence" className="mt-4">
        <EvidenceComparison
          caseId={caseId}
          claimantName={caseData.claimant?.name || 'Claimant'}
          respondentName={caseData.respondent?.name || 'Respondent'}
          claimantEvidence={claimantEvidence}
          respondentEvidence={respondentEvidence}
        />
      </TabsContent>

      <TabsContent value="statements" className="mt-4">
        <StatementComparison
          caseId={caseId}
          claimantName={caseData.claimant?.name || 'Claimant'}
          respondentName={caseData.respondent?.name || 'Respondent'}
          claimantStatement={claimantStatement}
          respondentStatement={respondentStatement}
          claimantId={caseData.claimantId}
        />
      </TabsContent>

      <TabsContent value="analysis" className="mt-4">
        <AnalysisDisplay
          caseId={caseId}
          analysisJob={analysisJob}
          jurisdiction={caseData.jurisdiction}
          disputeType={caseData.disputeType}
          claimedAmount={caseData.amount}
        />
      </TabsContent>

      <TabsContent value="award" className="mt-4">
        <AwardDisplay
          caseId={caseId}
          draftAward={draftAward}
          claimantName={caseData.claimant?.name || 'Claimant'}
          respondentName={caseData.respondent?.name || 'Respondent'}
          claimedAmount={caseData.amount}
        />
      </TabsContent>

      <TabsContent value="notes" className="mt-4">
        <NotesPanel caseId={caseId} />
      </TabsContent>
    </Tabs>
  );
}
