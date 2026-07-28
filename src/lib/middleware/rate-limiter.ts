/**
 * Rate Limiter — two-tier rate limiting using Upstash Redis.
 *
 * Tier 1 (Burst): IP-based, fixed window — anti-spam protection
 * Tier 2 (Budget): API-key/user-based, sliding window — quota protection
 *
 * Returns proper 429 responses with Retry-After headers.
 */

import { Ratelimit } from '@upstash/ratelimit';
import { Redis } from '@upstash/redis';
import { logger } from '@/lib/logger';

const log = logger.child({ component: 'rate-limiter' });

let redis: Redis | null = null;
let burstLimiter: Ratelimit | null = null;
let budgetLimiter: Ratelimit | null = null;

function getRedis(): Redis {
  if (!redis) {
    const url = process.env.UPSTASH_REDIS_REST_URL;
    const token = process.env.UPSTASH_REDIS_REST_TOKEN;

    if (!url || !token) {
      throw new Error('UPSTASH_REDIS_REST_URL and UPSTASH_REDIS_REST_TOKEN are required for rate limiting');
    }

    redis = new Redis({ url, token });
  }
  return redis;
}

/**
 * IP-based burst rate limiter.
 * 15 requests per minute — protects free-tier provider quotas (Groq/Gemini free limits).
 */
function getBurstLimiter(): Ratelimit {
  if (!burstLimiter) {
    burstLimiter = new Ratelimit({
      redis: getRedis(),
      limiter: Ratelimit.fixedWindow(15, '60 s'),
      prefix: 'mr:burst',
    });
  }
  return burstLimiter;
}

/**
 * API-key/user-based budget rate limiter.
 * 100 requests per hour — keeps daily usage comfortably inside Upstash & LLM free quotas.
 */
function getBudgetLimiter(): Ratelimit {
  if (!budgetLimiter) {
    budgetLimiter = new Ratelimit({
      redis: getRedis(),
      limiter: Ratelimit.slidingWindow(100, '3600 s'),
      prefix: 'mr:budget',
    });
  }
  return budgetLimiter;
}

export interface RateLimitResult {
  allowed: boolean;
  tier: 'burst' | 'budget';
  limit: number;
  remaining: number;
  reset: number;
  retryAfterMs: number;
}

/**
 * Check both rate limit tiers.
 * Returns the first tier that rejects the request, or allowed=true if both pass.
 */
export async function checkRateLimit(
  ip: string,
  identifier: string,
): Promise<RateLimitResult> {
  const url = process.env.UPSTASH_REDIS_REST_URL;
  const token = process.env.UPSTASH_REDIS_REST_TOKEN;

  // Graceful bypass if Upstash Redis is not configured or dummy
  if (!url || !token || url.includes('localhost') || token.includes('dummy')) {
    return {
      allowed: true,
      tier: 'burst',
      limit: 1000,
      remaining: 999,
      reset: Date.now() + 60000,
      retryAfterMs: 0,
    };
  }

  try {
    // Tier 1: Burst (IP-based)
    const burstResult = await getBurstLimiter().limit(ip);
    if (!burstResult.success) {
      log.warn('Burst rate limit exceeded', { ip, remaining: burstResult.remaining });
      return {
        allowed: false,
        tier: 'burst',
        limit: burstResult.limit,
        remaining: burstResult.remaining,
        reset: burstResult.reset,
        retryAfterMs: Math.max(burstResult.reset - Date.now(), 1000),
      };
    }

    // Tier 2: Budget (user/key-based)
    const budgetResult = await getBudgetLimiter().limit(identifier);
    if (!budgetResult.success) {
      log.warn('Budget rate limit exceeded', { identifier, remaining: budgetResult.remaining });
      return {
        allowed: false,
        tier: 'budget',
        limit: budgetResult.limit,
        remaining: budgetResult.remaining,
        reset: budgetResult.reset,
        retryAfterMs: Math.max(budgetResult.reset - Date.now(), 1000),
      };
    }

    return {
      allowed: true,
      tier: 'burst',
      limit: budgetResult.limit,
      remaining: budgetResult.remaining,
      reset: budgetResult.reset,
      retryAfterMs: 0,
    };
  } catch (error) {
    // If rate limiting fails (Redis down), log but allow the request
    // This prevents a Redis outage from blocking all traffic
    log.error('Rate limiting check failed — allowing request', {
      error: error instanceof Error ? error.message : 'Unknown',
    });
    return {
      allowed: true,
      tier: 'burst',
      limit: 0,
      remaining: 0,
      reset: 0,
      retryAfterMs: 0,
    };
  }
}

/**
 * Create rate limit response headers.
 */
export function rateLimitHeaders(result: RateLimitResult): Record<string, string> {
  const headers: Record<string, string> = {
    'X-RateLimit-Limit': String(result.limit),
    'X-RateLimit-Remaining': String(result.remaining),
    'X-RateLimit-Reset': String(result.reset),
  };

  if (!result.allowed) {
    headers['Retry-After'] = String(Math.ceil(result.retryAfterMs / 1000));
  }

  return headers;
}
