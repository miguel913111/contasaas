/**
 * Tipos globais da aplicação
 */

export enum UserRole {
  ADMIN = 'ADMIN',
  ACCOUNTANT = 'ACCOUNTANT',
  SELF_SERVICE = 'SELF_SERVICE',
}

export enum InvoiceStatus {
  PENDING = 'PENDING',
  APPROVED = 'APPROVED',
  REJECTED = 'REJECTED',
  EXPORTED = 'EXPORTED',
}

export enum VatRate {
  RATE_6 = 'RATE_6',
  RATE_13 = 'RATE_13',
  RATE_23 = 'RATE_23',
  RATE_EXEMPT = 'RATE_EXEMPT',
  RATE_ZERO = 'RATE_ZERO',
}

export interface InvoiceExtractedData {
  supplier_name: string;
  supplier_nif: string;
  document_number?: string;
  date: string; // ISO 8601
  total_value: number;
  taxable_base: number;
  vat_total: number;
  lines: InvoiceLineExtracted[];
}

export interface InvoiceLineExtracted {
  description: string;
  quantity?: number;
  unit_price?: number;
  taxable_amount: number;
  vat_amount: number;
  vat_rate: 6 | 13 | 23 | 0;
}

export interface OcrResult {
  success: boolean;
  data?: InvoiceExtractedData;
  method: 'pdf-parse' | 'gemini-vision' | 'manual' | 'qr-code';
  confidence?: number;
  error?: string;
  processingTimeMs?: number;
}

export interface AccountingSuggestion {
  accountCode: string;
  accountName: string;
  confidence: number;
  reason: string;
}

export interface CivaDeductionRule {
  vatDeductibilityRate: number; // 0-100
  articleReference: string;
  reason: string;
  requiresCorrection: boolean;
}

export interface Camt053Transaction {
  externalId: string;
  statementId: string;
  bookingDate: string;
  valueDate?: string;
  amount: number;
  currency: string;
  description?: string;
  counterpartyName?: string;
  counterpartyIban?: string;
  reference?: string;
}

export interface ReconciliationResult {
  transaction: Camt053Transaction;
  matchedInvoices: Array<{
    invoiceId: string;
    documentNumber: string;
    amount: number;
  }>;
  totalMatched: number;
  difference: number;
  differenceAccount?: string;
  method: 'exact' | 'knapsack' | 'manual';
}

export interface WhatsAppWebhookPayload {
  object: 'whatsapp_business_account';
  entry: Array<{
    id: string;
    changes: Array<{
      value: {
        messaging_product: 'whatsapp';
        metadata: {
          display_phone_number: string;
          phone_number_id: string;
        };
        contacts?: Array<{
          wa_id: string;
          profile: { name: string };
        }>;
        messages?: Array<{
          id: string;
          from: string;
          timestamp: string;
          type: 'text' | 'image' | 'document' | 'audio';
          text?: { body: string };
          image?: { id: string; mime_type: string; sha256: string };
          document?: { id: string; mime_type: string; sha256: string; filename: string };
        }>;
        statuses?: Array<{
          id: string;
          status: 'sent' | 'delivered' | 'read' | 'failed';
          timestamp: string;
          recipient_id: string;
        }>;
      };
      field: 'messages';
    }>;
  }>;
}

export interface RagChatRequest {
  question: string;
  companyId?: string;
  conversationId?: string;
}

export interface RagChatResponse {
  answer: string;
  sources: Array<{
    title: string;
    article: string;
    code: string;
    relevance: number;
  }>;
  confidence: number;
  processingTimeMs: number;
}

export interface RiskScanResult {
  referencePeriod: string;
  totalPayroll: number;
  totalKmsDeclared: number;
  totalAjudasCusto: number;
  ratioAjudasPayroll: number;
  kmRateApplied: number;
  maxLegalRate: number;
  isRateCompliant: boolean;
  isRatioAnomalous: boolean;
  riskLevel: 'LOW' | 'MEDIUM' | 'HIGH' | 'CRITICAL';
  alertMessages: string[];
  recommendations: string[];
}

export interface ToconlineDocumentLine {
  description: string;
  accountCode: string;
  debit: number;
  credit: number;
  costCenter?: string;
}

export enum WhatsAppMessageDirection {
  INBOUND = 'INBOUND',
  OUTBOUND = 'OUTBOUND',
}

export enum WhatsAppTemplateType {
  MISSING_DOCUMENT = 'MISSING_DOCUMENT',
  REMINDER = 'REMINDER',
  CONFIRMATION = 'CONFIRMATION',
  SERVICE_WINDOW_EXPIRED = 'SERVICE_WINDOW_EXPIRED',
}

export interface ToconlinePurchaseDocument {
  documentType: 'FC' | 'ND' | 'NC';
  documentNumber: string;
  documentDate: string;
  supplierNif: string;
  supplierName: string;
  totalValue: number;
  vatTotal: number;
  lines: ToconlineDocumentLine[];
  vatLines: Array<{
    vatRate: number;
    taxableAmount: number;
    vatAmount: number;
  }>;
}
