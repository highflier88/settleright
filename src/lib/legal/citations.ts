/**
 * Legal Citation Parser
 *
 * Parses and validates legal citations for California statutes, case law,
 * and federal regulations. Handles common citation formats.
 */

// Citation types
export type CitationType = 'statute' | 'case_law' | 'regulation' | 'unknown';

export interface ParsedCitation {
  type: CitationType;
  original: string;
  normalized: string;
  isValid: boolean;
  components: {
    code?: string;
    section?: string;
    subsection?: string;
    title?: string;
    volume?: string;
    reporter?: string;
    page?: string;
    year?: number;
    court?: string;
    caseName?: string;
  };
}

// California Code abbreviations
const CA_CODE_ABBREVIATIONS: Record<string, string> = {
  civ: 'Cal. Civ. Code',
  'civ.': 'Cal. Civ. Code',
  civil: 'Cal. Civ. Code',
  ccp: 'Cal. Code Civ. Proc.',
  'c.c.p.': 'Cal. Code Civ. Proc.',
  'code civ. proc.': 'Cal. Code Civ. Proc.',
  'bus. & prof.': 'Cal. Bus. & Prof. Code',
  'b&p': 'Cal. Bus. & Prof. Code',
  com: 'Cal. Com. Code',
  comm: 'Cal. Com. Code',
  commercial: 'Cal. Com. Code',
  fam: 'Cal. Fam. Code',
  family: 'Cal. Fam. Code',
  gov: 'Cal. Gov. Code',
  govt: 'Cal. Gov. Code',
  government: 'Cal. Gov. Code',
  lab: 'Cal. Lab. Code',
  labor: 'Cal. Lab. Code',
  pen: 'Cal. Penal Code',
  penal: 'Cal. Penal Code',
  prob: 'Cal. Prob. Code',
  probate: 'Cal. Prob. Code',
  veh: 'Cal. Veh. Code',
  vehicle: 'Cal. Veh. Code',
  'welf. & inst.': 'Cal. Welf. & Inst. Code',
  'w&i': 'Cal. Welf. & Inst. Code',
  'health & saf.': 'Cal. Health & Safety Code',
  'h&s': 'Cal. Health & Safety Code',
  ins: 'Cal. Ins. Code',
  insurance: 'Cal. Ins. Code',
  corp: 'Cal. Corp. Code',
  corporations: 'Cal. Corp. Code',
  evid: 'Cal. Evid. Code',
  evidence: 'Cal. Evid. Code',
};

// California court reporters
const CA_REPORTERS = [
  'Cal.',
  'Cal.2d',
  'Cal.3d',
  'Cal.4th',
  'Cal.5th',
  'Cal.App.',
  'Cal.App.2d',
  'Cal.App.3d',
  'Cal.App.4th',
  'Cal.App.5th',
  'Cal.Rptr.',
  'Cal.Rptr.2d',
  'Cal.Rptr.3d',
];

// Federal reporters
const FEDERAL_REPORTERS = [
  'U.S.',
  'S.Ct.',
  'L.Ed.',
  'L.Ed.2d',
  'F.',
  'F.2d',
  'F.3d',
  'F.4th',
  'F.Supp.',
  'F.Supp.2d',
  'F.Supp.3d',
];

/**
 * Parse a California statute citation
 * Examples:
 * - Cal. Civ. Code § 1668
 * - Civ. Code § 1550-1560
 * - CCP § 337
 * - Cal. Code Civ. Proc. § 116.110
 */
function parseCaliforniaStatute(citation: string): ParsedCitation | null {
  // Pattern for California statutes
  const patterns = [
    // Full format: Cal. Civ. Code § 1668
    /(?:Cal(?:ifornia)?\.?\s+)?([A-Za-z&.\s]+?)(?:\s+Code)?\s*[§|section|sec\.?]\s*([\d.]+(?:\s*[-–]\s*[\d.]+)?)\s*(?:\(([a-z\d]+)\))?/i,
    // Short format: CCP § 337
    /([A-Z&]+)\s*[§|section|sec\.?]\s*([\d.]+(?:\s*[-–]\s*[\d.]+)?)\s*(?:\(([a-z\d]+)\))?/i,
  ];

  for (const pattern of patterns) {
    const match = citation.match(pattern);
    if (match && match[1] && match[2]) {
      const codePart = match[1].toLowerCase().trim();
      const section = match[2].replace(/\s+/g, '');
      const subsection = match[3];

      // Normalize code name
      const normalizedCode =
        CA_CODE_ABBREVIATIONS[codePart] ||
        Object.entries(CA_CODE_ABBREVIATIONS).find(([key]) =>
          codePart.includes(key.replace('.', ''))
        )?.[1];

      if (normalizedCode) {
        const normalized = subsection
          ? `${normalizedCode} § ${section}(${subsection})`
          : `${normalizedCode} § ${section}`;

        return {
          type: 'statute',
          original: citation,
          normalized,
          isValid: true,
          components: {
            code: normalizedCode,
            section,
            subsection,
          },
        };
      }
    }
  }

  return null;
}

