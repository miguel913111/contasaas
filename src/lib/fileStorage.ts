/**
 * File Storage Local — Guarda ficheiros em disco estruturado por empresa/fatura
 * 
 * Estrutura:
 *   uploads/
 *     {companyId}/
 *       {invoiceId}/
 *         original.{ext}
 * 
 * Futuro: Migrar para S3/MinIO trocando esta camada
 */

import { writeFile, mkdir, readFile, access } from 'fs/promises';
import { join } from 'path';

const UPLOADS_DIR = process.env.UPLOADS_DIR || join(process.cwd(), 'uploads');

/**
 * Guarda um ficheiro no disco e retorna o caminho relativo
 */
export async function saveInvoiceFile(
  companyId: string,
  invoiceId: string,
  fileBuffer: Buffer,
  originalName: string
): Promise<string> {
  const ext = originalName.split('.').pop() || 'bin';
  const safeExt = ext.replace(/[^a-zA-Z0-9]/g, '').toLowerCase() || 'bin';
  
  const dir = join(UPLOADS_DIR, companyId, invoiceId);
  await mkdir(dir, { recursive: true });
  
  const fileName = `original.${safeExt}`;
  const filePath = join(dir, fileName);
  
  await writeFile(filePath, fileBuffer);
  
  // Retorna caminho relativo (usado na DB como fileUrl)
  return `/uploads/${companyId}/${invoiceId}/${fileName}`;
}

/**
 * Le um ficheiro guardado
 */
export async function readInvoiceFile(
  companyId: string,
  invoiceId: string
): Promise<Buffer | null> {
  try {
    const dir = join(UPLOADS_DIR, companyId, invoiceId);
    const files = await readFile(join(dir, 'original.pdf')).catch(() => null)
      || await readFile(join(dir, 'original.jpg')).catch(() => null)
      || await readFile(join(dir, 'original.jpeg')).catch(() => null)
      || await readFile(join(dir, 'original.png')).catch(() => null)
      || await readFile(join(dir, 'original.webp')).catch(() => null)
      || await readFile(join(dir, 'original.bin')).catch(() => null);
    return files;
  } catch {
    return null;
  }
}

/**
 * Verifica se um ficheiro existe
 */
export async function invoiceFileExists(
  companyId: string,
  invoiceId: string
): Promise<boolean> {
  try {
    const dir = join(UPLOADS_DIR, companyId, invoiceId);
    await access(dir);
    return true;
  } catch {
    return false;
  }
}

/**
 * Obtem o caminho absoluto de um ficheiro (para download/stream)
 */
export function getInvoiceFilePath(
  companyId: string,
  invoiceId: string,
  ext: string
): string {
  return join(UPLOADS_DIR, companyId, invoiceId, `original.${ext}`);
}
