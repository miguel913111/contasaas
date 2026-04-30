/**
 * RAG Ingestor para Legislação Tributária Portuguesa
 * 
 * Este script insere documentos de referência (CIVA, CIRC, SNC) na base
 * de dados PostgreSQL com extensão pgvector para semantic search.
 * 
 * Como usar:
 *   npx tsx scripts/ingest-rag.ts
 * 
 * Nota: Em produção, deverá ser substituído por scraper real do dre.pt
 * e snc.min-financas.pt. Para efeitos de boilerplate, incluímos samples
 * estruturados dos artigos mais consultados.
 */

import { PrismaClient } from '@prisma/client';
import { sha256String } from '../src/lib/utils';

const prisma = new PrismaClient();

// ============================================================
// SAMPLES ESTRUTURADOS DA LEGISLAÇÃO
// ============================================================

interface RagDocumentInput {
  title: string;
  source: string;
  documentType: string;
  code: string;
  article: string;
  section?: string;
  content: string;
  publishedAt?: Date;
}

const documents: RagDocumentInput[] = [
  {
    title: "CIVA - Artigo 21.º - Limitações à dedução",
    source: "dre.pt - Decreto-Lei n.º 394-B/1998",
    documentType: "CIVA",
    code: "CIVA-Art21",
    article: "Artigo 21",
    content: `
Artigo 21.º
Limitações à dedução

1 — Não é dedutível o imposto suportado pelo sujeito passivo nas seguintes aquisições de bens ou prestações de serviços:

a) [Revogado.]

b) Bens e serviços destinados a serem utilizados no consumo próprio ou no de trabalhadores, sócios, administradores ou membros de outros órgãos sociais da entidade, bem como em despesas de representação;

c) Combustíveis destinados a veículos ligeiros de passageiros ou mistos, não sendo dedutível mais de 50% do imposto suportado nas restantes aquisições de combustíveis;

d) [Revogado.]

e) [Revogado.]

f) Despesas de alojamento, restauração e bebidas;

g) [Revogado.]

2 — Consideram-se veículos ligeiros de passageiros ou mistos os definidos no anexo ao Código do Imposto sobre Veículos, com exceção dos que se destinam ao transporte público de passageiros, dos de ensino de condução e dos que se destinem a ser utilizados exclusivamente como meios de transporte de mercadorias ou para prestação de serviços a terceiros, desde que o seu peso máximo autorizado exceda 2 500 kg ou que a sua capacidade de carga útil exceda 1 200 kg.

3 — A limitação prevista na alínea c) do n.º 1 não se aplica:
a) Aos veículos híbridos plug-in e totalmente elétricos;
b) Aos veículos movidos a gás natural ou hidrogénio.
    `.trim(),
    publishedAt: new Date("1998-12-31"),
  },
  {
    title: "CIVA - Artigo 20.º - Direito à dedução",
    source: "dre.pt - Decreto-Lei n.º 394-B/1998",
    documentType: "CIVA",
    code: "CIVA-Art20",
    article: "Artigo 20",
    content: `
Artigo 20.º
Direito à dedução

1 — O sujeito passivo tem direito a deduzir do imposto devido o montante do imposto suportado nas aquisições de bens e serviços destinados às seguintes finalidades:

a) A produção ou comercialização de bens ou prestação de serviços sujeitos ao imposto;
b) A exportação de bens ou prestações de serviços para fora da Comunidade;
c) As operações isentas previstas no artigo 14.º, nos termos e condições nele previstos;
d) As prestações de serviços a que se refere o artigo 15.º;
e) As operações relativas a navios de alta mar e de pesca e a aeronaves de transporte internacional, bem como aos bens a eles afectos.

2 — O direito à dedução nasce no momento em que o imposto se tornar exigível relativamente às aquisições de bens e prestações de serviços em causa.
    `.trim(),
    publishedAt: new Date("1998-12-31"),
  },
  {
    title: "SNC - Conta 6224 - Fornecimentos e serviços externos",
    source: "snc.min-financas.pt - Plano Oficial de Contas",
    documentType: "SNC",
    code: "SNC-6224",
    article: "Conta 6224",
    content: `
622 - Fornecimentos e serviços externos
6224 - Água, gás, electricidade e comunicações

Natureza: Conta de resultado (Gastos)

Regista os gastos com:
- Consumo de água para instalações, serviços e equipamentos;
- Consumo de gás para aquecimento, cozedura ou processos industriais;
- Consumo de electricidade para iluminação, força motriz ou processos;
- Serviços de comunicações (telefone, internet, telefax, correio electrónico);
- Aluguer de postes, linhas e canos para telecomunicações.

Nota: Os gastos com combustíveis para aquecimento devem ser registados na subconta 6223.
    `.trim(),
    publishedAt: new Date("2010-01-01"),
  },
  {
    title: "SNC - Conta 6233 - Despesas com pessoal",
    source: "snc.min-financas.pt - Plano Oficial de Contas",
    documentType: "SNC",
    code: "SNC-6233",
    article: "Conta 6233",
    content: `
623 - Despesas com o pessoal
6233 - Ajudas de custo

Natureza: Conta de resultado (Gastos)

Regista as ajudas de custo pagas ou a pagar ao pessoal da empresa, nomeadamente:
- Subsídios de refeição;
- Subsídios de transporte (KMs percorridos com veículo próprio);
- Subsídios de alojamento em deslocações;
- Diuturnidades em serviço externo;
- Outras ajudas de custo previstas no contrato ou regulamento interno.

Nota fiscal: As ajudas de custo não sujeitas a IRS e TSU têm limites legais.
Para KMS com veículo próprio, o valor máximo dedutível em 2026 é de 0,40€/km.
    `.trim(),
    publishedAt: new Date("2010-01-01"),
  },
  {
    title: "SNC - Conta 6241 - Alugueres",
    source: "snc.min-financas.pt - Plano Oficial de Contas",
    documentType: "SNC",
    code: "SNC-6241",
    article: "Conta 6241",
    content: `
624 - Despesas de alugueres e renda
6241 - Alugueres de imóveis

Natureza: Conta de resultado (Gastos)

Regista os gastos com alugueres de prédios ou fracções de prédios destinados à exploração da empresa, incluindo:
- Rendas de lojas, escritórios, armazéns ou fábricas;
- Alugueres de espaços em centros comerciais;
- Canas de renda de equipamentos fixos (se contrato de arrendamento).

Não inclui: Alugueres de equipamentos móveis (registar em 6222).
    `.trim(),
    publishedAt: new Date("2010-01-01"),
  },
  {
    title: "CIRC - Artigo 42.º - Determinação do lucro tributável",
    source: "dre.pt - Decreto-Lei n.º 442-A/1988",
    documentType: "CIRC",
    code: "CIRC-Art42",
    article: "Artigo 42",
    content: `
Artigo 42.º
Determinação do lucro tributável

1 — O lucro tributável é determinado a partir dos resultados apurados nas demonstrações financeiras, ajustados pelas correções de valor e pelos ganhos e perdas imputados nos termos das normas contabilísticas e ainda pelas majorações e abatimentos constantes do presente Código.

2 — Para efeitos do número anterior, são considerados os resultados apurados de acordo com as normas contabilísticas em vigor, observadas as regras específicas constantes da secção II do presente capítulo.

3 — As despesas gerais e os custos de conservação e reparação são aceites como custos ou perdas do período de tributação se, globalmente ou individualmente, não excederem determinados limites percentuais aplicáveis ao valor de aquisição dos bens em causa.
    `.trim(),
    publishedAt: new Date("1988-11-30"),
  },
  {
    title: "Portaria - Valores das Ajudas de Custo 2026",
    source: "dre.pt - Portaria n.º XXX/2026",
    documentType: "PORTARIA",
    code: "PORTARIA-AjudasCusto-2026",
    article: "Portaria",
    content: `
Portaria que fixa os valores das ajudas de custo para 2026

1 — Para efeitos de não sujeição a IRS e TSU, os valores máximos das ajudas de custo são:

a) Subsídio de refeição: 10,20€ por dia (quando não fornecida refeição pela empresa);

b) Subsídio de transporte - veículo próprio:
   - 0,40€ por quilómetro percorrido entre a residência habitual e o local de trabalho;
   - O valor máximo mensal não pode ultrapassar o correspondente a 22 dias úteis;
   - É obrigatória a apresentação de mapa de deslocações com indicação das datas, origem, destino e quilómetros percorridos.

c) Subsídio de alojamento: Valor real comprovado, até ao limite de 75€/noite no continente e 100€/noite nas ilhas.

2 — Os valores excedentes aos limites acima referidos são sujeitos a IRS e TSU na totalidade.
    `.trim(),
    publishedAt: new Date("2026-01-01"),
  },
];

