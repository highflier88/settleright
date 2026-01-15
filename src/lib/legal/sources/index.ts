/**
 * Legal Source Registry
 *
 * Centralized configuration for legal data sources.
 */

export type LegalSourceId = 'courtlistener' | 'ca-leginfo' | 'ecfr';

export interface LegalSourceConfig {
  id: LegalSourceId;
  name: string;
  description: string;
  baseUrl: string;
  requiresAuth: boolean;
  rateLimit: {
    requestsPerMinute: number;
    requestsPerDay?: number;
  };
  supportedJurisdictions: string[];
  supportedSourceTypes: ('STATUTE' | 'CASE_LAW' | 'REGULATION' | 'COURT_RULE')[];
}

export const LEGAL_SOURCES: Record<LegalSourceId, LegalSourceConfig> = {
  courtlistener: {
    id: 'courtlistener',
    name: 'CourtListener',
    description: 'Free legal research database with millions of court opinions',
    baseUrl: 'https://www.courtlistener.com/api/rest/v3',
    requiresAuth: false, // Auth optional, increases rate limits
    rateLimit: {
      requestsPerMinute: 30, // Unauthenticated
      requestsPerDay: 5000,
    },
    supportedJurisdictions: ['US-CA', 'US-FEDERAL'],
    supportedSourceTypes: ['CASE_LAW'],
  },
  'ca-leginfo': {
    id: 'ca-leginfo',
    name: 'California Legislative Information',
    description: 'Official California statute database',
    baseUrl: 'https://leginfo.legislature.ca.gov',
    requiresAuth: false,
    rateLimit: {
      requestsPerMinute: 10, // Be respectful
    },
    supportedJurisdictions: ['US-CA'],
    supportedSourceTypes: ['STATUTE'],
  },
  ecfr: {
    id: 'ecfr',
    name: 'eCFR',
    description: 'Electronic Code of Federal Regulations',
    baseUrl: 'https://www.ecfr.gov/api/versioner/v1',
    requiresAuth: false,
    rateLimit: {
      requestsPerMinute: 60,
    },
    supportedJurisdictions: ['US-FEDERAL'],
    supportedSourceTypes: ['REGULATION'],
  },
};

/**
 * Get sources for a jurisdiction
 */
export function getSourcesForJurisdiction(jurisdiction: string): LegalSourceConfig[] {
  return Object.values(LEGAL_SOURCES).filter((source) =>
    source.supportedJurisdictions.includes(jurisdiction)
  );
}

/**
 * Get sources for a document type
 */
export function getSourcesForType(
  sourceType: 'STATUTE' | 'CASE_LAW' | 'REGULATION' | 'COURT_RULE'
): LegalSourceConfig[] {
  return Object.values(LEGAL_SOURCES).filter((source) =>
    source.supportedSourceTypes.includes(sourceType)
  );
}
