/**
 * Parser CAMT.053 (ISO 20022) e Motor de Reconciliação Bancária
 * 
 * Funcionalidades:
 * 1. Parsing de XML CAMT.053 para transações estruturadas
 * 2. Algoritmo de matching: exact → knapsack subset → manual
 * 3. Tratamento de diferenças infinitesimais (taxas bancárias)
 */

import { XMLParser } from 'fast-xml-parser';
import type { Camt053Transaction, ReconciliationResult } from '@/types';
import { prisma } from '@/lib/prisma';

// ============================================================
// PARSER CAMT.053
// ============================================================

interface ParsedCamt053 {
  statementId: string;
  creationDate: string;
  accountIban: string;
  accountCurrency: string;
  transactions: Camt053Transaction[];
  openingBalance: number;
  closingBalance: number;
}

export function parseCamt053(xmlContent: string): ParsedCamt053 {
  const parser = new XMLParser({
    ignoreAttributes: false,
    attributeNamePrefix: '@_',
    parseTagValue: true,
    trimValues: true,
  });

  const parsed = parser.parse(xmlContent);

  // Navegação segura na estrutura ISO 20022
  const document = parsed['Document'] || parsed;
  const bkToCstmrStmt = document['BkToCstmrStmt'] || document;
  const stmt = bkToCstmrStmt['Stmt'];

  if (!stmt) {
    throw new Error('Estrutura CAMT.053 inválida: elemento <Stmt> não encontrado');
  }

  // Extrai metadados do extracto
  const statementId = extractText(stmt, 'Id');
  const creationDate = extractText(stmt, 'CreDtTm');
  const account = stmt['Acct'] || {};
  const accountIban = extractText(account, 'Id.IBAN');
  const accountCurrency = extractText(account, 'Ccy') || 'EUR';

  // Extrai balanços
  const balances = extractBalances(stmt['Bal']);

  // Extrai transações
  const entries = stmt['Ntry'] || [];
  const transactions: Camt053Transaction[] = [];

  const entriesArray = Array.isArray(entries) ? entries : [entries];

  for (const entry of entriesArray) {
    const transaction = parseEntry(entry);
    if (transaction) {
      transactions.push(transaction);
    }
  }

  return {
    statementId,
    creationDate,
    accountIban,
    accountCurrency,
    transactions,
    openingBalance: balances.opening || 0,
    closingBalance: balances.closing || 0,
  };
}

function extractText(obj: any, path: string): string {
  const parts = path.split('.');
  let current = obj;
  for (const part of parts) {
    if (current == null) return '';
    current = current[part];
  }
  return typeof current === 'string' ? current : '';
}

function extractBalances(bal: any): { opening: number; closing: number } {
  if (!bal) return { opening: 0, closing: 0 };
  
  const balances = Array.isArray(bal) ? bal : [bal];
  let opening = 0;
  let closing = 0;

  for (const b of balances) {
    const type = extractText(b, 'Tp.CdOrPrtry.Cd');
    const amount = parseFloat(extractText(b, 'Amt')) || 0;
    const creditDebit = extractText(b, 'CdtDbtInd');
    const signedAmount = creditDebit === 'DBIT' ? -amount : amount;

    if (type === 'OPBD') opening = signedAmount;
    if (type === 'CLBD') closing = signedAmount;
  }

  return { opening, closing };
}

