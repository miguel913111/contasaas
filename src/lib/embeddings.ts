/**
 * Embeddings — Google Generative AI (text-embedding-004)
 * 
 * Modelo: text-embedding-004
 * Dimensao: 768
 * Free tier: ate 1M tokens/dia
 * 
 * Fallback: se GEMINI_API_KEY nao configurada, usa simulacao (nao para producao)
 */

const EMBEDDING_DIMENSION = 768;
const EMBEDDING_MODEL = 'text-embedding-004';

/**
 * Gera embedding semantico real via Google Generative AI API
 */
export async function generateEmbedding(text: string): Promise<number[]> {
  const apiKey = process.env.GEMINI_API_KEY;

  if (!apiKey || apiKey.length < 10) {
    console.warn('[Embeddings] GEMINI_API_KEY nao configurada. Usando fallback SHA256 (NAO USE EM PRODUCAO)');
    return generateFallbackEmbedding(text);
  }

  try {
    const response = await fetch(
      `https://generativelanguage.googleapis.com/v1beta/models/${EMBEDDING_MODEL}:embedContent?key=${apiKey}`,
      {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          content: { parts: [{ text: text.substring(0, 8000) }] }, // Limite de tokens
        }),
      }
    );

    if (!response.ok) {
      const errorText = await response.text();
      console.error('[Embeddings] API erro:', errorText);
      return generateFallbackEmbedding(text);
    }

    const data = await response.json();
    const values: number[] = data.embedding?.values;

    if (!values || values.length !== EMBEDDING_DIMENSION) {
      console.warn(`[Embeddings] Dimensao inesperada: ${values?.length}. Esperado: ${EMBEDDING_DIMENSION}`);
      return generateFallbackEmbedding(text);
    }

    return values;
  } catch (error) {
    console.error('[Embeddings] Erro:', error);
    return generateFallbackEmbedding(text);
  }
}

/**
 * Calcula similaridade de cosseno entre dois vetores
 * Resultado: -1 a 1 (1 = identicos)
 */
export function cosineSimilarity(a: number[], b: number[]): number {
  if (a.length !== b.length) {
    throw new Error(`Dimensoes diferentes: ${a.length} vs ${b.length}`);
  }

  let dotProduct = 0;
  let normA = 0;
  let normB = 0;

  for (let i = 0; i < a.length; i++) {
    dotProduct += a[i] * b[i];
    normA += a[i] * a[i];
    normB += b[i] * b[i];
  }

  if (normA === 0 || normB === 0) return 0;

  return dotProduct / (Math.sqrt(normA) * Math.sqrt(normB));
}

/**
 * Fallback SHA256 (apenas para desenvolvimento sem API key)
 */
async function generateFallbackEmbedding(text: string): Promise<number[]> {
  const crypto = await import('crypto');
  const hash = crypto.createHash('sha256').update(text).digest('hex');
  const embedding: number[] = [];
  for (let i = 0; i < EMBEDDING_DIMENSION; i++) {
    const charCode = hash.charCodeAt(i % hash.length);
    embedding.push((charCode / 255) * 2 - 1);
  }
  return embedding;
}
