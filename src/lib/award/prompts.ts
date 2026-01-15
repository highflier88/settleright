/**
 * Draft Award Prompts
 *
 * Claude prompts for generating formal arbitration award content
 * including findings of fact, conclusions of law, and orders.
 */

/**
 * System prompt for award generation
 */
export const AWARD_GENERATION_SYSTEM_PROMPT = `You are an expert arbitrator drafting a formal arbitration award. Your writing must be:

1. Precise and legally accurate
2. Formal in tone and structure
3. Based solely on the evidence and legal analysis provided
4. Clear enough for both parties to understand
5. Consistent with California arbitration practice

Follow standard arbitration award formatting conventions. Each finding and conclusion should be numbered sequentially for easy reference.`;

/**
 * Build prompt for generating findings of fact
 */
export function buildFindingsOfFactPrompt(params: {
  caseReference: string;
  claimantName: string;
  respondentName: string;
  caseDescription: string;
  undisputedFacts: Array<{
    fact: string;
    materialityScore: number;
  }>;
  disputedFacts: Array<{
    topic: string;
    claimantPosition: string;
    respondentPosition: string;
    resolved: 'claimant' | 'respondent' | 'partial';
    reasoning: string;
  }>;
  credibilityDetermination: {
    moreCredible: 'claimant' | 'respondent' | 'equal';
    reasoning: string;
  };
}): string {
  const {
    caseReference,
    claimantName,
    respondentName,
    caseDescription,
    undisputedFacts,
    disputedFacts,
    credibilityDetermination,
  } = params;

  const undisputedList = undisputedFacts
    .filter((f) => f.materialityScore > 0.3)
    .map((f, i) => `${i + 1}. ${f.fact}`)
    .join('\n');

  const disputedList = disputedFacts
    .map(
      (f, i) => `${i + 1}. Topic: ${f.topic}
   - Claimant says: ${f.claimantPosition}
   - Respondent says: ${f.respondentPosition}
   - Resolution: ${f.resolved === 'claimant' ? "Claimant's position accepted" : f.resolved === 'respondent' ? "Respondent's position accepted" : 'Partially accepted'}
   - Reasoning: ${f.reasoning}`
    )
    .join('\n\n');

  return `Draft the FINDINGS OF FACT section for this arbitration award.

## Case Information
- Case Reference: ${caseReference}
- Claimant: ${claimantName}
- Respondent: ${respondentName}
- Description: ${caseDescription}

## Undisputed Facts
${undisputedList || 'None identified'}

## Disputed Facts and Resolutions
${disputedList || 'None identified'}

## Credibility Determination
- More credible party: ${credibilityDetermination.moreCredible}
- Reasoning: ${credibilityDetermination.reasoning}

## Instructions
Generate numbered findings of fact. Each finding should:
1. State the fact clearly and precisely
2. Note whether it is undisputed, proven by preponderance, or based on credibility
3. Reference supporting evidence where applicable
4. Be written in formal legal style

Format as JSON:
{
  "findings": [
    {
      "number": 1,
      "finding": "The finding statement",
      "basis": "undisputed" | "proven" | "credibility",
      "supportingEvidence": ["evidence references"],
      "credibilityNote": "optional note if based on credibility",
      "date": "optional date if relevant",
      "amount": 0
    }
  ]
}`;
}

/**
 * Build prompt for generating conclusions of law
 */
export function buildConclusionsOfLawPrompt(params: {
  caseReference: string;
  jurisdiction: string;
  legalIssues: Array<{
    category: string;
    description: string;
    elementsSatisfied: boolean;
    applicableStatutes: string[];
  }>;
  findingsOfFact: Array<{
    number: number;
    finding: string;
  }>;
  citationsUsed: string[];
}): string {
  const { caseReference, jurisdiction, legalIssues, findingsOfFact, citationsUsed } = params;

  const issuesList = legalIssues
    .map(
      (issue, i) => `${i + 1}. ${issue.description} (${issue.category})
   - Elements satisfied: ${issue.elementsSatisfied ? 'Yes' : 'No'}
   - Applicable statutes: ${issue.applicableStatutes.join(', ')}`
    )
    .join('\n\n');

  const findingsList = findingsOfFact.map((f) => `${f.number}. ${f.finding}`).join('\n');

  return `Draft the CONCLUSIONS OF LAW section for this arbitration award.

## Case Information
- Case Reference: ${caseReference}
- Jurisdiction: ${jurisdiction}

## Legal Issues Analyzed
${issuesList}

## Findings of Fact (for reference)
${findingsList}

## Available Citations
${citationsUsed.slice(0, 15).join('\n')}

## Instructions
Generate numbered conclusions of law. Each conclusion should:
1. State the legal issue being addressed
2. Apply the law to the facts found
3. Cite applicable statutes or case law
4. Reference specific finding numbers that support the conclusion
5. Use formal legal language

Format as JSON:
{
  "conclusions": [
    {
      "number": 1,
      "issue": "The legal issue",
      "conclusion": "The formal legal conclusion",
      "legalBasis": ["Cal. Civ. Code § XXXX"],
      "supportingFindings": [1, 2, 3]
    }
  ]
}`;
}

