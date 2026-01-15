/**
 * Claude Prompt Templates for Fact Analysis
 *
 * Structured prompts for fact extraction, comparison, timeline,
 * contradiction detection, and credibility scoring.
 */

import type { EvidenceSummary } from './types';

/**
 * Format evidence summaries for inclusion in prompts
 */
export function formatEvidenceSummaries(evidence: EvidenceSummary[]): string {
  if (evidence.length === 0) {
    return 'No documentary evidence provided.';
  }

  return evidence
    .map((e, i) => {
      const parts = [
        `Evidence ${i + 1}: ${e.fileName}`,
        e.documentType ? `Type: ${e.documentType}` : null,
        `Submitted by: ${e.submittedBy}`,
        e.summary ? `Summary: ${e.summary}` : null,
        e.keyPoints?.length ? `Key points: ${e.keyPoints.join('; ')}` : null,
        e.entities?.dates?.length ? `Dates mentioned: ${e.entities.dates.join(', ')}` : null,
        e.entities?.amounts?.length ? `Amounts mentioned: $${e.entities.amounts.join(', $')}` : null,
      ];
      return parts.filter(Boolean).join('\n');
    })
    .join('\n\n');
}

/**
 * Prompt for extracting facts from a party's statement
 */
export function buildFactExtractionPrompt(
  partyType: 'claimant' | 'respondent',
  statement: string,
  caseContext: string,
  evidenceSummaries: EvidenceSummary[]
): string {
  const evidenceText = formatEvidenceSummaries(
    evidenceSummaries.filter((e) => e.submittedBy === partyType)
  );

  return `You are a legal analyst extracting key facts from a party's statement in a dispute.

CASE CONTEXT:
${caseContext}

PARTY: ${partyType.toUpperCase()}

${partyType.toUpperCase()}'S STATEMENT:
"""
${statement}
"""

SUPPORTING EVIDENCE FROM ${partyType.toUpperCase()}:
${evidenceText}

TASK:
Extract all significant facts from this statement. For each fact, identify:
1. The factual claim being made (be specific and precise)
2. Category: event (something that happened), claim (an assertion seeking relief), admission (acknowledging something unfavorable), denial (refuting an allegation), allegation (accusing the other party)
3. Any specific date mentioned or implied
4. Any monetary amount associated with this fact
5. Evidence IDs that support this fact (if applicable)
6. Your confidence in extracting this fact accurately (0-1)

Focus on:
- Key events in chronological order
- Specific claims and their bases
- Admissions against interest
- Direct denials of allegations
- Allegations against the other party

RESPOND WITH A JSON ARRAY OF FACTS:
[
  {
    "id": "fact_1",
    "statement": "The specific factual claim",
    "category": "event|claim|admission|denial|allegation",
    "date": "YYYY-MM-DD or descriptive date if exact not given",
    "amount": 1234.56,
    "supportingEvidence": ["evidence_id_1"],
    "confidence": 0.95,
    "context": "Brief context if needed"
  }
]

Extract 5-15 facts depending on statement length. Be thorough but focus on material facts.
Respond with ONLY the JSON array, no other text.`;
}

/**
 * Prompt for comparing facts between parties
 */
export function buildFactComparisonPrompt(
  claimantFacts: string,
  respondentFacts: string,
  caseContext: string
): string {
  return `You are a legal analyst comparing the factual claims of two parties in a dispute.

CASE CONTEXT:
${caseContext}

CLAIMANT'S EXTRACTED FACTS:
${claimantFacts}

RESPONDENT'S EXTRACTED FACTS:
${respondentFacts}

TASK:
Analyze the facts from both parties and identify:

1. DISPUTED FACTS: Facts where the parties disagree or have conflicting positions
   - Identify the topic of disagreement
   - State each party's position clearly
   - Rate the materiality to the case outcome (0-1)

2. UNDISPUTED FACTS: Facts that both parties agree on (explicitly or implicitly)
   - These are facts not contradicted by either party
   - Include facts admitted by both sides

For disputed facts, assess how central each dispute is to resolving the case.
For undisputed facts, note which party's statement establishes the fact.

RESPOND WITH A JSON OBJECT:
{
  "disputed": [
    {
      "id": "dispute_1",
      "topic": "Subject of disagreement",
      "claimantPosition": "Claimant's position on this matter",
      "respondentPosition": "Respondent's position on this matter",
      "relevantEvidence": ["evidence_id_1", "evidence_id_2"],
      "materialityScore": 0.85,
      "analysis": "Brief analysis of why this matters"
    }
  ],
  "undisputed": [
    {
      "id": "agreed_1",
      "fact": "The agreed-upon fact",
      "agreedBy": ["claimant", "respondent"],
      "supportingEvidence": ["evidence_id_1"],
      "materialityScore": 0.6
    }
  ]
}

Identify 3-8 disputed facts and 3-8 undisputed facts.
Respond with ONLY the JSON object, no other text.`;
}

