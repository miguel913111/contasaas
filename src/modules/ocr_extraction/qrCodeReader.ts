/**
 * Leitor de QR Code para Faturas Portuguesas
 * 
 * Pipeline:
 * 1. Recebe buffer de imagem ou PDF
 * 2. Se imagem: usa jimp + jsQR para extrair QR
 * 3. Se PDF: tenta pdf-parse para ver se QR está como texto selecionável
 * 4. Retorna string do QR ou null
 * 
 * Tecnologias:
 * - jimp: Manipulação de imagens pure-JS
 * - jsqr: Decodificação de QR Code
 */

import { Jimp, intToRGBA } from 'jimp';
import jsQR from 'jsqr';
import pdfParse from 'pdf-parse';
import {
  parsePortugueseQr,
  convertQrToInvoiceData,
  validateQrIntegrity,
  isPortugueseInvoiceQr,
  type PortugueseQrData,
} from './portugueseQrParser';
import type { InvoiceExtractedData, OcrResult } from '@/types';

export interface QrExtractResult {
  found: boolean;
  qrString?: string;
  parsedData?: PortugueseQrData;
  invoiceData?: InvoiceExtractedData;
  validation?: {
    valid: boolean;
    warnings: string[];
  };
}

/**
 * Extrai QR Code de um ficheiro (imagem ou PDF)
 * 
 * Esta é a FUNÇÃO PRINCIPAL que deve ser chamada primeiro no pipeline OCR.
 * Se retornar found=true, os dados são 100% fiáveis (vêm do QR Code oficial da AT).
 */
export async function extractQrFromFile(
  fileBuffer: Buffer,
  mimeType: string
): Promise<QrExtractResult> {
  // 1. IMAGEM: Tenta extrair QR com jimp + jsQR
  if (mimeType.startsWith('image/')) {
    return await extractQrFromImage(fileBuffer);
  }

  // 2. PDF: Tenta extrair QR do texto selecionável do PDF
  if (mimeType === 'application/pdf') {
    return await extractQrFromPdf(fileBuffer);
  }

  return { found: false };
}

/**
 * Extrai QR Code de uma imagem usando jimp + jsQR
 */
async function extractQrFromImage(fileBuffer: Buffer): Promise<QrExtractResult> {
  try {
    // Lê imagem com jimp
    const image = await Jimp.read(fileBuffer);
    
    // Converte para RGBA raw data
    const width = image.bitmap.width;
    const height = image.bitmap.height;
    const data = new Uint8ClampedArray(width * height * 4);
    
    for (let y = 0; y < height; y++) {
      for (let x = 0; x < width; x++) {
        const idx = (y * width + x) * 4;
        const color = intToRGBA(image.getPixelColor(x, y));
        data[idx] = color.r;
        data[idx + 1] = color.g;
        data[idx + 2] = color.b;
        data[idx + 3] = color.a;
      }
    }

    // Tenta decodificar QR
    const code = jsQR(data, width, height, {
      inversionAttempts: 'attemptBoth', // Tenta QR normal e invertido
    });

    if (!code) {
      // Se não encontrou, tenta com imagem pré-processada (grayscale + contrast)
      return await extractQrWithPreprocessing(fileBuffer);
    }

    return processQrString(code.data);

  } catch (error) {
    console.warn('[QR Reader] Erro ao processar imagem:', error);
    return { found: false };
  }
}

/**
 * Pré-processamento avançado para QR Codes difíceis
 * (talões térmicos desbotados, baixa resolução, etc.)
 */
