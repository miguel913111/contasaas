/**
 * Ingestor Completo da RAG Tributaria
 * 
 * Este script consolida TODAS as fontes oficiais:
 * 1. Legislacao primaria (CIVA, CIRC, SNC) - scripts/ingest-rag.ts
 * 2. DRE - diplomas essenciais
 * 3. Portal das Financas - Oficios Circulados
 * 4. OCC - Pareceres Tecnicos
 * 
 * Executar: npx tsx scripts/ingest-all-rag.ts
 */

import { PrismaClient } from '@prisma/client';
import { ingestOficiosCirculados } from '../src/modules/rag_tax_advisor/scrapers/portalFinancasScraper';
import { ingestPareceresOcc } from '../src/modules/rag_tax_advisor/scrapers/occScraper';
import { ingestDreDiplomas } from '../src/modules/rag_tax_advisor/scrapers/dreScraper';

const prisma = new PrismaClient();

async function setupPgVector() {
  try {
    await prisma.$executeRaw`CREATE EXTENSION IF NOT EXISTS vector;`;
    console.log('Extensao pgvector verificada');
  } catch (error) {
    console.warn('Aviso: pgvector pode ja estar instalado');
  }
}

async function main() {
  console.log('=============================================');
  console.log('INGESTOR COMPLETO RAG TRIBUTARIA');
  console.log('=============================================');
  console.log();

  await setupPgVector();

  // 1. Legislacao Primaria (CIVA, CIRC, SNC)
  console.log('[1/4] LEGISLACAO PRIMARIA');
  console.log('Executando scripts/ingest-rag.ts...');
  await import('./ingest-rag');
  console.log();

  // 2. DRE - Diplomas
  console.log('[2/4] DRE - DIPLOMAS');
  await ingestDreDiplomas();
  console.log();

  // 3. Portal das Financas - Oficios Circulados
  console.log('[3/4] PORTAL DAS FINANCAS - OFICIOS');
  await ingestOficiosCirculados();
  console.log();

  // 4. OCC - Pareceres Tecnicos
  console.log('[4/4] OCC - PARECERES TECNICOS');
  await ingestPareceresOcc();
  console.log();

  // Estatisticas finais
  console.log('=============================================');
  console.log('RESUMO');
  console.log('=============================================');

  const stats = await prisma.$queryRaw`
    SELECT document_type, COUNT(*) as count 
    FROM rag_documents 
    GROUP BY document_type
    ORDER BY count DESC
  ` as Array<{ document_type: string; count: bigint }>;

  let total = 0;
  for (const stat of stats) {
    console.log(`  ${stat.document_type}: ${stat.count} documentos`);
    total += Number(stat.count);
  }
  console.log(`  TOTAL: ${total} documentos/chunks`);
  console.log();
  console.log('Ingestao concluida com sucesso!');
}

main()
  .catch((e) => {
    console.error('Erro:', e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
