/**
 * California Jurisdiction Rules
 *
 * California-specific legal rules, statutes of limitations,
 * interest rates, and special provisions.
 */

import type { JurisdictionRules, InterestParams, InterestResult, DamagesCap } from './types';

/**
 * California jurisdiction rules
 */
export const CALIFORNIA_RULES: JurisdictionRules = {
  jurisdiction: 'US-CA',
  displayName: 'California',

  // Small claims limits
  smallClaimsLimit: 12500, // $12,500 for individuals
  smallClaimsLimitBusiness: 6250, // $6,250 for businesses (max 2 claims/year over $2,500)

  // Statute of limitations (in years)
  statuteOfLimitations: {
    written_contract: 4, // Cal. Code Civ. Proc. § 337
    oral_contract: 2, // Cal. Code Civ. Proc. § 339
    breach_of_warranty: 4, // Cal. Com. Code § 2725
    fraud: 3, // Cal. Code Civ. Proc. § 338(d)
    negligence: 2, // Cal. Code Civ. Proc. § 335.1
    property_damage: 3, // Cal. Code Civ. Proc. § 338
    personal_injury: 2, // Cal. Code Civ. Proc. § 335.1
    consumer_protection: 4, // CLRA - Cal. Civ. Code § 1783
    unjust_enrichment: 4, // General assumpsit
    account_stated: 4, // Cal. Code Civ. Proc. § 337
    open_book_account: 4, // Cal. Code Civ. Proc. § 337
  },

  // Interest rates
  defaultInterestRate: 0.07, // 7% legal rate (Cal. Civ. Code § 3289(a))
  prejudgmentInterestRate: 0.1, // 10% on contracts (Cal. Civ. Code § 3289(b))
  postjudgmentInterestRate: 0.1, // 10% (Cal. Code Civ. Proc. § 685.010)

  // Consumer protection statutes
  consumerProtectionStatutes: [
    'Cal. Civ. Code § 1750-1784 (CLRA - Consumers Legal Remedies Act)',
    'Cal. Bus. & Prof. Code § 17200-17210 (UCL - Unfair Competition Law)',
    'Cal. Bus. & Prof. Code § 17500-17509 (FAL - False Advertising Law)',
    'Cal. Com. Code § 2314 (Implied Warranty of Merchantability)',
    'Cal. Com. Code § 2315 (Implied Warranty of Fitness)',
    'Cal. Civ. Code § 1791-1795.8 (Song-Beverly Consumer Warranty Act)',
  ],

  // Contract statutes
  contractStatutes: [
    'Cal. Civ. Code § 1549 (Essential Elements of Contract)',
    'Cal. Civ. Code § 1550 (Contract Requirements)',
    'Cal. Civ. Code § 1565-1567 (Consent)',
    'Cal. Civ. Code § 1619-1633 (Contract Interpretation)',
    'Cal. Civ. Code § 1668 (Contracts Against Public Policy)',
    'Cal. Civ. Code § 3300 (Contract Damages - General Rule)',
    'Cal. Civ. Code § 3301 (Damages for Breach)',
    'Cal. Civ. Code § 3358 (Certain Damages)',
    'Cal. Civ. Code § 3289 (Prejudgment Interest)',
  ],

  // Commercial/payment statutes
  commercialStatutes: [
    'Cal. Com. Code § 2301-2328 (Obligations of Seller)',
    'Cal. Com. Code § 2601-2616 (Buyer Remedies)',
    'Cal. Com. Code § 2703-2725 (Seller Remedies)',
    'Cal. Civ. Code § 1717 (Attorney Fees - Contracts)',
  ],

  // Default burden of proof
  defaultBurdenStandard: 'preponderance',

  // Issues requiring elevated burden
  elevatedBurdenIssues: {
    fraud: 'clear_and_convincing',
    punitive_damages: 'clear_and_convincing',
    reformation: 'clear_and_convincing',
    undue_influence: 'clear_and_convincing',
  },

  // Special rules
  specialRules: [
    {
      id: 'clra_minimum_damages',
      category: 'consumer_protection',
      rule: 'CLRA provides minimum $1,000 actual damages for any violation',
      conditions: ['CLRA violation established', 'Consumer transaction'],
      effect: 'Award minimum $1,000 even if actual damages are less',
      statutoryBasis: 'Cal. Civ. Code § 1780(a)(1)',
    },
    {
      id: 'clra_treble_damages',
      category: 'consumer_protection',
      rule: 'CLRA allows treble damages for willful violations up to $5,000',
      conditions: ['Willful CLRA violation', 'Consumer transaction'],
      effect: 'May treble damages up to additional $5,000',
      statutoryBasis: 'Cal. Civ. Code § 1780(a)(1)',
    },
    {
      id: 'ucl_restitution',
      category: 'consumer_protection',
      rule: 'UCL provides only restitution, not damages',
      conditions: ['UCL claim', 'No concurrent damages claim'],
      effect: 'Limit recovery to restitution of money or property',
      statutoryBasis: 'Cal. Bus. & Prof. Code § 17203',
    },
    {
      id: 'prejudgment_interest_contracts',
      category: 'damages',
      rule: '10% prejudgment interest on contract damages from date certain',
      conditions: ['Contract claim', 'Damages certain or capable of being made certain'],
      effect: 'Award 10% annual interest from date of breach/demand',
      statutoryBasis: 'Cal. Civ. Code § 3289(b)',
    },
    {
      id: 'attorney_fee_shifting',
      category: 'fees',
      rule: 'Prevailing party entitled to attorney fees if contract provides',
      conditions: ['Contract contains attorney fee provision'],
      effect: 'Award reasonable attorney fees to prevailing party',
      statutoryBasis: 'Cal. Civ. Code § 1717',
    },
    {
      id: 'mitigation_duty',
      category: 'damages',
      rule: 'Claimant must take reasonable steps to mitigate damages',
      conditions: ['Breach established', 'Opportunity to mitigate existed'],
      effect: 'Reduce damages by amount that could have been avoided',
      statutoryBasis: 'Cal. Civ. Code § 3358',
    },
    {
      id: 'consequential_damages_foreseeability',
      category: 'damages',
      rule: 'Consequential damages must be foreseeable at time of contracting',
      conditions: ['Contract claim', 'Consequential damages sought'],
      effect: 'Award only damages that were reasonably foreseeable',
      statutoryBasis: 'Cal. Civ. Code § 3300',
    },
    {
      id: 'certainty_of_damages',
      category: 'damages',
      rule: 'Damages must be proven with reasonable certainty',
      conditions: ['Damages claim'],
      effect: 'Deny speculative damages lacking evidentiary support',
      statutoryBasis: 'Cal. Civ. Code § 3301',
    },
  ],
};

