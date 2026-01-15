/**
 * Draft Award Generator
 *
 * Generates formal arbitration awards from completed legal analysis,
 * including findings of fact, conclusions of law, and award decisions.
 */

import { randomUUID } from 'crypto';

import Anthropic from '@anthropic-ai/sdk';
import { NotificationType } from '@prisma/client';

import { prisma } from '@/lib/db';
import { createInAppNotification, NotificationTemplates } from '@/lib/services/notification';

import {
  AWARD_GENERATION_SYSTEM_PROMPT,
  buildFindingsOfFactPrompt,
  buildConclusionsOfLawPrompt,
  buildOrderPrompt,
} from './prompts';

import type {
  DraftAwardInput,
  DraftAwardOutput,
  DraftAwardOptions,
  FindingOfFact,
  AwardConclusionOfLaw,
  AwardDecision,
  ReviewSubmission,
  ReviewResult,
  StoredExtractedFact,
  StoredDisputedFact,
  StoredUndisputedFact,
  StoredCredibilityScores,
  StoredLegalIssue,
  StoredBurdenOfProof,
  StoredDamagesCalculation,
  StoredConclusionOfLaw,
  StoredAwardRecommendation,
  StoredCitation,
} from './types';
import type { Prisma } from '@prisma/client';

// Singleton Anthropic client
let anthropicClient: Anthropic | null = null;

/**
 * Get or create the Anthropic client
 */
function getAnthropicClient(): Anthropic {
  if (!anthropicClient) {
    const apiKey = process.env.ANTHROPIC_API_KEY;
    if (!apiKey) {
      throw new Error('ANTHROPIC_API_KEY environment variable is not set');
    }
    anthropicClient = new Anthropic({ apiKey });
  }
  return anthropicClient;
}

/**
 * Generate a draft award from completed analysis
 */
export async function generateDraftAward(
  input: DraftAwardInput,
  options: DraftAwardOptions = {}
): Promise<DraftAwardOutput> {
  const startTime = Date.now();
  let totalTokens = 0;

  // Check for existing draft award
  if (!options.force) {
    const existing = await prisma.draftAward.findUnique({
      where: { caseId: input.caseId },
    });

    if (existing) {
      throw new Error('Draft award already exists. Use force option to regenerate.');
    }
  }

  const client = getAnthropicClient();

  // Phase 1: Generate Findings of Fact
  const findingsResult = await generateFindingsOfFact(client, input);
  totalTokens += findingsResult.tokensUsed;

  // Phase 2: Generate Conclusions of Law
  const conclusionsResult = await generateConclusionsOfLaw(client, input, findingsResult.findings);
  totalTokens += conclusionsResult.tokensUsed;

  // Phase 3: Generate Decision and Order
  const decisionResult = await generateDecisionAndOrder(client, input);
  totalTokens += decisionResult.tokensUsed;

  // Calculate confidence based on analysis confidence
  const confidence = calculateAwardConfidence(input);

  const output: DraftAwardOutput = {
    findingsOfFact: findingsResult.findings,
    conclusionsOfLaw: conclusionsResult.conclusions,
    decision: decisionResult.decision,
    confidence,
    modelUsed: 'claude-sonnet-4-20250514',
    tokensUsed: totalTokens,
    generatedAt: new Date(),
  };

  // Save draft award to database
  await saveDraftAward(input.caseId, output);

  // Update case status to ARBITRATOR_REVIEW
  await prisma.case.update({
    where: { id: input.caseId },
    data: { status: 'ARBITRATOR_REVIEW' },
  });

  // Log generation (using console for now - audit logging can be added later)
  console.log('[DraftAward] Generated:', {
    caseId: input.caseId,
    findingsCount: output.findingsOfFact.length,
    conclusionsCount: output.conclusionsOfLaw.length,
    awardAmount: output.decision.totalAward,
    prevailingParty: output.decision.prevailingParty,
    confidence: output.confidence,
    processingTimeMs: Date.now() - startTime,
  });

  // Send notification if not skipped
  if (!options.skipNotification) {
    await notifyDraftAwardReady(input);
  }

  return output;
}

/**
 * Generate findings of fact from analysis results
 */
