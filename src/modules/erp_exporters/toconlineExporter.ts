/**
 * Exportador para TOConline API
 * 
 * Documentação: API REST assíncrona para commercial_purchases_documents
 * Schema: POST /commercial_purchases_documents
 */

import { prisma } from '@/lib/prisma';
import type { ToconlinePurchaseDocument } from '@/types';

const TOCONLINE_BASE_URL = process.env.TOCONLINE_BASE_URL || 'https://api.toconline.pt';
const TOCONLINE_API_KEY = process.env.TOCONLINE_API_KEY || '';

// ============================================================
// INTERFACE TOCONLINE
// ============================================================

interface ToconlineApiDocument {
  document_type: 'FC' | 'ND' | 'NC';
  document_number: string;
  document_date: string;
  supplier: {
    fiscal_id: string;
    name: string;
  };
  currency: string;
  exchange_rate: number;
  notes?: string;
  lines: Array<{
    description: string;
    account_code: string;
    debit: number;
    credit: number;
    cost_center?: string;
  }>;
  vat_lines: Array<{
    vat_rate: number;
    taxable_amount: number;
    vat_amount: number;
  }>;
}

// ============================================================
// MAPEAMENTO DE DOCUMENTOS
// ============================================================

export async function mapInvoiceToToconline(
  invoiceId: string
): Promise<ToconlinePurchaseDocument | null> {
  const invoice = await prisma.invoice.findUnique({
    where: { id: invoiceId },
    include: {
      lines: true,
      supplier: true,
    },
  });

  if (!invoice) return null;

  // Mapeia tipo de documento
  const docType = mapDocumentType(invoice.documentType);

  // Mapeia linhas
  const lines = invoice.lines.map((line: any) => ({
    description: line.description,
    accountCode: line.accountCode || invoice.accountCode || '6228',
    debit: parseFloat(line.taxableAmount.toString()),
    credit: 0,
    costCenter: line.costCenter,
  }));

  // Adiciona linha de IVA
  lines.push({
    description: 'IVA suportado',
    accountCode: '2432', // IVA dedutível
    debit: parseFloat(invoice.vatTotal.toString()),
    credit: 0,
    costCenter: null,
  });

  // Adiciona linha de contra-partida (Fornecedores)
  lines.push({
    description: `Fornecedor: ${invoice.supplierName || invoice.supplier?.name || 'Desconhecido'}`,
    accountCode: '2211', // Fornecedores de mercadorias e serviços
    debit: 0,
    credit: parseFloat(invoice.totalValue.toString()),
    costCenter: null,
  });

  // Mapeia VAT lines
  const vatLines = invoice.lines
    .filter((line: any) => line.vatRateValue > 0)
    .map((line: any) => ({
      vatRate: parseFloat(line.vatRateValue.toString()),
      taxableAmount: parseFloat(line.taxableAmount.toString()),
      vatAmount: parseFloat(line.vatAmount.toString()),
    }));

  return {
    documentType: docType,
    documentNumber: invoice.documentNumber,
    documentDate: invoice.date.toISOString().split('T')[0],
    supplierNif: invoice.supplierNif || invoice.supplier?.nif || '',
    supplierName: invoice.supplierName || invoice.supplier?.name || 'Fornecedor Desconhecido',
    totalValue: parseFloat(invoice.totalValue.toString()),
    vatTotal: parseFloat(invoice.vatTotal.toString()),
    lines,
    vatLines,
  };
}

function mapDocumentType(type: string): 'FC' | 'ND' | 'NC' {
  switch (type.toUpperCase()) {
    case 'FC':
    case 'FT':
    case 'F':
      return 'FC';
    case 'ND':
    case 'D':
      return 'ND';
    case 'NC':
    case 'C':
      return 'NC';
    default:
      return 'FC';
  }
}

// ============================================================
// EXPORTAÇÃO ASSÍNCRONA
// ============================================================

export async function exportToToconline(
  companyId: string,
  invoiceIds: string[]
): Promise<{
  success: boolean;
  exportId?: string;
  documentIds: string[];
  errors: string[];
}> {
  const errors: string[] = [];
  const documentIds: string[] = [];

  // Mapeia todos os documentos
  const documents: ToconlinePurchaseDocument[] = [];
  for (const invoiceId of invoiceIds) {
    const doc = await mapInvoiceToToconline(invoiceId);
    if (doc) {
      documents.push(doc);
    } else {
      errors.push(`Fatura ${invoiceId} não encontrada`);
    }
  }

  if (documents.length === 0) {
    return { success: false, documentIds: [], errors };
  }

  try {
    // Cria registo de exportação
    const exportRecord = await prisma.erpExport.create({
      data: {
        companyId,
        erpType: 'TOCONLINE',
        status: 'PROCESSING',
        invoiceCount: documents.length,
        totalValue: documents.reduce((sum, d) => sum + d.totalValue, 0),
        metadata: {
          documentCount: documents.length,
          invoiceIds,
        } as any,
      },
    });

    // Envia para TOConline (um por um ou batch)
    for (const doc of documents) {
      const apiDoc: ToconlineApiDocument = {
        document_type: doc.documentType,
        document_number: doc.documentNumber,
        document_date: doc.documentDate,
        supplier: {
          fiscal_id: doc.supplierNif,
          name: doc.supplierName,
        },
        currency: 'EUR',
        exchange_rate: 1,
        notes: `Exportado via ContaSaaS - ${new Date().toISOString()}`,
        lines: doc.lines.map((l) => ({
          description: l.description,
          account_code: l.accountCode,
          debit: l.debit,
          credit: l.credit,
          cost_center: l.costCenter,
        })),
        vat_lines: doc.vatLines.map((l: any) => ({
          vat_rate: l.vatRate,
          taxable_amount: l.taxableAmount,
          vat_amount: l.vatAmount,
        })),
      };

      const response = await fetch(`${TOCONLINE_BASE_URL}/commercial_purchases_documents`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${TOCONLINE_API_KEY}`,
          'X-API-Version': 'v1',
        },
        body: JSON.stringify(apiDoc),
      });

      if (response.ok) {
        const result = await response.json();
        documentIds.push(result.id || result.document_id);
      } else {
        const error = await response.text();
        errors.push(`Erro no documento ${doc.documentNumber}: ${error}`);
      }
    }

    // Atualiza registo de exportação
    await prisma.erpExport.update({
      where: { id: exportRecord.id },
      data: {
        status: errors.length === 0 ? 'COMPLETED' : errors.length < documents.length ? 'COMPLETED' : 'FAILED',
        toconlineDocumentIds: documentIds,
        toconlineResponse: { errors, documentIds } as any,
        completedAt: new Date(),
      },
    });

    return {
      success: errors.length === 0,
      exportId: exportRecord.id,
      documentIds,
      errors,
    };

  } catch (error) {
    const message = error instanceof Error ? error.message : 'Erro desconhecido';
    errors.push(message);
    return { success: false, documentIds, errors };
  }
}
