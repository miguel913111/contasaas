/**
 * Motor OCR Hibrido para extracao de dados de faturas
 * 
 * Estrategia (ordem de prioridade = fiabilidade):
 * 1. QR CODE (fonte da verdade oficial da AT) - 100% fiavel
 * 2. PDF com texto nativo -> pdf-parse (instantaneo, gratis)
 * 3. Gemini 3.0 Flash Vision (fallback final)
 * 4. Deduplicacao preventiva via hash SHA-256
 * 
 * Melhorias SAF-T PT:
 * - Leitura QR Code oficial Portaria 195/2020 (jimp + jsQR)
 * - Prompt otimizado para estrutura SAF-T (ATCUD, tipos documento, taxas)
 * - Validacao de NIF portugues (digito de controlo)
 * - Dicionario de fornecedores PT para reconhecimento automatico
 * - Classificacao SNC via descricao dos itens
 */

import { GoogleGenerativeAI } from '@google/generative-ai';
import pdfParse from 'pdf-parse';
import { sha256Buffer, generateInvoiceHashSignature } from '@/lib/utils';
import { prisma } from '@/lib/prisma';
import { SAFT_PT_SYSTEM_PROMPT } from './saftPtPrompt';
import { findSupplierByName, findSupplierByNif, suggestAccountFromSupplier } from './dictionaries/ptSuppliersDictionary';
import { isValidNif, normalizeNif, validateSupplierNif } from './dictionaries/nifValidator';
import { extractInvoiceDataFromQr } from './qrCodeReader';
import type { OcrResult, InvoiceExtractedData } from '@/types';

const genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY || '');

// ============================================================
// FUNCAO PRINCIPAL DE EXTRACAO
// ============================================================

export async function extractInvoiceData(
  fileBuffer: Buffer,
  mimeType: string
): Promise<OcrResult> {
  const startTime = Date.now();

  try {
    // 1. DEDUPLICACAO PREVENTIVA (hash do ficheiro)
    const fileHash = await sha256Buffer(fileBuffer);
    const existing = await prisma.invoice.findUnique({
      where: { fileHash },
    });

    if (existing) {
      return {
        success: false,
        method: 'pdf-parse',
        error: 'DUPLICATE_FILE',
        processingTimeMs: Date.now() - startTime,
      };
    }

    // 2. QR CODE (fonte primaria de verdade - Portaria 195/2020)
    const qrResult = await extractInvoiceDataFromQr(fileBuffer, mimeType);
    if (qrResult && qrResult.success && qrResult.data) {
      console.log('[OCR] QR Code lido com sucesso - fonte primaria AT');
      const enriched = enrichWithSupplierDictionary(qrResult.data);
      return {
        ...qrResult,
        data: enriched,
        processingTimeMs: Date.now() - startTime,
      };
    }

    // 3. PDF-PARSE (PDF com texto nativo)
    if (mimeType === 'application/pdf') {
      const pdfResult = await tryPdfParse(fileBuffer);
      if (pdfResult.success && pdfResult.data && isDataComplete(pdfResult.data)) {
        const enriched = enrichWithSupplierDictionary(pdfResult.data);
        return {
          ...pdfResult,
          data: enriched,
          processingTimeMs: Date.now() - startTime,
        };
      }
      console.log('[OCR] PDF parse incompleto, fallback para Gemini Vision');
    }

    // 4. GEMINI 3.0 FLASH (fallback final)
    return await extractWithGemini(fileBuffer, mimeType, startTime);

  } catch (error) {
    console.error('[OCR] Erro na extracao:', error);
    return {
      success: false,
      method: 'gemini-vision',
      error: error instanceof Error ? error.message : 'UNKNOWN_ERROR',
      processingTimeMs: Date.now() - startTime,
    };
  }
}

// ============================================================
// ENRIQUECIMENTO COM DICIONARIO DE FORNECEDORES
// ============================================================

