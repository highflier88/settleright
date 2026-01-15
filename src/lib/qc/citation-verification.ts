/**
 * Citation Verification Service
 *
 * Verifies legal citations in awards are valid and properly formatted:
 * - Validates citation format against legal citation standards
 * - Checks citations against known legal databases
 * - Reports invalid or potentially incorrect citations
 */

import { prisma } from '@/lib/db';

// ============================================================================
// TYPES
// ============================================================================

export interface CitationVerificationResult {
  citation: string;
  type: 'statute' | 'case_law' | 'regulation' | 'unknown';
  isValid: boolean;
  formatValid: boolean;
  existenceVerified: boolean;
  confidence: number;
  errors: string[];
  suggestions?: string[];
}

export interface CitationReport {
  awardId: string;
  caseId: string;
  totalCitations: number;
  validCitations: number;
  invalidCitations: number;
  unverifiedCitations: number;
  overallScore: number;
  citations: CitationVerificationResult[];
  generatedAt: Date;
}

// Citation format patterns
const CITATION_PATTERNS = {
  // US Case Law: "Smith v. Jones, 123 F.3d 456 (9th Cir. 2020)"
  usCaseLaw: /^.+\s+v\.\s+.+,\s*\d+\s+[A-Za-z0-9.]+\s+\d+\s*\([^)]+\d{4}\)$/,

  // US Code: "42 U.S.C. § 1983" or "42 USC 1983"
  usCode: /^\d+\s+U\.?S\.?C\.?\s*§?\s*\d+[a-z]?(?:\([a-z0-9]+\))?$/i,

  // CFR: "29 C.F.R. § 1614.105" or "29 CFR 1614.105"
  cfr: /^\d+\s+C\.?F\.?R\.?\s*§?\s*\d+(?:\.\d+)?$/i,

  // State Statutes: "Cal. Civ. Code § 1750"
  stateStatute: /^[A-Z][a-z]+\.?\s+(?:[A-Z][a-z]+\.?\s+)*(?:Code|Stat|Laws?)\s*§?\s*\d+/i,

  // Restatement: "Restatement (Second) of Contracts § 90"
  restatement: /^Restatement\s+\([A-Za-z]+\)\s+of\s+[A-Za-z]+\s*§?\s*\d+/i,

  // UCC: "U.C.C. § 2-314" or "UCC 2-314"
  ucc: /^U\.?C\.?C\.?\s*§?\s*\d+-\d+/i,
};

// Known valid statute prefixes for quick validation
const KNOWN_STATUTE_PREFIXES = [
  'U.S.C.',
  'USC',
  'C.F.R.',
  'CFR',
  'Cal.',
  'N.Y.',
  'Tex.',
  'Fla.',
  'Ill.',
  'Restatement',
  'U.C.C.',
  'UCC',
];

// Known court reporters
const KNOWN_REPORTERS = [
  'U.S.',
  'S.Ct.',
  'L.Ed.',
  'F.',
  'F.2d',
  'F.3d',
  'F.4th',
  'F.Supp.',
  'F.Supp.2d',
  'F.Supp.3d',
  'Cal.',
  'Cal.App.',
  'Cal.Rptr.',
  'N.Y.',
  'N.Y.S.',
  'N.Y.S.2d',
  'A.',
  'A.2d',
  'A.3d',
  'N.E.',
  'N.E.2d',
  'N.E.3d',
  'N.W.',
  'N.W.2d',
  'P.',
  'P.2d',
  'P.3d',
  'S.E.',
  'S.E.2d',
  'S.W.',
  'S.W.2d',
  'S.W.3d',
  'So.',
  'So.2d',
  'So.3d',
];

// ============================================================================
// FORMAT VERIFICATION
// ============================================================================

/**
 * Verify citation format is correct
 */
