/**
 * Extrator de Transacoes de Extratos Bancarios em PDF
 * Usa Gemini Vision para extrair dados estruturados de PDFs de extratos
 */

import { GoogleGenerativeAI } from '@google/generative-ai';

const genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY || '');

export interface ExtractedTransaction {
  date: string; // YYYY-MM-DD
  amount: number;
  description: string;
  reference?: string;
  counterparty?: string;
}

export interface ParsedStatement {
  statementId: string;
  accountIban: string;
  openingBalance: number;
  closingBalance: number;
  transactions: ExtractedTransaction[];
}

/**
 * Extrai transacoes de um PDF de extrato bancario
 */
export async function parsePdfStatement(
  pdfBuffer: Buffer
): Promise<ParsedStatement> {
  const startTime = Date.now();

  try {
    const base64Data = pdfBuffer.toString('base64');

    const model = genAI.getGenerativeModel({ model: 'gemini-1.5-flash' });
    const result = await model.generateContent({
      contents: [
        {
          role: 'user',
          parts: [
            {
              text: `Analise este extrato bancario em PDF e extraia as transacoes num formato JSON estrito.

IMPORTANTE: Responda APENAS com JSON valido, sem markdown, sem explicacoes.

Formato esperado:
{
  "statementId": "id do extrato ou data",
  "accountIban": "IBAN da conta ou vazio",
  "openingBalance": 0.00,
  "closingBalance": 0.00,
  "transactions": [
    {
      "date": "YYYY-MM-DD",
      "amount": -123.45,
      "description": "descricao da transacao",
      "reference": "referencia se existir",
      "counterparty": "nome do contraente se existir"
    }
  ]
}

Regras:
- As datas devem estar no formato YYYY-MM-DD
- O amount deve ser numero (negativo para debitos, positivo para creditos)
- Se nao conseguir determinar o sinal, use o valor absoluto e indique no campo description
- Inclua TODAS as transacoes visiveis no extrato
- Se nao houver saldo inicial/final, use 0.00`,
            },
            {
              inlineData: {
                mimeType: 'application/pdf',
                data: base64Data,
              },
            },
          ],
        },
      ],
    });

    const response = await result.response;
    const text = response.text();

    // Extrai JSON da resposta (remove markdown se existir)
    const jsonMatch = text.match(/\{[\s\S]*\}/);
    if (!jsonMatch) {
      throw new Error('Nao foi possivel extrair JSON da resposta do Gemini');
    }

    const parsed = JSON.parse(jsonMatch[0]);

    console.log(`[PDF/Bank] Extraido ${parsed.transactions?.length || 0} transacoes em ${Date.now() - startTime}ms`);

    return {
      statementId: parsed.statementId || `pdf-${Date.now()}`,
      accountIban: parsed.accountIban || '',
      openingBalance: parseFloat(parsed.openingBalance) || 0,
      closingBalance: parseFloat(parsed.closingBalance) || 0,
      transactions: (parsed.transactions || []).map((t: any) => ({
        date: t.date || new Date().toISOString().split('T')[0],
        amount: parseFloat(t.amount) || 0,
        description: t.description || 'Transacao sem descricao',
        reference: t.reference || '',
        counterparty: t.counterparty || '',
      })),
    };

  } catch (error) {
    console.error('[PDF/Bank] Erro ao extrair transacoes:', error);
    throw new Error('Falha ao processar PDF de extrato bancario. Tente exportar em XML CAMT.053.');
  }
}