/**
 * Build prompt for generating the order and decision
 */
export function buildOrderPrompt(params: {
  caseReference: string;
  claimantName: string;
  respondentName: string;
  jurisdiction: string;
  prevailingParty: 'claimant' | 'respondent' | 'split';
  awardAmount: number;
  interestAmount: number;
  totalAward: number;
  interestDetails?: {
    rate: number;
    startDate: string;
    endDate: string;
    statutoryBasis: string;
  };
  damagesBreakdown: Array<{
    description: string;
    amount: number;
  }>;
  reasoning: string;
}): string {
  const {
    caseReference,
    claimantName,
    respondentName,
    jurisdiction,
    prevailingParty,
    awardAmount,
    interestAmount,
    totalAward,
    interestDetails,
    damagesBreakdown,
    reasoning,
  } = params;

  const damagesList = damagesBreakdown
    .map((d) => `- ${d.description}: $${d.amount.toLocaleString()}`)
    .join('\n');

  return `Draft the ORDER AND AWARD section for this arbitration award.

## Case Information
- Case Reference: ${caseReference}
- Claimant: ${claimantName}
- Respondent: ${respondentName}
- Jurisdiction: ${jurisdiction}

## Award Determination
- Prevailing Party: ${prevailingParty === 'claimant' ? claimantName : prevailingParty === 'respondent' ? respondentName : 'Split decision'}
- Damages Award: $${awardAmount.toLocaleString()}
- Prejudgment Interest: $${interestAmount.toLocaleString()}
- Total Award: $${totalAward.toLocaleString()}

## Damages Breakdown
${damagesList}

${
  interestDetails
    ? `## Interest Calculation
- Rate: ${(interestDetails.rate * 100).toFixed(1)}% per annum
- From: ${interestDetails.startDate}
- To: ${interestDetails.endDate}
- Statutory Basis: ${interestDetails.statutoryBasis}`
    : ''
}

## Reasoning Summary
${reasoning}

## Instructions
Generate the formal ORDER AND AWARD. The order should:
1. Begin with "Based on the foregoing Findings of Fact and Conclusions of Law..."
2. State each element of the award clearly
3. Include interest calculation details if applicable
4. Address costs and fees (typically each party bears their own)
5. Use formal, authoritative language

Also generate a reasoning paragraph explaining the decision.

Format as JSON:
{
  "orderText": "The full formal order text",
  "reasoning": "Detailed reasoning for the decision"
}`;
}

/**
 * Build prompt for generating complete award narrative
 */
export function buildAwardNarrativePrompt(params: {
  caseReference: string;
  claimantName: string;
  respondentName: string;
  caseDescription: string;
  findingsCount: number;
  conclusionsCount: number;
  prevailingParty: string;
  totalAward: number;
}): string {
  const {
    caseReference,
    claimantName,
    respondentName,
    caseDescription,
    findingsCount,
    conclusionsCount,
    prevailingParty,
    totalAward,
  } = params;

  return `Generate a brief decision summary paragraph for the arbitration award.

## Case Information
- Case Reference: ${caseReference}
- Claimant: ${claimantName}
- Respondent: ${respondentName}
- Description: ${caseDescription}

## Award Summary
- Number of findings of fact: ${findingsCount}
- Number of conclusions of law: ${conclusionsCount}
- Prevailing party: ${prevailingParty}
- Total award: $${totalAward.toLocaleString()}

## Instructions
Write a 2-3 sentence summary of the decision that could appear at the beginning of the award document. It should state:
1. What the dispute was about
2. The outcome (who prevailed)
3. The award amount if applicable

Keep it formal but readable.

Format as JSON:
{
  "summary": "The decision summary paragraph"
}`;
}

/**
 * Standard award document header
 */
export function getAwardHeader(params: {
  caseReference: string;
  claimantName: string;
  respondentName: string;
}): string {
  return `ARBITRATION AWARD

Case No.: ${params.caseReference}

${params.claimantName},
    Claimant,

v.

${params.respondentName},
    Respondent.

─────────────────────────────────────────────────────────────────`;
}

/**
 * Standard award document footer
 */
export function getAwardFooter(generatedAt: Date): string {
  const dateStr = generatedAt.toLocaleDateString('en-US', {
    year: 'numeric',
    month: 'long',
    day: 'numeric',
  });

  return `─────────────────────────────────────────────────────────────────

DATED: ${dateStr}

This award is issued pursuant to the arbitration agreement between the parties.
This is a draft award pending arbitrator review and signature.`;
}