/**
 * Parse a case law citation
 * Examples:
 * - Smith v. Jones, 42 Cal.4th 123 (2008)
 * - ABC Corp. v. XYZ Inc., 100 Cal.App.5th 456, 789 Cal.Rptr.3d 012 (2023)
 * - 567 U.S. 123 (2015)
 */
function parseCaseLaw(citation: string): ParsedCitation | null {
  // Check for reporter citation
  const allReporters = [...CA_REPORTERS, ...FEDERAL_REPORTERS];
  const reporterPattern = new RegExp(
    `(\\d+)\\s+(${allReporters.map((r) => r.replace('.', '\\.')).join('|')})\\s+(\\d+)`,
    'i'
  );

  const reporterMatch = citation.match(reporterPattern);
  if (!reporterMatch) {
    return null;
  }

  const volume = reporterMatch[1];
  const reporter = reporterMatch[2];
  const page = reporterMatch[3];

  // Try to extract case name
  const caseNameMatch = citation.match(/^(.+?)\s*,?\s*\d+\s/);
  const caseName = caseNameMatch?.[1]?.trim();

  // Try to extract year
  const yearMatch = citation.match(/\((\d{4})\)/);
  const year = yearMatch?.[1] ? parseInt(yearMatch[1], 10) : undefined;

  // Determine court from reporter
  let court: string | undefined;
  if (reporter && reporter.startsWith('Cal.App')) {
    court = 'Cal. Ct. App.';
  } else if (reporter && reporter.startsWith('Cal.')) {
    court = 'Cal.';
  } else if (reporter && (reporter.includes('U.S.') || reporter.includes('S.Ct'))) {
    court = 'U.S.';
  } else if (reporter && reporter.startsWith('F.')) {
    court = 'Federal';
  }

  const normalized = caseName
    ? `${caseName}, ${volume} ${reporter} ${page}${year ? ` (${year})` : ''}`
    : `${volume} ${reporter} ${page}${year ? ` (${year})` : ''}`;

  return {
    type: 'case_law',
    original: citation,
    normalized,
    isValid: true,
    components: {
      caseName,
      volume,
      reporter,
      page,
      year,
      court,
    },
  };
}

/**
 * Parse a federal regulation citation (CFR)
 * Examples:
 * - 12 C.F.R. § 1002.1
 * - 16 CFR 433
 */
function parseFederalRegulation(citation: string): ParsedCitation | null {
  const pattern = /(\d+)\s*C\.?F\.?R\.?\s*[§]?\s*([\d.]+)/i;
  const match = citation.match(pattern);

  if (match) {
    const title = match[1];
    const section = match[2];
    const normalized = `${title} C.F.R. § ${section}`;

    return {
      type: 'regulation',
      original: citation,
      normalized,
      isValid: true,
      components: {
        title,
        section,
      },
    };
  }

  return null;
}

/**
 * Parse any legal citation
 */
export function parseCitation(citation: string): ParsedCitation {
  const trimmed = citation.trim();

  // Try each parser in order
  const statuteResult = parseCaliforniaStatute(trimmed);
  if (statuteResult) return statuteResult;

  const caseResult = parseCaseLaw(trimmed);
  if (caseResult) return caseResult;

  const regulationResult = parseFederalRegulation(trimmed);
  if (regulationResult) return regulationResult;

  // Unknown citation type
  return {
    type: 'unknown',
    original: citation,
    normalized: trimmed,
    isValid: false,
    components: {},
  };
}

/**
 * Extract all citations from text
 */
