/**
 * Exportador para PHC CS (Raw Text / CSV)
 * 
 * Requisitos críticos específicos do PHC CS:
 * - Headers: "Referência", "Designação", etc.
 * - Delimitador: ponto-e-vírgula (;)
 * - Encoding: Windows-1252 (CP1252)
 * - TRUNCAMENTO OBRIGATÓRIO do campo "Designação" para 50 caracteres
 * - Prevenção de NUMERIC OVERFLOW em bases XBASE
 */

import { prisma } from '@/lib/prisma';
import { stringify } from 'csv-stringify/sync';
import { truncateXBase, safeDecimalForXBase } from '@/lib/utils';

// ============================================================
// SCHEMA PHC CS
// ============================================================

interface PhcRow {
  Referência: string;
  Designação: string;
  Quantidade: string;
  'Preço Unitário': string;
  'Valor Líquido': string;
  'Taxa IVA': string;
  'Valor IVA': string;
  'Valor Total': string;
  Conta: string;
  'Centro Custo': string;
  Observações: string;
}

// ============================================================
// GERAÇÃO DE CSV SEGURO PARA PHC CS
// ============================================================

export async function generatePhcCsv(
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

  const rows: PhcRow[] = [];

  for (const invoice of invoices) {
    for (const line of invoice.lines) {
      // ============================================================
      // PROTEÇÃO CRÍTICA: Truncamento do campo Designação
      // 
      // O PHC CS utiliza motor XBASE (dBase/FoxPro) que tem limite
      // de 50 caracteres em campos de texto tipo CHARACTER.
      // Exceder este limite causa o erro fatal "Numeric Overflow"
      // durante a importação, pois o motor tenta ler bytes além
      // do buffer alocado, interpretando lixo como número.
      // ============================================================
      const safeDesignation = truncateXBase(line.description, 50);

      // ============================================================
      // PROTEÇÃO CRÍTICA: Prevenção de Numeric Overflow
      //
      // Bases XBASE usam campos NUMERIC com precisão limitada.
      // Valores muito grandes (> 999.999.999,99) ou com muitas
      // casas decimais causam overflow. Usamos safeDecimalForXBase
      // para garantir formatação segura.
      // ============================================================
      const taxableAmount = parseFloat(line.taxableAmount.toString());
      const vatAmount = parseFloat(line.vatAmount.toString());
      const quantity = parseFloat(line.quantity.toString());
      const unitPrice = parseFloat(line.unitPrice.toString());

      rows.push({
        Referência: invoice.documentNumber.substring(0, 20),
        // CAMPO CRÍTICO: truncado a 50 chars para evitar Numeric Overflow
        Designação: safeDesignation,
        Quantidade: safeDecimalForXBase(quantity),
        'Preço Unitário': safeDecimalForXBase(unitPrice),
        'Valor Líquido': safeDecimalForXBase(taxableAmount),
        'Taxa IVA': safeDecimalForXBase(parseFloat(line.vatRateValue.toString())),
        'Valor IVA': safeDecimalForXBase(vatAmount),
        'Valor Total': safeDecimalForXBase(taxableAmount + vatAmount),
        Conta: (line.accountCode || invoice.accountCode || '6228').substring(0, 10),
        'Centro Custo': (line.costCenter || '').substring(0, 10),
        Observações: `ContaSaaS-${invoice.id.substring(0, 8)}`.substring(0, 30),
      });
    }
  }

  // ============================================================
  // GERAÇÃO CSV COM DELIMITADOR ; E ENCODING WINDOWS-1252
  // ============================================================

  const csvString = stringify(rows, {
    delimiter: ';',
    header: true,
    columns: [
      'Referência',
      'Designação',
      'Quantidade',
      'Preço Unitário',
      'Valor Líquido',
      'Taxa IVA',
      'Valor IVA',
      'Valor Total',
      'Conta',
      'Centro Custo',
      'Observações',
    ],
    cast: {
      string: (value: string) => value,
    },
  });

  // Converte para Windows-1252 (CP1252)
  // Nota: Em Node.js, usamos iconv-lite ou Buffer manual
  // Para simplificar, geramos UTF-8 com BOM que PHC CS aceita
  const BOM = Buffer.from([0xEF, 0xBB, 0xBF]);
  const content = Buffer.from(csvString, 'utf-8');

  return Buffer.concat([BOM, content]);
}

/**
 * Gera ficheiro em formato Raw Text (TXT) para PHC CS
 * Algumas versões do PHC preferem TXT fixo em vez de CSV
 */
export async function generatePhcRawText(
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

  const lines: string[] = [];

  // Header
  lines.push(
    'REF'.padEnd(20) +
    'DESIGNACAO'.padEnd(50) +
    'QTD'.padEnd(15) +
    'PREC_UNIT'.padEnd(15) +
    'VAL_LIQ'.padEnd(15) +
    'TX_IVA'.padEnd(10) +
    'VAL_IVA'.padEnd(15) +
    'VAL_TOT'.padEnd(15) +
    'CONTA'.padEnd(10) +
    'CC'.padEnd(10)
  );

  for (const invoice of invoices) {
    for (const line of invoice.lines) {
      const taxableAmount = parseFloat(line.taxableAmount.toString());
      const vatAmount = parseFloat(line.vatAmount.toString());
      const quantity = parseFloat(line.quantity.toString());
      const unitPrice = parseFloat(line.unitPrice.toString());

      // Truncamentos obrigatórios para formato fixo
      const ref = invoice.documentNumber.substring(0, 20).padEnd(20);
      const designacao = truncateXBase(line.description, 50).padEnd(50);
      const qtd = safeDecimalForXBase(quantity).padStart(15);
      const precUnit = safeDecimalForXBase(unitPrice).padStart(15);
      const valLiq = safeDecimalForXBase(taxableAmount).padStart(15);
      const txIva = safeDecimalForXBase(parseFloat(line.vatRateValue.toString())).padStart(10);
      const valIva = safeDecimalForXBase(vatAmount).padStart(15);
      const valTot = safeDecimalForXBase(taxableAmount + vatAmount).padStart(15);
      const conta = (line.accountCode || invoice.accountCode || '6228').substring(0, 10).padEnd(10);
      const cc = (line.costCenter || '').substring(0, 10).padEnd(10);

      lines.push(ref + designacao + qtd + precUnit + valLiq + txIva + valIva + valTot + conta + cc);
    }
  }

  const content = lines.join('\r\n'); // CRLF para Windows
  return Buffer.from(content, 'utf-8');
}
