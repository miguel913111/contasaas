/**
 * Configuracao BullMQ + Redis para processamento assincrono
 * 
 * Filas:
 * - ocr: Processamento de faturas em background
 * - export: Exportacao para ERPs em background
 * - whatsapp: Envio de mensagens WhatsApp
 */

import { Queue, Worker } from 'bullmq';
import IORedis from 'ioredis';

const redisUrl = process.env.REDIS_URL || 'redis://localhost:6379';

// Conexao Redis
export const redisConnection = new IORedis(redisUrl, {
  maxRetriesPerRequest: null,
});

// ============================================================
// FILAS
// ============================================================

export const ocrQueue = new Queue('ocr', { connection: redisConnection });
export const exportQueue = new Queue('export', { connection: redisConnection });
export const whatsappQueue = new Queue('whatsapp', { connection: redisConnection });

// ============================================================
// WORKERS (processamento em background)
// ============================================================

// Worker OCR
const ocrWorker = new Worker(
  'ocr',
  async (job) => {
    const { fileBuffer, mimeType, companyId, userId, invoiceId } = job.data;
    
    // Importa dinamicamente para evitar problemas de bundle
    const { extractInvoiceData } = await import('@/modules/ocr_extraction/ocrEngine');
    const { processAccountingHeuristics } = await import('@/modules/accounting_logic/accountingHeuristics');
    const { generateInvoiceHashSignature } = await import('@/lib/utils');
    const { prisma } = await import('@/lib/prisma');
    
    const result = await extractInvoiceData(Buffer.from(fileBuffer), mimeType);
    
    // Se extracao teve sucesso, guarda na DB
    if (result.success && result.data && invoiceId) {
      try {
        const accountingResult = await processAccountingHeuristics(result.data);
        
        await prisma.invoice.update({
          where: { id: invoiceId },
          data: {
            documentNumber: result.data.document_number || 'PENDENTE',
            hashSignature: generateInvoiceHashSignature(
              result.data.supplier_nif,
              result.data.date,
              result.data.document_number || 'PENDENTE',
              result.data.total_value
            ),
            date: new Date(result.data.date),
            totalValue: result.data.total_value,
            taxableBase: result.data.taxable_base,
            vatTotal: result.data.vat_total,
            supplierName: result.data.supplier_name,
            supplierNif: result.data.supplier_nif,
            extractionMethod: result.method,
            extractionConfidence: result.confidence || 0,
            rawOcrData: result.data as any,
            suggestedAccount: accountingResult.suggestions[0]?.accountCode,
            status: 'PENDING',
            lines: {
              create: accountingResult.splitLines.map((line) => ({
                description: line.description,
                quantity: line.quantity || 1,
                unitPrice: line.unit_price || line.taxable_amount,
                taxableAmount: line.taxable_amount,
                vatAmount: line.vat_amount,
                vatRate: line.vat_rate === 6 ? 'RATE_6' : line.vat_rate === 13 ? 'RATE_13' : 'RATE_23',
                vatRateValue: line.vat_rate,
                accountCode: line.accountCode,
              })),
            },
          },
        });
      } catch (dbError) {
        console.error('[OCR Worker] Erro ao guardar na DB:', dbError);
      }
    }
    
    return result;
  },
  { connection: redisConnection }
);

// Worker Export
const exportWorker = new Worker(
  'export',
  async (job) => {
    const { erpType, companyId, invoiceIds } = job.data;
    
    // Em producao, implementar logica de exportacao assincrona
    console.log(`[Queue] Exportando ${invoiceIds.length} faturas para ${erpType}`);
    
    return { success: true, erpType, invoiceCount: invoiceIds.length };
  },
  { connection: redisConnection }
);

// Worker WhatsApp
const whatsappWorker = new Worker(
  'whatsapp',
  async (job) => {
    const { type, phoneNumber, message, templateName } = job.data;
    
    const { sendTextMessage, sendUtilityTemplate } = await import('@/modules/whatsapp_bot/webhookHandler');
    
    if (type === 'text') {
      return sendTextMessage(phoneNumber, message);
    }
    
    if (type === 'template') {
      return sendUtilityTemplate(phoneNumber, templateName);
    }
    
    return false;
  },
  { connection: redisConnection }
);

// Log de erros
ocrWorker.on('failed', (job, err) => {
  console.error(`[OCR Worker] Job ${job?.id} falhou:`, err);
});

exportWorker.on('failed', (job, err) => {
  console.error(`[Export Worker] Job ${job?.id} falhou:`, err);
});

whatsappWorker.on('failed', (job, err) => {
  console.error(`[WhatsApp Worker] Job ${job?.id} falhou:`, err);
});

// ============================================================
// FUNCOES DE ADICAO DE JOBS
// ============================================================

export async function addOcrJob(
  fileBuffer: number[],
  mimeType: string,
  companyId: string,
  userId: string,
  invoiceId: string
) {
  return ocrQueue.add('process-invoice', {
    fileBuffer,
    mimeType,
    companyId,
    userId,
    invoiceId,
  }, {
    attempts: 3,
    backoff: { type: 'exponential', delay: 5000 },
  });
}

export async function addExportJob(
  erpType: string,
  companyId: string,
  invoiceIds: string[]
) {
  return exportQueue.add('export-invoices', {
    erpType,
    companyId,
    invoiceIds,
  }, {
    attempts: 2,
    backoff: { type: 'fixed', delay: 10000 },
  });
}

export async function addWhatsAppJob(
  type: 'text' | 'template',
  phoneNumber: string,
  options: { message?: string; templateName?: string }
) {
  return whatsappQueue.add('send-message', {
    type,
    phoneNumber,
    ...options,
  }, {
    attempts: 3,
    backoff: { type: 'exponential', delay: 3000 },
  });
}
