// In-memory sliding window rate limiter. Module-scoped Map persists for
// the lifetime of the Node process, which on Vercel survives within a
// single instance only — across cold starts the limits reset. That is OK
// for the public dashboard tier; institutional tiers MUST move to a
// durable store (Upstash, Redis) before launch.

interface BucketKey {
  key: string;
  limit: number;
  windowMs: number;
}

const buckets = new Map<string, number[]>();

export interface RateCheck {
  allowed: boolean;
  remaining: number;
  resetMs: number;
  retryAfterSeconds: number;
}

export function check({ key, limit, windowMs }: BucketKey): RateCheck {
  const now = Date.now();
  const prior = buckets.get(key) ?? [];
  const live = prior.filter((t) => now - t < windowMs);
  if (live.length >= limit) {
    const oldest = live[0] ?? now;
    const resetMs = Math.max(0, windowMs - (now - oldest));
    return {
      allowed: false,
      remaining: 0,
      resetMs,
      retryAfterSeconds: Math.ceil(resetMs / 1000),
    };
  }
  live.push(now);
  buckets.set(key, live);
  return {
    allowed: true,
    remaining: limit - live.length,
    resetMs: windowMs,
    retryAfterSeconds: 0,
  };
}

export function clientIp(headers: Headers): string {
  return (
    headers.get("x-forwarded-for")?.split(",")[0]?.trim() ??
    headers.get("x-real-ip") ??
    "unknown"
  );
}

// Tier defaults — tightened in production behind a feature flag.
export const RATE_PUBLIC = { limit: 60, windowMs: 60 * 60 * 1000 } as const;
export const RATE_API_KEY = { limit: 1000, windowMs: 60 * 60 * 1000 } as const;
