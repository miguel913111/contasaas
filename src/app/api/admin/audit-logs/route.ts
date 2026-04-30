/**
 * API Route: Audit Logs (Admin only)
 * GET /api/admin/audit-logs
 * 
 * Query params: ?page=1&limit=20&action=&userId=&companyId=
 * Response: { logs: AuditLog[], total: number }
 * 
 * Seguranca: Apenas ADMIN pode aceder
 */

import { NextRequest, NextResponse } from 'next/server';
import { getToken } from 'next-auth/jwt';
import { prisma } from '@/lib/prisma';
import { applyRateLimit } from '@/lib/rateLimit';

export async function GET(request: NextRequest) {
  try {
    const rateLimitResponse = await applyRateLimit(request, 'general');
    if (rateLimitResponse) return rateLimitResponse;

    const token = await getToken({ req: request });
    if (!token || token.role !== 'ADMIN') {
      return NextResponse.json({ error: 'Acesso restrito a administradores' }, { status: 403 });
    }

    const { searchParams } = new URL(request.url);
    const page = parseInt(searchParams.get('page') || '1');
    const limit = Math.min(parseInt(searchParams.get('limit') || '20'), 100);
    const action = searchParams.get('action') || undefined;
    const userId = searchParams.get('userId') || undefined;
    const companyId = searchParams.get('companyId') || undefined;

    const where: any = {};
    if (action) where.action = action;
    if (userId) where.userId = userId;
    if (companyId) where.companyId = companyId;

    const [logs, total] = await Promise.all([
      prisma.auditLog.findMany({
        where,
        include: { user: { select: { name: true, email: true } }, company: { select: { name: true } } },
        orderBy: { createdAt: 'desc' },
        skip: (page - 1) * limit,
        take: limit,
      }),
      prisma.auditLog.count({ where }),
    ]);

    return NextResponse.json({ logs, total, page, limit });

  } catch (error) {
    console.error('[API/Admin/AuditLogs] Erro:', error);
    return NextResponse.json({ error: 'Erro interno' }, { status: 500 });
  }
}
