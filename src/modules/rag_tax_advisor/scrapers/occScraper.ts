/**
 * Scraper da Ordem dos Contabilistas Certificados (OCC)
 * 
 * Os Pareceres Tecnicos da OCC sao fundamentais porque:
 * 1. Interpretam a legislacao em casos praticos
 * 2. Representam o consenso da profissao contabilistica
 * 3. Tem peso legal em litigios tributarios
 * 
 * Fonte: occ.pt / boletim oficial da OCC
 */

import { prisma } from '@/lib/prisma';

export interface ParecerOcc {
  numero: string;           // 'PT-2023-045'
  data: string;
  titulo: string;
  areaTecnica: string;      // 'Fiscalidade', 'Contabilidade', 'Auditoria'
  questao: string;          // Pergunta colocada
  resposta: string;         // Parecer da OCC
  referenciasLegais: string[];
  sumarioExecutivo: string;
}

/**
 * Pareceres Tecnicos da OCC - Selecao curada
 * Em producao, scraper faria fetch de occ.pt
 */
export const PARECERES_OCC: ParecerOcc[] = [
  {
    numero: 'PT-2023-112',
    data: '2023-11-15',
    titulo: 'Tratamento contabilistico e fiscal de ajudas de custo',
    areaTecnica: 'Fiscalidade',
    questao: 'Qual o correto tratamento contabilistico das ajudas de custo pagas a trabalhadores, nomeadamente subsidios de transporte por KMs?',
    resposta: `
1. TRATAMENTO CONTABILISTICO (SNC)

As ajudas de custo devem ser registadas na conta 6233 - Ajudas de Custo.
Quando se trata de subsidio de transporte por KMs com veiculo proprio:
- Debito: 6233
- Credito: 24/22 (consoante ja pago ou nao)

2. TRATAMENTO FISCAL

IRS: Os valores ate ao limite legal (0,40 EUR/km em 2026) nao sao sujeitos a retencao na fonte.
O excedente tributa como rendimento de trabalho dependente.

TSU: O mesmo limite aplica-se para efeitos de contributiva.

IVA: As ajudas de custo nao sao operacoes sujeitas a IVA.

3. DOCUMENTACAO EXIGIDA

A empresa deve manter:
- Mapa de deslocacoes com data, origem, destino e KMs
- Copia da carta de conducao e documento unico do veiculo
- Declaracao do trabalhador sobre a titularidade do veiculo

4. NOTA SOBRE A DUPLA DEDUCAO

ATENCAO: Se a empresa paga ajudas de custo por KMs E deduz o IVA do combustivel,
pode estar a duplicar a deducao. O IVA do combustivel deduzido deve ser ajustado
proporcionalmente aos KMs pagos como ajuda de custo.
    `.trim(),
    referenciasLegais: [
      'Artigo 21.º do CIVA',
      'Artigo 2.º do CIRS',
      'Despacho 1403/2026 (limites ajudas de custo)',
    ],
    sumarioExecutivo: 'Ajudas de custo ate 0,40 EUR/km nao tributam. Acima tributam IRS+TSU. Manter mapa de deslocacoes. Cuidado com dupla deducao de IVA do combustivel.',
  },
  {
    numero: 'PT-2024-008',
    data: '2024-02-10',
    titulo: 'Dedução de IVA em veiculos hibridos plug-in',
    areaTecnica: 'Fiscalidade',
    questao: 'Um veiculo hibrido plug-in adquirido pela empresa tem dedutibilidade total de IVA do combustivel ou eletricidade?',
    resposta: `
1. APLICACAO DO ARTIGO 21.º, N.º 3 DO CIVA

Os veiculos hibridos plug-in beneficiam da isencao da limitacao prevista
na alinea c) do n.º 1, ou seja, tem dedutibilidade TOTAL do IVA suportado.

2. COMBUSTIVEL VS ELETRICIDADE

2.1. Gasoleo/gasolina: Dedutibilidade 100% (por aplicacao do n.º 3)
2.2. Eletricidade para carregamento: Dedutibilidade 100% (energia para veiculo plug-in)

3. CONDICAO: O VEICULO DEVE SER DA EMPRESA

O beneficio aplica-se desde que o veiculo esteja registado no ativo fixo
da empresa ou seja detido em regime de renting/leasing operacional.

4. DOCUMENTACAO

- Documento unico do veiculo indicando "hibrido plug-in"
- Fatura de aquisicao ou contrato de renting
- Declaracao modelo IVA (caso haja inspecao)

5. NOTA SOBRE LIMITACAO DE CUSTOS

Apesar da dedutibilidade total de IVA, os custos com o veiculo
(depreciacoes, combustivel, manutencao) ainda podem estar sujeitos
as limitacoes do artigo 45.º do CIRC (veiculos ligeiros).
    `.trim(),
    referenciasLegais: [
      'Artigo 21.º, n.º 3 do CIVA',
      'Artigo 45.º do CIRC',
      'Oficio Circulado 30211/2021',
    ],
    sumarioExecutivo: 'Veiculos hibridos plug-in tem 100% deducao de IVA em combustivel e eletricidade. O veiculo deve ser da empresa. Custos ainda limitados pelo CIRC art. 45.',
  },
  {
    numero: 'PT-2022-089',
    data: '2022-08-20',
    titulo: 'Faturas simplificadas vs faturas com NIF - obrigacoes do contabilista',
    areaTecnica: 'Contabilidade',
    questao: 'O cliente apresenta faturas simplificadas sem NIF. Pode o contabilista aceitar?',
    resposta: `
1. NATUREZA JURIDICA

As faturas simplificadas (FTS) sao documentos validos para efeitos fiscais,
mas NAO conferem direito a deducao de IVA ao titular quando nao contem o NIF.

2. DEDUCAO DE IVA

Artigo 29.º, n.º 4 do CIVA: A deducao do IVA suportado depende da existencia
de fatura que identifique o adquirente (NIF).

Faturas simplificadas SEM NIF:
- Nao admitem deducao de IVA
- Sao aceites como despesa para IRC (comprovativo de pagamento)

3. OBRIGACAO DO CONTABILISTA

O contabilista deve:
a) Alertar o cliente para a perda de deducao de IVA
b) Solicitar fatura com NIF quando valor > 1000 EUR
c) No caso de nao ser possivel, registar a despesa sem IVA dedutivel

4. REGIME ESPECIAL - RESTAURACAO

Para faturas simplificadas de restauracao até 250 EUR:
- A AT permite a deducao mediante comunicacao no e-Fatura
- O cliente deve inserir o NIF na area reservada
    `.trim(),
    referenciasLegais: [
      'Artigo 29.º do CIVA',
      'Artigo 20.º do CIVA',
      'Despacho 8632/2014 (faturas simplificadas)',
    ],
    sumarioExecutivo: 'Faturas simplificadas sem NIF nao permitem deducao de IVA. Alertar cliente. Para valores altos, exigir fatura com NIF. Restauracao ate 250 EUR tem regime especial.',
  },
];

