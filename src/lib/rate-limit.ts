import { headers } from 'next/headers';

import { RateLimitError } from './api/errors';

// Lazy import KV to avoid errors when environment vars are missing
let kv: typeof import('@vercel/kv').kv | null = null;
const isKVConfigured = !!(process.env.KV_REST_API_URL && process.env.KV_REST_API_TOKEN);

async function getKV() {
  if (!isKVConfigured) return null;
  if (kv) return kv;
  try {
    const module = await import('@vercel/kv');
    kv = module.kv;
    return kv;
  } catch {
    return null;
  }
}

interface RateLimitConfig {
  limit: number;
  window: number; // in seconds
}

interface RateLimitResult {
  success: boolean;
  limit: number;
  remaining: number;
  reset: number;
}

const defaultConfig: RateLimitConfig = {
  limit: 100,
  window: 60, // 1 minute
};

export async function rateLimit(
  identifier?: string,
  config: Partial<RateLimitConfig> = {}
): Promise<RateLimitResult> {
  const { limit, window } = { ...defaultConfig, ...config };

  // Get identifier from IP if not provided
  let key = identifier;
  if (!key) {
    const headersList = headers();
    const ip =
      headersList.get('x-forwarded-for')?.split(',')[0] ||
      headersList.get('x-real-ip') ||
      'anonymous';
    key = `rate_limit:${ip}`;
  } else {
    key = `rate_limit:${identifier}`;
  }

  const now = Math.floor(Date.now() / 1000);
  const windowStart = now - window;

  // Get KV client (returns null if not configured)
  const kvClient = await getKV();

  // If KV is not available, allow all requests (no rate limiting)
  if (!kvClient) {
    return {
      success: true,
      limit,
      remaining: limit,
      reset: now + window,
    };
  }

  try {
    // Use a sorted set to track request timestamps
    // Remove old entries
    await kvClient.zremrangebyscore(key, 0, windowStart);

    // Count current entries
    const count = await kvClient.zcard(key);

    if (count >= limit) {
      // Get the oldest entry to calculate reset time
      const oldest = await kvClient.zrange<number[]>(key, 0, 0, { withScores: true });
      const resetTime = oldest.length > 1 && oldest[1] !== undefined ? oldest[1] + window : now + window;

      return {
        success: false,
        limit,
        remaining: 0,
        reset: resetTime,
      };
    }

    // Add current request
    await kvClient.zadd(key, { score: now, member: `${now}:${Math.random()}` });

    // Set expiry on the key
    await kvClient.expire(key, window);

    return {
      success: true,
      limit,
      remaining: limit - count - 1,
      reset: now + window,
    };
  } catch (error) {
    // If KV is unavailable, allow the request but log the error
    console.error('Rate limit check failed:', error);
    return {
      success: true,
      limit,
      remaining: limit,
      reset: now + window,
    };
  }
}

export async function checkRateLimit(
  identifier?: string,
  config: Partial<RateLimitConfig> = {}
): Promise<void> {
  const result = await rateLimit(identifier, config);
  if (!result.success) {
    throw new RateLimitError(
      `Rate limit exceeded. Try again in ${result.reset - Math.floor(Date.now() / 1000)} seconds.`
    );
  }
}

// Predefined rate limit configurations
export const rateLimitConfigs = {
  // Standard API endpoints
  api: { limit: 100, window: 60 },
  // Authentication endpoints
  auth: { limit: 10, window: 60 },
  // File uploads
  upload: { limit: 20, window: 300 },
  // AI analysis (expensive operations)
  analysis: { limit: 5, window: 300 },
  // Payment endpoints
  payment: { limit: 10, window: 60 },
} as const;