/**
 * Prompt for building timeline from statements and evidence
 */
export function buildTimelinePrompt(
  claimantStatement: string,
  respondentStatement: string | undefined,
  evidenceSummaries: EvidenceSummary[],
  caseContext: string
): string {
  const evidenceText = formatEvidenceSummaries(evidenceSummaries);

  return `You are a legal analyst reconstructing a chronological timeline of events from party statements and evidence.

CASE CONTEXT:
${caseContext}

CLAIMANT'S STATEMENT:
"""
${claimantStatement}
"""

${respondentStatement ? `RESPONDENT'S STATEMENT:\n"""\n${respondentStatement}\n"""` : 'RESPONDENT HAS NOT YET SUBMITTED A STATEMENT.'}

DOCUMENTARY EVIDENCE:
${evidenceText}

TASK:
Create a chronological timeline of all events mentioned by either party or found in evidence.

For each event:
1. Extract or infer the date (be as specific as possible)
2. Describe what happened
3. Note the source (claimant, respondent, or evidence ID)
4. Mark whether this event is disputed between the parties

Guidelines:
- Use ISO date format (YYYY-MM-DD) when possible
- For approximate dates, use descriptive terms ("early January 2024", "Q3 2023")
- Include events from contracts, communications, and transactions
- Note events that one party mentions but the other disputes or ignores

RESPOND WITH A JSON OBJECT:
{
  "events": [
    {
      "id": "event_1",
      "date": "2024-01-15",
      "event": "Description of what happened",
      "source": "claimant|respondent|evidence",
      "sourceId": "evidence_id or 'statement'",
      "disputed": false,
      "details": "Additional context if relevant"
    }
  ],
  "startDate": "Earliest date in timeline",
  "endDate": "Latest date in timeline",
  "undatedEvents": [
    {
      "id": "undated_1",
      "date": "unknown",
      "event": "Event without clear date",
      "source": "claimant",
      "sourceId": "statement",
      "disputed": false
    }
  ]
}

Include 5-20 events depending on case complexity.
Sort events chronologically where dates are known.
Respond with ONLY the JSON object, no other text.`;
}

/**
 * Prompt for detecting contradictions between parties
 */
export function buildContradictionPrompt(
  disputedFacts: string,
  claimantStatement: string,
  respondentStatement: string,
  caseContext: string
): string {
  return `You are a legal analyst identifying contradictions between parties in a dispute.

CASE CONTEXT:
${caseContext}

PREVIOUSLY IDENTIFIED DISPUTED FACTS:
${disputedFacts}

CLAIMANT'S FULL STATEMENT:
"""
${claimantStatement}
"""

RESPONDENT'S FULL STATEMENT:
"""
${respondentStatement}
"""

TASK:
Analyze the disputed facts and party statements to identify specific contradictions.
A contradiction exists when the parties make mutually incompatible claims about the same matter.

For each contradiction:
1. Identify the specific topic
2. State exactly what the claimant claims
3. State exactly what the respondent claims
4. Assess severity:
   - MINOR: Different recollections that don't materially affect the case outcome
   - MODERATE: Conflicting claims about secondary issues
   - MAJOR: Direct contradiction on material facts central to the dispute
5. Analyze why these claims cannot both be true
6. Assess how this contradiction impacts the case

Focus on factual contradictions, not just different interpretations or opinions.
Look for contradictions about:
- What was said or agreed
- When events occurred
- What actions were taken
- Amounts or quantities
- Causal relationships

RESPOND WITH A JSON OBJECT:
{
  "contradictions": [
    {
      "id": "contradiction_1",
      "topic": "Subject of the contradiction",
      "claimantClaim": "Exactly what claimant says",
      "respondentClaim": "Exactly what respondent says",
      "severity": "minor|moderate|major",
      "analysis": "Explanation of why these are contradictory",
      "relatedFactIds": ["dispute_1", "dispute_2"],
      "caseImpact": "How this affects case resolution"
    }
  ],
  "summary": "Overall summary of contradictions and their significance"
}

Identify 2-6 contradictions, focusing on the most significant ones.
Respond with ONLY the JSON object, no other text.`;
}

/**
 * Prompt for credibility scoring
 */
export function buildCredibilityPrompt(
  claimantStatement: string,
  respondentStatement: string,
  claimantFacts: string,
  respondentFacts: string,
  contradictions: string,
  evidenceSummaries: EvidenceSummary[],
  caseContext: string
): string {
  const claimantEvidence = formatEvidenceSummaries(
    evidenceSummaries.filter((e) => e.submittedBy === 'claimant')
  );
  const respondentEvidence = formatEvidenceSummaries(
    evidenceSummaries.filter((e) => e.submittedBy === 'respondent')
  );

  return `You are a legal analyst assessing the credibility of parties in a dispute.

CASE CONTEXT:
${caseContext}

CLAIMANT'S STATEMENT:
"""
${claimantStatement}
"""

CLAIMANT'S EXTRACTED FACTS:
${claimantFacts}

CLAIMANT'S SUPPORTING EVIDENCE:
${claimantEvidence}

---

RESPONDENT'S STATEMENT:
"""
${respondentStatement}
"""

RESPONDENT'S EXTRACTED FACTS:
${respondentFacts}

RESPONDENT'S SUPPORTING EVIDENCE:
${respondentEvidence}

---

IDENTIFIED CONTRADICTIONS:
${contradictions}

TASK:
Assess the credibility of each party's account based on these factors:

1. EVIDENCE SUPPORT (0-1): How well is their account supported by documentary evidence?
   - Look for documents that corroborate their claims
   - Consider the quality and reliability of evidence

2. INTERNAL CONSISTENCY (0-1): Is their statement internally consistent?
   - Look for self-contradictions within their own statement
   - Check if their timeline makes logical sense

3. EXTERNAL CONSISTENCY (0-1): Is their account consistent with known facts?
   - Does it align with undisputed facts?
   - Is it consistent with evidence from neutral sources?

4. SPECIFICITY (0-1): How specific and detailed is their account?
   - Vague claims are less credible than specific ones
   - Names, dates, amounts add credibility

5. PLAUSIBILITY (0-1): How reasonable and believable is their account?
   - Does the story make logical sense?
   - Are their claimed actions reasonable given circumstances?

Calculate an overall score as weighted average:
- Evidence Support: 30%
- Internal Consistency: 20%
- External Consistency: 20%
- Specificity: 15%
- Plausibility: 15%

RESPOND WITH A JSON OBJECT:
{
  "claimant": {
    "overall": 0.75,
    "factors": {
      "evidenceSupport": 0.8,
      "internalConsistency": 0.9,
      "externalConsistency": 0.7,
      "specificity": 0.65,
      "plausibility": 0.7
    },
    "reasoning": "Explanation of claimant's credibility assessment",
    "strengths": ["Key strength 1", "Key strength 2"],
    "weaknesses": ["Key weakness 1", "Key weakness 2"]
  },
  "respondent": {
    "overall": 0.65,
    "factors": {
      "evidenceSupport": 0.6,
      "internalConsistency": 0.75,
      "externalConsistency": 0.65,
      "specificity": 0.6,
      "plausibility": 0.7
    },
    "reasoning": "Explanation of respondent's credibility assessment",
    "strengths": ["Key strength 1", "Key strength 2"],
    "weaknesses": ["Key weakness 1", "Key weakness 2"]
  },
  "comparison": "Comparative analysis of credibility between the parties"
}

Be objective and evidence-based in your assessment.
Respond with ONLY the JSON object, no other text.`;
}

/**
 * System prompt for fact analysis tasks
 */
export const FACT_ANALYSIS_SYSTEM_PROMPT = `You are an expert legal analyst specializing in dispute resolution. Your role is to analyze party statements and evidence objectively and thoroughly.

Key principles:
1. OBJECTIVITY: Analyze facts without bias toward either party
2. PRECISION: Extract specific, verifiable facts rather than vague assertions
3. MATERIALITY: Focus on facts relevant to resolving the dispute
4. EVIDENCE-BASED: Ground assessments in documented evidence when available
5. STRUCTURED OUTPUT: Always respond with valid JSON as specified

You are analyzing disputes in an online dispute resolution context, typically involving:
- Consumer disputes
- Small business disagreements
- Service contract issues
- Payment disputes
- Property damage claims

Apply appropriate legal standards while remaining accessible to non-lawyers.`;