function parseEntry(entry: any): Camt053Transaction | null {
  try {
    const amount = parseFloat(extractText(entry, 'Amt')) || 0;
    const creditDebit = extractText(entry, 'CdtDbtInd');
    const signedAmount = creditDebit === 'DBIT' ? -amount : amount;

    // Só processamos débitos (pagamentos) para reconciliação
    if (signedAmount >= 0) return null;

    const bookingDate = extractText(entry, 'BookgDt.Dt');
    const valueDate = extractText(entry, 'ValDt.Dt');
    const externalId = extractText(entry, 'NtryRef') || extractText(entry, 'AcctSvcrRef');

    // Informações da contraparte
    const details = entry['NtryDtls'] || entry;
    const txDetails = details['TxDtls'] || details;
    const detailsArray = Array.isArray(txDetails) ? txDetails : [txDetails];
    const firstDetail = detailsArray[0] || {};

    const counterparty = firstDetail['RltdPties'] || {};
    const counterpartyName = 
      extractText(counterparty, 'Cdtr.Nm') || 
      extractText(counterparty, 'Dbtr.Nm') || 
      '';
    const counterpartyIban = 
      extractText(counterparty, 'CdtrAcct.Id.IBAN') || 
      extractText(counterparty, 'DbtrAcct.Id.IBAN') || 
      '';

    // Referência do pagamento
    const references = firstDetail['RmtInf'] || {};
    const reference = 
      extractText(references, 'Strd.CdtrRefInf.Ref') || 
      extractText(references, 'Ustrd') || 
      '';

    // Descrição
    const description = 
      extractText(firstDetail, 'AddtlTxInf') || 
      extractText(entry, 'AddtlNtryInf') || 
      '';

    return {
      externalId,
      statementId: '', // preenchido depois
      bookingDate,
      valueDate: valueDate || undefined,
      amount: Math.abs(signedAmount), // Sempre positivo para matching
      currency: extractText(entry, 'Amt.@_Ccy') || 'EUR',
      description,
      counterpartyName,
      counterpartyIban,
      reference,
    };
  } catch (error) {
    console.warn('[CAMT053] Erro ao parsear entry:', error);
    return null;
  }
}

// ============================================================
// RECONCILIAÇÃO BANCÁRIA
// ============================================================

export async function reconcileTransactions(
  companyId: string,
  transactions: Camt053Transaction[],
  statementId: string
): Promise<ReconciliationResult[]> {
  const results: ReconciliationResult[] = [];

  // Busca faturas pendentes da empresa
  const pendingInvoices = await prisma.invoice.findMany({
    where: {
      companyId,
      status: { in: ['APPROVED', 'PENDING'] },
    },
    select: {
      id: true,
      documentNumber: true,
      totalValue: true,
      supplierName: true,
    },
  });

  for (const transaction of transactions) {
    // Atualiza statementId
    transaction.statementId = statementId;

    // 1. TENTATIVA: MATCH EXATO
    const exactMatch = findExactMatch(transaction, pendingInvoices);
    if (exactMatch) {
      results.push({
        transaction,
        matchedInvoices: [exactMatch],
        totalMatched: exactMatch.amount,
        difference: 0,
        method: 'exact',
      });
      continue;
    }

    // 2. TENTATIVA: KNAPSACK SUBSET (múltiplas faturas = um pagamento)
    const subsetMatch = findMatchingInvoicesSubset(
      transaction.amount,
      pendingInvoices
    );

    if (subsetMatch.length > 0) {
      const totalMatched = subsetMatch.reduce((sum, inv) => sum + inv.amount, 0);
      const difference = parseFloat((transaction.amount - totalMatched).toFixed(2));

      results.push({
        transaction,
        matchedInvoices: subsetMatch,
        totalMatched,
        difference,
        differenceAccount: Math.abs(difference) > 0 ? '6284' : undefined, // Despesas bancárias
        method: 'knapsack',
      });
      continue;
    }

    // 3. SEM MATCH - MANUAL
    results.push({
      transaction,
      matchedInvoices: [],
      totalMatched: 0,
      difference: transaction.amount,
      method: 'manual',
    });
  }

  return results;
}

// ============================================================
// ALGORITMO DE MATCHING
// ============================================================

function findExactMatch(
  transaction: Camt053Transaction,
  invoices: Array<{ id: string; documentNumber: string; totalValue: any; supplierName: string | null }>
): { invoiceId: string; documentNumber: string; amount: number } | null {
  // Tolerância de 0,01€ para diferenças de arredondamento
  const TOLERANCE = 0.01;

  for (const invoice of invoices) {
    const invoiceAmount = parseFloat(invoice.totalValue.toString());
    if (Math.abs(transaction.amount - invoiceAmount) <= TOLERANCE) {
      // Bónus: verifica se o nome do fornecedor aparece na descrição
      const nameMatch = invoice.supplierName && 
        transaction.description?.toLowerCase().includes(invoice.supplierName.toLowerCase());
      
      return {
        invoiceId: invoice.id,
        documentNumber: invoice.documentNumber,
        amount: invoiceAmount,
      };
    }
  }

  return null;
}

