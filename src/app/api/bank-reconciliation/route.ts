/**
 * API Route: Reconciliacao Bancaria (CAMT.053)
 * POST /api/bank-reconciliation
 * 
 * Body: multipart/form-data com XML CAMT.053 + companyId
 * Response: JSON com resultados de matching
 * 
 * Seguranca:
 * - Rate limit: 20 req/min por IP
 * - Validacao Zod: file (max 5MB, XML), companyId
 * - Autenticacao + RBAC
 */

import { NextRequest, NextResponse } from 'next/server';
import { getToken } from 'next-auth/jwt';
import { parseCamt053, reconcileTransactions, saveReconciliationResults } from '@/modules/bank_reconciliation/camt053Parser';
import { parsePdfStatement } from '@/modules/bank_reconciliation/pdfStatementParser';
import { prisma } from '@/lib/prisma';
import { bankReconciliationSchema, validateOrThrow, ValidationError } from '@/lib/validation';
import { applyRateLimit } from '@/lib/rateLimit';
import { logAudit, AuditActions } from '@/lib/auditLog';

export async function POST(request: NextRequest) {
  try {
    // 1. Rate limiting
    const rateLimitResponse = await applyRateLimit(request, 'bank');
    if (rateLimitResponse) return rateLimitResponse;

    // 2. Autenticacao
    const token = await getToken({ req: request });
    if (!token) {
      return NextResponse.json({ error: 'Nao autenticado' }, { status: 401 });
    }

    // 3. Parse e validacao do body
    const formData = await request.formData();
    const validated = validateOrThrow(bankReconciliationSchema, {
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

    // 5. Processa ficheiro (XML ou PDF)
    const bytes = await file.arrayBuffer();
    const buffer = Buffer.from(bytes);
    const isPdf = file.type === 'application/pdf' || file.name.toLowerCase().endsWith('.pdf');

    let parsed: { statementId: string; accountIban: string; openingBalance: number; closingBalance: number; transactions: any[] };

    if (isPdf) {
      // Extrai transacoes do PDF
      const pdfResult = await parsePdfStatement(buffer);
      parsed = {
        statementId: pdfResult.statementId,
        accountIban: pdfResult.accountIban,
        openingBalance: pdfResult.openingBalance,
        closingBalance: pdfResult.closingBalance,
        transactions: pdfResult.transactions.map((t) => ({
          externalId: t.reference || `${t.date}-${t.amount}`,
          bookingDate: new Date(t.date),
          amount: t.amount,
          description: t.description,
          counterpartyName: t.counterparty || '',
          reference: t.reference || '',
        })),
      };
    } else {
      // Parse XML CAMT.053
      const xmlContent = buffer.toString('utf-8');
      parsed = parseCamt053(xmlContent);
    }

    // 6. Reconcilia
    const results = await reconcileTransactions(companyId, parsed.transactions, parsed.statementId);

    // 7. Guarda resultados
    await saveReconciliationResults(companyId, parsed.statementId, results);

    // 8. Resumo
    const summary = {
      statementId: parsed.statementId,
      accountIban: parsed.accountIban,
      openingBalance: parsed.openingBalance,
      closingBalance: parsed.closingBalance,
      totalTransactions: results.length,
      exactMatches: results.filter((r) => r.method === 'exact').length,
      knapsackMatches: results.filter((r) => r.method === 'knapsack').length,
      manualRequired: results.filter((r) => r.method === 'manual').length,
      totalDifferences: results.reduce((sum, r) => sum + (r.difference || 0), 0),
      results: results.map((r) => ({
        transaction: {
          externalId: r.transaction.externalId,
          amount: r.transaction.amount,
          description: r.transaction.description,
          bookingDate: r.transaction.bookingDate,
        },
        matchedInvoices: r.matchedInvoices,
        totalMatched: r.totalMatched,
        difference: r.difference,
        method: r.method,
      })),
    };

    await logAudit({
      action: AuditActions.BANK_RECONCILED,
      entityType: 'BankTransaction',
      userId,
      companyId,
      details: { statementId: parsed.statementId, totalTransactions: results.length, exactMatches: summary.exactMatches },
    });

    return NextResponse.json(summary);

  } catch (error) {
    if (error instanceof ValidationError) {
      return NextResponse.json({ error: error.message }, { status: 400 });
    }
    console.error('[API/Bank] Erro:', error);
    const message = error instanceof Error ? error.message : 'Erro interno';
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
