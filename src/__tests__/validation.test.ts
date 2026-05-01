import { describe, it, expect } from 'vitest';
import { ocrSchema, exportSchema, bankReconciliationSchema, ragChatSchema, validateOrThrow, ValidationError } from '@/lib/validation';

describe('Zod Validation — OCR Schema', () => {
  const mockFile = new File(['test'], 'fatura.pdf', { type: 'application/pdf' });

  it('aceita PDF valido com companyId', () => {
    const result = ocrSchema.safeParse({ file: mockFile, companyId: 'abc123' });
    expect(result.success).toBe(true);
  });

  it('rejeita ficheiro sem companyId', () => {
    const result = ocrSchema.safeParse({ file: mockFile });
    expect(result.success).toBe(false);
  });

  it('rejeita companyId vazio', () => {
    const result = ocrSchema.safeParse({ file: mockFile, companyId: '' });
    expect(result.success).toBe(false);
  });

  it('rejeita ficheiro grande (>10MB)', () => {
    const bigFile = new File([new ArrayBuffer(11 * 1024 * 1024)], 'big.pdf', { type: 'application/pdf' });
    const result = ocrSchema.safeParse({ file: bigFile, companyId: 'abc' });
    expect(result.success).toBe(false);
  });

  it('rejeita formato invalido', () => {
    const txtFile = new File(['test'], 'fatura.txt', { type: 'text/plain' });
    const result = ocrSchema.safeParse({ file: txtFile, companyId: 'abc' });
    expect(result.success).toBe(false);
  });
});

describe('Zod Validation — Export Schema', () => {
  it('aceita export valido', () => {
    const result = exportSchema.safeParse({
      erpType: 'TOCONLINE',
      companyId: 'abc',
      invoiceIds: ['inv1', 'inv2'],
    });
    expect(result.success).toBe(true);
  });

  it('rejeita ERP invalido', () => {
    const result = exportSchema.safeParse({
      erpType: 'SAP',
      companyId: 'abc',
      invoiceIds: ['inv1'],
    });
    expect(result.success).toBe(false);
  });

  it('rejeita invoiceIds vazio', () => {
    const result = exportSchema.safeParse({
      erpType: 'PHC_CS',
      companyId: 'abc',
      invoiceIds: [],
    });
    expect(result.success).toBe(false);
  });

  it('rejeita mais de 500 invoices', () => {
    const result = exportSchema.safeParse({
      erpType: 'PRIMAVERA_V10',
      companyId: 'abc',
      invoiceIds: new Array(501).fill('inv'),
    });
    expect(result.success).toBe(false);
  });
});

describe('Zod Validation — Bank Reconciliation Schema', () => {
  const mockXml = new File(['<xml/>'], 'extrato.xml', { type: 'application/xml' });

  it('aceita XML valido', () => {
    const result = bankReconciliationSchema.safeParse({ file: mockXml, companyId: 'abc' });
    expect(result.success).toBe(true);
  });

  it('rejeita ficheiro >10MB', () => {
    const bigFile = new File([new ArrayBuffer(11 * 1024 * 1024)], 'big.xml', { type: 'application/xml' });
    const result = bankReconciliationSchema.safeParse({ file: bigFile, companyId: 'abc' });
    expect(result.success).toBe(false);
  });
});

describe('Zod Validation — RAG Chat Schema', () => {
  it('aceita pergunta valida', () => {
    const result = ragChatSchema.safeParse({ question: 'Qual o IVA da eletricidade?' });
    expect(result.success).toBe(true);
  });

  it('rejeita pergunta curta', () => {
    const result = ragChatSchema.safeParse({ question: 'Oi' });
    expect(result.success).toBe(false);
  });

  it('rejeita pergunta >2000 chars', () => {
    const result = ragChatSchema.safeParse({ question: 'a'.repeat(2001) });
    expect(result.success).toBe(false);
  });

  it('trim na pergunta', () => {
    const result = ragChatSchema.safeParse({ question: '  Qual o IVA?  ' });
    expect(result.success).toBe(true);
    if (result.success) {
      expect(result.data.question).toBe('Qual o IVA?');
    }
  });
});

describe('validateOrThrow helper', () => {
  it('retorna dados validos', () => {
    const data = validateOrThrow(ragChatSchema, { question: 'Ola mundo' });
    expect(data.question).toBe('Ola mundo');
  });

  it('lanca ValidationError em dados invalidos', () => {
    expect(() => validateOrThrow(ragChatSchema, { question: 'Oi' })).toThrow(ValidationError);
  });
});
