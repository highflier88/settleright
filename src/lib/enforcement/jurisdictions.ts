/**
 * Jurisdiction Filing Information
 *
 * Contains jurisdiction-specific information for enforcing
 * arbitration awards in various US states.
 */

import type { JurisdictionFilingInfo } from './types';

/**
 * Jurisdiction filing information database
 */
export const JURISDICTION_INFO: Record<string, JurisdictionFilingInfo> = {
  'US-CA': {
    jurisdiction: 'US-CA',
    jurisdictionName: 'California',
    courtName: 'Superior Court of California',
    courtAddress: 'File in the county where any party resides or where arbitration was conducted',
    filingFeeEstimate: '$435 - $450 (varies by county)',
    filingDeadline: '4 years from the date of award (CCP § 1288)',
    requiredDocuments: [
      'Petition to Confirm Arbitration Award',
      'Copy of the Arbitration Award',
      'Copy of the Arbitration Agreement',
      'Proof of Service on all parties',
      'Proposed Judgment',
      'Civil Case Cover Sheet',
    ],
    filingProcedure: [
      '1. File a Petition to Confirm Arbitration Award in Superior Court',
      '2. Serve the petition on all parties at least 10 days before the hearing',
      '3. Attend the hearing (if required by the court)',
      '4. Obtain judgment if petition is granted',
      '5. Record the judgment if real property is involved',
    ],
    additionalNotes: [
      'The petition must name all parties to the arbitration',
      'The court must confirm the award unless grounds for vacation or correction exist',
      'A confirmed award has the same force and effect as a civil judgment',
      "The prevailing party may be entitled to attorney's fees per the arbitration agreement",
    ],
    statute: 'California Code of Civil Procedure §§ 1285-1288.8',
    statuteText:
      'Any party to an arbitration may petition the court to confirm, correct, or vacate the award.',
  },

  'US-NY': {
    jurisdiction: 'US-NY',
    jurisdictionName: 'New York',
    courtName: 'New York State Supreme Court',
    courtAddress: 'File in the county where a party resides or has a place of business',
    filingFeeEstimate: '$210 - $340 (based on amount)',
    filingDeadline: '1 year from award delivery (CPLR § 7510)',
    requiredDocuments: [
      'Petition/Motion to Confirm Arbitration Award',
      'Copy of the Arbitration Award',
      'Copy of the Arbitration Agreement',
      'Affidavit of Service',
      'Request for Judicial Intervention (RJI)',
      'Proposed Judgment/Order',
    ],
    filingProcedure: [
      '1. Prepare and file a petition or motion to confirm the award',
      '2. File the RJI to have a judge assigned',
      '3. Serve all parties with notice of the petition',
      '4. Appear at any scheduled hearing',
      '5. Submit proposed judgment for signature',
    ],
    additionalNotes: [
      'Under CPLR Article 75, confirmation is nearly automatic unless grounds for vacatur exist',
      'The court has limited discretion to review the merits of the award',
      'Service must be made at least 8 days before the return date',
      'E-filing may be required in certain courts',
    ],
    statute: 'New York CPLR Article 75, §§ 7510-7514',
    statuteText: 'A party may apply to confirm the award within one year after its delivery.',
  },

  'US-TX': {
    jurisdiction: 'US-TX',
    jurisdictionName: 'Texas',
    courtName: 'District Court of Texas',
    courtAddress: 'File in the county where a party resides or where the agreement was made',
    filingFeeEstimate: '$300 - $400',
    filingDeadline: '1 year after award is made (TAA § 171.087)',
    requiredDocuments: [
      'Application to Confirm Arbitration Award',
      'Original or certified copy of Arbitration Award',
      'Original or certified copy of Arbitration Agreement',
      'Citation/Notice to other parties',
      'Proposed Judgment',
    ],
    filingProcedure: [
      '1. File an Application to Confirm the Arbitration Award',
      '2. Have citation issued and served on opposing parties',
      '3. Wait for answer period (typically 20 days)',
      '4. Request entry of judgment if no opposition',
      '5. Attend hearing if award is contested',
    ],
    additionalNotes: [
      'Texas follows the Texas Arbitration Act (TAA) for state law claims',
      'Federal Arbitration Act may apply for interstate commerce disputes',
      'The court must confirm unless grounds for modification or vacatur exist',
      'Judgment may be enforced as any other civil judgment',
    ],
    statute: 'Texas Civil Practice & Remedies Code Chapter 171',
    statuteText:
      'On application of a party, the court shall confirm an award unless grounds for vacatur exist.',
  },

  'US-FL': {
    jurisdiction: 'US-FL',
    jurisdictionName: 'Florida',
    courtName: 'Circuit Court of Florida',
    courtAddress: 'File in the county where a party resides or arbitration was held',
    filingFeeEstimate: '$400 - $500',
    filingDeadline: '1 year from date of award (F.S. § 682.12)',
    requiredDocuments: [
      'Motion/Petition to Confirm Arbitration Award',
      'Copy of the Arbitration Award',
      'Copy of the Arbitration Agreement',
      'Proof of Service',
      'Proposed Final Judgment',
      'Civil Cover Sheet',
    ],
    filingProcedure: [
      '1. File a motion or petition to confirm the arbitration award',
      '2. Serve all parties with the motion and supporting documents',
      '3. Wait for response period (20 days)',
      '4. Request hearing if response is filed',
      '5. Submit proposed judgment for entry',
    ],
    additionalNotes: [
      'Florida Arbitration Code governs most domestic arbitrations',
      'Federal Arbitration Act applies to interstate commerce disputes',
      'Courts have very limited review of arbitration awards',
      'A confirmed award becomes a final judgment of the court',
    ],
    statute: 'Florida Statutes Chapter 682 (Florida Arbitration Code)',
    statuteText: 'Upon application of a party, the court shall confirm an award.',
  },

  'US-IL': {
    jurisdiction: 'US-IL',
    jurisdictionName: 'Illinois',
    courtName: 'Circuit Court of Illinois',
    courtAddress: 'File in the county where a party resides or arbitration occurred',
    filingFeeEstimate: '$300 - $400',
    filingDeadline: '30 days after receipt of award (710 ILCS 5/11)',
    requiredDocuments: [
      'Petition to Confirm Arbitration Award',
      'Copy of Arbitration Award',
      'Copy of Arbitration Agreement',
      'Summons and Service',
      'Proposed Order/Judgment',
    ],
    filingProcedure: [
      '1. File petition to confirm within 30 days of receiving award',
      '2. Serve all parties with summons and petition',
      '3. Allow time for response',
      '4. Attend any scheduled hearing',
      '5. Obtain entry of judgment',
    ],
    additionalNotes: [
      'Illinois follows the Uniform Arbitration Act',
      'The 30-day filing deadline is relatively short compared to other states',
      'A confirmed award has the same effect as a court judgment',
      'Post-judgment interest begins accruing from confirmation',
    ],
    statute: 'Illinois Uniform Arbitration Act (710 ILCS 5/)',
    statuteText:
      'Upon application the court shall confirm an award unless grounds for vacatur exist.',
  },
};

