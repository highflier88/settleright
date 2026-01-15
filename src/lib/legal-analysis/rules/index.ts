/**
 * Jurisdiction Rules Engine
 *
 * Centralized rule engine for jurisdiction-specific legal rules.
 * Currently supports California (US-CA).
 */

import {
  CALIFORNIA_RULES,
  calculateCaliforniaInterest,
  checkCaliforniaSOL,
  formatCaliforniaCitation,
  getCaliforniaDamagesCaps,
  getCaliforniaSpecialRules,
  getCaliforniaStatutes,
} from './california';

import type { BurdenOfProofStandard } from '../types';
import type {
  DamagesCap,
  InterestParams,
  InterestResult,
  JurisdictionRules,
  RuleEngine,
  SpecialRule,
} from './types';

// Re-export types
export type {
  DamagesCap,
  InterestParams,
  InterestResult,
  JurisdictionRules,
  RuleEngine,
  SpecialRule,
} from './types';

/**
 * Registry of supported jurisdictions
 */
const JURISDICTION_REGISTRY: Record<string, JurisdictionRules> = {
  'US-CA': CALIFORNIA_RULES,
};

/**
 * Get rules for a jurisdiction
 */
export function getRules(jurisdiction: string): JurisdictionRules | null {
  return JURISDICTION_REGISTRY[jurisdiction] || null;
}

/**
 * Check if a jurisdiction is supported
 */
export function isJurisdictionSupported(jurisdiction: string): boolean {
  return jurisdiction in JURISDICTION_REGISTRY;
}

/**
 * Get all supported jurisdictions
 */
export function getSupportedJurisdictions(): string[] {
  return Object.keys(JURISDICTION_REGISTRY);
}

/**
 * Calculate interest for a jurisdiction
 */
export function calculateInterest(jurisdiction: string, params: InterestParams): InterestResult {
  switch (jurisdiction) {
    case 'US-CA':
      return calculateCaliforniaInterest(params);
    default:
      // Default to 7% simple interest
      const msPerDay = 1000 * 60 * 60 * 24;
      const days = Math.floor((params.endDate.getTime() - params.startDate.getTime()) / msPerDay);
      const years = days / 365;
      const amount = Math.round(params.principal * 0.07 * years * 100) / 100;
      return {
        amount,
        rate: 0.07,
        days,
        statutoryBasis: 'Default 7% legal rate',
      };
  }
}

/**
 * Get applicable statutes for a jurisdiction
 */
export function getApplicableStatutes(
  jurisdiction: string,
  disputeType: string,
  issues: string[] = []
): string[] {
  switch (jurisdiction) {
    case 'US-CA':
      return getCaliforniaStatutes(disputeType, issues);
    default:
      return [];
  }
}

/**
 * Get burden of proof standard for an issue
 */
export function getBurdenStandard(jurisdiction: string, issueType: string): BurdenOfProofStandard {
  const rules = getRules(jurisdiction);
  if (!rules) {
    return 'preponderance';
  }

  // Check if elevated burden is required
  const elevatedStandard = rules.elevatedBurdenIssues[issueType.toLowerCase()];
  if (elevatedStandard) {
    return elevatedStandard;
  }

  return rules.defaultBurdenStandard;
}

/**
 * Check statute of limitations
 */
export function checkStatuteOfLimitations(
  jurisdiction: string,
  issueType: string,
  dateOfBreach: Date
): { withinLimit: boolean; limitYears: number; expirationDate: Date } {
  switch (jurisdiction) {
    case 'US-CA':
      return checkCaliforniaSOL(issueType, dateOfBreach);
    default: {
      // Default 4-year limit
      const expirationDate = new Date(dateOfBreach);
      expirationDate.setFullYear(expirationDate.getFullYear() + 4);
      return {
        withinLimit: new Date() < expirationDate,
        limitYears: 4,
        expirationDate,
      };
    }
  }
}

/**
 * Get damages caps for a jurisdiction
 */
export function getDamagesCaps(jurisdiction: string, disputeType: string): DamagesCap[] {
  switch (jurisdiction) {
    case 'US-CA':
      return getCaliforniaDamagesCaps(disputeType);
    default:
      return [];
  }
}

/**
 * Get special rules for a jurisdiction and category
 */
export function getSpecialRules(jurisdiction: string, category: string): SpecialRule[] {
  switch (jurisdiction) {
    case 'US-CA':
      return getCaliforniaSpecialRules(category);
    default:
      return [];
  }
}

/**
 * Format a citation for a jurisdiction
 */
export function formatCitation(jurisdiction: string, code: string, section: string): string {
  switch (jurisdiction) {
    case 'US-CA':
      return formatCaliforniaCitation(code, section);
    default:
      return `${code} § ${section}`;
  }
}

/**
 * Get prejudgment interest rate
 */
export function getPrejudgmentInterestRate(jurisdiction: string, isContractClaim: boolean): number {
  const rules = getRules(jurisdiction);
  if (!rules) {
    return 0.07; // Default 7%
  }

  return isContractClaim ? rules.prejudgmentInterestRate : rules.defaultInterestRate;
}

/**
 * Get small claims limit
 */
export function getSmallClaimsLimit(jurisdiction: string, isBusiness: boolean = false): number {
  const rules = getRules(jurisdiction);
  if (!rules) {
    return 10000; // Default
  }

  if (isBusiness && rules.smallClaimsLimitBusiness) {
    return rules.smallClaimsLimitBusiness;
  }

  return rules.smallClaimsLimit;
}

/**
 * Rule engine implementation
 */
export const ruleEngine: RuleEngine = {
  getRules,
  calculateInterest,
  getApplicableStatutes,
  getBurdenStandard,
  checkStatuteOfLimitations,
  getDamagesCaps,
  getSpecialRules,
};

// Export California rules directly for convenience
export { CALIFORNIA_RULES } from './california';
