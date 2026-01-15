/**
 * Legal Analysis Prompts
 *
 * Claude prompt templates for legal reasoning tasks including
 * issue classification, burden analysis, damages, and conclusions.
 */

import type { LegalIssueCategory } from './types';

/**
 * System prompt for legal analysis
 */
export const LEGAL_ANALYSIS_SYSTEM_PROMPT = `You are an expert legal analyst specializing in civil disputes and arbitration. Your role is to provide objective, evidence-based legal analysis following established legal principles.

Key principles:
1. Apply the applicable law objectively to the facts
2. Consider only admissible evidence and proven facts
3. Apply the correct burden of proof standard
4. Cite specific statutes and case law where applicable
5. Acknowledge uncertainty when evidence is insufficient
6. Maintain neutrality between parties

You are analyzing a case under California law unless otherwise specified.`;

/**
 * Build the issue classification prompt
 */
export function buildIssueClassificationPrompt(params: {
  caseDescription: string;
  disputeType: string;
  claimedAmount: number;
  disputedFacts: Array<{
    topic: string;
    claimantPosition: string;
    respondentPosition: string;
    materialityScore: number;
  }>;
  undisputedFacts: Array<{
    fact: string;
    materialityScore: number;
  }>;
  legalContext?: string;
}): string {
  const { caseDescription, disputeType, claimedAmount, disputedFacts, undisputedFacts, legalContext } = params;

  const disputedFactsList = disputedFacts
    .map((f, i) => `${i + 1}. Topic: ${f.topic}
   - Claimant says: ${f.claimantPosition}
   - Respondent says: ${f.respondentPosition}
   - Materiality: ${(f.materialityScore * 100).toFixed(0)}%`)
    .join('\n');

  const undisputedFactsList = undisputedFacts
    .map((f, i) => `${i + 1}. ${f.fact} (Materiality: ${(f.materialityScore * 100).toFixed(0)}%)`)
    .join('\n');

  return `Analyze this dispute and classify the legal issues that must be resolved.

## Case Overview
- Type: ${disputeType}
- Amount in Dispute: $${claimedAmount.toLocaleString()}
- Description: ${caseDescription}

## Undisputed Facts
${undisputedFactsList || 'None identified'}

## Disputed Facts
${disputedFactsList || 'None identified'}

${legalContext ? `## Applicable Legal Authority\n${legalContext}\n` : ''}

## Task
Identify and classify the legal issues in this case. For each issue:
1. Categorize it (breach_of_contract, consumer_protection, warranty, fraud, negligence, unjust_enrichment, statutory_violation, payment_dispute, service_dispute, property_damage)
2. List the legal elements that must be proven
3. Identify applicable statutes and case law
4. Rate the materiality (0-1) to the case outcome

Respond in JSON format:
{
  "issues": [
    {
      "id": "issue-1",
      "category": "breach_of_contract",
      "description": "Description of the legal issue",
      "elements": [
        {
          "id": "elem-1",
          "name": "Element name",
          "description": "What must be proven",
          "isSatisfied": null,
          "supportingFacts": [],
          "opposingFacts": [],
          "analysis": "",
          "confidence": 0
        }
      ],
      "applicableStatutes": ["Cal. Civ. Code § 3300"],
      "applicableCaseLaw": [],
      "materialityScore": 0.9,
      "analysisNotes": "Additional analysis"
    }
  ]
}`;
}

/**
 * Build the burden of proof analysis prompt
 */
export function buildBurdenAnalysisPrompt(params: {
  issues: Array<{
    id: string;
    category: LegalIssueCategory;
    description: string;
    elements: Array<{
      id: string;
      name: string;
      description: string;
    }>;
  }>;
  extractedFacts: {
    claimant: Array<{ id: string; statement: string; confidence: number }>;
    respondent: Array<{ id: string; statement: string; confidence: number }>;
  };
  credibilityScores: {
    claimant: { overall: number };
    respondent: { overall: number };
  };
  contradictions: Array<{
    topic: string;
    severity: string;
    analysis: string;
  }>;
  legalContext?: string;
}): string {
  const { issues, extractedFacts, credibilityScores, contradictions, legalContext } = params;

  const issuesList = issues
    .map((issue) => {
      const elements = issue.elements
        .map((e) => `    - ${e.name}: ${e.description}`)
        .join('\n');
      return `- ${issue.description} (${issue.category})
  Elements to prove:
${elements}`;
    })
    .join('\n\n');

  const claimantFacts = extractedFacts.claimant
    .slice(0, 15)
    .map((f) => `- [${f.id}] ${f.statement} (confidence: ${(f.confidence * 100).toFixed(0)}%)`)
    .join('\n');

  const respondentFacts = extractedFacts.respondent
    .slice(0, 15)
    .map((f) => `- [${f.id}] ${f.statement} (confidence: ${(f.confidence * 100).toFixed(0)}%)`)
    .join('\n');

  const contradictionsList = contradictions
    .slice(0, 10)
    .map((c) => `- ${c.topic} (${c.severity}): ${c.analysis}`)
    .join('\n');

  return `Analyze whether the claimant has met their burden of proof for each legal element.

## Legal Issues to Analyze
${issuesList}

## Claimant's Facts
${claimantFacts || 'None extracted'}

## Respondent's Facts
${respondentFacts || 'None extracted'}

## Credibility Assessment
- Claimant credibility: ${(credibilityScores.claimant.overall * 100).toFixed(0)}%
- Respondent credibility: ${(credibilityScores.respondent.overall * 100).toFixed(0)}%

## Contradictions Identified
${contradictionsList || 'None identified'}

${legalContext ? `## Legal Authority\n${legalContext}\n` : ''}

## Burden of Proof Standards
- Civil claims: Preponderance of the evidence (>50% likely)
- Fraud claims: Clear and convincing evidence
- Punitive damages: Clear and convincing evidence

## Task
For each legal element, analyze whether the burden of proof has been met. Consider:
1. What evidence supports this element?
2. What evidence opposes it?
3. How does credibility affect the weighing?
4. Does the evidence meet the applicable standard?

Respond in JSON format:
{
  "overallBurdenMet": true,
  "analyses": [
    {
      "party": "claimant",
      "standard": "preponderance",
      "issue": "Issue/element being analyzed",
      "isMet": true,
      "probability": 0.75,
      "reasoning": "Detailed reasoning",
      "keyEvidence": ["fact-id-1", "fact-id-2"],
      "weaknesses": ["Identified weaknesses in proof"]
    }
  ],
  "shiftingBurdens": [
    {
      "fromParty": "claimant",
      "toParty": "respondent",
      "trigger": "What triggered the shift",
      "newBurden": "What respondent must now prove"
    }
  ],
  "summary": "Overall burden analysis summary"
}`;
}

/**
 * Build the damages calculation prompt
 */
export function buildDamagesPrompt(params: {
  claimedAmount: number;
  damagesClaimed: Array<{
    description: string;
    amount: number;
    category?: string;
  }>;
  extractedFacts: {
    claimant: Array<{ id: string; statement: string; amount?: number }>;
    respondent: Array<{ id: string; statement: string; amount?: number }>;
  };
  evidenceSummaries: Array<{
    id: string;
    fileName: string;
    summary?: string;
    submittedBy: 'claimant' | 'respondent';
  }>;
  jurisdiction: string;
  isContractClaim: boolean;
  breachDate?: string;
  legalContext?: string;
}): string {
  const {
    claimedAmount,
    damagesClaimed,
    extractedFacts,
    evidenceSummaries,
    jurisdiction,
    isContractClaim,
    breachDate,
    legalContext,
  } = params;

  const claimedDamagesList = damagesClaimed
    .map((d) => `- ${d.description}: $${d.amount.toLocaleString()}${d.category ? ` (${d.category})` : ''}`)
    .join('\n');

  const claimantEvidence = evidenceSummaries
    .filter((e) => e.submittedBy === 'claimant')
    .map((e) => `- ${e.fileName}: ${e.summary || 'No summary'}`)
    .join('\n');

  const financialFacts = [
    ...extractedFacts.claimant.filter((f) => f.amount !== undefined),
    ...extractedFacts.respondent.filter((f) => f.amount !== undefined),
  ]
    .slice(0, 10)
    .map((f) => `- ${f.statement}${f.amount ? ` ($${f.amount.toLocaleString()})` : ''}`)
    .join('\n');

  return `Calculate appropriate damages based on the evidence and applicable law.

## Claimed Damages
Total Claimed: $${claimedAmount.toLocaleString()}

Itemized Claims:
${claimedDamagesList || 'No itemization provided'}

## Supporting Evidence
${claimantEvidence || 'No evidence summaries'}

## Financial Facts Extracted
${financialFacts || 'No financial facts extracted'}

## Jurisdiction & Interest
- Jurisdiction: ${jurisdiction}
- Claim Type: ${isContractClaim ? 'Contract' : 'Non-Contract'}
- Breach Date: ${breachDate || 'Not specified'}
- Prejudgment Interest Rate: ${isContractClaim ? '10%' : '7%'} per annum (California)

${legalContext ? `## Legal Authority on Damages\n${legalContext}\n` : ''}

## California Damages Principles
1. Compensatory damages: Actual losses proven with reasonable certainty
2. Consequential damages: Must be foreseeable at time of contracting
3. Mitigation: Claimant must take reasonable steps to minimize losses
4. Interest: 10% prejudgment interest on contract claims from breach date

## Task
Calculate damages by:
1. Evaluating each claimed item against evidence
2. Determining what amount is actually supported
3. Applying any mitigation reduction
4. Calculating prejudgment interest if applicable

Respond in JSON format:
{
  "claimedTotal": ${claimedAmount},
  "supportedTotal": 0,
  "recommendedTotal": 0,
  "items": [
    {
      "id": "dmg-1",
      "type": "compensatory",
      "description": "Description",
      "claimedAmount": 0,
      "supportedAmount": 0,
      "calculatedAmount": 0,
      "basis": "Legal basis",
      "evidenceSupport": ["evidence-id"],
      "adjustments": [
        {
          "type": "mitigation",
          "description": "Description",
          "amount": -100,
          "legalBasis": "Cal. Civ. Code § 3358"
        }
      ],
      "confidence": 0.8
    }
  ],
  "mitigation": {
    "didClaimantMitigate": true,
    "mitigationEfforts": ["Effort 1"],
    "failureToMitigate": null,
    "reduction": 0
  },
  "interestCalculation": {
    "principal": 0,
    "rate": 0.10,
    "startDate": "${breachDate || 'unknown'}",
    "endDate": "today",
    "days": 0,
    "interestAmount": 0,
    "statutoryBasis": "Cal. Civ. Code § 3289(b)"
  },
  "summary": "Damages analysis summary"
}`;
}

/**
 * Build the conclusions of law prompt
 */
export function buildConclusionsPrompt(params: {
  issues: Array<{
    id: string;
    category: string;
    description: string;
    elements: Array<{
      name: string;
      isSatisfied: boolean | null;
      analysis: string;
    }>;
  }>;
  burdenAnalysis: {
    overallBurdenMet: boolean;
    summary: string;
  };
  damagesCalculation: {
    recommendedTotal: number;
    summary: string;
  };
  jurisdiction: string;
  legalContext?: string;
}): string {
  const { issues, burdenAnalysis, damagesCalculation, jurisdiction, legalContext } = params;

  const issueAnalyses = issues
    .map((issue) => {
      const elementResults = issue.elements
        .map((e) => `    - ${e.name}: ${e.isSatisfied === null ? 'Unknown' : e.isSatisfied ? 'Satisfied' : 'Not Satisfied'}`)
        .join('\n');
      return `- ${issue.description} (${issue.category})
  Elements:
${elementResults}`;
    })
    .join('\n\n');

  return `Generate conclusions of law based on the legal analysis.

## Legal Issues Analyzed
${issueAnalyses}

## Burden of Proof Summary
${burdenAnalysis.summary}
Overall burden met: ${burdenAnalysis.overallBurdenMet ? 'Yes' : 'No'}

## Damages Analysis
Recommended Award: $${damagesCalculation.recommendedTotal.toLocaleString()}
${damagesCalculation.summary}

## Jurisdiction
${jurisdiction}

${legalContext ? `## Applicable Legal Authority\n${legalContext}\n` : ''}

## Task
Draft formal conclusions of law for each issue. Each conclusion should:
1. State the legal issue
2. Apply the law to the facts
3. Reach a conclusion
4. Cite supporting authority

Also provide an overall determination and award recommendation.

Respond in JSON format:
{
  "conclusions": [
    {
      "id": "col-1",
      "issue": "The legal issue",
      "conclusion": "Formal conclusion of law",
      "legalBasis": ["Cal. Civ. Code § 3300", "Case citation"],
      "supportingFacts": ["fact-id-1"],
      "confidence": 0.85
    }
  ],
  "overallDetermination": "Summary of overall legal determination",
  "awardRecommendation": {
    "prevailingParty": "claimant",
    "awardAmount": 0,
    "reasoning": "Reasoning for award"
  }
}`;
}

/**
 * Build the confidence scoring prompt
 */
export function buildConfidencePrompt(params: {
  issueCount: number;
  elementsSatisfied: number;
  elementsTotal: number;
  evidenceCount: number;
  contradictionCount: number;
  credibilityDelta: number;
  citationsUsed: number;
  damagesSupported: number;
  damagesClaimed: number;
}): string {
  const {
    issueCount,
    elementsSatisfied,
    elementsTotal,
    evidenceCount,
    contradictionCount,
    credibilityDelta,
    citationsUsed,
    damagesSupported,
    damagesClaimed,
  } = params;

  return `Assess the overall confidence in the legal analysis.

## Analysis Metrics
- Legal issues identified: ${issueCount}
- Elements satisfied: ${elementsSatisfied}/${elementsTotal}
- Evidence items reviewed: ${evidenceCount}
- Contradictions found: ${contradictionCount}
- Credibility differential: ${(credibilityDelta * 100).toFixed(0)}%
- Legal citations used: ${citationsUsed}
- Damages supported: $${damagesSupported.toLocaleString()} / $${damagesClaimed.toLocaleString()} (${((damagesSupported / damagesClaimed) * 100).toFixed(0)}%)

## Task
Score the confidence in this analysis across these factors:
1. Evidence Quality: How strong and comprehensive is the evidence?
2. Legal Precedent: How clearly does the law apply to these facts?
3. Factual Certainty: How clear are the facts?
4. Jurisdictional Clarity: How clear is the applicable law?
5. Issue Complexity: How complex are the legal issues?

Respond in JSON format:
{
  "overallConfidence": 0.75,
  "factors": {
    "evidenceQuality": 0.8,
    "legalPrecedentStrength": 0.7,
    "factualCertainty": 0.75,
    "jurisdictionalClarity": 0.9,
    "issueComplexity": 0.6
  },
  "reasoning": "Explanation of confidence assessment",
  "caveats": ["Important caveats or limitations"]
}`;
}

/**
 * Legal issue categories with descriptions
 */
export const LEGAL_ISSUE_CATEGORIES: Record<LegalIssueCategory, string> = {
  breach_of_contract: 'Failure to perform contractual obligations',
  consumer_protection: 'Violation of consumer protection statutes (CLRA, UCL)',
  warranty: 'Breach of express or implied warranty',
  fraud: 'Intentional misrepresentation or concealment',
  negligence: 'Failure to exercise reasonable care',
  unjust_enrichment: 'Retention of benefit without legal justification',
  statutory_violation: 'Violation of specific statutory requirements',
  payment_dispute: 'Dispute over payment obligations',
  service_dispute: 'Dispute over service quality or delivery',
  property_damage: 'Damage to real or personal property',
};

/**
 * Contract elements required for breach of contract
 */
export const CONTRACT_ELEMENTS = [
  {
    name: 'Existence of Contract',
    description: 'A valid contract existed between the parties',
  },
  {
    name: 'Performance by Claimant',
    description: 'Claimant performed their contractual obligations or was excused from performance',
  },
  {
    name: 'Breach by Respondent',
    description: 'Respondent failed to perform their contractual obligations',
  },
  {
    name: 'Damages',
    description: 'Claimant suffered damages as a result of the breach',
  },
];

/**
 * Fraud elements required
 */
export const FRAUD_ELEMENTS = [
  {
    name: 'Misrepresentation',
    description: 'Respondent made a false representation of material fact',
  },
  {
    name: 'Knowledge of Falsity',
    description: 'Respondent knew the representation was false (scienter)',
  },
  {
    name: 'Intent to Induce Reliance',
    description: 'Respondent intended claimant to rely on the misrepresentation',
  },
  {
    name: 'Justifiable Reliance',
    description: 'Claimant justifiably relied on the misrepresentation',
  },
  {
    name: 'Damages',
    description: 'Claimant suffered damages as a result of reliance',
  },
];

/**
 * Consumer protection (CLRA) elements
 */
export const CLRA_ELEMENTS = [
  {
    name: 'Consumer Transaction',
    description: 'Transaction involved goods or services for personal, family, or household purposes',
  },
  {
    name: 'Prohibited Practice',
    description: 'Respondent engaged in a practice prohibited under Cal. Civ. Code § 1770',
  },
  {
    name: 'Causation',
    description: 'The prohibited practice caused claimant\'s harm',
  },
  {
    name: 'Damages',
    description: 'Claimant suffered actual damages (minimum $1,000 under CLRA)',
  },
];
