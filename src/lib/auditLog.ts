/**
 * Audit Logging — Regista todas as acoes criticas do sistema
 * 
 * Uso:
 *   await logAudit({
 *     action: 'APPROVE_INVOICE',
 *     entityType: 'Invoice',
 *     entityId: invoiceId,
 *     userId: session.user.id,
 *     companyId: invoice.companyId,
 *     details: { previousStatus: 'PENDING', newStatus: 'APPROVED' },
 *   });
 */

import { prisma } from './prisma';

export interface AuditLogInput {
  action: string;
  entityType: string;
  entityId?: string;
  userId?: string;
  companyId?: string;
  details?: Record<string, any>;
  ipAddress?: string;
  userAgent?: string;
}

export async function logAudit(input: AuditLogInput): Promise<void> {
  try {
    await prisma.auditLog.create({
      data: {
        action: input.action,
        entityType: input.entityType,
        entityId: input.entityId,
        userId: input.userId,
        companyId: input.companyId,
        details: input.details || {},
        ipAddress: input.ipAddress,
        userAgent: input.userAgent,
      },
    });
  } catch (error) {
    // Falha no audit log nao deve quebrar a operacao principal
    console.error('[AuditLog] Erro ao registar:', error);
  }
}

// Helpers pre-definidos para acoes comuns
export const AuditActions = {
  INVOICE_APPROVED: 'INVOICE_APPROVED',
  INVOICE_REJECTED: 'INVOICE_REJECTED',
  INVOICE_EXPORTED: 'INVOICE_EXPORTED',
  INVOICE_CREATED: 'INVOICE_CREATED',
  COMPANY_CREATED: 'COMPANY_CREATED',
  COMPANY_UPDATED: 'COMPANY_UPDATED',
  BANK_RECONCILED: 'BANK_RECONCILED',
  RAG_QUERY: 'RAG_QUERY',
  USER_LOGIN: 'USER_LOGIN',
  USER_ROLE_CHANGED: 'USER_ROLE_CHANGED',
} as const;
