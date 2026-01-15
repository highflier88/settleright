import { kv } from '@vercel/kv';

// Session/cache key prefixes
const PREFIXES = {
  session: 'session:',
  cache: 'cache:',
  rateLimit: 'rate_limit:',
  invitationToken: 'inv_token:',
  analysisJob: 'analysis_job:',
} as const;

// Session management
export async function setSession<T>(
  sessionId: string,
  data: T,
  ttlSeconds: number = 60 * 60 * 24 // 24 hours
): Promise<void> {
  await kv.set(`${PREFIXES.session}${sessionId}`, data, { ex: ttlSeconds });
}

export async function getSession<T>(sessionId: string): Promise<T | null> {
  return kv.get<T>(`${PREFIXES.session}${sessionId}`);
}

export async function deleteSession(sessionId: string): Promise<void> {
  await kv.del(`${PREFIXES.session}${sessionId}`);
}

// Generic caching
export async function setCache<T>(
  key: string,
  data: T,
  ttlSeconds: number = 300 // 5 minutes
): Promise<void> {
  await kv.set(`${PREFIXES.cache}${key}`, data, { ex: ttlSeconds });
}

export async function getCache<T>(key: string): Promise<T | null> {
  return kv.get<T>(`${PREFIXES.cache}${key}`);
}

export async function invalidateCache(key: string): Promise<void> {
  await kv.del(`${PREFIXES.cache}${key}`);
}

export async function invalidateCachePattern(pattern: string): Promise<void> {
  const keys = await kv.keys(`${PREFIXES.cache}${pattern}*`);
  if (keys.length > 0) {
    await kv.del(...keys);
  }
}

// Invitation token storage
export async function storeInvitationToken(
  token: string,
  caseId: string,
  ttlSeconds: number = 60 * 60 * 24 * 7 // 7 days
): Promise<void> {
  await kv.set(`${PREFIXES.invitationToken}${token}`, { caseId }, { ex: ttlSeconds });
}

export async function getInvitationToken(
  token: string
): Promise<{ caseId: string } | null> {
  return kv.get(`${PREFIXES.invitationToken}${token}`);
}

export async function deleteInvitationToken(token: string): Promise<void> {
  await kv.del(`${PREFIXES.invitationToken}${token}`);
}

// Analysis job progress tracking
export interface AnalysisProgress {
  status: 'pending' | 'processing' | 'completed' | 'failed';
  progress: number;
  message?: string;
  startedAt?: number;
  completedAt?: number;
}

export async function setAnalysisProgress(
  jobId: string,
  progress: AnalysisProgress
): Promise<void> {
  await kv.set(`${PREFIXES.analysisJob}${jobId}`, progress, { ex: 60 * 60 * 24 }); // 24 hours
}

export async function getAnalysisProgress(
  jobId: string
): Promise<AnalysisProgress | null> {
  return kv.get(`${PREFIXES.analysisJob}${jobId}`);
}

// Pub/Sub for real-time updates
export async function publishEvent(channel: string, message: unknown): Promise<void> {
  await kv.publish(channel, JSON.stringify(message));
}

// Export the raw kv client for advanced use cases
export { kv };
