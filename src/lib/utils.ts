import { type ClassValue, clsx } from 'clsx';
import { twMerge } from 'tailwind-merge';

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

/**
 * Formata valores monetários no formato português
 */
export function formatEUR(value: number | string): string {
  const num = typeof value === 'string' ? parseFloat(value) : value;
  return new Intl.NumberFormat('pt-PT', {
    style: 'currency',
    currency: 'EUR',
  }).format(num);
}

/**
 * Formata datas no formato português
 */
export function formatPTDate(date: Date | string): string {
  const d = typeof date === 'string' ? new Date(date) : date;
  return d.toLocaleDateString('pt-PT');
}

/**
 * Gera hash SHA-256 de um buffer
 */
export async function sha256Buffer(buffer: Buffer): Promise<string> {
  const crypto = await import('crypto');
  return crypto.createHash('sha256').update(buffer).digest('hex');
}

/**
 * Gera hash SHA-256 de uma string
 */
export function sha256String(input: string): string {
  const crypto = require('crypto');
  return crypto.createHash('sha256').update(input).digest('hex');
}

/**
 * Gera hash_signature única de fatura (NIF + Data + NrDoc + ValorTotal)
 * Usada para deduplicação preventiva
 */
export function generateInvoiceHashSignature(
  supplierNif: string,
  date: string,
  documentNumber: string,
  totalValue: string | number
): string {
  const normalizedNif = supplierNif.replace(/\D/g, '');
  const normalizedDate = date.replace(/-/g, '');
  const normalizedDoc = documentNumber.toUpperCase().replace(/\s/g, '');
  const normalizedValue = parseFloat(totalValue.toString()).toFixed(2);
  
  const payload = `${normalizedNif}|${normalizedDate}|${normalizedDoc}|${normalizedValue}`;
  return sha256String(payload);
}

/**
 * Trunca texto com limite seguro para bases XBASE (PHC CS)
 */
export function truncateXBase(input: string, maxLength: number = 50): string {
  if (!input) return '';
  return input.substring(0, maxLength).trim();
}

/**
 * Converte Decimal para string formatada sem erro de Numeric Overflow
 * Usado especificamente para exportações PHC CS
 */
export function safeDecimalForXBase(value: number | string | null | undefined): string {
  if (value === null || value === undefined) return '0.00';
  const num = typeof value === 'string' ? parseFloat(value) : value;
  if (isNaN(num)) return '0.00';
  // Limita a 15 dígitos totais, 2 decimais (prevenção overflow XBASE)
  const fixed = num.toFixed(2);
  if (fixed.length > 15) {
    return num.toExponential(2);
  }
  return fixed;
}
