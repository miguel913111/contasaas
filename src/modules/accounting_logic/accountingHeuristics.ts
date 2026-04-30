/**
 * Motor de Normalização Contabilística (SNC) e Dedução IVA
 * 
 * Responsabilidades:
 * 1. Associar itens de fatura às contas SNC adequadas
 * 2. Aplicar restrições do Artigo 21.º do CIVA
 * 3. Calcular split accounting (desagregação por taxa)
 */

import { prisma } from '@/lib/prisma';
import type {
  InvoiceExtractedData,
  AccountingSuggestion,
  CivaDeductionRule,
  InvoiceLineExtracted,
} from '@/types';

// ============================================================
// MAPA SEMÂNTICO SNC (Heurísticas Base)
// ============================================================

interface SncMappingRule {
  accountCode: string;
  accountName: string;
  keywords: string[];
  defaultVatRate: 6 | 13 | 23 | 0;
}

const SNC_SEMANTIC_MAP: SncMappingRule[] = [
  {
    accountCode: '6224',
    accountName: 'Água, luz, gás e comunicações',
    keywords: ['edp', 'eletricidade', 'água', 'gas', 'telefone', 'internet', 'vodafone', 'meo', 'nos', 'tel', 'comunicações'],
    defaultVatRate: 23,
  },
  {
    accountCode: '6223',
    accountName: 'Combustíveis e lubrificantes',
    keywords: ['galp', 'bp', 'repsol', 'cepsa', 'combustivel', 'gasoleo', 'gasolina', 'adblue', 'lubrificante'],
    defaultVatRate: 23,
  },
  {
    accountCode: '6233',
    accountName: 'Ajudas de custo',
    keywords: ['ajuda de custo', 'km', 'quilometro', 'deslocação', 'diuturnidade', 'subsídio transporte'],
    defaultVatRate: 0,
  },
  {
    accountCode: '6221',
    accountName: 'Materiais de escritório',
    keywords: ['papel', 'esferografica', 'toner', 'material escritorio', 'papelaria', 'staples', 'lyreco'],
    defaultVatRate: 23,
  },
  {
    accountCode: '6222',
    accountName: 'Alugueres de equipamentos',
    keywords: ['aluguer', 'renting', 'lease', 'equipamento'],
    defaultVatRate: 23,
  },
  {
    accountCode: '6241',
    accountName: 'Alugueres de imóveis',
    keywords: ['renda', 'aluguer imovel', 'aluguer escritorio', 'armazem'],
    defaultVatRate: 23,
  },
  {
    accountCode: '6226',
    accountName: 'Despesas de representação',
    keywords: ['restaurante', 'refeição', 'jantar', 'almoço', 'coffee', 'cafetaria', 'representação'],
    defaultVatRate: 23,
  },
  {
    accountCode: '6227',
    accountName: 'Despesas de publicidade',
    keywords: ['publicidade', 'google ads', 'facebook', 'meta', 'seo', 'marketing', 'design'],
    defaultVatRate: 23,
  },
  {
    accountCode: '6243',
    accountName: 'Despesas de conservação e reparação',
    keywords: ['reparação', 'conservação', 'manutenção', 'assistencia tecnica'],
    defaultVatRate: 23,
  },
  {
    accountCode: '6251',
    accountName: 'Deslocações em serviço',
    keywords: ['taxi', 'uber', 'bolt', 'transporte', 'comboio', 'avião', 'hotel'],
    defaultVatRate: 23,
  },
  {
    accountCode: '6261',
    accountName: 'Prémios de seguros',
    keywords: ['seguro', 'allianz', 'fidelidade', 'generali', 'zurich'],
    defaultVatRate: 23,
  },
  {
    accountCode: '6271',
    accountName: 'Serviços de contabilidade',
    keywords: ['contabilidade', 'contabilista', 'fiscalidade', 'audit', 'auditoria'],
    defaultVatRate: 23,
  },
  {
    accountCode: '6278',
    accountName: 'Outros serviços externos',
    keywords: ['consultoria', 'advogado', 'servico externo', 'assessoria'],
    defaultVatRate: 23,
  },
];

// ============================================================
// FUNÇÃO PRINCIPAL
// ============================================================

export interface ProcessedAccountingData {
  invoiceData: InvoiceExtractedData;
  suggestions: AccountingSuggestion[];
  deductionRules: CivaDeductionRule[];
  splitLines: Array<InvoiceLineExtracted & { accountCode: string; deductibilityRate: number }>;
  requiresManualReview: boolean;
}

