/**
 * API Route: OCR de Faturas (Assincrono)
 * POST /api/ocr
 * 
 * Body: multipart/form-data com ficheiro + companyId
 * Response: { success: true, jobId: string, message: string }
 * 
 * O processamento real acontece em background via BullMQ.
 * Consulte status em: GET /api/ocr/{jobId}
 * 
 * Seguranca:
 * - Rate limit: 10 req/min por IP
 * - Validacao Zod: file (max 10MB, PDF/JPG/PNG/WEBP), companyId
 * - Autenticacao + RBAC
 */

import { NextRequest, NextResponse } from 'next/server';
import { getToken } from 'next-auth/jwt';
import { prisma } from '@/lib/prisma';
import { ocrSchema, validateOrThrow, ValidationError } from '@/lib/validation';
import { applyRateLimit } from '@/lib/rateLimit';
import { addOcrJob } from '@/lib/queue';
import { saveInvoiceFile } from '@/lib/fileStorage';
import { logAudit, AuditActions } from '@/lib/auditLog';

export async function POST(request: NextRequest) {
  try {
    // 1. Rate limiting
    const rateLimitResponse = await applyRateLimit(request, 'ocr');
    if (rateLimitResponse) return rateLimitResponse;

    // 2. Autenticacao
    const token = await getToken({ req: request });
    if (!token) {
      return NextResponse.json({ error: 'Nao autenticado' }, { status: 401 });
    }

    // 3. Parse e validacao do body
    const formData = await request.formData();
    const validated = validateOrThrow(ocrSchema, {
      file: formData.get('file'),
      companyId: formData.get('companyId'),
    });

    const { file, companyId } = validated;

    // 4. Verifica permissao
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

    // 5. Converte ficheiro para buffer
    const bytes = await file.arrayBuffer();
    const buffer = Buffer.from(bytes);

    // 6. Guarda ficheiro em disco (estruturado)
    // Cria invoice stub para ter um ID para guardar o ficheiro
    const fileHash = require('crypto').createHash('sha256').update(buffer).digest('hex');
    
    const invoiceStub = await prisma.invoice.create({
      data: {
        companyId,
        documentNumber: 'PENDENTE_OCR',
        hashSignature: `pending_${Date.now()}_${fileHash.substring(0, 16)}`,
        fileHash,
        date: new Date(),
        totalValue: 0,
        taxableBase: 0,
        vatTotal: 0,
        status: 'PENDING',
        extractionMethod: 'qr-code', // sera atualizado pelo worker
      },
    });

    // Guarda ficheiro em disco
    const fileUrl = await saveInvoiceFile(companyId, invoiceStub.id, buffer, file.name);

    // Atualiza invoice com fileUrl
    await prisma.invoice.update({
      where: { id: invoiceStub.id },
      data: { fileUrl, fileName: file.name, mimeType: file.type },
    });

    // 7. Adiciona job na fila BullMQ
    const job = await addOcrJob(
      Array.from(buffer),
      file.type,
      companyId,
      userId,
      invoiceStub.id
    );

    await logAudit({
      action: AuditActions.INVOICE_CREATED,
      entityType: 'Invoice',
      entityId: invoiceStub.id,
      userId,
      companyId,
      details: { method: 'ocr', fileName: file.name, fileSize: file.size, jobId: job.id },
    });

    return NextResponse.json({
      success: true,
      jobId: job.id,
      invoiceId: invoiceStub.id,
      message: 'Fatura enviada para processamento. Consulte status em /api/ocr/' + job.id,
    });

  } catch (error) {
    if (error instanceof ValidationError) {
      return NextResponse.json({ error: error.message }, { status: 400 });
    }
    console.error('[API/OCR] Erro:', error);
    return NextResponse.json(
      { error: 'Erro interno no servidor' },
      { status: 500 }
    );
  }
}