// ============================================================
// FUNÇÕES DE INGESTÃO
// ============================================================

/**
 * Gera embedding simples (mock) para desenvolvimento.
 * Em produção, substituir por chamada à API de embeddings
 * (OpenAI text-embedding-3-small, ou similar).
 */
function generateMockEmbedding(text: string): number[] {
  // Simula embedding de 1536 dimensões
  // Em produção: const embedding = await openai.embeddings.create({ model: 'text-embedding-3-small', input: text })
  const hash = sha256String(text);
  const embedding: number[] = [];
  for (let i = 0; i < 1536; i++) {
    const charCode = hash.charCodeAt(i % hash.length);
    embedding.push((charCode / 255) * 2 - 1); // Normaliza entre -1 e 1
  }
  return embedding;
}

/**
 * Divide documento em chunks semânticos (por parágrafo/alínea)
 */
function chunkDocument(doc: RagDocumentInput): RagDocumentInput[] {
  const chunks: RagDocumentInput[] = [];
  const paragraphs = doc.content.split('\n\n').filter(p => p.trim().length > 20);
  
  for (let i = 0; i < paragraphs.length; i++) {
    const chunk = paragraphs[i];
    const section = chunk.match(/^\d+\)|^[a-z]\)|^Artigo \d+/)?.[0] || doc.section || `§${i + 1}`;
    
    chunks.push({
      ...doc,
      title: `${doc.title} - ${section}`,
      section,
      content: chunk.trim(),
    });
  }
  
  // Se documento pequeno, mantém como um só chunk
  if (chunks.length === 0) {
    chunks.push(doc);
  }
  
  return chunks;
}

