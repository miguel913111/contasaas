/**
 * Parser do Código QR Português (Portaria 195/2020)
 * 
 * Especificação técnica da AT:
 * - Campos separados por asterisco (*)
 * - Cada campo: CODIGO:valor
 * - Separador decimal: ponto (.)
 * - Campos monetários: sempre 2 casas decimais
 * 
 * Campos obrigatórios (+):
 *   A: NIF emitente
 *   B: NIF adquirente (999999990 se consumidor final)
 *   C: País do adquirente (PT, PT-AC, PT-MA)
 *   D: Tipo de documento (FT, FS, FR, ND, NC, VD, etc.)
 *   E: Estado do documento (N=Normal, A=Anulado, S=Self-billing)
 *   F: Data do documento (AAAAMMDD)
 *   G: Identificação única do documento (número da fatura)
 *   H: ATCUD (CódigoValidação-NumeroSequencial)
 *   I1: Espaço fiscal (PT, PT-AC, PT-MA)
 *   N: Total de impostos (soma de todos os IVAs)
 *   O: Total do documento com impostos
 *   Q: 4 caracteres do Hash (código de integridade)
 *   R: Nº do certificado atribuído pela AT
 * 
 * Campos opcionais (++):
 *   I2: Base tributável isenta
 *   I3: Base tributável IVA taxa reduzida
 *   I4: Total IVA taxa reduzida
 *   I5: Base tributável IVA taxa intermédia
 *   I6: Total IVA taxa intermédia
 *   I7: Base tributável IVA taxa normal
 *   I8: Total IVA taxa normal
 *   J1-J8: Mesmo que I1-I8 para PT-AC
 *   K1-K8: Mesmo que I1-I8 para PT-MA
 *   L: Total de impostos retidos (IRS/IRC)
 *   M: Total de impostos retidos na fonte
 *   P: Total de descontos/comissões
 *   S: Outras informações (IBAN, MB, etc.)
 */

import type { InvoiceExtractedData, InvoiceLineExtracted } from '@/types';

export interface PortugueseQrData {
  nifEmitente: string;
  nifAdquirente: string;
  paisAdquirente: string;
  tipoDocumento: string;
  estadoDocumento: string;
  data: string; // YYYY-MM-DD
  numeroDocumento: string;
  atcud: string;
  espacoFiscal: string;
  
  // Valores IVA - PT
  baseIsenta?: number;
  baseReduzida?: number;
  ivaReduzido?: number;
  baseIntermedia?: number;
  ivaIntermedio?: number;
  baseNormal?: number;
  ivaNormal?: number;
  
  // Totais
  totalImpostos: number;
  totalDocumento: number;
  totalDescontos?: number;
  
  // Hash e certificado
  hashQr: string;
  numeroCertificado: string;
  
  // Outras informações
  outrasInfo?: string;
  
  // Raw data
  rawQrString: string;
}

/**
 * Parseia uma string QR Code portuguesa
 */
export function parsePortugueseQr(qrString: string): PortugueseQrData | null {
  try {
    // Remove espaços em branco no início/fim
    const clean = qrString.trim();
    
    // Verifica se parece um QR português (deve ter campos A: e B:)
    if (!clean.includes('A:') || !clean.includes('B:')) {
      return null;
    }

    // Separa campos por asterisco
    const fields = clean.split('*');
    const data: Record<string, string> = {};

    for (const field of fields) {
      const colonIndex = field.indexOf(':');
      if (colonIndex > 0) {
        const code = field.substring(0, colonIndex);
        const value = field.substring(colonIndex + 1);
        data[code] = value;
      }
    }

    // Valida campos obrigatórios mínimos
    if (!data.A || !data.F || !data.G) {
      return null;
    }

    // Converte data AAAAMMDD -> YYYY-MM-DD
    const rawDate = data.F;
    const year = parseInt(rawDate.substring(0, 4));
    const month = parseInt(rawDate.substring(4, 6));
    const day = parseInt(rawDate.substring(6, 8));
    
    if (year < 2000 || month < 1 || month > 12 || day < 1 || day > 31) {
      return null;
    }
    
    const formattedDate = `${year.toString().padStart(4, '0')}-${month.toString().padStart(2, '0')}-${day.toString().padStart(2, '0')}`;

    return {
      nifEmitente: data.A,
      nifAdquirente: data.B || '999999990',
      paisAdquirente: data.C || 'PT',
      tipoDocumento: data.D || '',
      estadoDocumento: data.E || 'N',
      data: formattedDate,
      numeroDocumento: data.G,
      atcud: data.H || '',
      espacoFiscal: data.I1 || 'PT',
      
      baseIsenta: parseMonetary(data.I2),
      baseReduzida: parseMonetary(data.I3),
      ivaReduzido: parseMonetary(data.I4),
      baseIntermedia: parseMonetary(data.I5),
      ivaIntermedio: parseMonetary(data.I6),
      baseNormal: parseMonetary(data.I7),
      ivaNormal: parseMonetary(data.I8),
      
      totalImpostos: parseMonetary(data.N) || 0,
      totalDocumento: parseMonetary(data.O) || 0,
      totalDescontos: parseMonetary(data.P),
      
      hashQr: data.Q || '',
      numeroCertificado: data.R || '',
      
      outrasInfo: data.S,
      
      rawQrString: clean,
    };
  } catch (error) {
    console.error('[QR Parser] Erro ao parsear QR:', error);
    return null;
  }
}

/**
 * Converte PortugueseQrData para InvoiceExtractedData (formato interno)
 */
