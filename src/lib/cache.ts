/**
 * Redis Cache Layer
 * Wrapper around Redis for query caching with TTL
 */
import Redis from 'ioredis';

const redis = process.env.REDIS_URL
  ? new Redis(process.env.REDIS_URL, {
      maxRetriesPerRequest: 3,
      lazyConnect: true,
    })
  : null;

export type CacheKey =
  | `dashboard:kpi:${string}`
  | `invoices:list:${string}`
  | `company:${string}`
  | `user:${string}`
  | `rag:docs`
  | `stats:${string}`;

const DEFAULT_TTL = 300; // 5 minutes

export async function getCache<T>(key: CacheKey): Promise<T | null> {
  if (!redis) return null;
  try {
    const value = await redis.get(key);
    return value ? JSON.parse(value) : null;
  } catch {
    return null;
  }
}

export async function setCache<T>(
  key: CacheKey,
  value: T,
  ttlSeconds = DEFAULT_TTL
): Promise<void> {
  if (!redis) return;
  try {
    await redis.setex(key, ttlSeconds, JSON.stringify(value));
  } catch {
    // Silently fail — cache is best-effort
  }
}

export async function deleteCache(key: CacheKey | string): Promise<void> {
  if (!redis) return;
  try {
    await redis.del(key);
  } catch {
    // Silently fail
  }
}

export async function invalidatePattern(pattern: string): Promise<void> {
  if (!redis) return;
  try {
    const keys = await redis.keys(pattern);
    if (keys.length > 0) {
      await redis.del(...keys);
    }
  } catch {
    // Silently fail
  }
}

export async function getOrSet<T>(
  key: CacheKey,
  factory: () => Promise<T>,
  ttlSeconds = DEFAULT_TTL
): Promise<T> {
  const cached = await getCache<T>(key);
  if (cached !== null) return cached;

  const value = await factory();
  await setCache(key, value, ttlSeconds);
  return value;
}

// Helper to invalidate dashboard caches when data changes
export async function invalidateDashboard(companyId?: string): Promise<void> {
  if (companyId) {
    await invalidatePattern(`dashboard:kpi:${companyId}*`);
    await invalidatePattern(`invoices:list:${companyId}*`);
    await invalidatePattern(`company:${companyId}`);
  } else {
    await invalidatePattern('dashboard:*');
    await invalidatePattern('invoices:*');
    await invalidatePattern('company:*');
  }
}