/**
 * Calculate prejudgment interest under California law
 */
export function calculateCaliforniaInterest(params: InterestParams): InterestResult {
  const { principal, startDate, endDate, isContractClaim, customRate } = params;

  // Determine applicable rate
  let rate: number;
  let statutoryBasis: string;

  if (customRate !== undefined) {
    rate = customRate;
    statutoryBasis = 'Contractual rate';
  } else if (isContractClaim) {
    rate = CALIFORNIA_RULES.prejudgmentInterestRate;
    statutoryBasis = 'Cal. Civ. Code § 3289(b)';
  } else {
    rate = CALIFORNIA_RULES.defaultInterestRate;
    statutoryBasis = 'Cal. Civ. Code § 3289(a)';
  }

  // Calculate days
  const msPerDay = 1000 * 60 * 60 * 24;
  const days = Math.floor((endDate.getTime() - startDate.getTime()) / msPerDay);

  // Calculate simple interest
  const years = days / 365;
  const amount = Math.round(principal * rate * years * 100) / 100;

  return {
    amount,
    rate,
    days,
    statutoryBasis,
  };
}

/**
 * Get applicable California statutes for a dispute type
 */
export function getCaliforniaStatutes(disputeType: string, issues: string[] = []): string[] {
  const statutes: string[] = [];

  // Always include basic contract formation
  statutes.push(
    'Cal. Civ. Code § 1549 (Essential Elements of Contract)',
    'Cal. Civ. Code § 1550 (Contract Requirements)'
  );

  // Add by dispute type
  switch (disputeType.toUpperCase()) {
    case 'CONTRACT':
      statutes.push(...CALIFORNIA_RULES.contractStatutes);
      break;

    case 'SERVICE':
    case 'GOODS':
      statutes.push(...CALIFORNIA_RULES.consumerProtectionStatutes);
      statutes.push(...CALIFORNIA_RULES.contractStatutes.slice(0, 4));
      break;

    case 'PAYMENT':
      statutes.push(
        'Cal. Civ. Code § 3289 (Prejudgment Interest)',
        'Cal. Com. Code § 3104 (Negotiable Instruments)'
      );
      statutes.push(...CALIFORNIA_RULES.contractStatutes.slice(0, 4));
      break;

    default:
      statutes.push(...CALIFORNIA_RULES.contractStatutes.slice(0, 6));
  }

  // Add based on specific issues
  if (issues.includes('fraud')) {
    statutes.push(
      'Cal. Civ. Code § 1709 (Deceit)',
      'Cal. Civ. Code § 1710 (Types of Deceit)',
      'Cal. Civ. Code § 1572 (Actual Fraud)'
    );
  }

  if (issues.includes('consumer_protection') || issues.includes('warranty')) {
    statutes.push(...CALIFORNIA_RULES.consumerProtectionStatutes);
  }

  if (issues.includes('unjust_enrichment')) {
    statutes.push(
      'Cal. Civ. Code § 1580-1585 (Restitution)',
      'Restatement (Third) of Restitution (persuasive authority)'
    );
  }

  // Deduplicate
  return [...new Set(statutes)];
}