async function generateFindingsOfFact(
  client: Anthropic,
  input: DraftAwardInput
): Promise<{
  findings: FindingOfFact[];
  tokensUsed: number;
}> {
  // Prepare disputed facts with resolution info
  const disputedWithResolution = input.disputedFacts.map((df) => {
    // Determine resolution based on burden of proof
    const burdenAnalysis = input.burdenOfProof.analyses.find((a) =>
      a.issue.toLowerCase().includes(df.topic.toLowerCase())
    );

    let resolved: 'claimant' | 'respondent' | 'partial' = 'partial';
    if (burdenAnalysis) {
      if (burdenAnalysis.probability > 0.6) {
        resolved = 'claimant';
      } else if (burdenAnalysis.probability < 0.4) {
        resolved = 'respondent';
      }
    }

    return {
      topic: df.topic,
      claimantPosition: df.claimantPosition,
      respondentPosition: df.respondentPosition,
      resolved,
      reasoning: burdenAnalysis?.reasoning || 'Based on evidence presented',
    };
  });

  // Prepare undisputed facts with materiality
  const undisputedWithScore = input.undisputedFacts.map((uf) => ({
    fact: uf.fact,
    materialityScore: uf.materialityScore || 0.5,
  }));

  // Determine credibility
  const credibilityDetermination = {
    moreCredible:
      input.credibilityScores.claimantScore > input.credibilityScores.respondentScore
        ? ('claimant' as const)
        : input.credibilityScores.respondentScore > input.credibilityScores.claimantScore
          ? ('respondent' as const)
          : ('equal' as const),
    reasoning:
      input.credibilityScores.summary ||
      'Based on consistency with documentary evidence and internal coherence',
  };

  const prompt = buildFindingsOfFactPrompt({
    caseReference: input.caseReference,
    claimantName: input.claimantName,
    respondentName: input.respondentName,
    caseDescription: input.caseDescription,
    undisputedFacts: undisputedWithScore,
    disputedFacts: disputedWithResolution,
    credibilityDetermination,
  });

  const response = await client.messages.create({
    model: 'claude-sonnet-4-20250514',
    max_tokens: 4096,
    system: AWARD_GENERATION_SYSTEM_PROMPT,
    messages: [{ role: 'user', content: prompt }],
  });

  const responseText = response.content[0]?.type === 'text' ? response.content[0].text : '';

  const tokensUsed = (response.usage?.input_tokens || 0) + (response.usage?.output_tokens || 0);

  const findings = parseFindingsResponse(responseText);

  return { findings, tokensUsed };
}

/**
 * Parse findings from LLM response
 */
function parseFindingsResponse(responseText: string): FindingOfFact[] {
  try {
    const jsonMatch = responseText.match(/\{[\s\S]*\}/);
    if (!jsonMatch) {
      throw new Error('No JSON found in findings response');
    }

    const parsed = JSON.parse(jsonMatch[0]) as {
      findings?: Array<{
        number?: number;
        finding?: string;
        basis?: string;
        supportingEvidence?: string[];
        credibilityNote?: string;
        date?: string;
        amount?: number;
      }>;
    };

    if (!parsed.findings || !Array.isArray(parsed.findings)) {
      throw new Error('Invalid findings format');
    }

    return parsed.findings.map((f, index) => ({
      id: randomUUID(),
      number: f.number || index + 1,
      finding: f.finding || '',
      basis: (f.basis as 'undisputed' | 'proven' | 'credibility') || 'proven',
      supportingEvidence: f.supportingEvidence || [],
      credibilityNote: f.credibilityNote,
      date: f.date,
      amount: f.amount,
    }));
  } catch (error) {
    console.error('Failed to parse findings response:', error);
    return [];
  }
}

/**
 * Generate conclusions of law from legal analysis
 */
