/**
 * Exportador para Primavera v10 (Excel)
 * 
 * Requisitos específicos:
 * - Formato Excel (.xlsx)
 * - Headers exatos conforme add-on Primavera
 * - Formatação decimal obrigatória
 * - Prevenção de erros de importação
 */

import * as XLSX from 'xlsx';
import { prisma } from '@/lib/prisma';
import { safeDecimalForXBase } from '@/lib/utils';

// ============================================================
// SCHEMA PRIMAVERA V10
// ============================================================

interface PrimaveraRow {
  'Tipo Doc': string;
  'Série': string;
  'Nº Documento': string;
  'Data': string;
  'NIF Fornecedor': string;
  'Nome Fornecedor': string;
  'Moeda': string;
  'Câmbio': string;
  'Observações': string;
  'Linha': number;
  'Artigo': string;
  'Descrição': string;
  'Quantidade': string;
  'Preço Unitário': string;
  'Valor Líquido': string;
  'Taxa IVA': string;
  'Valor IVA': string;
  'Valor Total': string;
  'Conta': string;
  'Centro Custo': string;
}

// ============================================================
// GERAÇÃO DE EXCEL
// ============================================================

export async function generatePrimaveraExcel(
  companyId: string,
  invoiceIds: string[]
): Promise<Buffer> {
  const invoices = await prisma.invoice.findMany({
    where: {
      id: { in: invoiceIds },
      companyId,
    },
    include: { lines: true },
  });

  const rows: PrimaveraRow[] = [];

  for (const invoice of invoices) {
    const docType = mapDocType(invoice.documentType);
    const date = formatPrimaveraDate(invoice.date);

    for (let i = 0; i < invoice.lines.length; i++) {
      const line = invoice.lines[i];
      rows.push({
        'Tipo Doc': docType,
        'Série': '2026',
        'Nº Documento': invoice.documentNumber,
        'Data': date,
        'NIF Fornecedor': invoice.supplierNif || '',
        'Nome Fornecedor': invoice.supplierName || '',
        'Moeda': 'EUR',
        'Câmbio': '1',
        'Observações': `Exportado ContaSaaS - ${invoice.id.substring(0, 8)}`,
        'Linha': i + 1,
        'Artigo': '',
        'Descrição': line.description.substring(0, 100), // Limite Primavera
        'Quantidade': safeDecimalForXBase(parseFloat(line.quantity.toString())),
        'Preço Unitário': safeDecimalForXBase(parseFloat(line.unitPrice.toString())),
        'Valor Líquido': safeDecimalForXBase(parseFloat(line.taxableAmount.toString())),
        'Taxa IVA': safeDecimalForXBase(parseFloat(line.vatRateValue.toString())),
        'Valor IVA': safeDecimalForXBase(parseFloat(line.vatAmount.toString())),
        'Valor Total': safeDecimalForXBase(
          parseFloat(line.taxableAmount.toString()) + parseFloat(line.vatAmount.toString())
        ),
        'Conta': line.accountCode || invoice.accountCode || '6228',
        'Centro Custo': line.costCenter || '',
      });
    }
  }

  // Cria workbook
  const ws = XLSX.utils.json_to_sheet(rows);

  // Define larguras de coluna
  const colWidths: Record<string, number> = {
    'Tipo Doc': 10,
    'Série': 8,
    'Nº Documento': 15,
    'Data': 12,
    'NIF Fornecedor': 15,
    'Nome Fornecedor': 30,
    'Moeda': 8,
    'Câmbio': 8,
    'Observações': 30,
    'Linha': 6,
    'Artigo': 12,
    'Descrição': 40,
    'Quantidade': 12,
    'Preço Unitário': 14,
    'Valor Líquido': 14,
    'Taxa IVA': 10,
    'Valor IVA': 14,
    'Valor Total': 14,
    'Conta': 10,
    'Centro Custo': 12,
  };

  ws['!cols'] = Object.keys(colWidths).map((key) => ({ wch: colWidths[key] }));

  // Formatação numérica (evita importação como texto)
  const range = XLSX.utils.decode_range(ws['!ref'] || 'A1');
  for (let R = range.s.r + 1; R <= range.e.r; ++R) {
    // Colunas numéricas (Quantidade, Preço, Valores)
    const numericCols = [11, 12, 13, 14, 15, 16]; // Indices das colunas numéricas
    for (const C of numericCols) {
      const cellRef = XLSX.utils.encode_cell({ r: R, c: C });
      if (ws[cellRef]) {
        const val = parseFloat(ws[cellRef].v);
        if (!isNaN(val)) {
          ws[cellRef].t = 'n'; // Tipo número
          ws[cellRef].v = val;
          ws[cellRef].z = '#,##0.00'; // Formato português
        }
      }
    }
  }

  const wb = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(wb, ws, 'Documentos');

  return XLSX.write(wb, { type: 'buffer', bookType: 'xlsx' });
}

function mapDocType(type: string): string {
  const map: Record<string, string> = {
    'FC': 'VFA',
    'FT': 'VFA',
    'ND': 'VND',
    'NC': 'VNC',
  };
  return map[type.toUpperCase()] || 'VFA';
}

function formatPrimaveraDate(date: Date): string {
  // Primavera espera DD-MM-YYYY ou DD/MM/YYYY
  const d = new Date(date);
  const day = String(d.getDate()).padStart(2, '0');
  const month = String(d.getMonth() + 1).padStart(2, '0');
  const year = d.getFullYear();
  return `${day}-${month}-${year}`;
}
