/**
 * CourtListener API Client
 *
 * Free legal research API providing access to millions of court opinions.
 * https://www.courtlistener.com/api/rest/v3/
 */

import { LEGAL_SOURCES } from './index';

const config = LEGAL_SOURCES.courtlistener;

// Types for CourtListener API responses
export interface CourtListenerOpinion {
  id: number;
  absolute_url: string;
  cluster_id: number;
  cluster: string; // URL to cluster
  author_id: number | null;
  author: string | null;
  joined_by: unknown[];
  type: string;
  sha1: string;
  page_count: number | null;
  download_url: string | null;
  local_path: string | null;
  plain_text: string;
  html: string | null;
  html_lawbox: string | null;
  html_columbia: string | null;
  html_anon_2020: string | null;
  xml_harvard: string | null;
  html_with_citations: string | null;
  extracted_by_ocr: boolean;
  opinions_cited: string[];
  date_created: string;
  date_modified: string;
}

export interface CourtListenerCluster {
  id: number;
  absolute_url: string;
  panel: unknown[];
  non_participating_judges: unknown[];
  docket: string;
  sub_opinions: string[];
  citations: CourtListenerCitation[];
  judges: string;
  date_filed: string;
  date_filed_is_approximate: boolean;
  slug: string;
  case_name_short: string;
  case_name: string;
  case_name_full: string;
  scdb_id: string;
  scdb_decision_direction: string | null;
  scdb_votes_majority: number | null;
  scdb_votes_minority: number | null;
  source: string;
  procedural_history: string;
  attorneys: string;
  nature_of_suit: string;
  posture: string;
  syllabus: string;
  headnotes: string;
  summary: string;
  disposition: string;
  history: string;
  other_dates: string;
  cross_reference: string;
  correction: string;
  citation_count: number;
  precedential_status: string;
  date_blocked: string | null;
  blocked: boolean;
  filepath_json_harvard: string | null;
  arguments: string;
  headmatter: string;
}

export interface CourtListenerCitation {
  volume: number;
  reporter: string;
  page: string;
  type: number;
}

export interface CourtListenerCourt {
  id: string;
  resource_uri: string;
  date_modified: string;
  in_use: boolean;
  has_opinion_scraper: boolean;
  has_oral_argument_scraper: boolean;
  position: number;
  citation_string: string;
  short_name: string;
  full_name: string;
  url: string;
  start_date: string;
  end_date: string | null;
  jurisdiction: string;
  notes: string;
}

export interface CourtListenerSearchResult {
  id: number;
  caseName: string;
  court: string;
  court_id: string;
  docketNumber: string;
  dateFiled: string;
  citation: string[];
  snippet: string;
  cluster_id: number;
  absolute_url: string;
}

export interface CourtListenerSearchResponse {
  count: number;
  next: string | null;
  previous: string | null;
  results: CourtListenerSearchResult[];
}

// Rate limiting
let lastRequestTime = 0;
const minRequestInterval = 60000 / config.rateLimit.requestsPerMinute;

async function rateLimit(): Promise<void> {
  const now = Date.now();
  const timeSinceLastRequest = now - lastRequestTime;
  if (timeSinceLastRequest < minRequestInterval) {
    await new Promise((resolve) => setTimeout(resolve, minRequestInterval - timeSinceLastRequest));
  }
  lastRequestTime = Date.now();
}

/**
 * Make authenticated request to CourtListener API
 */
async function makeRequest<T>(endpoint: string, params: Record<string, string> = {}): Promise<T> {
  await rateLimit();

  const url = new URL(`${config.baseUrl}${endpoint}`);
  Object.entries(params).forEach(([key, value]) => {
    url.searchParams.append(key, value);
  });

  const headers: HeadersInit = {
    Accept: 'application/json',
  };

  // Add auth token if available (increases rate limits)
  const token = process.env.COURTLISTENER_API_TOKEN;
  if (token) {
    headers.Authorization = `Token ${token}`;
  }

  const response = await fetch(url.toString(), { headers });

  if (!response.ok) {
    const error = await response.text();
    throw new Error(`CourtListener API error: ${response.status} - ${error}`);
  }

  return response.json() as Promise<T>;
}

/**
 * Search for opinions in CourtListener
 */
