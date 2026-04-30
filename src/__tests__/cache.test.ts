import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { getCache, setCache, deleteCache, getOrSet, invalidateDashboard } from '@/lib/cache';

// Mock ioredis
const mockRedis = {
  get: vi.fn(),
  setex: vi.fn(),
  del: vi.fn(),
  keys: vi.fn(),
};

vi.mock('ioredis', () => ({
  default: class Redis {
    constructor() { return mockRedis; }
  },
}));

describe('Cache Layer', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    process.env.REDIS_URL = 'redis://localhost:6379';
  });

  afterEach(() => {
    delete process.env.REDIS_URL;
  });

  it('getCache returns null when no redis', async () => {
    delete process.env.REDIS_URL;
    const result = await getCache('dashboard:kpi:test');
    expect(result).toBeNull();
  });

  it('setCache works with redis', async () => {
    mockRedis.setex.mockResolvedValue('OK');
    await setCache('dashboard:kpi:test', { value: 42 }, 300);
    expect(mockRedis.setex).toHaveBeenCalledWith(
      'dashboard:kpi:test',
      300,
      JSON.stringify({ value: 42 })
    );
  });

  it('getOrSet returns cached value', async () => {
    mockRedis.get.mockResolvedValue(JSON.stringify({ cached: true }));
    const factory = vi.fn().mockResolvedValue({ fresh: true });
    
    const result = await getOrSet('dashboard:kpi:test', factory, 60);
    
    expect(result).toEqual({ cached: true });
    expect(factory).not.toHaveBeenCalled();
  });

  it('getOrSet calls factory when cache miss', async () => {
    mockRedis.get.mockResolvedValue(null);
    mockRedis.setex.mockResolvedValue('OK');
    const factory = vi.fn().mockResolvedValue({ fresh: true });
    
    const result = await getOrSet('dashboard:kpi:test', factory, 60);
    
    expect(result).toEqual({ fresh: true });
    expect(factory).toHaveBeenCalledTimes(1);
    expect(mockRedis.setex).toHaveBeenCalled();
  });

  it('invalidateDashboard deletes matching keys', async () => {
    mockRedis.keys.mockResolvedValue(['dashboard:kpi:1', 'dashboard:kpi:2']);
    mockRedis.del.mockResolvedValue(2);
    
    await invalidateDashboard('company-123');
    
    expect(mockRedis.keys).toHaveBeenCalledWith('dashboard:kpi:company-123*');
    expect(mockRedis.del).toHaveBeenCalledWith('dashboard:kpi:1', 'dashboard:kpi:2');
  });
});