export function extractCitations(text: string): ParsedCitation[] {
  const citations: ParsedCitation[] = [];
  const seen = new Set<string>();

  // Patterns to find potential citations
  const citationPatterns = [
    // Statutes: § followed by numbers
    /(?:[A-Za-z.&\s]+(?:Code)?)\s*[§]\s*[\d.]+(?:\s*[-–]\s*[\d.]+)?(?:\([a-z\d]+\))?/gi,
    // Case citations: number + reporter + number
    /\d+\s+(?:Cal|U\.S|S\.Ct|F)\.[^\s,]+\s+\d+/gi,
    // CFR citations
    /\d+\s*C\.?F\.?R\.?\s*[§]?\s*[\d.]+/gi,
  ];

  for (const pattern of citationPatterns) {
    let match;
    while ((match = pattern.exec(text)) !== null) {
      const citationText = match[0].trim();
      if (!seen.has(citationText.toLowerCase())) {
        seen.add(citationText.toLowerCase());
        const parsed = parseCitation(citationText);
        if (parsed.isValid) {
          citations.push(parsed);
        }
      }
    }
  }

  return citations;
}

/**
 * Validate a citation format
 */
export function validateCitation(citation: string): {
  isValid: boolean;
  type: CitationType;
  normalized?: string;
  error?: string;
} {
  const parsed = parseCitation(citation);

  if (!parsed.isValid) {
    return {
      isValid: false,
      type: 'unknown',
      error: 'Unable to parse citation format',
    };
  }

  return {
    isValid: true,
    type: parsed.type,
    normalized: parsed.normalized,
  };
}

/**
 * Generate a URL for looking up a citation (when available)
 */
export function getCitationUrl(parsed: ParsedCitation): string | null {
  if (parsed.type === 'statute' && parsed.components.code?.includes('Cal.')) {
    // California Legislative Information
    const codeMap: Record<string, string> = {
      'Cal. Civ. Code': 'CIV',
      'Cal. Code Civ. Proc.': 'CCP',
      'Cal. Bus. & Prof. Code': 'BPC',
      'Cal. Com. Code': 'COM',
      'Cal. Fam. Code': 'FAM',
      'Cal. Gov. Code': 'GOV',
      'Cal. Lab. Code': 'LAB',
      'Cal. Penal Code': 'PEN',
      'Cal. Prob. Code': 'PROB',
      'Cal. Veh. Code': 'VEH',
      'Cal. Health & Safety Code': 'HSC',
      'Cal. Ins. Code': 'INS',
      'Cal. Corp. Code': 'CORP',
      'Cal. Evid. Code': 'EVID',
    };

    const codeSlug = codeMap[parsed.components.code || ''];
    if (codeSlug && parsed.components.section) {
      const section = parsed.components.section.split('-')[0]; // Take first section if range
      return `https://leginfo.legislature.ca.gov/faces/codes_displaySection.xhtml?lawCode=${codeSlug}&sectionNum=${section}`;
    }
  }

  if (parsed.type === 'regulation' && parsed.components.title) {
    // eCFR link
    return `https://www.ecfr.gov/current/title-${parsed.components.title}/section-${parsed.components.section}`;
  }

  if (parsed.type === 'case_law' && parsed.components.volume && parsed.components.reporter) {
    // CourtListener search
    const query = encodeURIComponent(parsed.normalized);
    return `https://www.courtlistener.com/?q=${query}`;
  }

  return null;
}

/**
 * Format a citation for display
 */
export function formatCitation(parsed: ParsedCitation): string {
  if (parsed.type === 'statute') {
    const { code, section, subsection } = parsed.components;
    if (subsection) {
      return `${code} § ${section}(${subsection})`;
    }
    return `${code} § ${section}`;
  }

  if (parsed.type === 'case_law') {
    const { caseName, volume, reporter, page, year } = parsed.components;
    let formatted = '';
    if (caseName) {
      formatted += `${caseName}, `;
    }
    formatted += `${volume} ${reporter} ${page}`;
    if (year) {
      formatted += ` (${year})`;
    }
    return formatted;
  }

  if (parsed.type === 'regulation') {
    const { title, section } = parsed.components;
    return `${title} C.F.R. § ${section}`;
  }

  return parsed.normalized;
}

/**
 * Compare two citations for equality
 */
export function citationsEqual(a: string, b: string): boolean {
  const parsedA = parseCitation(a);
  const parsedB = parseCitation(b);

  return parsedA.normalized.toLowerCase() === parsedB.normalized.toLowerCase();
}
