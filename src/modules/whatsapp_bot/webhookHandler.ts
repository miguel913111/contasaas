/**
 * Gestor Autónomo de Comunicações via WhatsApp
 * 
 * Responsabilidades:
 * 1. Receber e validar webhooks da Meta (verificação de assinatura)
 * 2. Processar mensagens inbound (texto, imagem, documento)
 * 3. Enviar templates de utilidade (Utility Templates)
 * 4. Monitorizar janelas de serviço de 24h
 */

import { prisma } from '@/lib/prisma';
import type { WhatsAppWebhookPayload, WhatsAppMessageDirection, WhatsAppTemplateType } from '@/types';
import { extractInvoiceData } from '@/modules/ocr_extraction/ocrEngine';

// ============================================================
// CONFIGURAÇÃO
// ============================================================

const META_API_VERSION = process.env.WHATSAPP_API_VERSION || 'v18.0';
const PHONE_NUMBER_ID = process.env.WHATSAPP_PHONE_NUMBER_ID || '';
const ACCESS_TOKEN = process.env.WHATSAPP_ACCESS_TOKEN || '';
const APP_SECRET = process.env.WHATSAPP_APP_SECRET || '';

const SERVICE_WINDOW_HOURS = 24;

// ============================================================
// VERIFICAÇÃO DE ASSINATURA META
// ============================================================

/**
 * Verifica a assinatura HMAC do webhook da Meta
 * Protege contra requests falsificados
 */
export function verifyWebhookSignature(
  payload: string,
  signature: string
): boolean {
  if (!APP_SECRET) {
    console.warn('[WhatsApp] APP_SECRET não configurado, skipping signature verification');
    return true;
  }

  try {
    const crypto = require('crypto');
    const expectedSignature = crypto
      .createHmac('sha256', APP_SECRET)
      .update(payload, 'utf8')
      .digest('hex');

    return crypto.timingSafeEqual(
      Buffer.from(signature),
      Buffer.from(expectedSignature)
    );
  } catch {
    return false;
  }
}

/**
 * Verifica token de verificação do webhook (GET request)
 */
export function verifyWebhookToken(
  mode: string,
  token: string,
  challenge: string
): string | null {
  const verifyToken = process.env.WHATSAPP_WEBHOOK_VERIFY_TOKEN || '';

  if (mode === 'subscribe' && token === verifyToken) {
    return challenge;
  }

  return null;
}

// ============================================================
// PROCESSAMENTO DE MENSAGENS INBOUND
// ============================================================

export async function processWebhookPayload(
  payload: WhatsAppWebhookPayload
): Promise<void> {
  for (const entry of payload.entry) {
    for (const change of entry.changes) {
      const value = change.value;

      // Processa mensagens recebidas
      if (value.messages) {
        for (const message of value.messages) {
          await processInboundMessage(value.metadata.phone_number_id, message);
        }
      }

      // Processa status updates (delivered, read, failed)
      if (value.statuses) {
        for (const status of value.statuses) {
          await processStatusUpdate(status);
        }
      }
    }
  }
}

async function processInboundMessage(
  phoneNumberId: string,
  message: any
): Promise<void> {
  const phoneNumber = message.from;
  const timestamp = new Date(parseInt(message.timestamp) * 1000);

  // Atualiza janela de serviço
  const serviceWindowEnd = new Date(timestamp.getTime() + SERVICE_WINDOW_HOURS * 60 * 60 * 1000);
  const isWithinWindow = serviceWindowEnd > new Date();

  // Tenta associar a uma empresa pelo número de telefone
  const company = await prisma.company.findFirst({
    where: { phone: phoneNumber },
  });

  // Cria log da mensagem
  const log = await prisma.whatsAppLog.create({
    data: {
      phoneNumber,
      direction: 'INBOUND',
      status: 'DELIVERED',
      messageBody: message.text?.body,
      mediaUrl: message.image?.id || message.document?.id,
      mediaType: message.type,
      serviceWindowStart: timestamp,
      serviceWindowEnd,
      isWithinServiceWindow: isWithinWindow,
      companyId: company?.id,
    },
  });

  // Processa media (imagem/documento = potencial fatura)
  if (message.type === 'image' || message.type === 'document') {
    await processMediaMessage(phoneNumber, message, log.id, company?.id);
  }

  // Responde confirmação
  if (message.text?.body) {
    await sendTextMessage(
      phoneNumber,
      'Obrigado pela sua mensagem. Se enviou uma fatura, estamos a processá-la. 🧾'
    );
  }
}