function enrichWithSupplierDictionary(data: InvoiceExtractedData): InvoiceExtractedData {
  const enriched = { ...data };

  // Tenta encontrar fornecedor por NIF
  if (enriched.supplier_nif) {
    const byNif = findSupplierByNif(enriched.supplier_nif);
    if (byNif) {
      enriched.supplier_name = byNif.nomeOficial;
    }
  }

  // Se nao encontrou por NIF, tenta por nome
  if (!enriched.supplier_nif || !findSupplierByNif(enriched.supplier_nif)) {
    const byName = findSupplierByName(enriched.supplier_name);
    if (byName) {
      enriched.supplier_name = byName.nomeOficial;
      enriched.supplier_nif = byName.nif;
    }
  }

  // Sugere conta SNC com base no fornecedor
  const accountSuggestion = suggestAccountFromSupplier(enriched.supplier_name);
  if (accountSuggestion) {
    // Adiciona metadata (nao parte do tipo base, mas util para o caller)
    (enriched as any).suggestedAccount = accountSuggestion;
  }

  return enriched;
}

// ============================================================
// PDF-PARSE (Texto Nativo)
// ============================================================

async function tryPdfParse(buffer: Buffer): Promise<OcrResult> {
  const startTime = Date.now();

  try {
    const pdfData = await pdfParse(buffer);
    const text = pdfData.text;

    const extractedData = parseTextHeuristics(text);

    if (!extractedData) {
      return {
        success: false,
        method: 'pdf-parse',
        error: 'INSUFFICIENT_TEXT',
        processingTimeMs: Date.now() - startTime,
      };
    }

    return {
      success: true,
      data: extractedData,
      method: 'pdf-parse',
      confidence: 0.75,
      processingTimeMs: Date.now() - startTime,
    };

  } catch (error) {
    return {
      success: false,
      method: 'pdf-parse',
      error: error instanceof Error ? error.message : 'PDF_PARSE_ERROR',
      processingTimeMs: Date.now() - startTime,
    };
  }
}

function parseTextHeuristics(text: string): InvoiceExtractedData | null {
  const normalized = text.toUpperCase().replace(/\s+/g, ' ');

  // Extrai NIF (9 digitos, possivelmente com PT)
  const nifMatch = text.match(/(?:PT)?\s?(\d{3}[\s.]?\d{3}[\s.]?\d{3})/i);
  const nif = nifMatch ? normalizeNif(nifMatch[1]) : '';

  // Valida NIF extraido
  const nifValid = nif && isValidNif(nif);
  if (nif && !nifValid) {
    console.warn(`[OCR] NIF invalido detectado: ${nif}`);
  }

  // Extrai data (DD/MM/YYYY ou DD-MM-YYYY)
  const dateMatch = text.match(/(\d{2})[\/\-](\d{2})[\/\-](\d{4})/);
  const date = dateMatch
    ? `${dateMatch[3]}-${dateMatch[2]}-${dateMatch[1]}`
    : '';

  // Extrai valores monetarios
  const valueMatches = text.match(/(\d{1,3}(?:[.,]\d{3})*[.,]\d{2})/g);
  const values = valueMatches
    ? valueMatches.map((v) => parseFloat(v.replace(/\./g, '').replace(',', '.')))
    : [];

  const totalValue = values.length > 0 ? Math.max(...values) : 0;

  if (!nif || !date || totalValue === 0) {
    return null;
  }

  // Tenta extrair ATCUD (codigo de validacao da AT)
  const atcudMatch = text.match(/([A-Z0-9]{12,})/i);
  const atcud = atcudMatch ? atcudMatch[1] : undefined;

  return {
    supplier_name: extractSupplierName(text) || 'Fornecedor Desconhecido',
    supplier_nif: nifValid ? nif : nif, // Retorna mesmo invalido, mas assinala
    document_number: atcud ? `ATCUD:${atcud}` : undefined,
    date,
    total_value: totalValue,
    taxable_base: totalValue * 0.81,
    vat_total: totalValue * 0.23,
    lines: [
      {
        description: 'Servico/Produto (extracao automatica de texto)',
        taxable_amount: totalValue * 0.81,
        vat_amount: totalValue * 0.23,
        vat_rate: 23,
      },
    ],
  };
}

