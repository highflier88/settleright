/**
 * Analysis Orchestrator
 *
 * Main pipeline orchestrator that coordinates all analysis phases:
 * fact extraction, comparison, timeline, contradictions, and credibility.
 */

import { prisma } from '@/lib/db';

import { detectContradictions } from './contradictions';
import { assessCredibility } from './credibility';
import { compareFacts } from './fact-comparison';
import { extractFacts } from './fact-extraction';
import { reconstructTimeline, mergeTimelineEvents, extractEventsFromFacts } from './timeline';

import type {
  AnalysisInput,
  AnalysisOptions,
  AnalysisPhase,
  AnalysisProgress,
  AnalysisResult,
  Contradiction,
  CredibilityResult,
  DisputedFact,
  EvidenceSummary,
  ExtractedFactsResult,
  TimelineEvent,
  UndisputedFact,
} from './types';
import type { AnalysisStatus } from '@prisma/client';

/**
 * Progress callback type
 */
type ProgressCallback = (progress: AnalysisProgress) => Promise<void>;

/**
 * Default analysis options
 */
const DEFAULT_OPTIONS: AnalysisOptions = {
  skipFactExtraction: false,
  skipFactComparison: false,
  skipTimeline: false,
  skipContradictions: false,
  skipCredibility: false,
  force: false,
};

/**
 * Run the complete analysis pipeline for a case
 */
