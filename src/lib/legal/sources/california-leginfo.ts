/**
 * California Legislative Information Source
 *
 * Provides statute definitions and mappings for California law.
 * Uses static definitions for MVP with key sections relevant to
 * contract disputes, consumer protection, and small claims.
 */

import type { DisputeType } from '@prisma/client';

// California code structure
export interface CaliforniaCodeSection {
  code: string;
  codeSlug: string;
  section: string;
  title: string;
  text: string;
  summary?: string;
  effectiveDate?: string;
  disputeTypes: DisputeType[];
  topics: string[];
}

// California Code slugs for leginfo.legislature.ca.gov
export const CA_CODE_SLUGS: Record<string, string> = {
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

/**
 * Key California statutes for contract disputes
 * These are the most commonly cited sections in small claims
 * and commercial disputes under $10,000.
 */
export const KEY_CONTRACT_SECTIONS: CaliforniaCodeSection[] = [
  // Contract Formation
  {
    code: 'Cal. Civ. Code',
    codeSlug: 'CIV',
    section: '1549',
    title: 'Contract Defined',
    text: `A contract is an agreement to do or not to do a certain thing.`,
    summary: 'Defines what constitutes a contract under California law.',
    disputeTypes: ['CONTRACT', 'SERVICE', 'GOODS', 'PAYMENT'],
    topics: ['contract formation', 'agreement', 'definition'],
  },
  {
    code: 'Cal. Civ. Code',
    codeSlug: 'CIV',
    section: '1550',
    title: 'Essential Elements of Contract',
    text: `It is essential to the existence of a contract that there should be:
1. Parties capable of contracting;
2. Their consent;
3. A lawful object; and,
4. A sufficient cause or consideration.`,
    summary: 'Lists the four essential elements required for a valid contract.',
    disputeTypes: ['CONTRACT', 'SERVICE', 'GOODS', 'PAYMENT'],
    topics: ['contract formation', 'elements', 'validity', 'consideration', 'consent'],
  },
  {
    code: 'Cal. Civ. Code',
    codeSlug: 'CIV',
    section: '1565',
    title: 'Consent Defined',
    text: `The consent of the parties to a contract must be:
1. Free;
2. Mutual; and,
3. Communicated by each to the other.`,
    summary: 'Defines requirements for valid consent in contract formation.',
    disputeTypes: ['CONTRACT', 'SERVICE'],
    topics: ['consent', 'mutual agreement', 'contract formation'],
  },

  // Contract Breach
  {
    code: 'Cal. Civ. Code',
    codeSlug: 'CIV',
    section: '3300',
    title: 'Measure of Damages for Breach of Contract',
    text: `For the breach of an obligation arising from contract, the measure of damages, except where otherwise expressly provided by this code, is the amount which will compensate the party aggrieved for all the detriment proximately caused thereby, or which, in the ordinary course of things, would be likely to result therefrom.`,
    summary: 'Establishes the standard for measuring damages in contract breach cases.',
    disputeTypes: ['CONTRACT', 'SERVICE', 'GOODS', 'PAYMENT'],
    topics: ['damages', 'breach of contract', 'compensation', 'detriment'],
  },
  {
    code: 'Cal. Civ. Code',
    codeSlug: 'CIV',
    section: '3301',
    title: 'Damages for Breach Where No Standard',
    text: `No damages can be recovered for a breach of contract which are not clearly ascertainable in both their nature and origin.`,
    summary: 'Requires damages to be clearly ascertainable to be recoverable.',
    disputeTypes: ['CONTRACT', 'SERVICE', 'PAYMENT'],
    topics: ['damages', 'breach of contract', 'ascertainable damages'],
  },

  // Unconscionability
  {
    code: 'Cal. Civ. Code',
    codeSlug: 'CIV',
    section: '1670.5',
    title: 'Unconscionable Contract or Clause',
    text: `(a) If the court as a matter of law finds the contract or any clause of the contract to have been unconscionable at the time it was made the court may refuse to enforce the contract, or it may enforce the remainder of the contract without the unconscionable clause, or it may so limit the application of any unconscionable clause as to avoid any unconscionable result.
(b) When it is claimed or appears to the court that the contract or any clause thereof may be unconscionable the parties shall be afforded a reasonable opportunity to present evidence as to its commercial setting, purpose and effect to aid the court in making the determination.`,
    summary: 'Allows courts to refuse enforcement of unconscionable contracts or clauses.',
    disputeTypes: ['CONTRACT', 'SERVICE', 'GOODS'],
    topics: ['unconscionability', 'contract enforcement', 'unfair terms'],
  },
  {
    code: 'Cal. Civ. Code',
    codeSlug: 'CIV',
    section: '1668',
    title: 'Contracts Against Policy of Law',
    text: `All contracts which have for their object, directly or indirectly, to exempt anyone from responsibility for his own fraud, or willful injury to the person or property of another, or violation of law, whether willful or negligent, are against the policy of the law.`,
    summary: 'Voids contracts that attempt to exempt parties from responsibility for fraud or willful injury.',
    disputeTypes: ['CONTRACT', 'SERVICE'],
    topics: ['public policy', 'void contracts', 'fraud', 'liability exemption'],
  },

  // Payment
  {
    code: 'Cal. Civ. Code',
    codeSlug: 'CIV',
    section: '3287',
    title: 'Interest on Damages',
    text: `(a) Every person who is entitled to recover damages certain, or capable of being made certain by calculation, and the right to recover which is vested in him upon a particular day, is entitled also to recover interest thereon from that day, except during such time as the debtor is prevented by law, or by the act of the creditor from paying the debt.
(b) Every person who is entitled under any judgment to receive damages based upon a cause of action in contract where the claim was unliquidated, may also recover interest thereon from a date prior to the entry of judgment as the court may, in its discretion, fix, but in no event earlier than the date the action was filed.`,
    summary: 'Provides for prejudgment interest on liquidated damages in contract cases.',
    disputeTypes: ['CONTRACT', 'PAYMENT'],
    topics: ['interest', 'prejudgment interest', 'damages', 'debt'],
  },

  // Consumer Protection (CLRA)
  {
    code: 'Cal. Civ. Code',
    codeSlug: 'CIV',
    section: '1770',
    title: 'Consumer Legal Remedies Act - Prohibited Practices',
    text: `(a) The following unfair methods of competition and unfair or deceptive acts or practices undertaken by any person in a transaction intended to result or which results in the sale or lease of goods or services to any consumer are unlawful:
(1) Passing off goods or services as those of another.
(2) Misrepresenting the source, sponsorship, approval, or certification of goods or services.
(3) Misrepresenting the affiliation, connection, or association with, or certification by, another.
(4) Using deceptive representations or designations of geographic origin in connection with goods or services.
(5) Representing that goods or services have sponsorship, approval, characteristics, ingredients, uses, benefits, or quantities which they do not have or that a person has a sponsorship, approval, status, affiliation, or connection which he or she does not have.
(9) Advertising goods or services with intent not to sell them as advertised.
(14) Representing that a transaction confers or involves rights, remedies, or obligations which it does not have or involve, or which are prohibited by law.`,
    summary: 'Lists prohibited unfair and deceptive practices under the Consumer Legal Remedies Act.',
    disputeTypes: ['SERVICE', 'GOODS'],
    topics: ['consumer protection', 'CLRA', 'unfair practices', 'deceptive practices', 'misrepresentation'],
  },
  {
    code: 'Cal. Civ. Code',
    codeSlug: 'CIV',
    section: '1780',
    title: 'CLRA - Actions by Consumers',
    text: `(a) Any consumer who suffers any damage as a result of the use or employment by any person of a method, act, or practice declared to be unlawful by Section 1770 may bring an action against that person to recover or obtain any of the following:
(1) Actual damages.
(2) An order enjoining the methods, acts, or practices.
(3) Restitution of property.
(4) Punitive damages.
(5) Any other relief that the court deems proper.`,
    summary: 'Establishes consumer remedies for CLRA violations including actual damages, restitution, and punitive damages.',
    disputeTypes: ['SERVICE', 'GOODS'],
    topics: ['consumer protection', 'CLRA', 'remedies', 'damages', 'restitution'],
  },

  // Warranties
  {
    code: 'Cal. Civ. Code',
    codeSlug: 'CIV',
    section: '1791.1',
    title: 'Song-Beverly Act - Express Warranty Defined',
    text: `(a) "Express warranty" means:
(1) A written statement arising out of a sale to the consumer of a consumer good pursuant to which the manufacturer, distributor, or retailer undertakes to preserve or maintain the utility or performance of the consumer good or provide compensation if there is a failure in utility or performance; or
(2) In the event of any sample or model, that the whole of the goods conforms to such sample or model.`,
    summary: 'Defines express warranty under the Song-Beverly Consumer Warranty Act.',
    disputeTypes: ['GOODS'],
    topics: ['warranty', 'express warranty', 'Song-Beverly', 'consumer goods'],
  },
  {
    code: 'Cal. Civ. Code',
    codeSlug: 'CIV',
    section: '1792',
    title: 'Implied Warranty of Merchantability',
    text: `Unless disclaimed in the manner prescribed by this chapter, every sale of consumer goods that are sold at retail in this state shall be accompanied by the manufacturer's and the retail seller's implied warranty that the goods are merchantable.`,
    summary: 'Establishes implied warranty of merchantability for consumer goods.',
    disputeTypes: ['GOODS'],
    topics: ['warranty', 'implied warranty', 'merchantability', 'consumer goods'],
  },

  // Small Claims Procedures
  {
    code: 'Cal. Code Civ. Proc.',
    codeSlug: 'CCP',
    section: '116.220',
    title: 'Small Claims - Jurisdiction Amount',
    text: `(a) The small claims court has jurisdiction in the following actions:
(1) Except as provided in subdivisions (c), (e), and (f), for recovery of money, if the amount of the demand does not exceed ten thousand dollars ($10,000).
(2) Except as provided in subdivisions (c), (e), and (f), to enforce payment of delinquent unsecured personal property taxes if the amount of the demand does not exceed ten thousand dollars ($10,000).
(3) To issue the writ of possession authorized by Section 1861.5 of the Civil Code if the amount of the demand does not exceed ten thousand dollars ($10,000).
(4) To confirm, correct, or vacate a fee arbitration award not exceeding ten thousand dollars ($10,000) between an attorney and client that is binding or has become binding, or to conduct a hearing de novo between an attorney and client after nonbinding arbitration of a fee dispute involving no more than ten thousand dollars ($10,000).`,
    summary: 'Establishes small claims court jurisdiction for claims up to $10,000.',
    disputeTypes: ['CONTRACT', 'SERVICE', 'GOODS', 'PAYMENT', 'OTHER'],
    topics: ['small claims', 'jurisdiction', 'monetary limit', 'court procedure'],
  },
  {
    code: 'Cal. Code Civ. Proc.',
    codeSlug: 'CCP',
    section: '116.410',
    title: 'Small Claims - Proper Court',
    text: `(a) The proper court for the trial of an action under this chapter is:
(1) The small claims court in the judicial district in which the defendant, or one or more of the defendants, resided at the time the cause of action arose.
(2) The small claims court in the judicial district in which the defendant, or one or more of the defendants, resides at the time of commencement of the action.
(3) The small claims court in the judicial district in which the obligation was to be performed or in which the buyer or lessee actually signed the contract or received the goods or services.
(4) The small claims court in the judicial district in which the defendant, or one or more of the defendants, has a place of business, if the action arises out of the business.`,
    summary: 'Specifies venue requirements for small claims actions.',
    disputeTypes: ['CONTRACT', 'SERVICE', 'GOODS', 'PAYMENT', 'OTHER'],
    topics: ['small claims', 'venue', 'proper court', 'jurisdiction'],
  },

  // Statute of Limitations
  {
    code: 'Cal. Code Civ. Proc.',
    codeSlug: 'CCP',
    section: '337',
    title: 'Statute of Limitations - Written Contracts',
    text: `Within four years:
1. An action upon any contract, obligation or liability founded upon an instrument in writing, except as provided in Section 336a.`,
    summary: 'Four-year statute of limitations for written contract actions.',
    disputeTypes: ['CONTRACT', 'SERVICE', 'PAYMENT'],
    topics: ['statute of limitations', 'written contract', 'time limit', 'filing deadline'],
  },
  {
    code: 'Cal. Code Civ. Proc.',
    codeSlug: 'CCP',
    section: '339',
    title: 'Statute of Limitations - Oral Contracts',
    text: `Within two years:
1. An action upon a contract, obligation or liability not founded upon an instrument in writing, except as provided in Section 2725 of the Commercial Code.`,
    summary: 'Two-year statute of limitations for oral contract actions.',
    disputeTypes: ['CONTRACT', 'SERVICE'],
    topics: ['statute of limitations', 'oral contract', 'time limit', 'filing deadline'],
  },

  // Arbitration
  {
    code: 'Cal. Code Civ. Proc.',
    codeSlug: 'CCP',
    section: '1281',
    title: 'Written Agreement to Arbitrate',
    text: `A written agreement to submit to arbitration an existing controversy or a controversy thereafter arising is valid, enforceable and irrevocable, save upon such grounds as exist for the revocation of any contract.`,
    summary: 'Establishes validity and enforceability of written arbitration agreements.',
    disputeTypes: ['CONTRACT', 'SERVICE', 'GOODS', 'PAYMENT', 'OTHER'],
    topics: ['arbitration', 'agreement', 'enforceability', 'ADR'],
  },
  {
    code: 'Cal. Code Civ. Proc.',
    codeSlug: 'CCP',
    section: '1286.2',
    title: 'Grounds for Vacating Arbitration Award',
    text: `Subject to Section 1286.4, the court shall vacate the award if the court determines any of the following:
(a) The award was procured by corruption, fraud or other undue means.
(b) There was corruption in any of the arbitrators.
(c) The rights of the party were substantially prejudiced by misconduct of a neutral arbitrator.
(d) The arbitrators exceeded their powers and the award cannot be corrected without affecting the merits of the decision upon the controversy submitted.
(e) The rights of the party were substantially prejudiced by the refusal of the arbitrators to postpone the hearing upon sufficient cause being shown therefor or by the refusal of the arbitrators to hear evidence material to the controversy or by other conduct of the arbitrators contrary to the provisions of this title.
(f) An arbitrator making the award either: (1) failed to disclose within the time required for disclosure a ground for disqualification of which the arbitrator was then aware; or (2) was subject to disqualification upon grounds specified in Section 1281.91 but failed upon receipt of timely demand to disqualify himself or herself as required by that provision.`,
    summary: 'Lists grounds for vacating an arbitration award including fraud, corruption, and arbitrator misconduct.',
    disputeTypes: ['CONTRACT', 'SERVICE', 'GOODS', 'PAYMENT', 'OTHER'],
    topics: ['arbitration', 'vacate award', 'grounds', 'fraud', 'misconduct'],
  },
];

/**
 * Get all statutes for a specific dispute type
 */
export function getStatutesForDisputeType(disputeType: DisputeType): CaliforniaCodeSection[] {
  return KEY_CONTRACT_SECTIONS.filter((section) =>
    section.disputeTypes.includes(disputeType)
  );
}

/**
 * Get statutes by topic
 */
export function getStatutesByTopic(topic: string): CaliforniaCodeSection[] {
  const lowerTopic = topic.toLowerCase();
  return KEY_CONTRACT_SECTIONS.filter((section) =>
    section.topics.some((t) => t.toLowerCase().includes(lowerTopic))
  );
}

/**
 * Get a specific section
 */
export function getSection(code: string, section: string): CaliforniaCodeSection | undefined {
  return KEY_CONTRACT_SECTIONS.find(
    (s) => s.code === code && s.section === section
  );
}

/**
 * Build the leginfo URL for a section
 */
export function getSectionUrl(codeSlug: string, section: string): string {
  return `https://leginfo.legislature.ca.gov/faces/codes_displaySection.xhtml?lawCode=${codeSlug}&sectionNum=${section}`;
}

/**
 * Get all sections as documents for ingestion
 */
export function getAllSectionsForIngestion(): Array<{
  citation: string;
  title: string;
  fullText: string;
  summary: string;
  codeSection: string;
  disputeTypes: DisputeType[];
  topics: string[];
}> {
  return KEY_CONTRACT_SECTIONS.map((section) => ({
    citation: `${section.code} § ${section.section}`,
    title: section.title,
    fullText: section.text,
    summary: section.summary || '',
    codeSection: `${section.codeSlug}:${section.section}`,
    disputeTypes: section.disputeTypes,
    topics: section.topics,
  }));
}
