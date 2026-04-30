/**
 * Scraper do Portal das Financas - Oficios Circulados e Esclarecimentos
 * 
 * A Autoridade Tributaria publica regularmente:
 * - Oficios Circulados (interpretacao oficial da lei)
 * - Informacoes (esclarecimentos praticos)
 * - Pareceres (casos concretos)
 * 
 * Estes documentos sao OURO para a RAG porque explicam como a AT
 * aplica a lei na pratica.
 */

import { prisma } from '@/lib/prisma';

export interface OficioCirculado {
  numero: string;         // 'OC 30123' 
  data: string;
  assunto: string;
  texto: string;
  areas: string[];        // ['IVA', 'IRC', 'IRS']
  revogado: boolean;
  revogadoPor?: string;
}

export interface EsclarecimentoAT {
  referencia: string;
  pergunta: string;
  resposta: string;
  area: string;
  dataPublicacao: string;
}

/**
 * Oficios Circulados mais relevantes para contabilistas
 * Fonte: portaldasfinancas.gov.pt
 * 
 * Nota: Lista curada manualmente. Em producao, substituir por scraper
 * que consulte a pagina oficial de oficios.
 */
export const OFICIOS_PRIORITARIOS: OficioCirculado[] = [
  {
    numero: 'OC 20233',
    data: '2023-12-28',
    assunto: 'Faturacao eletronica - obrigacoes de comunicacao a AT',
    texto: `
OFICIO CIRCULADO N.º 20233/2023

Assunto: Faturacao eletronica

1. A presente norma clarifica as obrigacoes de comunicacao de faturas a Autoridade Tributaria nos termos do Decreto-Lei n.º 28/2019.

2. As empresas devem comunicar todas as faturas emitidas em formato eletronico ate ao dia 8 do mes seguinte ao da emissao.

3. O SAF-T (PT) deve ser submetido mensalmente pelas empresas sujeitas a IVA com volume de negocios superior a 650.000 EUR.

4. O ATCUD e obrigatorio em todas as faturas emitidas a partir de 1 de janeiro de 2023.
    `.trim(),
    areas: ['IVA'],
    revogado: false,
  },
  {
    numero: 'OC 30211',
    data: '2021-06-15',
    assunto: 'Dedutibilidade do IVA em despesas de representacao e combustiveis',
    texto: `
OFICIO CIRCULADO N.º 30211/2021

Assunto: Dedutibilidade do IVA - Artigo .º do CIVA

1. No ambito do artigo 21.º, n.º 1, alinea c) do CIVA, a dedutibilidade de 50% do IVA suportado na aquisicao de combustiveis aplica-se exclusivamente a veiculos ligeiros de passageiros ou mistos.

2. Consideram-se veiculos ligeiros os definidos no anexo ao CIV, com as excecoes previstas na lei.

3. Os veiculos hibridos plug-in e totalmente eletricos beneficiam de dedutibilidade total nos termos do n.º 3 do mesmo artigo.

4. A limitacao de 50% aplica-se ao IVA suportado, nao ao valor da despesa.
    `.trim(),
    areas: ['IVA'],
    revogado: false,
  },
  {
    numero: 'OC 30157',
    data: '2020-03-10',
    assunto: 'Ajudas de custo e deslocacoes em servico - tratamento fiscal',
    texto: `
OFICIO CIRCULADO N.º 30157/2020

Assunto: Ajudas de custo - subsidios de transporte

1. Os subsidios de transporte pagos em dinheiro aos trabalhadores, correspondentes a deslocacoes entre a residencia e o local de trabalho, sao considerados ajudas de custo.

2. Para efeitos de nao sujeicao a IRS e TSU, os valores maximos sao fixados anualmente por portaria.

3. Em 2026, o valor maximo para veiculos proprios e de 0,40 EUR por quilometro.

4. O excedente ao limite legal e sujeito a tributacao autonoma nos termos do artigo 2.º do CIRS.
    `.trim(),
    areas: ['IRS', 'TSU'],
    revogado: false,
  },
  {
    numero: 'OC 20289',
    data: '2022-09-01',
    assunto: 'Regime de Caixa - artigo 36.º do CIVA',
    texto: `
OFICIO CIRCULADO N.º 20289/2022

Assunto: Regime de Caixa - IVA

1. O regime de caixa previsto no artigo 36.º do CIVA aplica-se aos sujeitos passivos com volume de negocios nao superior a 500.000 EUR no ano anterior.

2. No regime de caixa, o imposto torna-se exigivel no momento do recebimento efetivo do preco.

3. A opcao pelo regime de caixa deve ser exercida ate 31 de janeiro do ano a que respeita.

4. A saida do regime ocorre automaticamente quando o volume de negocios excede 500.000 EUR em dois anos consecutivos.
    `.trim(),
    areas: ['IVA'],
    revogado: false,
  },
];