async function generateConclusionsOfLaw(
  client: Anthropic,
  input: DraftAwardInput,
  findings: FindingOfFact[]
): Promise<{
  conclusions: AwardConclusionOfLaw[];
  tokensUsed: number;
}> {
  // Prepare legal issues with elements satisfaction
  const issuesWithElements = input.legalIssues.map((issue) => ({
    category: issue.category,
    description: issue.description,
    elementsSatisfied: issue.elements.every((e) => e.isSatisfied === true),
    applicableStatutes: issue.applicableStatutes,
  }));

  // Prepare findings for reference
  const findingsForReference = findings.map((f) => ({
    number: f.number,
    finding: f.finding,
  }));

  // Get citation strings
  const citationStrings = input.citationsUsed.map((c) => c.citation);

  const prompt = buildConclusionsOfLawPrompt({
    caseReference: input.caseReference,
    jurisdiction: input.jurisdiction,
    legalIssues: issuesWithElements,
    findingsOfFact: findingsForReference,
    citationsUsed: citationStrings,
  });

  const response = await client.messages.create({
    model: 'claude-sonnet-4-20250514',
    max_tokens: 4096,
    system: AWARD_GENERATION_SYSTEM_PROMPT,
    messages: [{ role: 'user', content: prompt }],
  });

  const responseText = response.content[0]?.type === 'text' ? response.content[0].text : '';

  const tokensUsed = (response.usage?.input_tokens || 0) + (response.usage?.output_tokens || 0);

  const conclusions = parseConclusionsResponse(responseText);

  return { conclusions, tokensUsed };
}

/**
 * Parse conclusions from LLM response
 */
function parseConclusionsResponse(responseText: string): AwardConclusionOfLaw[] {
  try {
    const jsonMatch = responseText.match(/\{[\s\S]*\}/);
    if (!jsonMatch) {
      throw new Error('No JSON found in conclusions response');
    }

    const parsed = JSON.parse(jsonMatch[0]) as {
      conclusions?: Array<{
        number?: number;
        issue?: string;
        conclusion?: string;
        legalBasis?: string[];
        supportingFindings?: number[];
      }>;
    };

    if (!parsed.conclusions || !Array.isArray(parsed.conclusions)) {
      throw new Error('Invalid conclusions format');
    }

    return parsed.conclusions.map((c, index) => ({
      id: randomUUID(),
      number: c.number || index + 1,
      issue: c.issue || '',
      conclusion: c.conclusion || '',
      legalBasis: c.legalBasis || [],
      supportingFindings: c.supportingFindings || [],
    }));
  } catch (error) {
    console.error('Failed to parse conclusions response:', error);
    return [];
  }
}

/**
 * Generate decision and order section
 */
async function generateDecisionAndOrder(
  client: Anthropic,
  input: DraftAwardInput
): Promise<{
  decision: AwardDecision;
  tokensUsed: number;
}> {
  const { awardRecommendation, damagesCalculation } = input;

  // Calculate interest
  const interestDetails = damagesCalculation.interestCalculation
    ? {
        rate: damagesCalculation.interestCalculation.rate,
        startDate: damagesCalculation.interestCalculation.startDate,
        endDate: damagesCalculation.interestCalculation.endDate,
        statutoryBasis: damagesCalculation.interestCalculation.statutoryBasis,
      }
    : undefined;

  // Build damages breakdown
  const damagesBreakdown = damagesCalculation.items
    .filter((item) => item.supported)
    .map((item) => ({
      description: item.description,
      amount: item.supportedAmount,
    }));

  const prompt = buildOrderPrompt({
    caseReference: input.caseReference,
    claimantName: input.claimantName,
    respondentName: input.respondentName,
    jurisdiction: input.jurisdiction,
    prevailingParty: awardRecommendation.prevailingParty,
    awardAmount: damagesCalculation.supportedTotal,
    interestAmount: damagesCalculation.interestCalculation?.amount || 0,
    totalAward: damagesCalculation.recommendedTotal,
    interestDetails,
    damagesBreakdown,
    reasoning: awardRecommendation.reasoning,
  });

  const response = await client.messages.create({
    model: 'claude-sonnet-4-20250514',
    max_tokens: 2048,
    system: AWARD_GENERATION_SYSTEM_PROMPT,
    messages: [{ role: 'user', content: prompt }],
  });

  const responseText = response.content[0]?.type === 'text' ? response.content[0].text : '';

  const tokensUsed = (response.usage?.input_tokens || 0) + (response.usage?.output_tokens || 0);

  const decision = parseDecisionResponse(responseText, input, damagesCalculation);

  return { decision, tokensUsed };
}

/**
 * Parse decision from LLM response
 */
