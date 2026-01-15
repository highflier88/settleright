/**
 * California Jurisdiction Law Mappings Seed
 *
 * Seeds the database with California law mappings for each dispute type.
 * These mappings help the AI analysis engine identify relevant laws.
 */

import { PrismaClient, DisputeType } from '@prisma/client';

const prisma = new PrismaClient();

interface LawMapping {
  jurisdiction: string;
  lawCategory: string;
  applicableCodes: Array<{
    codeSection: string;
    sections: string[];
    description: string;
  }>;
  disputeTypes: DisputeType[];
  smallClaimsLimit?: number;
  notes?: string;
}

const CALIFORNIA_LAW_MAPPINGS: LawMapping[] = [
  // Contract Formation
  {
    jurisdiction: 'US-CA',
    lawCategory: 'contract_formation',
    applicableCodes: [
      {
        codeSection: 'CIV',
        sections: ['1549', '1550', '1565', '1580', '1581', '1582'],
        description: 'Contract formation requirements and essential elements',
      },
    ],
    disputeTypes: ['CONTRACT', 'SERVICE', 'GOODS', 'PAYMENT'],
    notes: 'Applies to all contracts formed in California',
  },

  // Contract Breach
  {
    jurisdiction: 'US-CA',
    lawCategory: 'contract_breach',
    applicableCodes: [
      {
        codeSection: 'CIV',
        sections: ['3300', '3301', '3302', '3306', '3307', '3322'],
        description: 'Damages for breach of contract',
      },
      {
        codeSection: 'CCP',
        sections: ['337', '339'],
        description: 'Statute of limitations for contract actions',
      },
    ],
    disputeTypes: ['CONTRACT', 'SERVICE', 'PAYMENT'],
    smallClaimsLimit: 10000,
    notes: '4 years for written contracts, 2 years for oral contracts',
  },

  // Consumer Protection (CLRA)
  {
    jurisdiction: 'US-CA',
    lawCategory: 'consumer_protection',
    applicableCodes: [
      {
        codeSection: 'CIV',
        sections: ['1770', '1780', '1781', '1782', '1784'],
        description: 'Consumer Legal Remedies Act',
      },
      {
        codeSection: 'BPC',
        sections: ['17200', '17500'],
        description: 'Unfair competition and false advertising',
      },
    ],
    disputeTypes: ['SERVICE', 'GOODS'],
    notes: 'Requires 30-day notice before filing suit under CLRA',
  },

  // Warranties (Song-Beverly)
  {
    jurisdiction: 'US-CA',
    lawCategory: 'warranties',
    applicableCodes: [
      {
        codeSection: 'CIV',
        sections: ['1791.1', '1792', '1792.1', '1793', '1793.2', '1794'],
        description: 'Song-Beverly Consumer Warranty Act',
      },
      {
        codeSection: 'COM',
        sections: ['2314', '2315', '2316'],
        description: 'Commercial Code warranties',
      },
    ],
    disputeTypes: ['GOODS'],
    notes: 'Lemon law provisions in 1793.2',
  },

  // Payment/Debt
  {
    jurisdiction: 'US-CA',
    lawCategory: 'payment_debt',
    applicableCodes: [
      {
        codeSection: 'CIV',
        sections: ['1473', '1479', '1485', '1521', '1541', '3287', '3288', '3289'],
        description: 'Payment, accord, satisfaction, and interest on debts',
      },
      {
        codeSection: 'CCP',
        sections: ['337', '337a'],
        description: 'Statute of limitations for debt actions',
      },
    ],
    disputeTypes: ['PAYMENT', 'CONTRACT'],
    smallClaimsLimit: 10000,
    notes: 'Prejudgment interest available on certain debts',
  },

  // Service Disputes
  {
    jurisdiction: 'US-CA',
    lawCategory: 'service_disputes',
    applicableCodes: [
      {
        codeSection: 'CIV',
        sections: ['1770', '3300', '3301'],
        description: 'CLRA and contract damages for services',
      },
      {
        codeSection: 'BPC',
        sections: ['7159', '7160', '7161'],
        description: 'Home improvement contracts',
      },
    ],
    disputeTypes: ['SERVICE'],
    notes: 'Special rules for home improvement and construction services',
  },

  // Small Claims Procedures
  {
    jurisdiction: 'US-CA',
    lawCategory: 'small_claims',
    applicableCodes: [
      {
        codeSection: 'CCP',
        sections: ['116.110', '116.220', '116.230', '116.320', '116.410', '116.540'],
        description: 'Small claims court jurisdiction and procedures',
      },
    ],
    disputeTypes: ['CONTRACT', 'SERVICE', 'GOODS', 'PAYMENT', 'OTHER'],
    smallClaimsLimit: 10000,
    notes: '$12,500 limit for natural persons effective 2024',
  },

  // Arbitration
  {
    jurisdiction: 'US-CA',
    lawCategory: 'arbitration',
    applicableCodes: [
      {
        codeSection: 'CCP',
        sections: [
          '1281',
          '1281.2',
          '1282',
          '1283',
          '1284',
          '1285',
          '1286',
          '1286.2',
          '1287',
          '1288',
        ],
        description: 'California Arbitration Act',
      },
    ],
    disputeTypes: ['CONTRACT', 'SERVICE', 'GOODS', 'PAYMENT', 'OTHER'],
    notes: 'Awards can be confirmed, corrected, or vacated by court',
  },

  // Unconscionability
  {
    jurisdiction: 'US-CA',
    lawCategory: 'unconscionability',
    applicableCodes: [
      {
        codeSection: 'CIV',
        sections: ['1668', '1670.5'],
        description: 'Unconscionable contracts and void provisions',
      },
    ],
    disputeTypes: ['CONTRACT', 'SERVICE', 'GOODS'],
    notes: 'Both procedural and substantive unconscionability required',
  },

  // Fraud and Misrepresentation
  {
    jurisdiction: 'US-CA',
    lawCategory: 'fraud_misrepresentation',
    applicableCodes: [
      {
        codeSection: 'CIV',
        sections: ['1571', '1572', '1573', '1709', '1710'],
        description: 'Fraud in contract formation and deceit',
      },
      {
        codeSection: 'CCP',
        sections: ['338'],
        description: 'Statute of limitations for fraud (3 years)',
      },
    ],
    disputeTypes: ['CONTRACT', 'SERVICE', 'GOODS'],
    notes: '3-year statute of limitations from discovery',
  },

  // Rescission
  {
    jurisdiction: 'US-CA',
    lawCategory: 'rescission',
    applicableCodes: [
      {
        codeSection: 'CIV',
        sections: ['1688', '1689', '1691', '1692', '1693'],
        description: 'Contract rescission and restoration',
      },
    ],
    disputeTypes: ['CONTRACT', 'SERVICE', 'GOODS'],
    notes: 'Must restore what was received under the contract',
  },
];

