/**
 * File Storage — Cloudflare R2 (Object Storage)
 * 
 * Substitui armazenamento local por R2 compativel S3.
 * Estrutura de chaves:
 *   invoices/{companyId}/{invoiceId}/original.{ext}
 * 
 * Fallback: Se R2 nao estiver configurado, usa disco local
 * (util para desenvolvimento local sem credenciais R2).
 */

import { writeFile, mkdir, readFile, access } from 'fs/promises';
import { join } from 'path';
import { uploadFile, downloadFile, fileExists, deleteFile } from './r2';

const UPLOADS_DIR = process.env.UPLOADS_DIR || join(process.cwd(), 'uploads');
const USE_LOCAL = !process.env.R2_BUCKET_NAME;

function getKey(companyId: string, invoiceId: string, fileName: string): string {
  const ext = fileName.split('.').pop() || 'bin';
  const safeExt = ext.replace(/[^a-zA-Z0-9]/g, '').toLowerCase() || 'bin';
  return `invoices/${companyId}/${invoiceId}/original.${safeExt}`;
}

/**
 * Guarda um ficheiro e retorna a chave (identificador R2)
 */
export async function saveInvoiceFile(
  companyId: string,
  invoiceId: string,
  fileBuffer: Buffer,
  originalName: string,
  mimeType?: string
): Promise<string> {
  const ext = originalName.split('.').pop() || 'bin';
  const safeExt = ext.replace(/[^a-zA-Z0-9]/g, '').toLowerCase() || 'bin';
  const contentType = mimeType || getMimeTypeFromExt(safeExt);

  if (USE_LOCAL) {
    // Fallback local para desenvolvimento
    const dir = join(UPLOADS_DIR, companyId, invoiceId);
    await mkdir(dir, { recursive: true });
    const fileName = `original.${safeExt}`;
    const filePath = join(dir, fileName);
    await writeFile(filePath, fileBuffer);
    return `/uploads/${companyId}/${invoiceId}/${fileName}`;
  }

  const key = getKey(companyId, invoiceId, originalName);
  await uploadFile(key, fileBuffer, contentType);
  return key;
}

/**
 * Le um ficheiro guardado (retorna Buffer)
 */
export async function readInvoiceFile(
  companyId: string,
  invoiceId: string,
  extOrKey?: string
): Promise<Buffer | null> {
  if (USE_LOCAL) {
    const dir = join(UPLOADS_DIR, companyId, invoiceId);
    const files = await readFile(join(dir, 'original.pdf')).catch(() => null)
      || await readFile(join(dir, 'original.jpg')).catch(() => null)
      || await readFile(join(dir, 'original.jpeg')).catch(() => null)
      || await readFile(join(dir, 'original.png')).catch(() => null)
      || await readFile(join(dir, 'original.webp')).catch(() => null)
      || await readFile(join(dir, 'original.bin')).catch(() => null);
    return files;
  }

  // Se extOrKey for uma chave completa (ex: invoices/...), usa diretamente
  const key = extOrKey && extOrKey.includes('/')
    ? extOrKey
    : getKey(companyId, invoiceId, extOrKey || 'original.pdf');

  return downloadFile(key);
}

/**
 * Verifica se um ficheiro existe
 */
export async function invoiceFileExists(
  companyId: string,
  invoiceId: string,
  extOrKey?: string
): Promise<boolean> {
  if (USE_LOCAL) {
    try {
      const dir = join(UPLOADS_DIR, companyId, invoiceId);
      await access(dir);
      return true;
    } catch {
      return false;
    }
  }

  const key = extOrKey && extOrKey.includes('/')
    ? extOrKey
    : getKey(companyId, invoiceId, extOrKey || 'original.pdf');

  return fileExists(key);
}

/**
 * Obtem o caminho/chave de um ficheiro
 */
export function getInvoiceFilePath(
  companyId: string,
  invoiceId: string,
  ext: string
): string {
  if (USE_LOCAL) {
    return join(UPLOADS_DIR, companyId, invoiceId, `original.${ext}`);
  }
  return getKey(companyId, invoiceId, `original.${ext}`);
}

/**
 * Apaga um ficheiro
 */
export async function deleteInvoiceFile(
  companyId: string,
  invoiceId: string,
  extOrKey?: string
): Promise<void> {
  if (USE_LOCAL) {
    // Nao implementado para local — nao e critico
    return;
  }

  const key = extOrKey && extOrKey.includes('/')
    ? extOrKey
    : getKey(companyId, invoiceId, extOrKey || 'original.pdf');

  await deleteFile(key);
}

function getMimeTypeFromExt(ext: string): string {
  const map: Record<string, string> = {
    pdf: 'application/pdf',
    jpg: 'image/jpeg',
    jpeg: 'image/jpeg',
    png: 'image/png',
    webp: 'image/webp',
    bin: 'application/octet-stream',
  };
  return map[ext] || 'application/octet-stream';
}
