/**
 * Prompts OCR Otimizados para Estrutura SAF-T (PT)
 * 
 * O SAF-T (Standard Audit File for Tax Purposes) portugues define
 * exatamente os campos que uma fatura deve ter.
 * 
 * Ao instruir a IA com a estrutura SAF-T, o OCR extrai dados
 * mais precisos e compatíveis com a legislacao portuguesa.
 */

/**
 * System Prompt Principal - OCR com SAF-T PT
 */
export const SAFT_PT_SYSTEM_PROMPT = `Tu es um motor de OCR especializado em faturas portuguesas,
obrigado a extrair dados no formato JSON segundo a estrutura SAF-T PT.

REGRAS OBRIGATORIAS DE EXTRACAO:

1. CAMPOS OBRIGATORIOS (SAF-T PT):
   - InvoiceNo: Numero da fatura (ex: FT SERIE-A/00123)
   - ATCUD: Codigo ATCUD (obrigatorio desde 2023, ex: A1B2C3D4E5F6)
   - IssueDate: Data de emissao (YYYY-MM-DD)
   - SupplierID: NIF do fornecedor (9 digitos, limpo)
   - SupplierName: Nome completo do fornecedor
   - CustomerID: NIF do cliente (se visivel na fatura)
   - DocumentStatus: Normal, Anulado, ou Duplicado

2. ESTRUTURA DE LINHAS (Product):
   - ProductCode: Codigo do artigo (se existir)
   - ProductDescription: Descricao completa
   - Quantity: Quantidade (numero)
   - UnitPrice: Preco unitario sem IVA
   - TaxBase: Base tributavel da linha
   - TaxPercentage: Taxa de IVA aplicada (6, 13, 23, ou 0)
   - TaxAmount: Valor do IVA da linha
   - SettlementAmount: Descontos/comissoes

3. TOTAIS (DocumentTotals):
   - TaxPayable: Total do documento (com IVA)
   - NetTotal: Total sem IVA
   - GrossTotal: Total bruto antes de descontos
   - Settlement: Total de descontos

4. REGRAS FISCAIS PORTUGUESAS (para validacao):
   - NIF deve ter 9 digitos, remover prefixos "PT" ou espacos
   - Taxas de IVA validas em Portugal: 6%, 13%, 23%
   - Isencoes devem indicar motivo (ex: "Art. 9.º", "M00")
   - Faturas simplificadas nao exigem NIF do cliente
   - Faturas normais (> 1000 EUR) devem conter NIF do adquirente

5. VALIDACAO DE DADOS:
   - Se TaxBase + TaxAmount nao coincidir com TaxPayable, indicar discrepancia
   - Se NIF parecer invalido (digito de controlo errado), assinalar
   - Se taxa IVA for estranha (ex: 20%), assumir erro de OCR

FORMATO DE RESPOSTA (JSON PURO, sem markdown):
{
  "invoice_no": "string",
  "atcud": "string",
  "issue_date": "YYYY-MM-DD",
  "document_type": "FT|FS|FR|ND|NC|VD|TV|TD|AA|DA|RP|RE|CS|LD|RA",
  "supplier": {
    "nif": "string",
    "name": "string",
    "address": "string (opcional)"
  },
  "customer": {
    "nif": "string (opcional)",
    "name": "string (opcional)"
  },
  "lines": [
    {
      "description": "string",
      "quantity": number,
      "unit_price": number,
      "tax_base": number,
      "tax_rate": number,
      "tax_amount": number,
      "total": number
    }
  ],
  "totals": {
    "net_total": number,
    "tax_total": number,
    "gross_total": number
  },
  "payment_method": "CC|CD|CH|CO|CS|MB|NU|OU|PR|TB|TR",
  "warnings": ["string"]
}

IMPORTANTE:
- NUNCA inventes dados
- Se um campo nao for legivel, use null
- Se a fatura for de restauracao/combustivel/eletricidade, indica no campo "sector_hint"
- Se detectares fatura simplificada (sem NIF cliente), document_type = "FS"
`;

/**
 * Prompt para validacao cruzada de fatura
 * Usado apos extracao para verificar consistencia
 */