export async function processAccountingHeuristics(
  invoiceData: InvoiceExtractedData
): Promise<ProcessedAccountingData> {
  const suggestions: AccountingSuggestion[] = [];
  const deductionRules: CivaDeductionRule[] = [];
  const splitLines: Array<InvoiceLineExtracted & { accountCode: string; deductibilityRate: number }> = [];

  let requiresManualReview = false;

  for (const line of invoiceData.lines) {
    // 1. SUGESTÃO DE CONTA SNC
    const suggestion = findBestAccountMatch(line.description);
    suggestions.push(suggestion);

    // 2. REGRAS DE DEDUTIBILIDADE CIVA (Artigo 21.º)
    const deductionRule = applyCivaArticle21(line, suggestion.accountCode);
    deductionRules.push(deductionRule);

    // 3. SPLIT ACCOUNTING (desagregação por taxa e dedutibilidade)
    const splitLine = {
      ...line,
      accountCode: suggestion.accountCode,
      deductibilityRate: deductionRule.vatDeductibilityRate,
    };
    splitLines.push(splitLine);

    // 4. FLAG PARA REVISÃO MANUAL
    if (deductionRule.vatDeductibilityRate !== 100 || deductionRule.requiresCorrection) {
      requiresManualReview = true;
    }
  }

  return {
    invoiceData,
    suggestions,
    deductionRules,
    splitLines,
    requiresManualReview,
  };
}

// ============================================================
// 1. MATCHING SEMÂNTICO SNC
// ============================================================

function findBestAccountMatch(description: string): AccountingSuggestion {
  const normalizedDesc = description.toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '');
  
  let bestMatch: SncMappingRule | null = null;
  let bestScore = 0;

  for (const rule of SNC_SEMANTIC_MAP) {
    let score = 0;
    for (const keyword of rule.keywords) {
      const normalizedKeyword = keyword.toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '');
      if (normalizedDesc.includes(normalizedKeyword)) {
        score += normalizedKeyword.length; // Peso pela especificidade da palavra
      }
    }
    if (score > bestScore) {
      bestScore = score;
      bestMatch = rule;
    }
  }

  if (bestMatch) {
    const confidence = Math.min(0.95, 0.5 + bestScore * 0.05);
    return {
      accountCode: bestMatch.accountCode,
      accountName: bestMatch.accountName,
      confidence,
      reason: `Match por keywords: ${bestMatch.keywords.filter(k => normalizedDesc.includes(k)).join(', ')}`,
    };
  }

  // Fallback: conta genérica de fornecimentos
  return {
    accountCode: '6228',
    accountName: 'Outros fornecimentos e serviços',
    confidence: 0.3,
    reason: 'Nenhum match semântico encontrado. Requer revisão manual.',
  };
}

// ============================================================
// 2. ARTIGO 21.º CIVA - LIMITAÇÕES À DEDUÇÃO
// ============================================================