/**
 * Inicializa extensão pgvector se necessário
 */
async function setupPgVector() {
  try {
    await prisma.$executeRaw`CREATE EXTENSION IF NOT EXISTS vector;`;
    console.log('✅ Extensão pgvector verificada/criada');
  } catch (error) {
    console.warn('⚠️  Não foi possível criar extensão pgvector:', error);
    console.warn('   Certifica-te de que o pgvector está instalado no PostgreSQL');
  }
}

/**
 * Limpa documentos existentes (opcional)
 */
async function clearExisting() {
  const count = await prisma.ragDocument.count();
  if (count > 0) {
    console.log(`🗑️  Removendo ${count} documentos existentes...`);
    await prisma.ragDocument.deleteMany();
  }
}

/**
 * Ingestão principal
 */
async function ingest() {
  console.log('🚀 Iniciando ingestão da RAG Tributária\n');
  
  await setupPgVector();
  await clearExisting();
  
  let totalChunks = 0;
  
  for (const doc of documents) {
    const chunks = chunkDocument(doc);
    console.log(`📄 ${doc.title}`);
    console.log(`   ${chunks.length} chunk(s) gerado(s)`);
    
    for (const chunk of chunks) {
      const embedding = generateMockEmbedding(chunk.content);
      
      await prisma.$executeRaw`
        INSERT INTO rag_documents (
          id, title, source, document_type, code, article, section, 
          content, metadata, is_revogated, published_at, scraped_at,
          embedding
        ) VALUES (
          gen_random_uuid(), ${chunk.title}, ${chunk.source}, ${chunk.documentType}, 
          ${chunk.code}, ${chunk.article}, ${chunk.section}, ${chunk.content},
          ${JSON.stringify({ originalLength: doc.content.length })}::jsonb, 
          false, ${chunk.publishedAt}, NOW(),
          ${embedding}::vector
        )
      `;
      
      totalChunks++;
    }
    console.log('');
  }
  
  console.log(`✅ Ingestão concluída! ${totalChunks} chunks inseridos.`);
  console.log(`📊 Documentos por tipo:`);
  
  const stats = await prisma.$queryRaw`
    SELECT document_type, COUNT(*) as count 
    FROM rag_documents 
    GROUP BY document_type
  ` as Array<{ document_type: string; count: bigint }>;
  
  for (const stat of stats) {
    console.log(`   ${stat.document_type}: ${stat.count}`);
  }
}

// ============================================================
// EXECUÇÃO
// ============================================================

ingest()
  .catch((e) => {
    console.error('❌ Erro na ingestão:', e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