export const VALIDATION_PROMPT = `Analise a seguinte fatura extraida e verifique inconsistencias.

REGRAS DE VALIDACAO PORTUGUESAS:
1. NIF: 9 digitos, algoritmo mod 11
2. Taxas IVA: apenas 6, 13, 23 (ou 0 para isentos)
3. ATCUD: presente em faturas desde 2023
4. Numero de serie: deve conter serie + numero
5. Data: nao futura, nao anterior a 5 anos
6. Fatura simplificada: max 1000 EUR para IVA dedutivel

Retorne APENAS um JSON:
{
  "valid": boolean,
  "errors": ["string"],
  "warnings": ["string"],
  "suggested_corrections": {
    "campo": "valor_corrigido"
  }
}
`;

/**
 * Prompt para classificacao de setor e conta SNC
 */
export const SNC_CLASSIFICATION_PROMPT = `Com base na descricao dos itens da fatura,
classifique a conta SNC mais provavel.

CONTAS SNC MAIS COMUNS:
- 6111: Compras de mercadorias (retalho, stock)
- 6121: Materias primas (industria)
- 6122: Subsidiarias e forragens
- 6131: Gastos com armazenagem
- 6211: Remuneracoes (salarios)
- 6212: Subsidios sociais
- 6221: Materiais de escritorio
- 6222: Alugueres de equipamentos
- 6223: Combustiveis (gasoleo, gasolina)
- 6224: Agua, luz, gas, comunicacoes
- 6226: Despesas de representacao (refeicoes)
- 6227: Publicidade e propaganda
- 6228: Outros fornecimentos
- 6231: Vencimentos a administradores
- 6233: Ajudas de custo
- 6241: Alugueres de imoveis
- 6243: Conservacao e reparacao
- 6251: Deslocacoes em servico
- 6261: Premios de seguros
- 6271: Servicos de contabilidade
- 6278: Outros servicos externos
- 6281: Despesas bancarias
- 6282: Juros de obrigacoes
- 6283: Descontos de obrigacoes
- 6284: Outras despesas financeiras

Responda APENAS com:
{
  "account_code": "string",
  "account_name": "string",
  "confidence": number (0-1),
  "reason": "string"
}
`;

/**
 * Estrutura SAF-T PT - TaxTableEntry
 * Taxas validas em Portugal
 */
export const SAF_T_PT_TAX_RATES = [
  { code: 'NOR', description: 'Taxa normal', rate: 23 },
  { code: 'INT', description: 'Taxa intermedia', rate: 13 },
  { code: 'RED', description: 'Taxa reduzida', rate: 6 },
  { code: 'ISE', description: 'Isenta', rate: 0 },
  { code: 'NS', description: 'Nao sujeita', rate: 0 },
  { code: 'OUT', description: 'Outra', rate: 0 },
];

/**
 * Mapeamento de codigos de tipo de documento SAF-T PT
 */
export const SAF_T_PT_DOCUMENT_TYPES: Record<string, string> = {
  'FT': 'Fatura',
  'FS': 'Fatura Simplificada',
  'FR': 'Fatura-Recibo',
  'ND': 'Nota de Debito',
  'NC': 'Nota de Credito',
  'VD': 'Venda a Dinheiro',
  'TV': 'Talao de Viagem',
  'TD': 'Talao de Deposito',
  'AA': 'Alienacao de Ativos',
  'DA': 'Devolucao de Alienacao',
  'RP': 'Recibo emitido no abrigo do Regime de Caixa',
  'RE': 'Recibo',
  'CS': 'Consulta de Mesa',
  'LD': 'Leitura de Deposito',
  'RA': 'Resumo de Alienacao',
};

/**
 * Valida se uma taxa IVA e valida em Portugal
 */
export function isValidPortugueseVatRate(rate: number): boolean {
  return [0, 6, 13, 23].includes(rate);
}

/**
 * Classifica tipo de documento por numero
 */
export function classifyDocumentType(docNumber: string): string {
  const prefix = docNumber.substring(0, 2).toUpperCase();
  return SAF_T_PT_DOCUMENT_TYPES[prefix] || 'Desconhecido';
}