export async function runAnalysis(
  input: AnalysisInput,
  options: AnalysisOptions = {},
  onProgress?: ProgressCallback
): Promise<AnalysisResult> {
  const opts = { ...DEFAULT_OPTIONS, ...options };
  const startTime = Date.now();
  let totalTokensUsed = 0;

  // Get or create analysis job
  const job = await getOrCreateAnalysisJob(input.caseId);

  const updateProgress = async (phase: AnalysisPhase, progress: number, message?: string) => {
    const status = phaseToStatus(phase);

    await Promise.all([
      prisma.analysisJob.update({
        where: { id: job.id },
        data: { status, progress },
      }),
      onProgress?.({
        caseId: input.caseId,
        jobId: job.id,
        phase,
        progress,
        message,
      }),
    ]);
  };

  try {
    // Build case context string
    const caseContext = buildCaseContext(input);

    // Phase 1: Fact Extraction (20%)
    await updateProgress('extracting_facts', 10, 'Extracting facts from statements');

    let extractedFacts: ExtractedFactsResult = { claimant: [], respondent: [] };

    if (!opts.skipFactExtraction) {
      extractedFacts = await extractFacts(
        input.claimantStatement,
        input.respondentStatement,
        caseContext,
        input.evidenceSummaries
      );
      totalTokensUsed += extractedFacts.tokensUsed || 0;

      // Save intermediate results
      await prisma.analysisJob.update({
        where: { id: job.id },
        data: {
          // eslint-disable-next-line @typescript-eslint/no-unsafe-assignment
          extractedFacts: JSON.parse(JSON.stringify(extractedFacts)),
        },
      });
    }

    await updateProgress('extracting_facts', 20, 'Fact extraction complete');

    // Phase 2: Fact Comparison (40%)
    await updateProgress('comparing_facts', 30, 'Comparing facts between parties');

    let disputedFacts: DisputedFact[] = [];
    let undisputedFacts: UndisputedFact[] = [];

    if (!opts.skipFactComparison && extractedFacts.claimant.length > 0) {
      const comparisonResult = await compareFacts(
        extractedFacts.claimant,
        extractedFacts.respondent,
        caseContext
      );
      disputedFacts = comparisonResult.disputed;
      undisputedFacts = comparisonResult.undisputed;
      totalTokensUsed += comparisonResult.tokensUsed || 0;

      // Save intermediate results
      await prisma.analysisJob.update({
        where: { id: job.id },
        data: {
          // eslint-disable-next-line @typescript-eslint/no-unsafe-assignment
          disputedFacts: JSON.parse(JSON.stringify(disputedFacts)),
          // eslint-disable-next-line @typescript-eslint/no-unsafe-assignment
          undisputedFacts: JSON.parse(JSON.stringify(undisputedFacts)),
        },
      });
    }

    await updateProgress('comparing_facts', 40, 'Fact comparison complete');

    // Phase 3: Timeline Reconstruction (60%)
    await updateProgress('building_timeline', 50, 'Reconstructing timeline');

    let timeline: TimelineEvent[] = [];

    if (!opts.skipTimeline) {
      const timelineResult = await reconstructTimeline(
        input.claimantStatement,
        input.respondentStatement,
        input.evidenceSummaries,
        disputedFacts,
        caseContext
      );
      totalTokensUsed += timelineResult.tokensUsed || 0;

      // Merge with fact-based events
      const factEvents = extractEventsFromFacts(extractedFacts.claimant, extractedFacts.respondent);
      timeline = mergeTimelineEvents(timelineResult.timeline.events, factEvents);

      // Save intermediate results
      await prisma.analysisJob.update({
        where: { id: job.id },
        data: {
          // eslint-disable-next-line @typescript-eslint/no-unsafe-assignment
          timeline: JSON.parse(JSON.stringify(timeline)),
        },
      });
    }

    await updateProgress('building_timeline', 60, 'Timeline reconstruction complete');

    // Phase 4: Contradiction Detection (80%)
    await updateProgress('detecting_contradictions', 70, 'Detecting contradictions');

    let contradictions: Contradiction[] = [];

    if (!opts.skipContradictions && input.respondentStatement && disputedFacts.length > 0) {
      const contradictionResult = await detectContradictions(
        disputedFacts,
        input.claimantStatement,
        input.respondentStatement,
        caseContext
      );
      contradictions = contradictionResult.contradictions;
      totalTokensUsed += contradictionResult.tokensUsed || 0;

      // Save intermediate results
      await prisma.analysisJob.update({
        where: { id: job.id },
        data: {
          // eslint-disable-next-line @typescript-eslint/no-unsafe-assignment
          contradictions: JSON.parse(JSON.stringify(contradictions)),
        },
      });
    }

    await updateProgress('detecting_contradictions', 80, 'Contradiction detection complete');

    // Phase 5: Credibility Scoring (100%)
    await updateProgress('scoring_credibility', 90, 'Assessing credibility');

    let credibilityScores: CredibilityResult | undefined;

    if (!opts.skipCredibility && extractedFacts.claimant.length > 0) {
      credibilityScores = await assessCredibility(
        input.claimantStatement,
        input.respondentStatement || '',
        extractedFacts.claimant,
        extractedFacts.respondent,
        contradictions,
        input.evidenceSummaries,
        caseContext
      );
      totalTokensUsed += credibilityScores.tokensUsed || 0;

      // Save intermediate results
      await prisma.analysisJob.update({
        where: { id: job.id },
        data: {
          // eslint-disable-next-line @typescript-eslint/no-unsafe-assignment
          credibilityScores: JSON.parse(JSON.stringify(credibilityScores)),
        },
      });
    }

    // Complete the job
    const processingTimeMs = Date.now() - startTime;
    const estimatedCost = estimateTotalCost(totalTokensUsed);

    await prisma.analysisJob.update({
      where: { id: job.id },
      data: {
        status: 'COMPLETED',
        progress: 100,
        completedAt: new Date(),
        tokensUsed: totalTokensUsed,
        processingTimeMs,
        estimatedCost,
      },
    });

    await updateProgress('completed', 100, 'Analysis complete');

    return {
      caseId: input.caseId,
      jobId: job.id,
      status: 'completed',
      extractedFacts,
      disputedFacts,
      undisputedFacts,
      timeline,
      contradictions,
      credibilityScores,
      processingTimeMs,
      totalTokensUsed,
      estimatedCost,
    };
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : 'Unknown error';

    await prisma.analysisJob.update({
      where: { id: job.id },
      data: {
        status: 'FAILED',
        failedAt: new Date(),
        failureReason: errorMessage,
      },
    });

    await updateProgress('failed', 0, errorMessage);

    return {
      caseId: input.caseId,
      jobId: job.id,
      status: 'failed',
      error: errorMessage,
      processingTimeMs: Date.now() - startTime,
    };
  }
}

/**
 * Get or create analysis job for a case
 */
async function getOrCreateAnalysisJob(caseId: string) {
  const existing = await prisma.analysisJob.findUnique({
    where: { caseId },
  });

  if (existing) {
    return prisma.analysisJob.update({
      where: { id: existing.id },
      data: {
        status: 'QUEUED',
        progress: 0,
        startedAt: new Date(),
        completedAt: null,
        failedAt: null,
        failureReason: null,
      },
    });
  }

  return prisma.analysisJob.create({
    data: {
      caseId,
      status: 'QUEUED',
      startedAt: new Date(),
    },
  });
}

/**
 * Convert phase to Prisma status enum
 */
function phaseToStatus(phase: AnalysisPhase): AnalysisStatus {
  const mapping: Record<AnalysisPhase, AnalysisStatus> = {
    queued: 'QUEUED',
    extracting_facts: 'PROCESSING',
    comparing_facts: 'PROCESSING',
    building_timeline: 'PROCESSING',
    detecting_contradictions: 'PROCESSING',
    scoring_credibility: 'PROCESSING',
    completed: 'COMPLETED',
    failed: 'FAILED',
  };
  return mapping[phase];
}

/**
 * Build case context string for prompts
 */