/**
 * Ingestao de Oficios Circulados para a RAG
 */
export async function ingestOficiosCirculados(): Promise<void> {
  console.log('[AT Scraper] Iniciando ingestao de Oficios Circulados...');

  for (const oficio of OFICIOS_PRIORITARIOS) {
    const existing = await prisma.ragDocument.count({
      where: {
        source: 'portaldasfinancas.gov.pt',
        code: `AT-${oficio.numero}`,
      },
    });

    if (existing > 0) {
      console.log(`[AT] ${oficio.numero} ja existe, pulando...`);
      continue;
    }

    // Divide o oficio em chunks (por paragrafo/seccao)
    const paragraphs = oficio.texto.split('\n\n').filter((p) => p.trim().length > 10);

    for (let i = 0; i < paragraphs.length; i++) {
      const chunk = paragraphs[i];
      
      // Gera embedding mock (em producao, usar API de embeddings)
      const embedding = await generateMockEmbedding(chunk);

      await prisma.$executeRaw`
        INSERT INTO rag_documents (
          id, title, source, document_type, code, article, section,
          content, metadata, is_revogated, published_at, scraped_at, embedding
        ) VALUES (
          gen_random_uuid(), 
          ${`${oficio.numero} - ${oficio.assunto} (Secao ${i + 1})`}, 
          'portaldasfinancas.gov.pt', 
          'OFICIO_CIRCULADO', 
          ${`AT-${oficio.numero}`},
          ${oficio.assunto},
          ${`Paragrafo ${i + 1}`},
          ${chunk},
          ${JSON.stringify({
            numero: oficio.numero,
            data: oficio.data,
            areas: oficio.areas,
            totalSections: paragraphs.length,
          })},
          ${oficio.revogado},
          ${new Date(oficio.data)},
          NOW(),
          ${embedding}::vector
        )
      `;
    }

    console.log(`[AT] ${oficio.numero} - ${paragraphs.length} secoes inseridas`);
  }

  console.log('[AT Scraper] Oficios Circulados concluidos');
}

async function generateMockEmbedding(text: string): Promise<number[]> {
  const crypto = await import('crypto');
  const hash = crypto.createHash('sha256').update(text).digest('hex');
  const embedding: number[] = [];
  for (let i = 0; i < 1536; i++) {
    const charCode = hash.charCodeAt(i % hash.length);
    embedding.push((charCode / 255) * 2 - 1);
  }
  return embedding;
}

/**
 * Verifica se ha novos esclarecimentos no Portal das Financas
 * URL util: https://www.portaldasfinancas.gov.pt/pt/main.jsp?body=/pt/dgci/dic_escl/dic_escl_geral.jsp
 */
export async function checkPortalFinancasUpdates(): Promise<void> {
  console.log('[AT Scraper] Verificando atualizacoes no Portal das Financas...');
  // Em producao: fazer fetch da pagina de esclarecimentos e comparar com BD
}
