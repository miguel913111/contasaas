/**
 * API Route: RAG Tax Advisor Chat
 * POST /api/rag-chat
 * 
 * Body (JSON): { question: string, companyId?: string }
 * Body (FormData): { question: string, file: File, companyId?: string }
 * Response: { answer, sources, confidence }
 * 
 * Seguranca:
 * - Rate limit: 30 req/min por IP
 * - Validacao Zod: question (3-2000 chars), companyId?
 * - Autenticacao + RBAC
 * - File upload: max 10MB, PDF/JPG/PNG/WEBP
 */

import { NextRequest, NextResponse } from 'next/server';
import { getToken } from 'next-auth/jwt';
import { processRagQuery } from '@/modules/rag_tax_advisor/ragEngine';
import { prisma } from '@/lib/prisma';
import { ragChatSchema, validateOrThrow, ValidationError, ocrSchema } from '@/lib/validation';
import { applyRateLimit } from '@/lib/rateLimit';
import { extractTextFromImage } from '@/modules/ocr_extraction/ocrEngine';

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

    // 3. Parse body (JSON ou FormData)
    let question: string;
    let companyId: string | undefined;
    let fileText: string | undefined;

    const contentType = request.headers.get('content-type') || '';

    if (contentType.includes('multipart/form-data')) {
      // FormData com ficheiro
      const formData = await request.formData();
      question = (formData.get('question') as string) || '';
      companyId = (formData.get('companyId') as string) || undefined;
      const file = formData.get('file') as File | null;

      if (file) {
        // Validar ficheiro
        const buffer = Buffer.from(await file.arrayBuffer());
        const fileValidation = ocrSchema.safeParse({
          file: { size: file.size, type: file.type },
        });
        if (!fileValidation.success) {
          return NextResponse.json(
            { error: 'Ficheiro invalido: ' + fileValidation.error.issues.map(i => i.message).join('; ') },
            { status: 400 }
          );
        }

        try {
          // Extrair texto do ficheiro usando OCR (directamente do buffer)
          fileText = await extractTextFromImage(buffer, file.type);
        } catch (err) {
          console.warn('[RAG] Falha ao extrair texto do ficheiro:', err);
          fileText = '[Nao foi possivel extrair texto do documento]';
        }
      }
    } else {
      // JSON simples
      const body = await request.json();
      const validated = validateOrThrow(ragChatSchema, body);
      question = validated.question;
      companyId = validated.companyId;
    }

    // Validar pergunta
    if (!question || question.trim().length < 3) {
      return NextResponse.json(
        { error: 'Pergunta demasiado curta (min 3 caracteres)' },
        { status: 400 }
      );
    }

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

    // 5. Combinar pergunta com texto do ficheiro se existir
    const finalQuestion = fileText
      ? `${question.trim()}\n\n[Conteudo do documento anexado]:\n${fileText.substring(0, 4000)}`
      : question;

    // 6. Processa query RAG
    const result = await processRagQuery(finalQuestion, token.role as string);

    // 7. Guarda no historico
    await prisma.ragQuery.create({
      data: {
        question: question.substring(0, 2000),
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