export function convertQrToInvoiceData(qr: PortugueseQrData): InvoiceExtractedData {
  const lines: InvoiceLineExtracted[] = [];

  // Linha: Base isenta
  if (qr.baseIsenta && qr.baseIsenta > 0) {
    lines.push({
      description: 'Operação isenta de IVA',
      quantity: 1,
      unit_price: qr.baseIsenta,
      taxable_amount: qr.baseIsenta,
      vat_amount: 0,
      vat_rate: 0,
    });
  }

  // Linha: Taxa reduzida (6%)
  if (qr.baseReduzida && qr.baseReduzida > 0) {
    lines.push({
      description: 'Taxa reduzida de IVA (6%)',
      quantity: 1,
      unit_price: qr.baseReduzida,
      taxable_amount: qr.baseReduzida,
      vat_amount: qr.ivaReduzido || qr.baseReduzida * 0.06,
      vat_rate: 6,
    });
  }

  // Linha: Taxa intermédia (13%)
  if (qr.baseIntermedia && qr.baseIntermedia > 0) {
    lines.push({
      description: 'Taxa intermédia de IVA (13%)',
      quantity: 1,
      unit_price: qr.baseIntermedia,
      taxable_amount: qr.baseIntermedia,
      vat_amount: qr.ivaIntermedio || qr.baseIntermedia * 0.13,
      vat_rate: 13,
    });
  }

  // Linha: Taxa normal (23%)
  if (qr.baseNormal && qr.baseNormal > 0) {
    lines.push({
      description: 'Taxa normal de IVA (23%)',
      quantity: 1,
      unit_price: qr.baseNormal,
      taxable_amount: qr.baseNormal,
      vat_amount: qr.ivaNormal || qr.baseNormal * 0.23,
      vat_rate: 23,
    });
  }

  // Se não há linhas detalhadas, cria uma linha genérica
  if (lines.length === 0) {
    const total = qr.totalDocumento;
    const vat = qr.totalImpostos;
    const taxable = total - vat;
    lines.push({
      description: 'Total documento (sem detalhe de taxas)',
      quantity: 1,
      unit_price: taxable,
      taxable_amount: taxable,
      vat_amount: vat,
      vat_rate: taxable > 0 ? Math.round((vat / taxable) * 100) as 6 | 13 | 23 | 0 : 23,
    });
  }

  // Calcula totais a partir das linhas
  const calculatedTaxable = lines.reduce((sum, l) => sum + l.taxable_amount, 0);
  const calculatedVat = lines.reduce((sum, l) => sum + l.vat_amount, 0);

  return {
    supplier_name: qr.nifEmitente, // Será enriquecido pelo dicionário depois
    supplier_nif: qr.nifEmitente,
    document_number: qr.numeroDocumento,
    date: qr.data,
    total_value: qr.totalDocumento,
    taxable_base: calculatedTaxable,
    vat_total: calculatedVat,
    lines,
  };
}

/**
 * Valida a integridade do QR Code (verifica se o hash está presente)
 * 
 * Nota: A validação criptográfica completa do hash Q exigiria
 * acesso à chave pública da AT, que não está disponível publicamente.
 * Esta função faz apenas validações sintáticas.
 */
export function validateQrIntegrity(qr: PortugueseQrData): {
  valid: boolean;
  warnings: string[];
} {
  const warnings: string[] = [];

  // Valida NIFs
  if (qr.nifEmitente.length !== 9 || !/^\d{9}$/.test(qr.nifEmitente)) {
    warnings.push('NIF emitente inválido');
  }

  if (qr.nifAdquirente.length !== 9 || !/^\d{9}$/.test(qr.nifAdquirente)) {
    warnings.push('NIF adquirente inválido');
  }

  // Valida data
  const dateRegex = /^\d{4}-\d{2}-\d{2}$/;
  if (!dateRegex.test(qr.data)) {
    warnings.push('Data inválida');
  }

  // Valida tipos de documento conhecidos
  const validDocTypes = ['FT', 'FS', 'FR', 'ND', 'NC', 'VD', 'TV', 'TD', 'AA', 'DA', 'RP', 'RE', 'CS', 'LD', 'RA', 'PF', 'GT', 'GR', 'GA', 'GC', 'GD'];
  if (!validDocTypes.includes(qr.tipoDocumento)) {
    warnings.push(`Tipo de documento desconhecido: ${qr.tipoDocumento}`);
  }

  // Valida estado
  if (!['N', 'A', 'S'].includes(qr.estadoDocumento)) {
    warnings.push(`Estado de documento desconhecido: ${qr.estadoDocumento}`);
  }

  // Verifica hash
  if (!qr.hashQr || qr.hashQr.length !== 4) {
    warnings.push('Hash QR ausente ou inválido (deve ter 4 caracteres)');
  }

  return {
    valid: warnings.length === 0,
    warnings,
  };
}

/**
 * Determina se uma string é um QR Code português válido
 */
export function isPortugueseInvoiceQr(qrString: string): boolean {
  const clean = qrString.trim();
  
  // Deve começar com A: (NIF emitente)
  if (!clean.startsWith('A:')) return false;
  
  // Deve conter campos obrigatórios mínimos
  const requiredFields = ['A:', 'B:', 'C:', 'D:', 'F:', 'G:', 'H:', 'N:', 'O:'];
  return requiredFields.every(field => clean.includes(field));
}

/**
 * Parseia valor monetário do QR (string -> number)
 */
function parseMonetary(value: string | undefined): number | undefined {
  if (!value || value === '') return undefined;
  const parsed = parseFloat(value);
  return isNaN(parsed) ? undefined : parsed;
}

/**
 * Gera URL de consulta da fatura no Portal das Finanças
 */
export function generateAtInvoiceUrl(atcud: string): string {
  return `https://faturas.portaldasfinancas.gov.pt/consultar/${atcud}`;
}
