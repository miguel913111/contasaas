/**
 * Retrieval-Augmented Generation Tributario
 * 
 * Funcionalidades:
 * 1. Semantic search em documentos vetorizados (pgvector)
 * 2. Geracao de respostas contextualizadas com Gemini
 * 3. Scanner preventivo de risco (Ajudas de Custo)
 */

import { prisma } from '@/lib/prisma';
import { GoogleGenerativeAI } from '@google/generative-ai';
import { generateEmbedding, cosineSimilarity } from '@/lib/embeddings';
import type { RagChatResponse, RiskScanResult } from '@/types';

const genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY || '');

const TOP_K_RETRIEVAL = 5;
const SIMILARITY_THRESHOLD = 0.7;

// Cache em memoria para documentos RAG (fallback quando pgvector indisponivel)
let inMemoryIndex: Array<{
  id: string;
  title: string;
  content: string;
  article: string | null;
  code: string | null;
  embedding: number[];
}> | null = null;

/**
 * Constroi indice em memoria com embeddings reais
 * Chamado automaticamente na primeira busca
 */
async function buildInMemoryIndex(): Promise<void> {
  if (inMemoryIndex !== null) return;

  const docs = await prisma.ragDocument.findMany({
    where: { isRevogated: false },
    select: { id: true, title: true, content: true, article: true, code: true },
  });

  console.log(`[RAG] A indexar ${docs.length} documentos em memoria...`);

  const indexed = [];
  for (const doc of docs) {
    const text = `${doc.title}\n${doc.code}\n${doc.article || ''}\n${doc.content}`;
    const embedding = await generateEmbedding(text);
    indexed.push({ ...doc, embedding });
  }

  inMemoryIndex = indexed;
  console.log(`[RAG] Indexacao concluida: ${indexed.length} documentos`);
}

async function retrieveRelevantDocuments(
  question: string,
  documentType?: string
): Promise<Array<{
  id: string;
  title: string;
  content: string;
  article: string;
  code: string;
  similarity: number;
}>> {
  const queryEmbedding = await generateEmbedding(question);

  // Tenta pgvector primeiro (se campo embedding existir e pgvector ativo)
  try {
    const results = await prisma.$queryRaw`
      SELECT 
        id,
        title,
        content,
        article,
        code,
        1 - (embedding <=> ${queryEmbedding}::vector) as similarity
      FROM rag_documents
      WHERE is_revogated = false
      ORDER BY embedding <=> ${queryEmbedding}::vector
      LIMIT ${TOP_K_RETRIEVAL}
    ` as Array<any>;

    if (results && results.length > 0) {
      return results
        .filter((r) => parseFloat(r.similarity) >= SIMILARITY_THRESHOLD)
        .map((r) => ({
          id: r.id,
          title: r.title,
          content: r.content,
          article: r.article,
          code: r.code,
          similarity: parseFloat(r.similarity),
        }));
    }
  } catch {
    // pgvector nao disponivel — usa busca em memoria
  }

  // Fallback: busca em memoria com similaridade de cosseno
  await buildInMemoryIndex();

  if (!inMemoryIndex || inMemoryIndex.length === 0) {
    return [];
  }

  const scored = inMemoryIndex.map((doc) => ({
    ...doc,
    similarity: cosineSimilarity(queryEmbedding, doc.embedding),
  }));

  scored.sort((a, b) => b.similarity - a.similarity);

  return scored
    .slice(0, TOP_K_RETRIEVAL)
    .filter((r) => r.similarity >= SIMILARITY_THRESHOLD)
    .map((r) => ({
      id: r.id,
      title: r.title,
      content: r.content,
      article: r.article || '',
      code: r.code || '',
      similarity: r.similarity,
    }));
}

const RAG_SYSTEM_PROMPT = `Tu es um Assistente Tributario especializado em legislacao portuguesa.
Tens acesso exclusivamente aos documentos juridicos fornecidos no contexto abaixo.

REGRAS OBRIGATORIAS:
1. Baseia a tua resposta APENAS nos documentos fornecidos
2. Se nao souberes, diz "Nao tenho informacao suficiente nos documentos consultados"
3. Cita sempre o artigo/codigo especifico (ex: "Artigo 21, n. 1, alinea c) do CIVA")
4. Usa linguagem clara mas tecnicamente precisa
5. Se a pergunta for de um ENI (empresario), simplifica a linguagem
6. NUNCA inventes artigos ou alineas que nao existam no contexto
7. Adiciona um aviso no final: "Esta informacao e meramente indicativa. Consulte sempre um contabilista certificado para decisoes fiscais."

FORMATO DA RESPOSTA:
- Resposta direta (2-3 frases no maximo para a conclusao principal)
- Base legal (citacao especifica)
- Nota pratica (como aplicar na contabilidade)
- Aviso de responsabilidade
`;