async function processMediaMessage(
  phoneNumber: string,
  message: any,
  logId: string,
  companyId?: string
): Promise<void> {
  try {
    // 1. Download da media da Meta
    const mediaId = message.image?.id || message.document?.id;
    if (!mediaId) return;

    const mediaUrl = await getMediaUrl(mediaId);
    if (!mediaUrl) {
      console.error('[WhatsApp] Não foi possível obter URL da media');
      return;
    }

    const fileBuffer = await downloadMedia(mediaUrl);
    const mimeType = message.image?.mime_type || message.document?.mime_type || 'image/jpeg';

    // 2. Processa OCR
    const ocrResult = await extractInvoiceData(fileBuffer, mimeType);

    if (ocrResult.success && ocrResult.data) {
      // 3. Se tem companyId, cria fatura automaticamente
      if (companyId) {
        // Deduplicação
        const crypto = require('crypto');
        const fileHash = crypto.createHash('sha256').update(fileBuffer).digest('hex');

        await prisma.invoice.create({
          data: {
            companyId,
            documentNumber: ocrResult.data.document_number || 'WHATSAPP',
            hashSignature: require('@/lib/utils').generateInvoiceHashSignature(
              ocrResult.data.supplier_nif,
              ocrResult.data.date,
              ocrResult.data.document_number || 'WHATSAPP',
              ocrResult.data.total_value
            ),
            fileHash,
            date: new Date(ocrResult.data.date),
            totalValue: ocrResult.data.total_value,
            taxableBase: ocrResult.data.taxable_base,
            vatTotal: ocrResult.data.vat_total,
            supplierName: ocrResult.data.supplier_name,
            supplierNif: ocrResult.data.supplier_nif,
            extractionMethod: ocrResult.method,
            extractionConfidence: ocrResult.confidence || 0,
            rawOcrData: ocrResult.data as any,
            status: 'PENDING',
            lines: {
              create: ocrResult.data.lines.map((line) => ({
                description: line.description,
                quantity: line.quantity || 1,
                unitPrice: line.unit_price || line.taxable_amount,
                taxableAmount: line.taxable_amount,
                vatAmount: line.vat_amount,
                vatRate: line.vat_rate === 6 ? 'RATE_6' : line.vat_rate === 13 ? 'RATE_13' : 'RATE_23',
                vatRateValue: line.vat_rate,
              })),
            },
          },
        });

        // 4. Atualiza log com resultado
        await prisma.whatsAppLog.update({
          where: { id: logId },
          data: {
            processedAt: new Date(),
            ocrResultId: fileHash,
          },
        });

        // 5. Notifica utilizador
        await sendTextMessage(
          phoneNumber,
          `✅ Fatura processada com sucesso!\n\n` +
          `📄 Fornecedor: ${ocrResult.data.supplier_name}\n` +
          `💰 Valor: ${ocrResult.data.total_value.toFixed(2)}€\n` +
          `📅 Data: ${ocrResult.data.date}\n\n` +
          `Será analisada pelo seu contabilista em breve.`
        );
      } else {
        await sendTextMessage(
          phoneNumber,
          '⚠️ Não conseguimos identificar a sua empresa pelo número de telefone. Por favor contacte o suporte.'
        );
      }
    } else {
      await sendTextMessage(
        phoneNumber,
        '❌ Não conseguimos processar a imagem. Por favor envie uma foto mais nítida da fatura.'
      );
    }

  } catch (error) {
    console.error('[WhatsApp] Erro ao processar media:', error);
    await sendTextMessage(
      phoneNumber,
      '❌ Ocorreu um erro ao processar o documento. Tente novamente mais tarde.'
    );
  }
}

async function processStatusUpdate(status: any): Promise<void> {
  // Atualiza status na base de dados
  const statusMap: Record<string, string> = {
    sent: 'SENT',
    delivered: 'DELIVERED',
    read: 'READ',
    failed: 'FAILED',
  };

  await prisma.whatsAppLog.updateMany({
    where: { id: status.id },
    data: {
      status: (statusMap[status.status] || 'PENDING') as any,
    },
  });
}

// ============================================================
// ENVIO DE MENSAGENS (Utility Templates)
// ============================================================

/**
 * Envia mensagem de texto simples (só funciona dentro da janela de 24h)
 */
export async function sendTextMessage(
  to: string,
  body: string
): Promise<boolean> {
  try {
    const response = await fetch(
      `https://graph.facebook.com/${META_API_VERSION}/${PHONE_NUMBER_ID}/messages`,
      {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${ACCESS_TOKEN}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          messaging_product: 'whatsapp',
          recipient_type: 'individual',
          to,
          type: 'text',
          text: { body },
        }),
      }
    );

    if (!response.ok) {
      const error = await response.json();
      console.error('[WhatsApp] Erro ao enviar mensagem:', error);
      return false;
    }

    return true;
  } catch (error) {
    console.error('[WhatsApp] Erro de rede:', error);
    return false;
  }
}