function parseDecisionResponse(
  responseText: string,
  input: DraftAwardInput,
  damagesCalculation: DraftAwardInput['damagesCalculation']
): AwardDecision {
  try {
    const jsonMatch = responseText.match(/\{[\s\S]*\}/);
    if (!jsonMatch) {
      throw new Error('No JSON found in decision response');
    }

    const parsed = JSON.parse(jsonMatch[0]) as {
      orderText?: string;
      reasoning?: string;
    };

    return {
      prevailingParty: input.awardRecommendation.prevailingParty,
      awardAmount: damagesCalculation.supportedTotal,
      interestAmount: damagesCalculation.interestCalculation?.amount || 0,
      totalAward: damagesCalculation.recommendedTotal,
      reasoning: parsed.reasoning || input.awardRecommendation.reasoning,
      orderText: parsed.orderText || generateDefaultOrderText(input, damagesCalculation),
      interestDetails: damagesCalculation.interestCalculation
        ? {
            rate: damagesCalculation.interestCalculation.rate,
            startDate: damagesCalculation.interestCalculation.startDate,
            endDate: damagesCalculation.interestCalculation.endDate,
            days: damagesCalculation.interestCalculation.days,
            statutoryBasis: damagesCalculation.interestCalculation.statutoryBasis,
          }
        : undefined,
    };
  } catch (error) {
    console.error('Failed to parse decision response:', error);
    return {
      prevailingParty: input.awardRecommendation.prevailingParty,
      awardAmount: damagesCalculation.supportedTotal,
      interestAmount: damagesCalculation.interestCalculation?.amount || 0,
      totalAward: damagesCalculation.recommendedTotal,
      reasoning: input.awardRecommendation.reasoning,
      orderText: generateDefaultOrderText(input, damagesCalculation),
    };
  }
}

/**
 * Generate default order text if LLM fails
 */
function generateDefaultOrderText(
  input: DraftAwardInput,
  damagesCalculation: DraftAwardInput['damagesCalculation']
): string {
  const winner =
    input.awardRecommendation.prevailingParty === 'claimant'
      ? input.claimantName
      : input.awardRecommendation.prevailingParty === 'respondent'
        ? input.respondentName
        : 'Neither party fully';

  const loser =
    input.awardRecommendation.prevailingParty === 'claimant'
      ? input.respondentName
      : input.claimantName;

  let orderText = `Based on the foregoing Findings of Fact and Conclusions of Law, it is hereby ORDERED and AWARDED as follows:\n\n`;

  if (input.awardRecommendation.prevailingParty === 'split') {
    orderText += `1. Each party prevails on certain claims as set forth herein.\n\n`;
  } else {
    orderText += `1. ${loser} shall pay to ${winner} the sum of $${damagesCalculation.supportedTotal.toLocaleString()} in damages.\n\n`;
  }

  if (damagesCalculation.interestCalculation) {
    const interest = damagesCalculation.interestCalculation;
    orderText += `2. ${loser} shall pay to ${winner} prejudgment interest in the amount of $${interest.amount.toLocaleString()}, calculated at ${(interest.rate * 100).toFixed(1)}% per annum from ${interest.startDate} to ${interest.endDate} pursuant to ${interest.statutoryBasis}.\n\n`;
    orderText += `3. The total award to ${winner} is $${damagesCalculation.recommendedTotal.toLocaleString()}.\n\n`;
    orderText += `4. Each party shall bear their own costs and attorney's fees.`;
  } else {
    orderText += `2. The total award to ${winner} is $${damagesCalculation.recommendedTotal.toLocaleString()}.\n\n`;
    orderText += `3. Each party shall bear their own costs and attorney's fees.`;
  }

  return orderText;
}

/**
 * Calculate confidence score for the award
 */
function calculateAwardConfidence(input: DraftAwardInput): number {
  // Base confidence from burden of proof
  let confidence = input.burdenOfProof.overallBurdenMet ? 0.7 : 0.5;

  // Adjust for credibility delta
  const credibilityDelta = Math.abs(
    input.credibilityScores.claimantScore - input.credibilityScores.respondentScore
  );
  if (credibilityDelta > 0.3) {
    confidence += 0.1;
  }

  // Adjust for disputed facts ratio
  const totalFacts = input.undisputedFacts.length + input.disputedFacts.length;
  if (totalFacts > 0) {
    const undisputedRatio = input.undisputedFacts.length / totalFacts;
    confidence += undisputedRatio * 0.1;
  }

  // Adjust for citation count
  if (input.citationsUsed.length >= 10) {
    confidence += 0.05;
  }

  return Math.min(0.95, Math.round(confidence * 100) / 100);
}

