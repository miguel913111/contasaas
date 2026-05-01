/**
 * Cloudflare R2 Storage Client
 * 
 * R2 e compativel com S3 API. Usamos @aws-sdk/client-s3 para
 * upload, download, e gestao de ficheiros.
 * 
 * Configuracao via env vars:
 *   R2_ACCOUNT_ID     - ID da conta Cloudflare
 *   R2_ACCESS_KEY_ID  - Access Key
 *   R2_SECRET_ACCESS_KEY - Secret Key
 *   R2_BUCKET_NAME    - Nome do bucket
 *   R2_PUBLIC_URL     - URL publica custom (opcional)
 */

import {
  S3Client,
  PutObjectCommand,
  GetObjectCommand,
  HeadObjectCommand,
  DeleteObjectCommand,
} from '@aws-sdk/client-s3';

const R2_ACCOUNT_ID = process.env.R2_ACCOUNT_ID || '';
const R2_ACCESS_KEY_ID = process.env.R2_ACCESS_KEY_ID || '';
const R2_SECRET_ACCESS_KEY = process.env.R2_SECRET_ACCESS_KEY || '';
const R2_BUCKET_NAME = process.env.R2_BUCKET_NAME || '';
const R2_PUBLIC_URL = process.env.R2_PUBLIC_URL || '';

function getR2Client(): S3Client {
  if (!R2_ACCOUNT_ID || !R2_ACCESS_KEY_ID || !R2_SECRET_ACCESS_KEY) {
    throw new Error(
      'R2 credentials missing. Set R2_ACCOUNT_ID, R2_ACCESS_KEY_ID, R2_SECRET_ACCESS_KEY'
    );
  }
  return new S3Client({
    region: 'auto',
    endpoint: `https://${R2_ACCOUNT_ID}.r2.cloudflarestorage.com`,
    credentials: {
      accessKeyId: R2_ACCESS_KEY_ID,
      secretAccessKey: R2_SECRET_ACCESS_KEY,
    },
  });
}

function getBucketName(): string {
  if (!R2_BUCKET_NAME) {
    throw new Error('R2_BUCKET_NAME not set');
  }
  return R2_BUCKET_NAME;
}

/**
 * Faz upload de um Buffer para o R2
 */
export async function uploadFile(
  key: string,
  buffer: Buffer,
  contentType: string
): Promise<string> {
  const client = getR2Client();
  const bucket = getBucketName();

  await client.send(
    new PutObjectCommand({
      Bucket: bucket,
      Key: key,
      Body: buffer,
      ContentType: contentType,
    })
  );

  return key;
}

/**
 * Faz download de um ficheiro do R2 para Buffer
 */
export async function downloadFile(key: string): Promise<Buffer | null> {
  const client = getR2Client();
  const bucket = getBucketName();

  try {
    const response = await client.send(
      new GetObjectCommand({
        Bucket: bucket,
        Key: key,
      })
    );

    if (!response.Body) return null;

    const chunks: Uint8Array[] = [];
    // Body e um stream — consumimos para buffer
    for await (const chunk of response.Body as AsyncIterable<Uint8Array>) {
      chunks.push(chunk);
    }

    return Buffer.concat(chunks);
  } catch (error: any) {
    if (error.name === 'NoSuchKey' || error.Code === 'NoSuchKey') {
      return null;
    }
    console.error('[R2] Download error:', error);
    return null;
  }
}

/**
 * Verifica se um ficheiro existe no R2
 */
export async function fileExists(key: string): Promise<boolean> {
  const client = getR2Client();
  const bucket = getBucketName();

  try {
    await client.send(
      new HeadObjectCommand({
        Bucket: bucket,
        Key: key,
      })
    );
    return true;
  } catch {
    return false;
  }
}

/**
 * Apaga um ficheiro do R2
 */
export async function deleteFile(key: string): Promise<void> {
  const client = getR2Client();
  const bucket = getBucketName();

  await client.send(
    new DeleteObjectCommand({
      Bucket: bucket,
      Key: key,
    })
  );
}

/**
 * Retorna a URL publica de um ficheiro
 * Usa R2_PUBLIC_URL se definida, senao gera URL do R2
 */
export function getPublicUrl(key: string): string {
  if (R2_PUBLIC_URL) {
    return `${R2_PUBLIC_URL.replace(/\/$/, '')}/${key}`;
  }
  return `https://${R2_ACCOUNT_ID}.r2.cloudflarestorage.com/${getBucketName()}/${key}`;
}
