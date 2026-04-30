/**
 * API Route: RAG Tax Advisor Chat
 * POST /api/rag-chat
 * 
 * Body: { question: string, companyId?: string }
 * Response: { answer, sources, confidence }
 * 
 * Seguranca:
 * - Rate limit: 30 req/min por IP
 * - Validacao Zod: question (3-2000 chars), companyId?
 * - Autenticacao + RBAC (companyId opcional)
 */

import { NextRequest, NextResponse } from 'next/server';
import { getToken } from 'next-auth/jwt';
import { processRagQuery } from '@/modules/rag_tax_advisor/ragEngine';
import { prisma } from '@/lib/prisma';
import { ragChatSchema, validateOrThrow, ValidationError } from '@/lib/validation';
import { applyRateLimit } from '@/lib/rateLimit';

export async function POST(request: NextRequest) {
  try {
    // 1. Rate limiting
    const rateLimitResponse = await applyRateLimit(request, 'rag');
    if (rateLimitResponse) return rateLimitResponse;

    // 2. Autenticacao
    const token = await getToken({ req: request });
    if (!token) {
      return NextResponse.json({ error: 'Nao autenticado' }, { status: 401 });
    }

    // 3. Parse e validacao do body
    const body = await request.json();
    const validated = validateOrThrow(ragChatSchema, body);
    const { question, companyId } = validated;

    // 4. Se companyId fornecido, verifica permissao
    if (companyId) {
      const company = await prisma.company.findUnique({
        where: { id: companyId },
        select: { ownerId: true, accountantId: true },
      });

      if (!company) {
        return NextResponse.json({ error: 'Empresa nao encontrada' }, { status: 404 });
      }

      const userId = token.id as string;
      const userRole = token.role as string;

      const hasAccess =
        userRole === 'ADMIN' ||
        company.ownerId === userId ||
        company.accountantId === userId;

      if (!hasAccess) {
        return NextResponse.json({ error: 'Sem permissao' }, { status: 403 });
      }
    }

    // 5. Processa query RAG
    const result = await processRagQuery(
      question,
      token.role as string
    );

    // 6. Guarda no historico
    await prisma.ragQuery.create({
      data: {
        question,
        answer: result.answer,
        contextUsed: result.sources as any,
        confidence: result.confidence,
        processingTimeMs: result.processingTimeMs,
        userId: token.id as string,
        companyId: companyId || null,
      },
    });

    return NextResponse.json(result);

  } catch (error) {
    if (error instanceof ValidationError) {
      return NextResponse.json({ error: error.message }, { status: 400 });
    }
    console.error('[API/RAG] Erro:', error);
    return NextResponse.json(
      { error: 'Erro interno no servidor' },
      { status: 500 }
    );
  }
}