/**
 * Save draft award to database
 */
async function saveDraftAward(caseId: string, output: DraftAwardOutput): Promise<void> {
  // Delete existing draft if any
  await prisma.draftAward.deleteMany({
    where: { caseId },
  });

  // Create new draft award
  await prisma.draftAward.create({
    data: {
      id: randomUUID(),
      caseId,
      findingsOfFact: output.findingsOfFact as unknown as Prisma.JsonArray,
      conclusionsOfLaw: output.conclusionsOfLaw as unknown as Prisma.JsonArray,
      decision: output.decision.orderText,
      awardAmount: output.decision.totalAward,
      prevailingParty:
        output.decision.prevailingParty === 'claimant'
          ? 'CLAIMANT'
          : output.decision.prevailingParty === 'respondent'
            ? 'RESPONDENT'
            : 'SPLIT',
      reasoning: output.decision.reasoning,
      confidence: output.confidence,
      citationsVerified: false,
      modelUsed: output.modelUsed,
      generatedAt: output.generatedAt,
    },
  });
}

/**
 * Notify parties that draft award is ready
 */
async function notifyDraftAwardReady(input: DraftAwardInput): Promise<void> {
  // Get case with arbitrator assignment
  const caseData = await prisma.case.findUnique({
    where: { id: input.caseId },
    select: {
      id: true,
      referenceNumber: true,
      arbitratorAssignment: {
        select: {
          arbitratorId: true,
        },
      },
    },
  });

  if (!caseData) return;

  // Notify arbitrator if assigned
  const arbitratorId = caseData.arbitratorAssignment?.arbitratorId;
  if (arbitratorId) {
    await createInAppNotification({
      userId: arbitratorId,
      type: NotificationType.IN_APP,
      templateId: NotificationTemplates.DRAFT_AWARD_READY,
      subject: 'Draft Award Ready for Review',
      body: `A draft award has been generated for case ${caseData.referenceNumber} and is ready for your review.`,
      metadata: {
        caseId: caseData.id,
        actionUrl: `/dashboard/cases/${caseData.id}/award`,
      },
    });
  }
}

/**
 * Get draft award for a case
 */
export async function getDraftAward(caseId: string): Promise<{
  id: string;
  caseId: string;
  findingsOfFact: FindingOfFact[];
  conclusionsOfLaw: AwardConclusionOfLaw[];
  decision: string;
  awardAmount: number | null;
  prevailingParty: string | null;
  reasoning: string;
  confidence: number;
  citationsVerified: boolean;
  reviewStatus: string | null;
  reviewNotes: string | null;
  generatedAt: Date;
  reviewedAt: Date | null;
} | null> {
  const draftAward = await prisma.draftAward.findUnique({
    where: { caseId },
  });

  if (!draftAward) return null;

  return {
    id: draftAward.id,
    caseId: draftAward.caseId,
    findingsOfFact: draftAward.findingsOfFact as unknown as FindingOfFact[],
    conclusionsOfLaw: draftAward.conclusionsOfLaw as unknown as AwardConclusionOfLaw[],
    decision: draftAward.decision,
    awardAmount: draftAward.awardAmount ? Number(draftAward.awardAmount) : null,
    prevailingParty: draftAward.prevailingParty,
    reasoning: draftAward.reasoning,
    confidence: draftAward.confidence,
    citationsVerified: draftAward.citationsVerified,
    reviewStatus: draftAward.reviewStatus,
    reviewNotes: draftAward.reviewNotes,
    generatedAt: draftAward.generatedAt,
    reviewedAt: draftAward.reviewedAt,
  };
}

/**
 * Submit review of draft award
 */
