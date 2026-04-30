/**
 * Schemas Zod para validação de inputs em todas as API routes
 * 
 * Uso:
 *   import { ocrSchema, validateOrThrow } from '@/lib/validation';
 *   const data = validateOrThrow(ocrSchema, formData);
 */

import { z } from 'zod';

// ============================================================
// HELPERS
// ============================================================

export function validateOrThrow<T>(schema: z.ZodSchema<T>, data: unknown): T {
  const result = schema.safeParse(data);
  if (!result.success) {
    const issues = result.error.issues.map(i => `${i.path.join('.')}: ${i.message}`).join('; ');
    throw new ValidationError(issues);
  }
  return result.data;
}

export class ValidationError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'ValidationError';
  }
}

// ============================================================
// SCHEMAS
// ============================================================

/** Schema para upload OCR (multipart/form-data) */
export const ocrSchema = z.object({
  file: z.instanceof(File, { message: 'Ficheiro obrigatorio' })
    .refine(f => f.size > 0, { message: 'Ficheiro vazio' })
    .refine(f => f.size <= 10 * 1024 * 1024, { message: 'Ficheiro deve ter no maximo 10MB' })
    .refine(
      f => ['application/pdf', 'image/jpeg', 'image/png', 'image/webp'].includes(f.type),
      { message: 'Formato invalido. Aceita: PDF, JPG, PNG, WEBP' }
    ),
  companyId: z.string().min(1, { message: 'companyId obrigatorio' }),
});

export type OcrInput = z.infer<typeof ocrSchema>;

/** Schema para exportação ERP (JSON body) */
export const exportSchema = z.object({
  erpType: z.enum(['TOCONLINE', 'PRIMAVERA_V10', 'PHC_CS'], {
    message: 'ERP deve ser TOCONLINE, PRIMAVERA_V10 ou PHC_CS',
  }),
  companyId: z.string().min(1, { message: 'companyId obrigatorio' }),
  invoiceIds: z.array(z.string().min(1), { message: 'invoiceIds deve ser um array de strings' })
    .min(1, { message: 'Selecione pelo menos uma fatura' })
    .max(500, { message: 'Maximo 500 faturas por exportacao' }),
  format: z.enum(['csv', 'raw']).optional(),
});

export type ExportInput = z.infer<typeof exportSchema>;

/** Schema para reconciliação bancária (multipart/form-data) */
export const bankReconciliationSchema = z.object({
  file: z.instanceof(File, { message: 'Ficheiro obrigatorio' })
    .refine(f => f.size > 0, { message: 'Ficheiro vazio' })
    .refine(f => f.size <= 10 * 1024 * 1024, { message: 'Ficheiro deve ter no maximo 10MB' })
    .refine(
      f => ['text/xml', 'application/xml', 'application/pdf'].includes(f.type) || f.name.toLowerCase().endsWith('.xml') || f.name.toLowerCase().endsWith('.pdf'),
      { message: 'Formato invalido. Aceita XML (CAMT.053) ou PDF de extrato bancario' }
    ),
  companyId: z.string().min(1, { message: 'companyId obrigatorio' }),
});

export type BankReconciliationInput = z.infer<typeof bankReconciliationSchema>;

/** Schema para RAG Chat (JSON body) */
export const ragChatSchema = z.object({
  question: z.string()
    .min(3, { message: 'Pergunta deve ter pelo menos 3 caracteres' })
    .max(2000, { message: 'Pergunta deve ter no maximo 2000 caracteres' })
    .transform(s => s.trim()),
  companyId: z.string().optional(),
});

export type RagChatInput = z.infer<typeof ragChatSchema>;

// ============================================================
// SCHEMAS PARA PAGINACAO / FILTROS (futuro)
// ============================================================

export const paginationSchema = z.object({
  page: z.coerce.number().int().min(1).default(1),
  limit: z.coerce.number().int().min(1).max(100).default(20),
});

export const invoiceFilterSchema = z.object({
  status: z.enum(['PENDING', 'APPROVED', 'REJECTED', 'EXPORTED']).optional(),
  startDate: z.string().regex(/^\d{4}-\d{2}-\d{2}$/).optional(),
  endDate: z.string().regex(/^\d{4}-\d{2}-\d{2}$/).optional(),
  supplierNif: z.string().regex(/^\d{9}$/).optional(),
  ...paginationSchema.shape,
});