function extractSupplierName(text: string): string | null {
  const lines = text.split('\n').filter((l) => l.trim().length > 3);
  for (const line of lines.slice(0, 5)) {
    const trimmed = line.trim();
    if (
      trimmed.length > 5 &&
      !trimmed.includes('FATURA') &&
      !trimmed.includes('FATURA SIMPLIFICADA') &&
      !trimmed.includes('NIF') &&
      !trimmed.includes('NIPC') &&
      !/\d{9}/.test(trimmed)
    ) {
      return trimmed;
    }
  }
  return null;
}

function isDataComplete(data: InvoiceExtractedData): boolean {
  return !!(
    data.supplier_nif?.length === 9 &&
    data.date &&
    data.total_value > 0 &&
    data.lines.length > 0
  );
}

// ============================================================
// GEMINI 3.0 FLASH (Visao Multimodal) com SAF-T PT
// ============================================================

async function extractWithGemini(
  buffer: Buffer,
  mimeType: string,
  startTime: number
): Promise<OcrResult> {
  try {
    const model = genAI.getGenerativeModel({
      model: 'gemini-2.0-flash-exp',
      generationConfig: {
        temperature: 0.05, // Muito baixo para JSON preciso
        responseMimeType: 'application/json',
      },
    });

    const base64Data = buffer.toString('base64');

    const result = await model.generateContent({
      contents: [
        {
          role: 'user',
          parts: [
            { text: SAFT_PT_SYSTEM_PROMPT },
            {
              inlineData: {
                mimeType: normalizeMimeType(mimeType),
                data: base64Data,
              },
            },
          ],
        },
      ],
    });

    const responseText = result.response.text();
    const parsedData = parseGeminiResponse(responseText);

    if (!parsedData) {
      return {
        success: false,
        method: 'gemini-vision',
        error: 'INVALID_JSON_RESPONSE',
        processingTimeMs: Date.now() - startTime,
      };
    }

    // Valida e enriquece dados extraidos
    const validatedData = validateExtractedData(parsedData);
    const enrichedData = enrichWithSupplierDictionary(validatedData);

    // Valida NIF
    const nifValidation = validateSupplierNif(
      enrichedData.supplier_nif,
      enrichedData.supplier_name
    );
    if (!nifValidation.valid) {
      console.warn(`[OCR] NIF invalido: ${enrichedData.supplier_nif} - ${nifValidation.warning}`);
    }

    return {
      success: true,
      data: enrichedData,
      method: 'gemini-vision',
      confidence: 0.95,
      processingTimeMs: Date.now() - startTime,
    };

  } catch (error) {
    console.error('[OCR] Erro Gemini:', error);
    return {
      success: false,
      method: 'gemini-vision',
      error: error instanceof Error ? error.message : 'GEMINI_ERROR',
      processingTimeMs: Date.now() - startTime,
    };
  }
}

function normalizeMimeType(mimeType: string): string {
  if (mimeType.includes('pdf')) return 'application/pdf';
  if (mimeType.includes('png')) return 'image/png';
  if (mimeType.includes('jpeg') || mimeType.includes('jpg')) return 'image/jpeg';
  if (mimeType.includes('webp')) return 'image/webp';
  return 'image/jpeg';
}

function parseGeminiResponse(text: string): InvoiceExtractedData | null {
  try {
    const cleanText = text
      .replace(/```json\n?/g, '')
      .replace(/```\n?/g, '')
      .trim();

    const parsed = JSON.parse(cleanText);

    return {
      supplier_name: parsed.supplier?.name || parsed.supplier_name || '',
      supplier_nif: parsed.supplier?.nif || parsed.supplier_nif || '',
      document_number: parsed.invoice_no || parsed.document_number,
      date: parsed.issue_date || parsed.date || '',
      total_value: parseFloat(parsed.totals?.gross_total || parsed.total_value) || 0,
      taxable_base: parseFloat(parsed.totals?.net_total || parsed.taxable_base) || 0,
      vat_total: parseFloat(parsed.totals?.tax_total || parsed.vat_total) || 0,
      lines: (parsed.lines || []).map((line: any) => ({
        description: line.description || line.product_description || '',
        quantity: parseFloat(line.quantity) || 1,
        unit_price: parseFloat(line.unit_price) || 0,
        taxable_amount: parseFloat(line.tax_base || line.taxable_amount) || 0,
        vat_amount: parseFloat(line.tax_amount || line.vat_amount) || 0,
        vat_rate: parseInt(line.tax_rate || line.tax_percentage || line.vat_rate) || 23,
      })),
    };
  } catch {
    return null;
  }
}

