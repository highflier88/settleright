/**
 * Legal Analysis Orchestrator
 *
 * Coordinates all phases of legal analysis:
 * - Issue classification
 * - Burden of proof analysis
 * - Damages calculation
 * - Conclusions of law
 * - Confidence scoring
 */

import { prisma } from '@/lib/db';

import { analyzeBurdenOfProof } from './burden-analyzer';
import { aggregateCitations, scoreConfidence } from './confidence-scorer';
import { applyClraMinimum, applyDamagesCaps, calculateDamages } from './damages-calculator';
import { classifyLegalIssues } from './issue-classifier';

import type {
  AwardRecommendation,
  BurdenOfProofResult,
  ConclusionOfLaw,
  DamagesCalculation,
  LegalAnalysisInput,
  LegalAnalysisOptions,
  LegalAnalysisPhase,
  LegalAnalysisProgress,
  LegalAnalysisResult,
  LegalIssue,
} from './types';

/**
 * Progress callback type
 */
type ProgressCallback = (progress: LegalAnalysisProgress) => Promise<void>;

/**
 * Default options
 */
const DEFAULT_OPTIONS: LegalAnalysisOptions = {
  skipIssueClassification: false,
  skipBurdenAnalysis: false,
  skipDamagesCalculation: false,
  skipConclusions: false,
  force: false,
};

/**
 * Run the complete legal analysis pipeline
 */