function buildCaseContext(input: AnalysisInput): string {
  const parts = [
    `Dispute Type: ${input.disputeType}`,
    input.claimedAmount ? `Claimed Amount: $${input.claimedAmount.toLocaleString()}` : null,
    `Case Description: ${input.caseDescription.slice(0, 500)}`,
  ];

  return parts.filter(Boolean).join('\n');
}

/**
 * Estimate total cost based on tokens used
 */
function estimateTotalCost(tokensUsed: number): number {
  // Rough average of Haiku and Sonnet costs
  // Haiku: ~$0.50/M, Sonnet: ~$9/M average
  const avgCostPerMillion = 4.5;
  return (tokensUsed / 1_000_000) * avgCostPerMillion;
}

/**
 * Queue a case for analysis
 */
export async function queueAnalysis(caseId: string): Promise<string> {
  const job = await getOrCreateAnalysisJob(caseId);

  await prisma.analysisJob.update({
    where: { id: job.id },
    data: {
      status: 'QUEUED',
      queuedAt: new Date(),
    },
  });

  return job.id;
}

/**
 * Get analysis status for a case
 */
export async function getAnalysisStatus(caseId: string) {
  const job = await prisma.analysisJob.findUnique({
    where: { caseId },
  });

  if (!job) {
    return null;
  }

  return {
    jobId: job.id,
    status: job.status,
    progress: job.progress,
    startedAt: job.startedAt,
    completedAt: job.completedAt,
    failedAt: job.failedAt,
    failureReason: job.failureReason,
    tokensUsed: job.tokensUsed,
    processingTimeMs: job.processingTimeMs,
    estimatedCost: job.estimatedCost,
    extractedFacts: job.extractedFacts,
    disputedFacts: job.disputedFacts,
    undisputedFacts: job.undisputedFacts,
    timeline: job.timeline,
    contradictions: job.contradictions,
    credibilityScores: job.credibilityScores,
  };
}

/**
 * Load analysis input from database
 */
export async function loadAnalysisInput(caseId: string): Promise<AnalysisInput | null> {
  const caseData = await prisma.case.findUnique({
    where: { id: caseId },
    include: {
      claimant: { select: { id: true, name: true } },
      respondent: { select: { id: true, name: true } },
      statements: {
        orderBy: { submittedAt: 'asc' },
      },
      evidence: {
        where: {
          deletedAt: null,
          processingStatus: 'COMPLETED',
        },
        select: {
          id: true,
          fileName: true,
          documentType: true,
          extractedText: true,
          summary: true,
          keyPoints: true,
          extractedEntities: true,
          submittedById: true,
        },
      },
    },
  });

  if (!caseData) {
    return null;
  }

  // Find claimant and respondent statements
  const claimantStatement = caseData.statements.find(
    (s) => s.submittedById === caseData.claimantId && s.type === 'INITIAL'
  );
  const respondentStatement = caseData.statements.find(
    (s) => s.submittedById === caseData.respondentId && s.type === 'INITIAL'
  );

  if (!claimantStatement) {
    return null; // Need at least claimant statement
  }

  // Transform evidence to summaries
  const evidenceSummaries: EvidenceSummary[] = caseData.evidence.map((e) => {
    const entities = e.extractedEntities as {
      dates?: string[];
      amounts?: number[];
      parties?: string[];
    } | null;

    return {
      id: e.id,
      fileName: e.fileName,
      documentType: e.documentType || undefined,
      extractedText: e.extractedText?.slice(0, 2000) || undefined,
      summary: e.summary || undefined,
      keyPoints: e.keyPoints || undefined,
      entities: entities || undefined,
      submittedBy: e.submittedById === caseData.claimantId ? 'claimant' : 'respondent',
    };
  });

  return {
    caseId,
    caseDescription: caseData.description,
    disputeType: caseData.disputeType,
    claimedAmount: caseData.amount ? Number(caseData.amount) : undefined,
    claimantStatement: claimantStatement.content,
    claimantClaimItems: claimantStatement.claimItems,
    respondentStatement: respondentStatement?.content,
    respondentClaimItems: respondentStatement?.claimItems,
    evidenceSummaries,
  };
}

/**
 * Process pending analysis jobs
 */
export async function processPendingAnalysis(limit: number = 5): Promise<number> {
  // Find queued jobs
  const queuedJobs = await prisma.analysisJob.findMany({
    where: { status: 'QUEUED' },
    orderBy: { queuedAt: 'asc' },
    take: limit,
    select: { caseId: true },
  });

  let processed = 0;

  for (const job of queuedJobs) {
    const input = await loadAnalysisInput(job.caseId);
    if (input) {
      await runAnalysis(input);
      processed++;
    }
  }

  return processed;
}