function validateExtractedData(data: InvoiceExtractedData): InvoiceExtractedData {
  const cleanNif = normalizeNif(data.supplier_nif);

  const lines = data.lines.length > 0
    ? data.lines
    : [
        {
          description: 'Total fatura',
          quantity: 1,
          unit_price: data.total_value,
          taxable_amount: data.taxable_base,
          vat_amount: data.vat_total,
          vat_rate: 23 as const,
        },
      ];

  const calculatedTaxable = lines.reduce((sum, l) => sum + (l.taxable_amount || 0), 0);
  const calculatedVat = lines.reduce((sum, l) => sum + (l.vat_amount || 0), 0);

  return {
    ...data,
    supplier_nif: cleanNif,
    taxable_base: calculatedTaxable || data.taxable_base,
    vat_total: calculatedVat || data.vat_total,
    total_value: data.total_value || calculatedTaxable + calculatedVat,
    lines,
  };
}

// ============================================================
// DEDUPLICACAO DE HASH SIGNATURE
// ============================================================

export async function checkDuplicateSignature(
  data: InvoiceExtractedData
): Promise<{ isDuplicate: boolean; existingId?: string }> {
  const signature = generateInvoiceHashSignature(
    data.supplier_nif,
    data.date,
    data.document_number || 'SN',
    data.total_value
  );

  const existing = await prisma.invoice.findUnique({
    where: { hashSignature: signature },
    select: { id: true },
  });

  return {
    isDuplicate: !!existing,
    existingId: existing?.id,
  };
}


// ============================================================
// EXTRACAO DE TEXTO LIVRE (para RAG chat com documentos)
// ============================================================

/**
 * Extrai texto puro de uma imagem ou PDF para uso no RAG chat.
 * Usa Gemini Vision como fallback universal.
 * 
 * @param fileBuffer - Buffer do ficheiro (em memoria ou do R2)
 * @param mimeType - MIME type do ficheiro
 */
export async function extractTextFromImage(
  fileBuffer: Buffer,
  mimeType: string
): Promise<string> {
  const startTime = Date.now();

  try {
    // Para PDFs, tentamos pdf-parse primeiro
    if (mimeType === 'application/pdf') {
      try {
        const pdfData = await pdfParse(fileBuffer);
        if (pdfData.text && pdfData.text.trim().length > 50) {
          console.log(`[OCR/RAG] PDF texto extraido via pdf-parse: ${pdfData.text.length} chars`);
          return pdfData.text.trim().substring(0, 8000);
        }
      } catch {
        // Falha no pdf-parse, segue para Gemini
      }
    }

    // Para imagens e PDFs que falharam no pdf-parse, usa Gemini Vision
    const base64Data = fileBuffer.toString('base64');

    const model = genAI.getGenerativeModel({ model: 'gemini-1.5-flash' });
    const result = await model.generateContent({
      contents: [
        {
          role: 'user',
          parts: [
            {
              text: 'Extraia TODO o texto visivel deste documento. Preserve a estrutura (titulos, listas, tabelas). Nao adicione comentarios, apenas o texto puro.',
            },
            {
              inlineData: {
                mimeType: mimeType === 'application/pdf' ? 'image/jpeg' : mimeType,
                data: base64Data,
              },
            },
          ],
        },
      ],
    });

    const response = await result.response;
    const text = response.text();

    console.log(`[OCR/RAG] Texto extraido via Gemini: ${text.length} chars em ${Date.now() - startTime}ms`);
    return text.trim().substring(0, 8000);

  } catch (error) {
    console.error('[OCR/RAG] Erro ao extrair texto:', error);
    return '[Erro ao processar documento. Tente novamente ou faca a pergunta apenas por texto.]';
  }
}
