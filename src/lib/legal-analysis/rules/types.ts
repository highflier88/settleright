/**
 * Jurisdiction Rules Types
 *
 * Interfaces for jurisdiction-specific legal rules.
 */

import type { BurdenOfProofStandard } from '../types';

/**
 * Special legal rule for a jurisdiction
 */
export interface SpecialRule {
  /** Unique identifier */
  id: string;
  /** Category this rule applies to */
  category: string;
  /** Description of the rule */
  rule: string;
  /** Conditions that trigger the rule */
  conditions: string[];
  /** Effect of the rule */
  effect: string;
  /** Statutory basis */
  statutoryBasis?: string;
}

/**
 * Statute of limitations by issue type
 */
export type StatuteOfLimitations = Record<string, number>;

/**
 * Complete jurisdiction rules
 */
export interface JurisdictionRules {
  /** Jurisdiction code (e.g., "US-CA") */
  jurisdiction: string;
  /** Display name */
  displayName: string;

  /** Small claims court limit */
  smallClaimsLimit: number;
  /** Small claims limit for businesses */
  smallClaimsLimitBusiness?: number;

  /** Statute of limitations by issue type (in years) */
  statuteOfLimitations: StatuteOfLimitations;

  /** Default legal interest rate */
  defaultInterestRate: number;
  /** Prejudgment interest rate for contracts */
  prejudgmentInterestRate: number;
  /** Post-judgment interest rate */
  postjudgmentInterestRate?: number;

  /** Consumer protection statutes */
  consumerProtectionStatutes: string[];
  /** Contract law statutes */
  contractStatutes: string[];
  /** Payment/commercial statutes */
  commercialStatutes: string[];

  /** Default burden of proof standard */
  defaultBurdenStandard: BurdenOfProofStandard;
  /** Standards requiring higher proof */
  elevatedBurdenIssues: Record<string, BurdenOfProofStandard>;

  /** Special rules for this jurisdiction */
  specialRules: SpecialRule[];
}

/**
 * Interest calculation parameters
 */
export interface InterestParams {
  /** Principal amount */
  principal: number;
  /** Start date */
  startDate: Date;
  /** End date */
  endDate: Date;
  /** Whether this is a contract claim */
  isContractClaim: boolean;
  /** Custom rate override */
  customRate?: number;
}

/**
 * Interest calculation result
 */
export interface InterestResult {
  /** Interest amount */
  amount: number;
  /** Rate used */
  rate: number;
  /** Days calculated */
  days: number;
  /** Statutory basis for the rate */
  statutoryBasis: string;
}

/**
 * Damages cap information
 */
export interface DamagesCap {
  /** Type of cap */
  type: 'statutory' | 'contractual' | 'punitive';
  /** Maximum amount */
  maxAmount?: number;
  /** Maximum multiplier (for punitive) */
  maxMultiplier?: number;
  /** Statutory basis */
  statutoryBasis?: string;
  /** Conditions that apply */
  conditions: string[];
}

/**
 * Rule engine interface
 */
export interface RuleEngine {
  /** Get rules for a jurisdiction */
  getRules(jurisdiction: string): JurisdictionRules | null;

  /** Calculate interest */
  calculateInterest(jurisdiction: string, params: InterestParams): InterestResult;

  /** Get applicable statutes */
  getApplicableStatutes(
    jurisdiction: string,
    disputeType: string,
    issues: string[]
  ): string[];

  /** Get burden of proof standard */
  getBurdenStandard(
    jurisdiction: string,
    issueType: string
  ): BurdenOfProofStandard;

  /** Check statute of limitations */
  checkStatuteOfLimitations(
    jurisdiction: string,
    issueType: string,
    dateOfBreach: Date
  ): { withinLimit: boolean; limitYears: number; expirationDate: Date };

  /** Get damages caps */
  getDamagesCaps(
    jurisdiction: string,
    disputeType: string
  ): DamagesCap[];

  /** Get special rules */
  getSpecialRules(
    jurisdiction: string,
    category: string
  ): SpecialRule[];
}