/**
 * Envia template de utilidade (funciona FORA da janela de 24h)
 * 
 * Requer pré-aprovação do template na Meta Business Manager
 */
export async function sendUtilityTemplate(
  to: string,
  templateName: string,
  languageCode: string = 'pt_PT',
  parameters?: Array<{ type: string; parameter_name: string; text: string }>
): Promise<boolean> {
  try {
    const response = await fetch(
      `https://graph.facebook.com/${META_API_VERSION}/${PHONE_NUMBER_ID}/messages`,
      {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${ACCESS_TOKEN}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          messaging_product: 'whatsapp',
          recipient_type: 'individual',
          to,
          type: 'template',
          template: {
            name: templateName,
            language: { code: languageCode },
            components: parameters ? [
              {
                type: 'body',
                parameters: parameters.map((p) => ({
                  type: p.type,
                  parameter_name: p.parameter_name,
                  text: p.text,
                })),
              },
            ] : undefined,
          },
        }),
      }
    );

    if (!response.ok) {
      const error = await response.json();
      console.error('[WhatsApp] Erro ao enviar template:', error);
      return false;
    }

    return true;
  } catch (error) {
    console.error('[WhatsApp] Erro de rede:', error);
    return false;
  }
}

/**
 * Solicita documento em falta via template de utilidade
 * Usado quando há transação bancária sem fatura correspondente
 */
export async function requestMissingDocument(
  transactionId: string,
  phoneNumber: string
): Promise<boolean> {
  // Busca transação para obter detalhes
  const transaction = await prisma.bankTransaction.findUnique({
    where: { id: transactionId },
    include: { company: true },
  });

  if (!transaction) return false;

  // Verifica se está dentro da janela de serviço
  const lastLog = await prisma.whatsAppLog.findFirst({
    where: { phoneNumber },
    orderBy: { createdAt: 'desc' },
  });

  const withinWindow = lastLog?.serviceWindowEnd && lastLog.serviceWindowEnd > new Date();

  if (withinWindow) {
    // Envia mensagem simples (grátis)
    return sendTextMessage(
      phoneNumber,
      `Olá! 👋\n\n` +
      `Detetámos um pagamento de *${transaction.amount.toFixed(2)}€* ` +
      `(${transaction.description || 'sem descrição'}) sem fatura correspondente.\n\n` +
      `Pode enviar-nos a foto da fatura? Obrigado! 🧾`
    );
  } else {
    // Envia template de utilidade (fora da janela)
    const success = await sendUtilityTemplate(
      phoneNumber,
      'missing_document_v2',
      'pt_PT',
      [
        { type: 'text', parameter_name: 'amount', text: transaction.amount.toFixed(2) },
        { type: 'text', parameter_name: 'description', text: transaction.description || 'Pagamento' },
      ]
    );

    // Regista o envio
    await prisma.whatsAppLog.create({
      data: {
        phoneNumber,
        direction: 'OUTBOUND',
        status: success ? 'SENT' : 'FAILED',
        templateType: 'MISSING_DOCUMENT',
        templateName: 'missing_document_v2',
        serviceWindowStart: lastLog?.serviceWindowStart || new Date(),
        serviceWindowEnd: lastLog?.serviceWindowEnd || new Date(Date.now() + SERVICE_WINDOW_HOURS * 60 * 60 * 1000),
        isWithinServiceWindow: false,
        companyId: transaction.companyId,
      },
    });

    return success;
  }
}

// ============================================================
// HELPERS DE MEDIA
// ============================================================

async function getMediaUrl(mediaId: string): Promise<string | null> {
  try {
    const response = await fetch(
      `https://graph.facebook.com/${META_API_VERSION}/${mediaId}`,
      {
        headers: { Authorization: `Bearer ${ACCESS_TOKEN}` },
      }
    );

    if (!response.ok) return null;

    const data = await response.json();
    return data.url;
  } catch {
    return null;
  }
}

async function downloadMedia(url: string): Promise<Buffer> {
  const response = await fetch(url, {
    headers: { Authorization: `Bearer ${ACCESS_TOKEN}` },
  });

  if (!response.ok) {
    throw new Error(`Falha ao download media: ${response.status}`);
  }

  const arrayBuffer = await response.arrayBuffer();
  return Buffer.from(arrayBuffer);
}