/**
 * KNAPSACK PROBLEM - Subset Sum
 * 
 * Problema: Dado um pagamento de valor V, encontrar subset de faturas
 * cuja soma seja igual (ou próxima) de V.
 * 
 * Algoritmo: Dynamic Programming para Subset Sum com tolerância
 * Complexidade: O(n * target) onde target é o valor em cêntimos
 */
function findMatchingInvoicesSubset(
  targetAmount: number,
  invoices: Array<{ id: string; documentNumber: string; totalValue: any; supplierName: string | null }>,
  tolerance: number = 0.05 // 5 cêntimos de tolerância
): Array<{ invoiceId: string; documentNumber: string; amount: number }> {
  
  // Converte para cêntimos para evitar problemas de float
  const targetCents = Math.round(targetAmount * 100);
  const toleranceCents = Math.round(tolerance * 100);
  
  const items = invoices.map((inv) => ({
    id: inv.id,
    documentNumber: inv.documentNumber,
    cents: Math.round(parseFloat(inv.totalValue.toString()) * 100),
  }));

  // Para evitar explosão combinatória, limitamos a 15 faturas
  if (items.length > 15) {
    // Ordena por proximidade ao target e pega as 15 mais próximas
    items.sort((a, b) => 
      Math.abs(a.cents - targetCents) - Math.abs(b.cents - targetCents)
    );
    items.splice(15);
  }

  // DP: dp[i][s] = true se existe subset de items[0..i-1] com soma s
  const n = items.length;
  const maxSum = targetCents + toleranceCents;
  
  // Usamos Map para economia de memória
  const dp: Map<number, number[]> = new Map();
  dp.set(0, []);

  for (let i = 0; i < n; i++) {
    const currentEntries: [number, number[]][] = Array.from(dp.entries());
    for (const [sum, subset] of currentEntries) {
      const newSum = sum + items[i].cents;
      if (newSum > maxSum) continue;
      
      const newSubset = [...subset, i];
      
      if (!dp.has(newSum) || newSubset.length < (dp.get(newSum)?.length || Infinity)) {
        dp.set(newSum, newSubset);
      }
    }
  }

  // Procura a melhor solução dentro da tolerância
  let bestSum = -1;
  let bestDiff = Infinity;

  for (const [sum, subset] of Array.from(dp.entries())) {
    if (sum === 0) continue; // Ignora subset vazio
    const diff = Math.abs(sum - targetCents);
    if (diff <= toleranceCents && diff < bestDiff) {
      bestDiff = diff;
      bestSum = sum;
    }
  }

  if (bestSum === -1) {
    return [];
  }

  const result = dp.get(bestSum);
  if (!result) return [];

  return result.map((idx) => ({
    invoiceId: items[idx].id,
    documentNumber: items[idx].documentNumber,
    amount: items[idx].cents / 100,
  }));
}

// ============================================================
// PERSISTÊNCIA
// ============================================================

export async function saveReconciliationResults(
  companyId: string,
  statementId: string,
  results: ReconciliationResult[]
): Promise<void> {
  for (const result of results) {
    const tx = await prisma.bankTransaction.create({
      data: {
        companyId,
        externalId: result.transaction.externalId,
        statementId,
        bookingDate: new Date(result.transaction.bookingDate),
        valueDate: result.transaction.valueDate ? new Date(result.transaction.valueDate) : null,
        amount: result.transaction.amount,
        currency: result.transaction.currency,
        description: result.transaction.description,
        counterpartyName: result.transaction.counterpartyName,
        counterpartyIban: result.transaction.counterpartyIban,
        reference: result.transaction.reference,
        isReconciled: result.matchedInvoices.length > 0,
        reconciliationMethod: result.method,
        differenceAmount: result.difference || null,
        differenceAccount: result.differenceAccount,
      },
    });

    // Liga faturas casadas
    if (result.matchedInvoices.length > 0) {
      await prisma.bankTransaction.update({
        where: { id: tx.id },
        data: {
          matchedInvoices: {
            connect: result.matchedInvoices.map((inv) => ({ id: inv.invoiceId })),
          },
        },
      });
    }
  }
}