async function extractQrWithPreprocessing(fileBuffer: Buffer): Promise<QrExtractResult> {
  try {
    const image = await Jimp.read(fileBuffer);
    
    // Aplica pré-processamentos em sequência
    const preprocessings = [
      // 1. Grayscale + alto contraste
      () => {
        image.greyscale();
        image.contrast(0.5);
        return image;
      },
      // 2. Grayscale + threshold (binarização)
      () => {
        image.greyscale();
        // Threshold manual: pixels > 128 -> branco, senão -> preto
        image.scan(0, 0, image.bitmap.width, image.bitmap.height, function (x, y, idx) {
          const gray = image.bitmap.data[idx]; // R=G=B em grayscale
          const val = gray > 128 ? 255 : 0;
          image.bitmap.data[idx] = val;
          image.bitmap.data[idx + 1] = val;
          image.bitmap.data[idx + 2] = val;
        });
        return image;
      },
      // 3. Resize 2x (super-resolution simples)
      () => {
        image.resize({ w: image.bitmap.width * 2, h: image.bitmap.height * 2 });
        image.greyscale();
        image.contrast(0.3);
        return image;
      },
    ];

    for (const preprocess of preprocessings) {
      const processed = preprocess();
      
      const width = processed.bitmap.width;
      const height = processed.bitmap.height;
      const data = new Uint8ClampedArray(width * height * 4);
      
      for (let y = 0; y < height; y++) {
        for (let x = 0; x < width; x++) {
          const idx = (y * width + x) * 4;
          const color = intToRGBA(processed.getPixelColor(x, y));
          data[idx] = color.r;
          data[idx + 1] = color.g;
          data[idx + 2] = color.b;
          data[idx + 3] = color.a;
        }
      }

      const code = jsQR(data, width, height, {
        inversionAttempts: 'attemptBoth',
      });

      if (code) {
        return processQrString(code.data);
      }
    }

    return { found: false };

  } catch (error) {
    console.warn('[QR Reader] Erro no pré-processamento:', error);
    return { found: false };
  }
}

/**
 * Extrai QR Code de um PDF
 * 
 * Estratégia:
 * 1. Tenta pdf-parse para ver se o texto do QR está selecionável no PDF
 * 2. (Futuro) Converter PDF para imagem e usar jsQR
 */
async function extractQrFromPdf(fileBuffer: Buffer): Promise<QrExtractResult> {
  try {
    const pdfData = await pdfParse(fileBuffer);
    const text = pdfData.text;

    // Procura por padrões de QR Code português no texto
    // O QR pode aparecer como texto selecionável em alguns PDFs
    const qrPattern = /A:\d{9}\*B:\d{9}\*C:PT\*D:[A-Z]{2}/;
    const match = text.match(qrPattern);

    if (match) {
      // Extrai a string completa do QR (ate ao proximo \n ou fim de linha)
      const startIdx = match.index!;
      const endIdx = text.indexOf('\n', startIdx);
      const qrString = endIdx > 0 
        ? text.substring(startIdx, endIdx).trim()
        : text.substring(startIdx).trim();

      return processQrString(qrString);
    }

    return { found: false };

  } catch (error) {
    console.warn('[QR Reader] Erro ao processar PDF:', error);
    return { found: false };
  }
}

/**
 * Processa uma string QR e converte para dados de fatura
 */
function processQrString(qrString: string): QrExtractResult {
  // Verifica se é um QR português
  if (!isPortugueseInvoiceQr(qrString)) {
    return { found: true, qrString }; // QR encontrado mas não é português
  }

  // Parseia o QR
  const parsed = parsePortugueseQr(qrString);
  if (!parsed) {
    return { found: true, qrString };
  }

  // Valida integridade
  const validation = validateQrIntegrity(parsed);

  // Converte para formato interno de fatura
  const invoiceData = convertQrToInvoiceData(parsed);

  return {
    found: true,
    qrString,
    parsedData: parsed,
    invoiceData,
    validation,
  };
}

/**
 * Função de conveniência: extrai QR e retorna OcrResult diretamente
 * 
 * Usada pelo ocrEngine.ts para integrar no pipeline existente.
 */
export async function extractInvoiceDataFromQr(
  fileBuffer: Buffer,
  mimeType: string
): Promise<OcrResult | null> {
  const startTime = Date.now();

  const qrResult = await extractQrFromFile(fileBuffer, mimeType);

  if (!qrResult.found || !qrResult.invoiceData) {
    return null;
  }

  return {
    success: true,
    data: qrResult.invoiceData,
    method: 'qr-code',
    confidence: 1.0, // QR Code = 100% confiança
    processingTimeMs: Date.now() - startTime,
  };
}
