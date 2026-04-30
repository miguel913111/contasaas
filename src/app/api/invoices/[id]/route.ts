/**
 * API Route: Gestao de Fatura Individual
 * GET /api/invoices/{id}    — obter detalhes
 * PATCH /api/invoices/{id}  — atualizar (status, conta, etc.)
 * 
 * Seguranca:
 * - Rate limit: general
 * - Validacao Zod
 * - RBAC: apenas accountant da empresa ou admin
 */

import { NextRequest, NextResponse } from 'next/server';
import { getToken } from 'next-auth/jwt';
import { prisma } from '@/lib/prisma';
import { z } from 'zod';
import { applyRateLimit } from '@/lib/rateLimit';
import { logAudit, AuditActions } from '@/lib/auditLog';
import { sendEmail, buildInvoiceApprovedEmail } from '@/lib/email';
import { invalidateDashboard } from '@/lib/cache';

const updateSchema = z.object({
  status: z.enum(['PENDING', 'APPROVED', 'REJECTED', 'EXPORTED']).optional(),
  accountCode: z.string().min(1).max(20).optional(),
  documentNumber: z.string().min(1).max(100).optional(),
  supplierName: z.string().max(200).optional(),
  supplierNif: z.string().regex(/^\d{9}$/).optional(),
  notes: z.string().max(1000).optional(),
});

async function getInvoiceWithAccess(invoiceId: string, userId: string, userRole: string) {
  const invoice = await prisma.invoice.findUnique({
    where: { id: invoiceId },
    include: { company: true, lines: true },
  });

  if (!invoice) return { invoice: null, hasAccess: false };

  const hasAccess =
    userRole === 'ADMIN' ||
    invoice.company.accountantId === userId ||
    invoice.company.ownerId === userId;

  return { invoice, hasAccess };
}

// GET — Detalhes da fatura
export async function GET(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const token = await getToken({ req: request });
    if (!token) {
      return NextResponse.json({ error: 'Nao autenticado' }, { status: 401 });
    }

    const { id } = params;
    const { invoice, hasAccess } = await getInvoiceWithAccess(
      id,
      token.id as string,
      token.role as string
    );

    if (!invoice) {
      return NextResponse.json({ error: 'Fatura nao encontrada' }, { status: 404 });
    }

    if (!hasAccess) {
      return NextResponse.json({ error: 'Sem permissao' }, { status: 403 });
    }

    return NextResponse.json(invoice);

  } catch (error) {
    console.error('[API/Invoice/GET] Erro:', error);
    return NextResponse.json({ error: 'Erro interno' }, { status: 500 });
  }
}

// PATCH — Atualizar fatura
export async function PATCH(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const rateLimitResponse = await applyRateLimit(request, 'general');
    if (rateLimitResponse) return rateLimitResponse;

    const token = await getToken({ req: request });
    if (!token) {
      return NextResponse.json({ error: 'Nao autenticado' }, { status: 401 });
    }

    const { id } = params;
    const { invoice, hasAccess } = await getInvoiceWithAccess(
      id,
      token.id as string,
      token.role as string
    );

    if (!invoice) {
      return NextResponse.json({ error: 'Fatura nao encontrada' }, { status: 404 });
    }

    if (!hasAccess) {
      return NextResponse.json({ error: 'Sem permissao' }, { status: 403 });
    }

    const body = await request.json();
    const result = updateSchema.safeParse(body);

    if (!result.success) {
      const issues = result.error.issues.map(i => `${i.path.join('.')}: ${i.message}`).join('; ');
      return NextResponse.json({ error: issues }, { status: 400 });
    }

    const data = result.data;
    const updateData: any = {};

    if (data.status) updateData.status = data.status;
    if (data.accountCode) updateData.accountCode = data.accountCode;
    if (data.documentNumber) updateData.documentNumber = data.documentNumber;
    if (data.supplierName !== undefined) updateData.supplierName = data.supplierName;
    if (data.supplierNif) updateData.supplierNif = data.supplierNif;
    if (data.notes) updateData.civaArticle21Note = data.notes;

    const updated = await prisma.invoice.update({
      where: { id },
      data: updateData,
      include: { company: true, lines: true },
    });

    // Audit log + email notification + cache invalidation
    if (data.status) {
      await logAudit({
        action: data.status === 'APPROVED' ? AuditActions.INVOICE_APPROVED : AuditActions.INVOICE_REJECTED,
        entityType: 'Invoice',
        entityId: id,
        userId: token.id as string,
        companyId: invoice.companyId,
        details: { previousStatus: invoice.status, newStatus: data.status, documentNumber: updated.documentNumber },
      });

      // Invalidate dashboard cache
      await invalidateDashboard(invoice.companyId);

      // Send email notification to company owner
      if (data.status === 'APPROVED') {
        const owner = await prisma.user.findUnique({
          where: { id: invoice.company.ownerId },
          select: { email: true, name: true },
        });

        if (owner?.email) {
          const emailPayload = buildInvoiceApprovedEmail({
            userName: owner.name || 'Cliente',
            invoiceNumber: updated.documentNumber,
            amount: `${parseFloat(updated.totalValue.toString()).toFixed(2)} EUR`,
            companyName: updated.company.name,
          });
          await sendEmail({ ...emailPayload, to: owner.email });
        }
      }
    }

    return NextResponse.json({
      success: true,
      invoice: updated,
      message: 'Fatura atualizada com sucesso',
    });

  } catch (error) {
    console.error('[API/Invoice/PATCH] Erro:', error);
    return NextResponse.json({ error: 'Erro interno' }, { status: 500 });
  }
}