/**
 * Default/fallback jurisdiction info for unsupported jurisdictions
 */
export const DEFAULT_JURISDICTION_INFO: JurisdictionFilingInfo = {
  jurisdiction: 'UNKNOWN',
  jurisdictionName: 'Your Jurisdiction',
  courtName: 'Local Court of General Jurisdiction',
  courtAddress: 'Contact your local court clerk for filing location',
  filingFeeEstimate: 'Contact court clerk for current fees',
  filingDeadline: 'Typically 1-4 years (varies by jurisdiction)',
  requiredDocuments: [
    'Petition or Motion to Confirm Arbitration Award',
    'Copy of the Arbitration Award',
    'Copy of the Arbitration Agreement',
    'Proof of Service on all parties',
    'Proposed Judgment or Order',
  ],
  filingProcedure: [
    '1. File a petition to confirm the arbitration award in the appropriate court',
    '2. Serve all parties with notice of the petition',
    '3. Attend any scheduled hearing',
    '4. Obtain judgment upon confirmation',
  ],
  additionalNotes: [
    'Consult with a local attorney for jurisdiction-specific requirements',
    'Federal Arbitration Act (9 U.S.C. § 9) may apply for interstate disputes',
    'State arbitration statutes typically govern domestic arbitrations',
    'Courts have limited authority to review the merits of arbitration awards',
  ],
  statute: 'Federal Arbitration Act, 9 U.S.C. §§ 9-13; State Arbitration Statutes',
  statuteText: 'A party may apply to the court for an order confirming the award.',
};

/**
 * Get jurisdiction filing information
 */
export function getJurisdictionInfo(jurisdiction: string): JurisdictionFilingInfo {
  return (
    JURISDICTION_INFO[jurisdiction] || {
      ...DEFAULT_JURISDICTION_INFO,
      jurisdiction,
      jurisdictionName: formatJurisdictionName(jurisdiction),
    }
  );
}

/**
 * Format jurisdiction code to readable name
 */
function formatJurisdictionName(jurisdiction: string): string {
  // Handle US state codes like "US-CA"
  if (jurisdiction.startsWith('US-')) {
    const stateCode = jurisdiction.slice(3);
    const stateNames: Record<string, string> = {
      AL: 'Alabama',
      AK: 'Alaska',
      AZ: 'Arizona',
      AR: 'Arkansas',
      CA: 'California',
      CO: 'Colorado',
      CT: 'Connecticut',
      DE: 'Delaware',
      FL: 'Florida',
      GA: 'Georgia',
      HI: 'Hawaii',
      ID: 'Idaho',
      IL: 'Illinois',
      IN: 'Indiana',
      IA: 'Iowa',
      KS: 'Kansas',
      KY: 'Kentucky',
      LA: 'Louisiana',
      ME: 'Maine',
      MD: 'Maryland',
      MA: 'Massachusetts',
      MI: 'Michigan',
      MN: 'Minnesota',
      MS: 'Mississippi',
      MO: 'Missouri',
      MT: 'Montana',
      NE: 'Nebraska',
      NV: 'Nevada',
      NH: 'New Hampshire',
      NJ: 'New Jersey',
      NM: 'New Mexico',
      NY: 'New York',
      NC: 'North Carolina',
      ND: 'North Dakota',
      OH: 'Ohio',
      OK: 'Oklahoma',
      OR: 'Oregon',
      PA: 'Pennsylvania',
      RI: 'Rhode Island',
      SC: 'South Carolina',
      SD: 'South Dakota',
      TN: 'Tennessee',
      TX: 'Texas',
      UT: 'Utah',
      VT: 'Vermont',
      VA: 'Virginia',
      WA: 'Washington',
      WV: 'West Virginia',
      WI: 'Wisconsin',
      WY: 'Wyoming',
      DC: 'District of Columbia',
    };
    return stateNames[stateCode] || stateCode;
  }
  return jurisdiction;
}

/**
 * Get list of supported jurisdictions
 */
export function getSupportedJurisdictions(): string[] {
  return Object.keys(JURISDICTION_INFO);
}
