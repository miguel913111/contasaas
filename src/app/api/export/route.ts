/**
 * API Route: Exportacao para ERPs
 * POST /api/export
 * 
 * Body: { erpType: 'TOCONLINE'|'PRIMAVERA_V10'|'PHC_CS', companyId, invoiceIds }
 * Response: Blob ou JSON com status
 * 
 * Seguranca:
 * - Rate limit: 20 req/min por IP
 * - Validacao Zod: erpType, companyId, invoiceIds (max 500), format?
 * - Autenticacao + RBAC (ENI limitado a PHC_CS)
 */

import { NextRequest, NextResponse } from 'next/server';
import { getToken } from 'next-auth/jwt';
import { prisma } from '@/lib/prisma';
import { exportToToconline } from '@/modules/erp_exporters/toconlineExporter';
import { generatePrimaveraExcel } from '@/modules/erp_exporters/primaveraExporter';
import { generatePhcCsv, generatePhcRawText } from '@/modules/erp_exporters/phcExporter';
import { exportSchema, validateOrThrow, ValidationError } from '@/lib/validation';
import { applyRateLimit } from '@/lib/rateLimit';
import { logAudit, AuditActions } from '@/lib/auditLog';

export async function POST(request: NextRequest) {
  try {
    // 1. Rate limiting
    const rateLimitResponse = await applyRateLimit(request, 'export');
    if (rateLimitResponse) return rateLimitResponse;

    // 2. Autenticacao
    const token = await getToken({ req: request });
    if (!token) {
      return NextResponse.json({ error: 'Nao autenticado' }, { status: 401 });
    }

    // 3. Parse e validacao do body
    const body = await request.json();
    const validated = validateOrThrow(exportSchema, body);
    const { erpType, companyId, invoiceIds, format } = validated;

    // 4. Verifica permissao
    const company = await prisma.company.findUnique({
      where: { id: companyId },
      select: { ownerId: true, accountantId: true, name: true },
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

    // ENI nao pode exportar para ERP (apenas contabilistas)
    if (userRole === 'SELF_SERVICE' && erpType !== 'PHC_CS') {
      return NextResponse.json(
        { error: 'Portal ENI apenas permite exportacao basica. Contacte o seu contabilista.' },
        { status: 403 }
      );
    }

    let result;

    switch (erpType) {
      case 'TOCONLINE': {
        result = await exportToToconline(companyId, invoiceIds);
        await logAudit({ action: AuditActions.INVOICE_EXPORTED, entityType: 'ErpExport', userId, companyId, details: { erpType, invoiceCount: invoiceIds.length } });
        return NextResponse.json(result);
      }

      case 'PRIMAVERA_V10': {
        const excelBuffer = await generatePrimaveraExcel(companyId, invoiceIds);
        
        await prisma.erpExport.create({
          data: {
            companyId,
            erpType: 'PRIMAVERA_V10',
            status: 'COMPLETED',
            invoiceCount: invoiceIds.length,
            userId,
            completedAt: new Date(),
          },
        });

        await logAudit({ action: AuditActions.INVOICE_EXPORTED, entityType: 'ErpExport', userId, companyId, details: { erpType, invoiceCount: invoiceIds.length } });

        return new NextResponse(new Uint8Array(excelBuffer), {
          status: 200,
          headers: {
            'Content-Type': 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
            'Content-Disposition': `attachment; filename="primavera_${company.name}_${Date.now()}.xlsx"`,
          },
        });
      }

      case 'PHC_CS': {
        if (format === 'raw') {
          const rawBuffer = await generatePhcRawText(companyId, invoiceIds);
          
          await prisma.erpExport.create({
            data: {
              companyId,
              erpType: 'PHC_CS',
              status: 'COMPLETED',
              invoiceCount: invoiceIds.length,
              userId,
              completedAt: new Date(),
            },
          });

          await logAudit({ action: AuditActions.INVOICE_EXPORTED, entityType: 'ErpExport', userId, companyId, details: { erpType, invoiceCount: invoiceIds.length, format: 'raw' } });

          return new NextResponse(new Uint8Array(rawBuffer), {
            status: 200,
            headers: {
              'Content-Type': 'text/plain; charset=utf-8',
              'Content-Disposition': `attachment; filename="phc_${company.name}_${Date.now()}.txt"`,
            },
          });
        } else {
          const csvBuffer = await generatePhcCsv(companyId, invoiceIds);
          
          await prisma.erpExport.create({
            data: {
              companyId,
              erpType: 'PHC_CS',
              status: 'COMPLETED',
              invoiceCount: invoiceIds.length,
              userId,
              completedAt: new Date(),
            },
          });

          await logAudit({ action: AuditActions.INVOICE_EXPORTED, entityType: 'ErpExport', userId, companyId, details: { erpType, invoiceCount: invoiceIds.length, format: 'csv' } });

          return new NextResponse(new Uint8Array(csvBuffer), {
            status: 200,
            headers: {
              'Content-Type': 'text/csv; charset=utf-8',
              'Content-Disposition': `attachment; filename="phc_${company.name}_${Date.now()}.csv"`,
            },
          });
        }
      }

      default:
        return NextResponse.json({ error: 'ERP nao suportado' }, { status: 400 });
    }

  } catch (error) {
    if (error instanceof ValidationError) {
      return NextResponse.json({ error: error.message }, { status: 400 });
    }
    console.error('[API/Export] Erro:', error);
    return NextResponse.json(
      { error: 'Erro interno no servidor' },
      { status: 500 }
    );
  }
}