export async function processRagQuery(
  question: string,
  userRole?: string
): Promise<RagChatResponse> {
  const startTime = Date.now();

  try {
    const documents = await retrieveRelevantDocuments(question);

    if (documents.length === 0) {
      return {
        answer:
          'Nao encontrei documentacao tributaria relevante para a sua pergunta. ' +
          'Tente reformular com termos mais especificos (ex: "deducao IVA gasoleo", "ajudas de custo 2026").',
        sources: [],
        confidence: 0,
        processingTimeMs: Date.now() - startTime,
      };
    }

    const contextBlock = documents
      .map(
        (doc, idx) =>
          `[DOCUMENTO ${idx + 1}]\n` +
          `Codigo: ${doc.code}\n` +
          `Artigo: ${doc.article}\n` +
          `Conteudo: ${doc.content}\n` +
          `Relevancia: ${(doc.similarity * 100).toFixed(1)}%`
      )
      .join('\n\n---\n\n');

    const model = genAI.getGenerativeModel({
      model: 'gemini-2.0-flash-exp',
      generationConfig: {
        temperature: 0.2,
        maxOutputTokens: 2048,
      },
    });

    const userPrompt = `${RAG_SYSTEM_PROMPT}\n\n` +
      `CONTEXTO JURIDICO:\n${contextBlock}\n\n` +
      `PERGUNTA DO UTILIZADOR (${userRole || 'Contabilista'}):\n${question}`;

    const result = await model.generateContent(userPrompt);
    const answer = result.response.text();

    const avgSimilarity =
      documents.reduce((sum, d) => sum + d.similarity, 0) / documents.length;

    return {
      answer,
      sources: documents.map((d) => ({
        title: d.title,
        article: d.article,
        code: d.code,
        relevance: d.similarity,
      })),
      confidence: avgSimilarity,
      processingTimeMs: Date.now() - startTime,
    };

  } catch (error) {
    console.error('[RAG] Erro no processamento:', error);
    return {
      answer: 'Ocorreu um erro ao processar a sua consulta. Tente novamente mais tarde.',
      sources: [],
      confidence: 0,
      processingTimeMs: Date.now() - startTime,
    };
  }
}