/**
 * Get damages caps for California
 */
export function getCaliforniaDamagesCaps(disputeType: string): DamagesCap[] {
  const caps: DamagesCap[] = [];

  // CLRA damages cap
  if (['SERVICE', 'GOODS'].includes(disputeType.toUpperCase())) {
    caps.push({
      type: 'statutory',
      maxAmount: 5000,
      statutoryBasis: 'Cal. Civ. Code § 1780(a)(1)',
      conditions: ['CLRA violation', 'Treble damages sought'],
    });
  }

  // Punitive damages cap
  caps.push({
    type: 'punitive',
    maxMultiplier: 10, // General guideline, not statutory
    conditions: [
      'Clear and convincing evidence of oppression, fraud, or malice',
      'Cal. Civ. Code § 3294',
    ],
  });

  return caps;
}

/**
 * Check statute of limitations for California
 */
export function checkCaliforniaSOL(
  issueType: string,
  dateOfBreach: Date
): { withinLimit: boolean; limitYears: number; expirationDate: Date } {
  // Map issue type to SOL category
  const solMapping: Record<string, string> = {
    breach_of_contract: 'written_contract',
    breach_contract: 'written_contract',
    contract: 'written_contract',
    oral_contract: 'oral_contract',
    warranty: 'breach_of_warranty',
    fraud: 'fraud',
    negligence: 'negligence',
    property_damage: 'property_damage',
    consumer_protection: 'consumer_protection',
    unjust_enrichment: 'unjust_enrichment',
  };

  const solKey = solMapping[issueType.toLowerCase()] || 'written_contract';
  const limitYears = CALIFORNIA_RULES.statuteOfLimitations[solKey] || 4;

  const expirationDate = new Date(dateOfBreach);
  expirationDate.setFullYear(expirationDate.getFullYear() + limitYears);

  const now = new Date();
  const withinLimit = now < expirationDate;

  return {
    withinLimit,
    limitYears,
    expirationDate,
  };
}

/**
 * Get California special rules for a category
 */
export function getCaliforniaSpecialRules(category: string) {
  return CALIFORNIA_RULES.specialRules.filter((rule) => rule.category === category);
}

/**
 * Format California citation for display
 */
export function formatCaliforniaCitation(code: string, section: string): string {
  const codeAbbreviations: Record<string, string> = {
    civil: 'Cal. Civ. Code',
    'civil code': 'Cal. Civ. Code',
    ccp: 'Cal. Code Civ. Proc.',
    'code of civil procedure': 'Cal. Code Civ. Proc.',
    commercial: 'Cal. Com. Code',
    'commercial code': 'Cal. Com. Code',
    'business and professions': 'Cal. Bus. & Prof. Code',
    'bus & prof': 'Cal. Bus. & Prof. Code',
  };

  const abbrev = codeAbbreviations[code.toLowerCase()] || code;
  return `${abbrev} § ${section}`;
}