function applyCivaArticle21(
  line: InvoiceLineExtracted,
  accountCode: string
): CivaDeductionRule {
  const desc = line.description.toLowerCase();

  // ============================================================
  // ALÍNEA B) - BENS/SERVIÇOS PARA CONSUMO PRÓPRIO, REPRESENTAÇÃO
  // ============================================================
  if (desc.includes('refeicao') || desc.includes('jantar') || desc.includes('almoço') ||
      desc.includes('restaurante') || desc.includes('bebida') || desc.includes('cafe') ||
      accountCode === '6226') {
    return {
      vatDeductibilityRate: 0,
      articleReference: 'Artigo 21.º, n.º 1, alínea b) do CIVA',
      reason: 'Despesas de alimentação/bebidas e representação não admitem dedução de IVA.',
      requiresCorrection: true,
    };
  }

  // ============================================================
  // ALÍNEA C) - COMBUSTÍVEIS PARA VEÍCULOS LIGEIROS
  // ============================================================
  // NOTA TÉCNICA IMPORTANTE:
  // A dedutibilidade de combustíveis está limitada a 50% para veículos
  // ligeiros de passageiros ou mistos (Artigo 21.º, n.º 1, alínea c)).
  //
  // EXCEÇÕES (n.º 3 do Artigo 21.º):
  // - Veículos híbridos plug-in: 100% dedutível
  // - Veículos totalmente elétricos: 100% dedutível
  // - Veículos a gás natural/hidrogénio: 100% dedutível
  //
  // HEURÍSTICA IMPLEMENTADA:
  // - Se descrição contém "Gasóleo" e NÃO contém "plug-in"/"elétrico" → 50%
  // - Se descrição contém "Eletricidade" (carregamento veículo plug-in) → 100%
  // - Se descrição contém "híbrido" ou "plug-in" → 100%
  // ============================================================

  if (accountCode === '6223' || desc.includes('gasoleo') || desc.includes('gasolina') || desc.includes('combustivel')) {
    // Verifica se é veículo plug-in/elétrico pela descrição
    if (desc.includes('eletrico') || desc.includes('eletricidade') || desc.includes('plugin') || 
        desc.includes('plug-in') || desc.includes('hibrido') || desc.includes('híbrido') ||
        desc.includes('gas natural') || desc.includes('hidrogenio')) {
      return {
        vatDeductibilityRate: 100,
        articleReference: 'Artigo 21.º, n.º 3 do CIVA',
        reason: 'Combustível/energia para veículo plug-in, elétrico ou alternativo. Dedutibilidade total.',
        requiresCorrection: false,
      };
    }

    // Caso padrão: veículo ligeiro convencional
    return {
      vatDeductibilityRate: 50,
      articleReference: 'Artigo 21.º, n.º 1, alínea c) do CIVA',
      reason: 'Gasóleo/gasolina para veículos ligeiros: dedutibilidade limitada a 50%.',
      requiresCorrection: true, // Requer lançamento de correção (50% não dedutível)
    };
  }

  // ============================================================
  // ALÍNEA F) - DESPESAS DE ALOJAMENTO
  // ============================================================
  if (desc.includes('hotel') || desc.includes('alojamento') || desc.includes('pensao') || desc.includes('estadia')) {
    return {
      vatDeductibilityRate: 0,
      articleReference: 'Artigo 21.º, n.º 1, alínea f) do CIVA',
      reason: 'Despesas de alojamento não admitem dedução de IVA.',
      requiresCorrection: true,
    };
  }

  // ============================================================
  // CASO PADRÃO: 100% DEDUTÍVEL
  // ============================================================
  return {
    vatDeductibilityRate: 100,
    articleReference: 'Artigo 20.º do CIVA',
    reason: 'Aquisição de bens/serviços destinados à produção/comercialização. Dedutibilidade total.',
    requiresCorrection: false,
  };
}

// ============================================================
// 3. FUNÇÕES AUXILIARES
// ============================================================

/**
 * Calcula o valor do IVA não dedutível para uma linha
 */
export function calculateNonDeductibleVat(
  vatAmount: number,
  deductibilityRate: number
): number {
  return vatAmount * (1 - deductibilityRate / 100);
}

/**
 * Gera linhas de correção contabilística para o Artigo 21.º
 * 
 * Exemplo prático:
 * - Fatura de gasóleo: 100€ + 23€ IVA
 * - Dedutibilidade 50% → 11,50€ dedutíveis, 11,50€ não dedutíveis
 * - Lançamento de correção: 11,50€ para conta 688 (Outros gastos) ou 6223
 */
export function generateCorrectionEntries(
  splitLines: Array<InvoiceLineExtracted & { accountCode: string; deductibilityRate: number }>
): Array<{
  description: string;
  accountCode: string;
  debit: number;
  credit: number;
  originalVatAmount: number;
  nonDeductibleVat: number;
}> {
  const corrections: Array<{
    description: string;
    accountCode: string;
    debit: number;
    credit: number;
    originalVatAmount: number;
    nonDeductibleVat: number;
  }> = [];

  for (const line of splitLines) {
    if (line.deductibilityRate < 100) {
      const nonDeductibleVat = calculateNonDeductibleVat(line.vat_amount, line.deductibilityRate);
      
      corrections.push({
        description: `Correção IVA não dedutível - ${line.description}`,
        accountCode: line.accountCode, // Mesma conta de custo (absorção)
        debit: nonDeductibleVat,
        credit: 0,
        originalVatAmount: line.vat_amount,
        nonDeductibleVat,
      });
    }
  }

  return corrections;
}

/**
 * Sugere conta com base em descrição textual (para uso em UI)
 */
export function suggestAccountForDescription(description: string): AccountingSuggestion {
  return findBestAccountMatch(description);
}