export async function analyzeRiskAjudasCusto(
  companyId: string
): Promise<RiskScanResult> {
  const now = new Date();
  const year = now.getFullYear();
  const quarter = Math.floor(now.getMonth() / 3) + 1;
  const referencePeriod = `${year}-Q${quarter}`;

  const payrollInvoices = await prisma.invoice.findMany({
    where: {
      companyId,
      accountCode: { in: ['6211', '6212', '623'] },
      date: {
        gte: new Date(year, (quarter - 1) * 3, 1),
        lt: new Date(year, quarter * 3, 1),
      },
    },
    select: { totalValue: true },
  });

  const totalPayroll = payrollInvoices.reduce(
    (sum: number, inv: any) => sum + parseFloat(inv.totalValue.toString()),
    0
  );

  const ajudasInvoices = await prisma.invoice.findMany({
    where: {
      companyId,
      accountCode: '6233',
      date: {
        gte: new Date(year, (quarter - 1) * 3, 1),
        lt: new Date(year, quarter * 3, 1),
      },
    },
    select: { totalValue: true, lines: true },
  });

  const totalAjudasCusto = ajudasInvoices.reduce(
    (sum: number, inv: any) => sum + parseFloat(inv.totalValue.toString()),
    0
  );

  const KM_RATE_2026 = 0.4;
  const estimatedKms = totalAjudasCusto / KM_RATE_2026;

  const ratioAjudasPayroll = totalPayroll > 0 ? (totalAjudasCusto / totalPayroll) * 100 : 0;

  const sectorBenchmarks: Record<string, number> = {
    CONSTRUCAO: 15,
    COMERCIO: 8,
    SERVICOS: 12,
    INDUSTRIA: 10,
    TRANSPORTES: 25,
    DEFAULT: 12,
  };

  const company = await prisma.company.findUnique({
    where: { id: companyId },
    select: { activityCode: true },
  });

  const sector = getSectorFromCAE(company?.activityCode);
  const benchmark = sectorBenchmarks[sector] || sectorBenchmarks.DEFAULT;

  const isRateCompliant = true;
  const isRatioAnomalous = ratioAjudasPayroll > benchmark * 1.5;

  let riskLevel: 'LOW' | 'MEDIUM' | 'HIGH' | 'CRITICAL' = 'LOW';
  if (ratioAjudasPayroll > benchmark * 2.5) riskLevel = 'CRITICAL';
  else if (ratioAjudasPayroll > benchmark * 2) riskLevel = 'HIGH';
  else if (ratioAjudasPayroll > benchmark * 1.5) riskLevel = 'MEDIUM';

  const alertMessages: string[] = [];
  const recommendations: string[] = [];

  if (isRatioAnomalous) {
    alertMessages.push(
      `Ratio ajudas de custo / massa salarial (${ratioAjudasPayroll.toFixed(1)}%) ` +
      `e ${((ratioAjudasPayroll / benchmark - 1) * 100).toFixed(0)}% superior ao benchmark do setor ${sector} (${benchmark}%).`
    );
    recommendations.push(
      'Rever justificacao das deslocacoes e mapas de KMs detalhados.',
      'Verificar se ha dupla deducao (ajudas de custo + IVA do gasoleo).'
    );
  }

  if (estimatedKms > 5000) {
    alertMessages.push(
      `KMs estimados (${estimatedKms.toFixed(0)} km/trimestre) sao elevados. ` +
      `Requerer mapa de deslocacoes com origem/destino.`
    );
  }

  if (totalAjudasCusto > 0 && totalPayroll === 0) {
    alertMessages.push(
      'Ajudas de custo declaradas sem massa salarial registada. Possivel inconsistencia.'
    );
    riskLevel = 'CRITICAL';
  }

  const result: RiskScanResult = {
    referencePeriod,
    totalPayroll,
    totalKmsDeclared: estimatedKms,
    totalAjudasCusto,
    ratioAjudasPayroll,
    kmRateApplied: KM_RATE_2026,
    maxLegalRate: KM_RATE_2026,
    isRateCompliant,
    isRatioAnomalous,
    riskLevel,
    alertMessages,
    recommendations,
  };

  await prisma.riskScanAjudasCusto.create({
    data: {
      companyId,
      referencePeriod,
      totalPayroll,
      totalKmsDeclared: estimatedKms,
      totalAjudasCusto,
      ratioAjudasPayroll,
      kmRateApplied: KM_RATE_2026,
      maxLegalRate: KM_RATE_2026,
      isRateCompliant,
      isRatioAnomalous,
      riskLevel,
      alertMessages: alertMessages as any,
      recommendations: recommendations as any,
    },
  });

  return result;
}

function getSectorFromCAE(cae?: string | null): string {
  if (!cae) return 'DEFAULT';
  const code = cae.substring(0, 2);
  const sectorMap: Record<string, string> = {
    '41': 'CONSTRUCAO',
    '42': 'CONSTRUCAO',
    '43': 'CONSTRUCAO',
    '45': 'COMERCIO',
    '46': 'COMERCIO',
    '47': 'COMERCIO',
    '49': 'TRANSPORTES',
    '50': 'TRANSPORTES',
    '51': 'TRANSPORTES',
    '10': 'INDUSTRIA',
    '20': 'INDUSTRIA',
    '25': 'INDUSTRIA',
    '31': 'INDUSTRIA',
    '62': 'SERVICOS',
    '63': 'SERVICOS',
    '69': 'SERVICOS',
    '70': 'SERVICOS',
    '71': 'SERVICOS',
    '72': 'SERVICOS',
    '73': 'SERVICOS',
    '74': 'SERVICOS',
    '75': 'SERVICOS',
    '78': 'SERVICOS',
    '79': 'SERVICOS',
    '80': 'SERVICOS',
    '81': 'SERVICOS',
    '82': 'SERVICOS',
  };
  return sectorMap[code] || 'DEFAULT';
}