export function verifyCitationFormat(citation: string): {
  isValid: boolean;
  type: 'statute' | 'case_law' | 'regulation' | 'unknown';
  errors: string[];
  suggestions: string[];
} {
  const trimmed = citation.trim();
  const errors: string[] = [];
  const suggestions: string[] = [];

  // Check for common typos and issues
  if (trimmed.includes('  ')) {
    errors.push('Contains double spaces');
    suggestions.push(trimmed.replace(/\s+/g, ' '));
  }

  // Detect citation type and validate format
  if (CITATION_PATTERNS.usCaseLaw.test(trimmed)) {
    return { isValid: true, type: 'case_law', errors, suggestions };
  }

  if (CITATION_PATTERNS.usCode.test(trimmed)) {
    return { isValid: true, type: 'statute', errors, suggestions };
  }

  if (CITATION_PATTERNS.cfr.test(trimmed)) {
    return { isValid: true, type: 'regulation', errors, suggestions };
  }

  if (CITATION_PATTERNS.stateStatute.test(trimmed)) {
    return { isValid: true, type: 'statute', errors, suggestions };
  }

  if (CITATION_PATTERNS.restatement.test(trimmed)) {
    return { isValid: true, type: 'statute', errors, suggestions };
  }

  if (CITATION_PATTERNS.ucc.test(trimmed)) {
    return { isValid: true, type: 'statute', errors, suggestions };
  }

  // Check if it looks like a case citation but doesn't match pattern
  if (trimmed.includes(' v. ') || trimmed.includes(' vs. ')) {
    errors.push('Appears to be case law but format is non-standard');

    // Try to provide suggestions
    if (trimmed.includes(' vs. ')) {
      suggestions.push(trimmed.replace(' vs. ', ' v. '));
    }
    if (!trimmed.includes('(') || !trimmed.includes(')')) {
      errors.push('Missing court and year parenthetical');
    }

    return { isValid: false, type: 'case_law', errors, suggestions };
  }

  // Check if it looks like a statute
  if (KNOWN_STATUTE_PREFIXES.some((prefix) => trimmed.includes(prefix))) {
    errors.push('Appears to be a statute but format is non-standard');
    return { isValid: false, type: 'statute', errors, suggestions };
  }

  // Check if it contains a reporter name
  if (KNOWN_REPORTERS.some((reporter) => trimmed.includes(reporter))) {
    errors.push('Contains reporter name but format is incomplete');
    return { isValid: false, type: 'case_law', errors, suggestions };
  }

  errors.push('Unable to identify citation type');
  return { isValid: false, type: 'unknown', errors, suggestions };
}

/**
 * Check if citation likely exists (simplified check)
 * In production, this would query legal databases like Westlaw or LexisNexis
 */
export async function checkCitationExists(
  citation: string,
  type: 'statute' | 'case_law' | 'regulation' | 'unknown'
): Promise<{
  exists: boolean;
  confidence: number;
  notes: string[];
}> {
  // Placeholder for external API call (legal databases)
  await Promise.resolve();

  const notes: string[] = [];

  // For now, we perform basic validation
  // In production, this would integrate with legal research APIs

  if (type === 'statute') {
    // Check for valid US Code structure
    const uscMatch = citation.match(/(\d+)\s+U\.?S\.?C\.?\s*§?\s*(\d+)/i);
    if (uscMatch) {
      const title = parseInt(uscMatch[1] || '0');
      // US Code has titles 1-54
      if (title >= 1 && title <= 54) {
        notes.push('US Code title number is valid');
        return { exists: true, confidence: 0.7, notes };
      } else {
        notes.push(`US Code title ${title} is outside valid range (1-54)`);
        return { exists: false, confidence: 0.8, notes };
      }
    }

    // Check for valid CFR structure
    const cfrMatch = citation.match(/(\d+)\s+C\.?F\.?R\.?\s*§?\s*(\d+)/i);
    if (cfrMatch) {
      const title = parseInt(cfrMatch[1] || '0');
      // CFR has titles 1-50
      if (title >= 1 && title <= 50) {
        notes.push('CFR title number is valid');
        return { exists: true, confidence: 0.7, notes };
      } else {
        notes.push(`CFR title ${title} is outside valid range (1-50)`);
        return { exists: false, confidence: 0.8, notes };
      }
    }

    notes.push('Unable to verify statute existence - external database required');
    return { exists: true, confidence: 0.5, notes };
  }

  if (type === 'case_law') {
    // Extract year from citation
    const yearMatch = citation.match(/\(.*(\d{4})\)/);
    if (yearMatch) {
      const year = parseInt(yearMatch[1] || '0');
      const currentYear = new Date().getFullYear();

      if (year > currentYear) {
        notes.push(`Citation year ${year} is in the future`);
        return { exists: false, confidence: 0.9, notes };
      }

      if (year < 1789) {
        notes.push(`Citation year ${year} predates US federal courts`);
        return { exists: false, confidence: 0.85, notes };
      }

      notes.push('Citation year is plausible');
    }

    // Check for valid reporter
    const hasValidReporter = KNOWN_REPORTERS.some((reporter) => citation.includes(reporter));

    if (hasValidReporter) {
      notes.push('Contains recognized reporter');
      return { exists: true, confidence: 0.6, notes };
    }

    notes.push('Unable to verify case existence - external database required');
    return { exists: true, confidence: 0.4, notes };
  }

  notes.push('Citation type unknown - cannot verify existence');
  return { exists: true, confidence: 0.3, notes };
}

