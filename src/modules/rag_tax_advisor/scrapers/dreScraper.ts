/**
 * Scraper do Diario da Republica Eletronico (DRE.pt)
 * 
 * Responsabilidades:
 * 1. Extrair diplomas do CIVA, CIRC, CIRS, CPPT
 * 2. Parse estruturado por artigo/alinea
 * 3. Armazenar com metadados (tipo_norma, numero, data_publicacao, revogado)
 * 
 * Nota: Este scraper usa samples estruturados para demonstracao.
 * Em producao, substituir por chamadas reais ao webservice do DRE
 * ou por scraping controlado com puppeteer/cheerio.
 */

import { prisma } from '@/lib/prisma';

export interface DreDiploma {
  tipo: string;        // 'Decreto-Lei', 'Lei', 'Portaria'
  numero: string;      // '394-B/1998'
  data: string;        // '1998-12-31'
  sumario: string;
  conteudo: string;
  emVigor: boolean;
}

export interface DreArtigo {
  numero: string;      // 'Artigo 21.º'
  titulo?: string;     // 'Limitacoes a deducao'
  texto: string;
  alteracoes: Array<{
    diploma: string;
    data: string;
    natureza: 'aditamento' | 'revogacao' | 'modificacao';
  }>;
}

/**
 * Base de conhecimento estruturada dos diplomas essenciais
 * Em producao, isto seria alimentado por scraping real do DRE
 */
export const DIPLOMAS_ESSENCIAIS: DreDiploma[] = [
  {
    tipo: 'Decreto-Lei',
    numero: '394-B/1998',
    data: '1998-12-31',
    sumario: 'Codigo do IVA (CIVA)',
    conteudo: 'CIVA',
    emVigor: true,
  },
  {
    tipo: 'Decreto-Lei',
    numero: '442-A/1988',
    data: '1988-11-30',
    sumario: 'Codigo do IRC (CIRC)',
    conteudo: 'CIRC',
    emVigor: true,
  },
  {
    tipo: 'Decreto-Lei',
    numero: '442-B/1988',
    data: '1988-11-30',
    sumario: 'Codigo do IRS (CIRS)',
    conteudo: 'CIRS',
    emVigor: true,
  },
  {
    tipo: 'Decreto-Lei',
    numero: '442-C/1988',
    data: '1988-11-30',
    sumario: 'Codigo de Procedimento e de Processo Tributario (CPPT)',
    conteudo: 'CPPT',
    emVigor: true,
  },
];

/**
 * Artigos mais consultados do CIVA para RAG
 * Fonte: dre.pt + interpretacao da AT
 */
export const ARTIGOS_CIVA_PRIORITARIOS = [
  'Artigo 1.º',     // Ambito de aplicacao
  'Artigo 2.º',     // Operacoes tributaveis
  'Artigo 7.º',     // Lugar das prestacoes de servicos
  'Artigo 14.º',    // Isencoes
  'Artigo 15.º',    // Operacoes nao sujeitas
  'Artigo 20.º',    // Direito a deducao
  'Artigo 21.º',    // Limitacoes a deducao
  'Artigo 22.º',    // Ajustamentos do direito a deducao
  'Artigo 26.º',    // Obrigacoes declarativas
  'Artigo 29.º',    // Faturacao
  'Artigo 36.º',    // Regime de Caixa
  'Artigo 78.º',    // Regime de isencao
];

/**
 * Ingestao de diplomas do DRE para a RAG
 */
export async function ingestDreDiplomas(): Promise<void> {
  console.log('[DRE Scraper] Iniciando ingestao de diplomas...');

  for (const diploma of DIPLOMAS_ESSENCIAIS) {
    // Verifica se ja existe
    const existing = await prisma.ragDocument.count({
      where: {
        source: 'dre.pt',
        code: `${diploma.conteudo}-${diploma.numero}`,
      },
    });

    if (existing > 0) {
      console.log(`[DRE] ${diploma.conteudo} ${diploma.numero} ja existe, pulando...`);
      continue;
    }

    // Em producao: aqui faria fetch ao conteudo completo do diploma
    // const fullText = await fetchDreContent(diploma.numero);
    // const articles = parseArticles(fullText);

    console.log(`[DRE] ${diploma.conteudo} ${diploma.numero} marcado para ingestao`);
  }

  console.log('[DRE Scraper] Concluido');
}

/**
 * Funcao para verificar atualizacoes no DRE
 * Deve ser executada semanalmente via cron/job
 */
export async function checkDreUpdates(): Promise<{
  novosDiplomas: number;
  diplomasAlterados: number;
}> {
  console.log('[DRE Scraper] Verificando atualizacoes...');

  // Em producao: consultar feed RSS do DRE ou API
  // https://dre.pt/web/guest/home/-/dre/feed

  return {
    novosDiplomas: 0,
    diplomasAlterados: 0,
  };
}

/**
 * Gera URL de consulta direta no DRE para um artigo especifico
 */
export function generateDreUrl(
  diplomaNumero: string,
  artigo?: string
): string {
  const baseUrl = 'https://dre.pt/home';
  const searchParams = new URLSearchParams({
    q: `${diplomaNumero} ${artigo || ''}`,
    tab: 'diplomas',
  });
  return `${baseUrl}?${searchParams.toString()}`;
}
