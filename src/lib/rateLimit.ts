/**
 * Rate Limiting para API routes
 * 
 * Estratégia:
 * - Dev: Map em memória (simples, sem dependências)
 * - Prod: Redis via ioredis (distribuído, persistente)
 * 
 * Configuração via variáveis de ambiente:
 *   RATE_LIMIT_GENERAL=60   (req/min)
 *   RATE_LIMIT_OCR=10
 *   RATE_LIMIT_EXPORT=20
 *   RATE_LIMIT_RAG=30
 *   RATE_LIMIT_BANK=20
 */

import { NextRequest, NextResponse } from 'next/server';

interface RateLimitConfig {
  windowMs: number;
  maxRequests: number;
}

const DEFAULT_WINDOW_MS = 60 * 1000; // 1 minuto

const configs: Record<string, RateLimitConfig> = {
  general: {
    windowMs: DEFAULT_WINDOW_MS,
    maxRequests: parseInt(process.env.RATE_LIMIT_GENERAL || '60'),
  },
  ocr: {
    windowMs: DEFAULT_WINDOW_MS,
    maxRequests: parseInt(process.env.RATE_LIMIT_OCR || '10'),
  },
  export: {
    windowMs: DEFAULT_WINDOW_MS,
    maxRequests: parseInt(process.env.RATE_LIMIT_EXPORT || '20'),
  },
  rag: {
    windowMs: DEFAULT_WINDOW_MS,
    maxRequests: parseInt(process.env.RATE_LIMIT_RAG || '30'),
  },
  bank: {
    windowMs: DEFAULT_WINDOW_MS,
    maxRequests: parseInt(process.env.RATE_LIMIT_BANK || '20'),
  },
};

// ============================================================
// IMPLEMENTACAO EM MEMORIA (Dev / Fallback)
// ============================================================

interface WindowEntry {
  count: number;
  resetTime: number;
}

const memoryStore = new Map<string, WindowEntry>();

function getClientIp(request: NextRequest): string {
  const forwarded = request.headers.get('x-forwarded-for');
  if (forwarded) {
    return forwarded.split(',')[0].trim();
  }
  return request.ip || 'unknown';
}

function checkMemoryLimit(key: string, config: RateLimitConfig): { allowed: boolean; remaining: number; resetTime: number } {
  const now = Date.now();
  const entry = memoryStore.get(key);

  if (!entry || now > entry.resetTime) {
    // Nova janela
    const resetTime = now + config.windowMs;
    memoryStore.set(key, { count: 1, resetTime });
    return { allowed: true, remaining: config.maxRequests - 1, resetTime };
  }

  if (entry.count >= config.maxRequests) {
    return { allowed: false, remaining: 0, resetTime: entry.resetTime };
  }

  entry.count++;
  return { allowed: true, remaining: config.maxRequests - entry.count, resetTime: entry.resetTime };
}

// Limpeza periódica do Map (evita memory leak)
setInterval(() => {
  const now = Date.now();
  Array.from(memoryStore.entries()).forEach(([key, entry]) => {
    if (now > entry.resetTime) {
      memoryStore.delete(key);
    }
  });
}, 60 * 1000);

// ============================================================
// API PÚBLICA
// ============================================================

export interface RateLimitResult {
  allowed: boolean;
  limit: number;
  remaining: number;
  resetTime: number;
}

/**
 * Verifica se o request está dentro do rate limit.
 * Retorna { allowed: false, ... } se excedido.
 */
export async function checkRateLimit(
  request: NextRequest,
  category: 'general' | 'ocr' | 'export' | 'rag' | 'bank' = 'general'
): Promise<RateLimitResult> {
  const config = configs[category];
  const clientIp = getClientIp(request);
  const key = `ratelimit:${category}:${clientIp}`;

  // TODO: Implementar Redis rate limit em produção
  // if (redisConnection?.status === 'ready') { ... }

  const result = checkMemoryLimit(key, config);
  return {
    allowed: result.allowed,
    limit: config.maxRequests,
    remaining: result.remaining,
    resetTime: result.resetTime,
  };
}

/**
 * Wrapper para routes Next.js.
 * Retorna 429 Too Many Requests se o limite for excedido.
 */
export async function applyRateLimit(
  request: NextRequest,
  category: 'general' | 'ocr' | 'export' | 'rag' | 'bank' = 'general'
): Promise<NextResponse | null> {
  const result = await checkRateLimit(request, category);

  if (!result.allowed) {
    const retryAfter = Math.ceil((result.resetTime - Date.now()) / 1000);
    return NextResponse.json(
      {
        error: 'Demasiados pedidos. Por favor, aguarde.',
        retryAfter,
      },
      {
        status: 429,
        headers: {
          'X-RateLimit-Limit': String(result.limit),
          'X-RateLimit-Remaining': String(result.remaining),
          'X-RateLimit-Reset': String(Math.ceil(result.resetTime / 1000)),
          'Retry-After': String(retryAfter),
        },
      }
    );
  }

  return null;
}