export async function searchOpinions(params: {
  query: string;
  court?: string; // Court ID, e.g., "cal", "cacd"
  dateFiled_after?: string; // YYYY-MM-DD
  dateFiled_before?: string;
  pageSize?: number;
  page?: number;
}): Promise<CourtListenerSearchResponse> {
  const searchParams: Record<string, string> = {
    q: params.query,
    type: 'o', // opinions
  };

  if (params.court) {
    searchParams.court = params.court;
  }
  if (params.dateFiled_after) {
    searchParams.filed_after = params.dateFiled_after;
  }
  if (params.dateFiled_before) {
    searchParams.filed_before = params.dateFiled_before;
  }
  if (params.pageSize) {
    searchParams.page_size = params.pageSize.toString();
  }
  if (params.page) {
    searchParams.page = params.page.toString();
  }

  return makeRequest<CourtListenerSearchResponse>('/search/', searchParams);
}

/**
 * Get a specific opinion by ID
 */
export async function getOpinion(opinionId: number): Promise<CourtListenerOpinion> {
  return makeRequest<CourtListenerOpinion>(`/opinions/${opinionId}/`);
}

/**
 * Get a cluster (case) by ID
 */
export async function getCluster(clusterId: number): Promise<CourtListenerCluster> {
  return makeRequest<CourtListenerCluster>(`/clusters/${clusterId}/`);
}

/**
 * Get court information
 */
export async function getCourt(courtId: string): Promise<CourtListenerCourt> {
  return makeRequest<CourtListenerCourt>(`/courts/${courtId}/`);
}

/**
 * Get list of California courts
 */
export async function getCaliforniaCourts(): Promise<CourtListenerCourt[]> {
  const response = await makeRequest<{ results: CourtListenerCourt[] }>('/courts/', {
    jurisdiction: 'S', // State
  });

  // Filter to California courts
  return response.results.filter(
    (court) => court.id.startsWith('cal') || court.citation_string.toLowerCase().includes('cal')
  );
}

// California court IDs in CourtListener
export const CA_COURT_IDS = {
  SUPREME_COURT: 'cal',
  COURT_OF_APPEAL: [
    'calctapp', // Generic
    'calctapp_1st', // 1st District
    'calctapp_2nd', // 2nd District
    'calctapp_3rd', // 3rd District
    'calctapp_4th', // 4th District
    'calctapp_5th', // 5th District
    'calctapp_6th', // 6th District
  ],
  APPELLATE_DIVISION: 'calctapp_app_div',
} as const;

/**
 * Fetch California case law for a specific topic
 */
export async function fetchCaliforniaCaseLaw(params: {
  topic: string;
  limit?: number;
  startDate?: string;
}): Promise<
  Array<{
    id: number;
    citation: string;
    caseName: string;
    court: string;
    dateFiled: string;
    text: string;
    summary: string;
  }>
> {
  const results: Array<{
    id: number;
    citation: string;
    caseName: string;
    court: string;
    dateFiled: string;
    text: string;
    summary: string;
  }> = [];

  const limit = params.limit || 50;

  // Search for relevant opinions
  const searchResults = await searchOpinions({
    query: params.topic,
    court: 'cal', // California Supreme Court
    dateFiled_after: params.startDate,
    pageSize: Math.min(limit, 20),
  });

  for (const result of searchResults.results.slice(0, limit)) {
    try {
      // Fetch full opinion
      const cluster = await getCluster(result.cluster_id);

      // Get the main opinion text
      let opinionText = '';
      const opinionUrl = cluster.sub_opinions[0];
      if (opinionUrl) {
        // Fetch first opinion
        const opinionIdStr = opinionUrl.split('/').filter(Boolean).pop();
        const opinionId = parseInt(opinionIdStr || '0', 10);
        if (opinionId) {
          const opinion = await getOpinion(opinionId);
          opinionText = opinion.plain_text || '';
        }
      }

      // Format citation
      const firstCitation = cluster.citations[0];
      const citationStr = firstCitation
        ? `${firstCitation.volume} ${firstCitation.reporter} ${firstCitation.page}`
        : result.citation.join(', ');

      results.push({
        id: result.cluster_id,
        citation: citationStr,
        caseName: cluster.case_name || result.caseName,
        court: result.court,
        dateFiled: cluster.date_filed || result.dateFiled,
        text: opinionText,
        summary: cluster.summary || cluster.syllabus || result.snippet,
      });
    } catch (error) {
      console.error(`Failed to fetch opinion ${result.cluster_id}:`, error);
      // Continue with other results
    }
  }

  return results;
}

/**
 * Format CourtListener citation to standard format
 */
export function formatCitation(citation: CourtListenerCitation): string {
  return `${citation.volume} ${citation.reporter} ${citation.page}`;
}