export async function seedCaliforniaLawMappings(): Promise<void> {
  console.log('Seeding California law mappings...');

  for (const mapping of CALIFORNIA_LAW_MAPPINGS) {
    await prisma.jurisdictionLawMapping.upsert({
      where: {
        jurisdiction_lawCategory: {
          jurisdiction: mapping.jurisdiction,
          lawCategory: mapping.lawCategory,
        },
      },
      update: {
        applicableCodes: mapping.applicableCodes,
        disputeTypes: mapping.disputeTypes,
        smallClaimsLimit: mapping.smallClaimsLimit,
        notes: mapping.notes,
      },
      create: {
        jurisdiction: mapping.jurisdiction,
        lawCategory: mapping.lawCategory,
        applicableCodes: mapping.applicableCodes,
        disputeTypes: mapping.disputeTypes,
        smallClaimsLimit: mapping.smallClaimsLimit,
        notes: mapping.notes,
      },
    });

    console.log(`  Seeded: ${mapping.jurisdiction} - ${mapping.lawCategory}`);
  }

  console.log(`Seeded ${CALIFORNIA_LAW_MAPPINGS.length} law mappings`);
}

// Allow running directly
if (require.main === module) {
  seedCaliforniaLawMappings()
    .then(() => {
      console.log('Done!');
      process.exit(0);
    })
    .catch((error) => {
      console.error('Error seeding:', error);
      process.exit(1);
    });
}