export async function submitDraftAwardReview(
  caseId: string,
  submission: ReviewSubmission
): Promise<ReviewResult> {
  const draftAward = await prisma.draftAward.findUnique({
    where: { caseId },
  });

  if (!draftAward) {
    throw new Error('Draft award not found');
  }

  // Update draft award with review
  const updated = await prisma.draftAward.update({
    where: { id: draftAward.id },
    data: {
      reviewStatus: submission.reviewStatus,
      reviewNotes: submission.reviewNotes,
      reviewedAt: new Date(),
    },
  });

  // Determine next step based on review decision
  let nextStep: string;
  switch (submission.reviewStatus) {
    case 'APPROVE':
      nextStep = 'Award will be finalized and issued to parties';
      // Update case status
      await prisma.case.update({
        where: { id: caseId },
        data: { status: 'DECIDED' },
      });
      break;
    case 'MODIFY':
      nextStep = 'Modifications will be applied and award regenerated';
      break;
    case 'REJECT':
      nextStep = 'Award rejected; case will be reviewed for further analysis';
      await prisma.case.update({
        where: { id: caseId },
        data: { status: 'ANALYSIS_IN_PROGRESS' },
      });
      break;
    case 'ESCALATE':
      nextStep = 'Case escalated for human arbitrator review';
      break;
    default:
      nextStep = 'Review submitted';
  }

  // Log review
  console.log('[DraftAward] Review submitted:', {
    draftAwardId: draftAward.id,
    caseId,
    reviewStatus: submission.reviewStatus,
    nextStep,
  });

  return {
    id: updated.id,
    reviewStatus: submission.reviewStatus,
    reviewedAt: updated.reviewedAt!,
    nextStep,
  };
}

/**
 * Load draft award input from completed analysis
 */
export async function loadDraftAwardInput(caseId: string): Promise<DraftAwardInput | null> {
  // Get case data
  const caseData = await prisma.case.findUnique({
    where: { id: caseId },
    select: {
      id: true,
      referenceNumber: true,
      description: true,
      jurisdiction: true,
      disputeType: true,
      amount: true,
      claimant: { select: { name: true } },
      respondent: { select: { name: true } },
    },
  });

  if (!caseData) return null;

  // Get analysis job with all results
  const analysisJob = await prisma.analysisJob.findUnique({
    where: { caseId },
  });

  if (!analysisJob) return null;

  // Check both fact and legal analysis are completed
  if (analysisJob.status !== 'COMPLETED' || analysisJob.legalAnalysisStatus !== 'COMPLETED') {
    return null;
  }

  // Parse stored JSON data (use unknown as intermediate type for JSON fields)
  const extractedFacts = analysisJob.extractedFacts as unknown as {
    claimant: StoredExtractedFact[];
    respondent: StoredExtractedFact[];
  } | null;

  const disputedFacts = (analysisJob.disputedFacts || []) as unknown as StoredDisputedFact[];

  const undisputedFacts = (analysisJob.undisputedFacts || []) as unknown as StoredUndisputedFact[];

  const credibilityScores =
    analysisJob.credibilityScores as unknown as StoredCredibilityScores | null;

  const legalIssues = (analysisJob.legalIssues || []) as unknown as StoredLegalIssue[];

  const burdenOfProof = analysisJob.burdenOfProof as unknown as StoredBurdenOfProof | null;

  const damagesCalculation =
    analysisJob.damagesCalculation as unknown as StoredDamagesCalculation | null;

  const conclusionsOfLaw = (analysisJob.conclusionsOfLaw ||
    []) as unknown as StoredConclusionOfLaw[];

  // Get award recommendation from damages calculation or create default
  const awardRecommendation: StoredAwardRecommendation = damagesCalculation
    ? {
        prevailingParty: damagesCalculation.recommendedTotal > 0 ? 'claimant' : 'respondent',
        awardAmount: damagesCalculation.recommendedTotal,
        reasoning: 'Based on supported damages calculation',
      }
    : {
        prevailingParty: 'split',
        awardAmount: 0,
        reasoning: 'No damages calculation available',
      };

  const citationsUsed = (analysisJob.citationsUsed || []) as unknown as StoredCitation[];

  // Validate required data
  if (!extractedFacts || !credibilityScores || !burdenOfProof || !damagesCalculation) {
    return null;
  }

  return {
    caseId: caseData.id,
    caseReference: caseData.referenceNumber,
    caseDescription: caseData.description || '',
    jurisdiction: caseData.jurisdiction || 'US-CA',
    disputeType: caseData.disputeType || 'CONTRACT',
    claimedAmount: caseData.amount ? Number(caseData.amount) : 0,
    claimantName: caseData.claimant?.name || 'Claimant',
    respondentName: caseData.respondent?.name || 'Respondent',
    extractedFacts,
    disputedFacts,
    undisputedFacts,
    credibilityScores,
    legalIssues,
    burdenOfProof,
    damagesCalculation,
    conclusionsOfLaw,
    awardRecommendation,
    citationsUsed,
  };
}