export async function runLegalAnalysis(
  input: LegalAnalysisInput,
  options: LegalAnalysisOptions = {},
  onProgress?: ProgressCallback
): Promise<LegalAnalysisResult> {
  const opts = { ...DEFAULT_OPTIONS, ...options };
  const startTime = Date.now();
  let totalTokensUsed = 0;

  // Get the analysis job
  const job = await prisma.analysisJob.findUnique({
    where: { caseId: input.caseId },
  });

  if (!job) {
    throw new Error(`No analysis job found for case ${input.caseId}`);
  }

  const updateProgress = async (phase: LegalAnalysisPhase, progress: number, message?: string) => {
    await Promise.all([
      prisma.analysisJob.update({
        where: { id: job.id },
        data: {
          legalAnalysisStatus: phaseToStatus(phase),
          progress,
        },
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
    await updateProgress('classifying_issues', 10, 'Starting legal analysis');

    // Retrieve legal context from Phase 3.1 (if available)
    let legalContext: string | undefined;
    try {
      const { getLegalContextForAnalysis, formatLegalContextForPrompt } =
        await import('@/lib/legal/retrieval');
      const context = await getLegalContextForAnalysis({
        jurisdiction: input.jurisdiction,
        // Cast to any to handle string vs DisputeType enum mismatch
        // eslint-disable-next-line @typescript-eslint/no-explicit-any, @typescript-eslint/no-unsafe-assignment
        disputeType: input.disputeType as any,
        disputeDescription: input.caseDescription,
        claimAmount: input.claimedAmount,
        issues: [],
      });
      legalContext = formatLegalContextForPrompt(context);
    } catch {
      console.warn('Legal context retrieval not available');
    }

    // Phase 1: Issue Classification (20%)
    await updateProgress('classifying_issues', 15, 'Classifying legal issues');

    let issues: LegalIssue[] = [];

    if (!opts.skipIssueClassification) {
      const classificationResult = await classifyLegalIssues({
        caseDescription: input.caseDescription,
        disputeType: input.disputeType,
        claimedAmount: input.claimedAmount,
        disputedFacts: input.disputedFacts,
        undisputedFacts: input.undisputedFacts,
        jurisdiction: input.jurisdiction,
        legalContext,
      });

      issues = classificationResult.issues;
      totalTokensUsed += classificationResult.tokensUsed;

      // Save intermediate results
      await prisma.analysisJob.update({
        where: { id: job.id },
        data: {
          // eslint-disable-next-line @typescript-eslint/no-unsafe-assignment
          legalIssues: JSON.parse(JSON.stringify(issues)),
        },
      });
    }

    await updateProgress('classifying_issues', 20, 'Issue classification complete');

    // Phase 2: Burden of Proof Analysis (40%)
    await updateProgress('analyzing_burden', 30, 'Analyzing burden of proof');

    let burdenOfProof: BurdenOfProofResult = {
      overallBurdenMet: false,
      analyses: [],
      summary: 'Burden analysis skipped',
    };

    if (!opts.skipBurdenAnalysis && issues.length > 0) {
      burdenOfProof = await analyzeBurdenOfProof({
        issues,
        extractedFacts: input.extractedFacts,
        credibilityScores: input.credibilityScores,
        contradictions: input.contradictions,
        jurisdiction: input.jurisdiction,
        legalContext,
      });

      totalTokensUsed += burdenOfProof.tokensUsed || 0;

      // Update issue elements based on burden analysis
      issues = updateIssueElements(issues, burdenOfProof.analyses);

      // Save intermediate results
      await prisma.analysisJob.update({
        where: { id: job.id },
        data: {
          // eslint-disable-next-line @typescript-eslint/no-unsafe-assignment
          legalIssues: JSON.parse(JSON.stringify(issues)),
          // eslint-disable-next-line @typescript-eslint/no-unsafe-assignment
          burdenOfProof: JSON.parse(JSON.stringify(burdenOfProof)),
        },
      });
    }

    await updateProgress('analyzing_burden', 40, 'Burden analysis complete');

    // Phase 3: Damages Calculation (60%)
    await updateProgress('calculating_damages', 50, 'Calculating damages');

    let damagesCalculation: DamagesCalculation = {
      claimedTotal: input.claimedAmount,
      supportedTotal: 0,
      recommendedTotal: 0,
      items: [],
      mitigation: { didClaimantMitigate: true, mitigationEfforts: [], reduction: 0 },
      summary: 'Damages calculation skipped',
    };

    if (!opts.skipDamagesCalculation) {
      // Extract damages from claimant facts
      const damagesClaimed = extractDamagesClaims(input);

      // Find breach date from facts
      const breachDate = findBreachDate(input);

      // Determine if contract claim
      const isContractClaim = issues.some(
        (i) => i.category === 'breach_of_contract' || i.category === 'warranty'
      );

      damagesCalculation = await calculateDamages({
        claimedAmount: input.claimedAmount,
        damagesClaimed,
        extractedFacts: input.extractedFacts,
        evidenceSummaries: input.evidenceSummaries,
        jurisdiction: input.jurisdiction,
        isContractClaim,
        breachDate,
        legalContext,
      });

      totalTokensUsed += damagesCalculation.tokensUsed || 0;

      // Apply caps and minimums
      damagesCalculation = applyDamagesCaps(
        damagesCalculation,
        input.jurisdiction,
        input.disputeType
      );

      // Apply CLRA minimum if applicable
      const hasClraViolation = issues.some((i) => i.category === 'consumer_protection');
      damagesCalculation = applyClraMinimum(
        damagesCalculation,
        input.jurisdiction,
        hasClraViolation
      );

      // Save intermediate results
      await prisma.analysisJob.update({
        where: { id: job.id },
        data: {
          // eslint-disable-next-line @typescript-eslint/no-unsafe-assignment
          damagesCalculation: JSON.parse(JSON.stringify(damagesCalculation)),
        },
      });
    }

    await updateProgress('calculating_damages', 60, 'Damages calculation complete');

    // Phase 4: Conclusions of Law (80%)
    await updateProgress('generating_conclusions', 70, 'Generating conclusions');

    let conclusionsOfLaw: ConclusionOfLaw[] = [];
    let awardRecommendation: AwardRecommendation | undefined;

    if (!opts.skipConclusions) {
      // Generate conclusions based on analysis
      conclusionsOfLaw = generateConclusions(issues, burdenOfProof, damagesCalculation);

      // Generate award recommendation
      awardRecommendation = generateAwardRecommendation(burdenOfProof, damagesCalculation, issues);

      // Save intermediate results
      await prisma.analysisJob.update({
        where: { id: job.id },
        data: {
          // eslint-disable-next-line @typescript-eslint/no-unsafe-assignment
          conclusionsOfLaw: JSON.parse(JSON.stringify(conclusionsOfLaw)),
        },
      });
    }

    await updateProgress('generating_conclusions', 80, 'Conclusions generated');

    // Phase 5: Confidence Scoring (100%)
    await updateProgress('scoring_confidence', 90, 'Scoring confidence');

    // Aggregate citations
    const citationsUsed = aggregateCitations(issues, damagesCalculation);

    // Score confidence
    const {
      overallConfidence,
      factors,
      tokensUsed: confidenceTokens,
    } = await scoreConfidence({
      issues,
      burdenOfProof,
      damagesCalculation,
      contradictions: input.contradictions,
      citationsUsed,
      evidenceCount: input.evidenceSummaries.length,
      credibilityDelta:
        input.credibilityScores.claimant.overall - input.credibilityScores.respondent.overall,
    });

    totalTokensUsed += confidenceTokens;

    // Complete the analysis
    const processingTimeMs = Date.now() - startTime;
    const estimatedCost = estimateLegalAnalysisCost(totalTokensUsed);

    await prisma.analysisJob.update({
      where: { id: job.id },
      data: {
        legalAnalysisStatus: 'COMPLETED',
        legalAnalysisCompletedAt: new Date(),
        legalAnalysisTokens: totalTokensUsed,
        legalConfidence: overallConfidence,
        // eslint-disable-next-line @typescript-eslint/no-unsafe-assignment
        citationsUsed: JSON.parse(JSON.stringify(citationsUsed)),
      },
    });

    await updateProgress('completed', 100, 'Legal analysis complete');

    return {
      caseId: input.caseId,
      jobId: job.id,
      status: 'completed',
      legalIssues: issues,
      burdenOfProof,
      damagesCalculation,
      conclusionsOfLaw,
      overallConfidence,
      confidenceFactors: factors,
      citationsUsed,
      awardRecommendation,
      jurisdictionApplied: input.jurisdiction,
      modelUsed: 'claude-sonnet-4-20250514',
      tokensUsed: totalTokensUsed,
      processingTimeMs,
      estimatedCost,
    };
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : 'Unknown error';

    await prisma.analysisJob.update({
      where: { id: job.id },
      data: {
        legalAnalysisStatus: 'FAILED',
        legalAnalysisError: errorMessage,
      },
    });

    await updateProgress('failed', 0, errorMessage);

    return {
      caseId: input.caseId,
      jobId: job.id,
      status: 'failed',
      error: errorMessage,
      jurisdictionApplied: input.jurisdiction,
      modelUsed: 'claude-sonnet-4-20250514',
      tokensUsed: totalTokensUsed,
      processingTimeMs: Date.now() - startTime,
      estimatedCost: estimateLegalAnalysisCost(totalTokensUsed),
    };
  }
}

/**
 * Convert phase to Prisma status
 */
function phaseToStatus(
  phase: LegalAnalysisPhase
): 'PENDING' | 'PROCESSING' | 'COMPLETED' | 'FAILED' {
  switch (phase) {
    case 'queued':
      return 'PENDING';
    case 'completed':
      return 'COMPLETED';
    case 'failed':
      return 'FAILED';
    default:
      return 'PROCESSING';
  }
}

/**
 * Update issue elements based on burden analyses
 */
function updateIssueElements(
  issues: LegalAnalysisResult['legalIssues'],
  analyses: NonNullable<LegalAnalysisResult['burdenOfProof']>['analyses']
) {
  if (!issues) return [];

  return issues.map((issue) => ({
    ...issue,
    elements: issue.elements.map((element) => {
      // Find matching burden analysis
      const analysis = analyses.find(
        (a) => a.issue.includes(element.name) || a.issue.includes(issue.description)
      );

      if (analysis) {
        return {
          ...element,
          isSatisfied: analysis.isMet,
          analysis: analysis.reasoning,
          confidence: analysis.probability,
          supportingFacts: analysis.keyEvidence,
        };
      }

      return element;
    }),
  }));
}

/**
 * Extract damages claims from input
 */
function extractDamagesClaims(input: LegalAnalysisInput) {
  const claims: Array<{ description: string; amount: number; category?: string }> = [];

  // Extract from claimant facts with amounts
  for (const fact of input.extractedFacts.claimant) {
    if (fact.amount && fact.amount > 0) {
      claims.push({
        description: fact.statement,
        amount: fact.amount,
        category: fact.category,
      });
    }
  }

  // If no specific claims found, use total claimed amount
  if (claims.length === 0) {
    claims.push({
      description: 'Total claimed damages',
      amount: input.claimedAmount,
    });
  }

  return claims;
}

/**
 * Find breach date from facts
 */
function findBreachDate(input: LegalAnalysisInput): string | undefined {
  // Look for dates in claimant facts
  for (const fact of input.extractedFacts.claimant) {
    if (fact.date && fact.category?.toLowerCase().includes('breach')) {
      return fact.date;
    }
  }

  // Look for dispute-related dates
  for (const disputed of input.disputedFacts) {
    if (disputed.topic.toLowerCase().includes('date')) {
      // Try to extract date from claimant position
      const dateMatch = disputed.claimantPosition.match(/\d{4}-\d{2}-\d{2}/);
      if (dateMatch) {
        return dateMatch[0];
      }
    }
  }

  return undefined;
}

/**
 * Generate conclusions of law
 */
function generateConclusions(
  issues: NonNullable<LegalAnalysisResult['legalIssues']>,
  burdenOfProof: NonNullable<LegalAnalysisResult['burdenOfProof']>,
  damagesCalculation: NonNullable<LegalAnalysisResult['damagesCalculation']>
): ConclusionOfLaw[] {
  const conclusions: ConclusionOfLaw[] = [];

  for (const issue of issues) {
    const elementsSatisfied = issue.elements.filter((e) => e.isSatisfied === true);
    const allSatisfied = elementsSatisfied.length === issue.elements.length;

    // Find related burden analyses
    const relevantAnalyses = burdenOfProof.analyses.filter(
      (a) =>
        a.issue.includes(issue.description) || issue.elements.some((e) => a.issue.includes(e.name))
    );

    const avgConfidence =
      relevantAnalyses.length > 0
        ? relevantAnalyses.reduce((sum, a) => sum + a.probability, 0) / relevantAnalyses.length
        : 0.5;

    let conclusionText: string;
    if (allSatisfied) {
      conclusionText = `Claimant has established ${issue.description}. All required elements have been proven by a preponderance of the evidence.`;
    } else if (elementsSatisfied.length > 0) {
      const unsatisfied = issue.elements
        .filter((e) => e.isSatisfied !== true)
        .map((e) => e.name)
        .join(', ');
      conclusionText = `Claimant has partially established ${issue.description}. However, the following elements were not sufficiently proven: ${unsatisfied}.`;
    } else {
      conclusionText = `Claimant has not established ${issue.description}. The burden of proof has not been met.`;
    }

    conclusions.push({
      id: `col-${issue.id}`,
      issue: issue.description,
      conclusion: conclusionText,
      legalBasis: issue.applicableStatutes.slice(0, 3),
      supportingFacts: issue.elements.flatMap((e) => e.supportingFacts).slice(0, 5),
      confidence: avgConfidence,
    });
  }

  // Add damages conclusion
  if (damagesCalculation.recommendedTotal > 0) {
    conclusions.push({
      id: 'col-damages',
      issue: 'Damages',
      conclusion: `Claimant is entitled to recover $${damagesCalculation.recommendedTotal.toLocaleString()} in damages${damagesCalculation.interestCalculation ? `, including $${damagesCalculation.interestCalculation.interestAmount.toLocaleString()} in prejudgment interest` : ''}.`,
      legalBasis: damagesCalculation.interestCalculation?.statutoryBasis
        ? [damagesCalculation.interestCalculation.statutoryBasis]
        : [],
      supportingFacts: damagesCalculation.items.flatMap((i) => i.evidenceSupport).slice(0, 5),
      confidence:
        damagesCalculation.items.reduce((sum, i) => sum + i.confidence, 0) /
        (damagesCalculation.items.length || 1),
    });
  }

  return conclusions;
}

/**
 * Generate award recommendation
 */
function generateAwardRecommendation(
  burdenOfProof: NonNullable<LegalAnalysisResult['burdenOfProof']>,
  damagesCalculation: NonNullable<LegalAnalysisResult['damagesCalculation']>,
  issues: NonNullable<LegalAnalysisResult['legalIssues']>
): AwardRecommendation {
  // Determine prevailing party
  const issuesWon = issues.filter((i) => i.elements.every((e) => e.isSatisfied === true));

  let prevailingParty: AwardRecommendation['prevailingParty'];
  let reasoning: string;

  if (burdenOfProof.overallBurdenMet && damagesCalculation.recommendedTotal > 0) {
    if (issuesWon.length === issues.length) {
      prevailingParty = 'claimant';
      reasoning = 'Claimant has proven all claims and is entitled to full recovery.';
    } else if (issuesWon.length > 0) {
      prevailingParty = 'split';
      reasoning = `Claimant prevailed on ${issuesWon.length} of ${issues.length} claims.`;
    } else {
      prevailingParty = 'respondent';
      reasoning = 'Claimant failed to meet burden of proof on any claim.';
    }
  } else if (damagesCalculation.recommendedTotal > 0) {
    prevailingParty = 'split';
    reasoning = 'Some damages supported but burden of proof not fully met.';
  } else {
    prevailingParty = 'respondent';
    reasoning = 'Claimant failed to prove damages or liability.';
  }

  return {
    prevailingParty,
    awardAmount: prevailingParty === 'respondent' ? 0 : damagesCalculation.recommendedTotal,
    reasoning,
  };
}

/**
 * Estimate cost for legal analysis
 */
function estimateLegalAnalysisCost(tokensUsed: number): number {
  // Sonnet: ~$9/M tokens average
  const costPerMillion = 9;
  return (tokensUsed / 1_000_000) * costPerMillion;
}

/**
 * Get legal analysis status
 */
export async function getLegalAnalysisStatus(caseId: string) {
  const job = await prisma.analysisJob.findUnique({
    where: { caseId },
    select: {
      id: true,
      legalAnalysisStatus: true,
      legalAnalysisStartedAt: true,
      legalAnalysisCompletedAt: true,
      legalAnalysisError: true,
      legalAnalysisTokens: true,
      legalConfidence: true,
      legalIssues: true,
      burdenOfProof: true,
      damagesCalculation: true,
      conclusionsOfLaw: true,
      citationsUsed: true,
    },
  });

  return job;
}

/**
 * Load input for legal analysis from completed fact analysis
 */
export async function loadLegalAnalysisInput(caseId: string): Promise<LegalAnalysisInput | null> {
  const caseData = await prisma.case.findUnique({
    where: { id: caseId },
    select: {
      id: true,
      description: true,
      disputeType: true,
      amount: true,
      jurisdiction: true,
    },
  });

  if (!caseData) {
    return null;
  }

  const job = await prisma.analysisJob.findUnique({
    where: { caseId },
    select: {
      extractedFacts: true,
      disputedFacts: true,
      undisputedFacts: true,
      contradictions: true,
      credibilityScores: true,
    },
  });

  if (!job || !job.extractedFacts) {
    return null;
  }

  // Load evidence summaries
  const evidence = await prisma.evidence.findMany({
    where: {
      caseId,
      deletedAt: null,
      processingStatus: 'COMPLETED',
    },
    select: {
      id: true,
      fileName: true,
      documentType: true,
      summary: true,
      keyPoints: true,
      submittedById: true,
    },
  });

  const caseWithClaimant = await prisma.case.findUnique({
    where: { id: caseId },
    select: { claimantId: true },
  });

  return {
    caseId,
    jurisdiction: caseData.jurisdiction || 'US-CA',
    disputeType: caseData.disputeType,
    claimedAmount: caseData.amount ? Number(caseData.amount) : 0,
    caseDescription: caseData.description,
    extractedFacts: job.extractedFacts as unknown as LegalAnalysisInput['extractedFacts'],
    disputedFacts: (job.disputedFacts || []) as unknown as LegalAnalysisInput['disputedFacts'],
    undisputedFacts: (job.undisputedFacts ||
      []) as unknown as LegalAnalysisInput['undisputedFacts'],
    contradictions: (job.contradictions || []) as unknown as LegalAnalysisInput['contradictions'],
    credibilityScores: (job.credibilityScores || {
      claimant: { overall: 0.5 },
      respondent: { overall: 0.5 },
    }) as unknown as LegalAnalysisInput['credibilityScores'],
    evidenceSummaries: evidence.map((e) => ({
      id: e.id,
      fileName: e.fileName,
      documentType: e.documentType || undefined,
      summary: e.summary || undefined,
      keyPoints: e.keyPoints || undefined,
      submittedBy: e.submittedById === caseWithClaimant?.claimantId ? 'claimant' : 'respondent',
    })),
  };
}
