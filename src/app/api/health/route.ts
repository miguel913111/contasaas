/**
 * API Route: Health Check
 * GET /api/health
 * 
 * Verifica estado dos servicos:
 * - Database (Prisma)
 * - Redis (BullMQ)
 * - OCR Engine (Gemini disponivel?)
 * 
 * Usado por monitoring, Docker health checks, etc.
 */

import { NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';

export const dynamic = 'force-dynamic';

interface HealthStatus {
  status: 'healthy' | 'degraded' | 'unhealthy';
  timestamp: string;
  version: string;
  services: {
    database: { status: 'ok' | 'error'; latencyMs: number; message?: string };
    redis: { status: 'ok' | 'error' | 'skipped'; message?: string };
    ocr: { status: 'ok' | 'error' | 'degraded'; message?: string };
  };
}

export async function GET() {
  const startTime = Date.now();
  const status: HealthStatus = {
    status: 'healthy',
    timestamp: new Date().toISOString(),
    version: process.env.npm_package_version || '0.1.0',
    services: {
      database: { status: 'error', latencyMs: 0 },
      redis: { status: 'skipped', message: 'Redis nao configurado' },
      ocr: { status: 'degraded', message: 'Gemini API key nao configurada' },
    },
  };

  // 1. Check Database
  try {
    const dbStart = Date.now();
    await prisma.$queryRaw`SELECT 1`;
    status.services.database = {
      status: 'ok',
      latencyMs: Date.now() - dbStart,
    };
  } catch (error) {
    status.services.database = {
      status: 'error',
      latencyMs: Date.now() - startTime,
      message: error instanceof Error ? error.message : 'Erro desconhecido',
    };
    status.status = 'unhealthy';
  }

  // 2. Check Redis (se REDIS_URL configurada)
  if (process.env.REDIS_URL && process.env.REDIS_URL !== 'redis://localhost:6379') {
    try {
      const { redisConnection } = await import('@/lib/queue');
      await redisConnection.ping();
      status.services.redis = { status: 'ok' };
    } catch (error) {
      status.services.redis = {
        status: 'error',
        message: error instanceof Error ? error.message : 'Redis indisponivel',
      };
      if (status.status !== 'unhealthy') status.status = 'degraded';
    }
  }

  // 3. Check OCR (Gemini API key)
  if (process.env.GEMINI_API_KEY && process.env.GEMINI_API_KEY.length > 10) {
    status.services.ocr = { status: 'ok' };
  }

  // HTTP status code
  const httpStatus = status.status === 'healthy' ? 200 : status.status === 'degraded' ? 200 : 503;

  return NextResponse.json(status, {
    status: httpStatus,
    headers: {
      'Cache-Control': 'no-store, no-cache, must-revalidate',
    },
  });
}