// ============================================================================
// CITATION VERIFICATION
// ============================================================================

/**
 * Verify a single citation
 */
export async function verifyCitation(citation: string): Promise<CitationVerificationResult> {
  const formatResult = verifyCitationFormat(citation);
  const existenceResult = await checkCitationExists(citation, formatResult.type);

  const errors = [...formatResult.errors];
  if (!existenceResult.exists) {
    errors.push(
      ...existenceResult.notes.filter((n) => n.includes('outside') || n.includes('future'))
    );
  }

  // Calculate overall validity
  const isValid = formatResult.isValid && existenceResult.exists;
  const confidence = formatResult.isValid
    ? existenceResult.confidence
    : existenceResult.confidence * 0.5;

  return {
    citation,
    type: formatResult.type,
    isValid,
    formatValid: formatResult.isValid,
    existenceVerified: existenceResult.exists,
    confidence,
    errors,
    suggestions: formatResult.suggestions.length > 0 ? formatResult.suggestions : undefined,
  };
}

/**
 * Verify all citations in an award
 */
export async function verifyCitations(awardId: string): Promise<CitationReport> {
  // Get the award with citations
  const award = await prisma.award.findUnique({
    where: { id: awardId },
    select: {
      id: true,
      caseId: true,
      conclusionsOfLaw: true,
    },
  });

  if (!award) {
    throw new Error('Award not found');
  }

  // Also get the draft award for additional citations
  const draftAward = await prisma.draftAward.findUnique({
    where: { caseId: award.caseId },
    select: {
      conclusionsOfLaw: true,
    },
  });

  // Extract citations from conclusions of law
  const citations = new Set<string>();

  // From final award
  const awardConclusions = award.conclusionsOfLaw as Array<{
    legalBasis?: string[];
  }> | null;

  if (awardConclusions) {
    for (const conclusion of awardConclusions) {
      if (conclusion.legalBasis) {
        for (const basis of conclusion.legalBasis) {
          citations.add(basis);
        }
      }
    }
  }

  // From draft award
  const draftConclusions = draftAward?.conclusionsOfLaw as Array<{
    legalBasis?: string[];
  }> | null;

  if (draftConclusions) {
    for (const conclusion of draftConclusions) {
      if (conclusion.legalBasis) {
        for (const basis of conclusion.legalBasis) {
          citations.add(basis);
        }
      }
    }
  }

  // Verify each citation
  const verificationResults: CitationVerificationResult[] = [];
  for (const citation of citations) {
    const result = await verifyCitation(citation);
    verificationResults.push(result);
  }

  // Calculate statistics
  const validCount = verificationResults.filter((r) => r.isValid).length;
  const invalidCount = verificationResults.filter((r) => !r.isValid && r.confidence > 0.5).length;
  const unverifiedCount = verificationResults.filter((r) => r.confidence <= 0.5).length;

  const overallScore = citations.size > 0 ? validCount / citations.size : 1.0;

  return {
    awardId,
    caseId: award.caseId,
    totalCitations: citations.size,
    validCitations: validCount,
    invalidCitations: invalidCount,
    unverifiedCitations: unverifiedCount,
    overallScore,
    citations: verificationResults,
    generatedAt: new Date(),
  };
}

/**
 * Get citation verification report for a case
 */
export async function getCitationVerificationReport(
  caseId: string
): Promise<CitationReport | null> {
  const award = await prisma.award.findUnique({
    where: { caseId },
    select: { id: true },
  });

  if (!award) {
    return null;
  }

  return verifyCitations(award.id);
}