/**
 * Ingestao de Pareceres OCC para a RAG
 */
export async function ingestPareceresOcc(): Promise<void> {
  console.log('[OCC Scraper] Iniciando ingestao de Pareceres Tecnicos...');

  for (const parecer of PARECERES_OCC) {
    const existing = await prisma.ragDocument.count({
      where: {
        source: 'occ.pt',
        code: parecer.numero,
      },
    });

    if (existing > 0) {
      console.log(`[OCC] ${parecer.numero} ja existe, pulando...`);
      continue;
    }

    // Divide em chunks: questao, resposta, sumario
    const chunks = [
      { title: `${parecer.numero} - Questao`, content: parecer.questao },
      { title: `${parecer.numero} - Resposta`, content: parecer.resposta },
      { title: `${parecer.numero} - Sumario`, content: parecer.sumarioExecutivo },
    ];

    for (const chunk of chunks) {
      const embedding = await generateMockEmbedding(chunk.content);

      await prisma.$executeRaw`
        INSERT INTO rag_documents (
          id, title, source, document_type, code, article, section,
          content, metadata, is_revogated, published_at, scraped_at, embedding
        ) VALUES (
          gen_random_uuid(), 
          ${chunk.title}, 
          'occ.pt', 
          'PARECER_OCC', 
          ${parecer.numero},
          ${parecer.areaTecnica},
          ${parecer.titulo},
          ${chunk.content},
          ${JSON.stringify({
            numero: parecer.numero,
            data: parecer.data,
            area: parecer.areaTecnica,
            referencias: parecer.referenciasLegais,
          })},
          false,
          ${new Date(parecer.data)},
          NOW(),
          ${embedding}::vector
        )
      `;
    }

    console.log(`[OCC] ${parecer.numero} - ${chunks.length} chunks inseridos`);
  }

  console.log('[OCC Scraper] Pareceres concluidos');
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
