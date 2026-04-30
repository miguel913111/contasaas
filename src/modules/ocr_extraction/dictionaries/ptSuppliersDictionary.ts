/**
 * Dicionario de Fornecedores Portugueses
 * 
 * Para reconhecimento automatico de fornecedores no OCR.
 * Mapeia padroes textuais e NIFs para nomes oficiais.
 * 
 * Fontes:
 * - NIFs validados na AT
 * - Denominacoes sociais oficiais
 * - Aliases comuns nas faturas
 */

export interface SupplierEntry {
  nif: string;
  nomeOficial: string;
  aliases: string[];       // Nomes que aparecem nas faturas
  setor: string;           // Para sugestao SNC
  contaSncPredita: string; // Conta mais provavel
  tiposDocumento: string[]; // 'FC', 'FT', 'FS', etc.
}

/**
 * Dicionario base de fornecedores comuns em Portugal
 * Em producao, isto seria alimentado por:
 * 1. Base de dados da AT (consulta de NIFs)
 * 2. Aprendizagem automatica a partir das faturas processadas
 * 3. Importacao SAF-T dos clientes
 */
export const PT_SUPPLIERS_DICTIONARY: SupplierEntry[] = [
  // ENERGIA
  {
    nif: '502011020',
    nomeOficial: 'EDP COMERCIAL - COMERCIALIZACAO DE ENERGIA, S.A.',
    aliases: ['EDP', 'EDP COMERCIAL', 'EDP ENERGIA', 'EDP SERVICO UNIVERSAL'],
    setor: 'Energia',
    contaSncPredita: '6224',
    tiposDocumento: ['FC', 'FT'],
  },
  {
    nif: '503933764',
    nomeOficial: 'GALP ENERGIA, SGPS, S.A.',
    aliases: ['GALP', 'GALP ENERGIA', 'PETROGAL'],
    setor: 'Combustiveis',
    contaSncPredita: '6223',
    tiposDocumento: ['FC', 'FS', 'VD'],
  },
  {
    nif: '500611548',
    nomeOficial: 'REPSOL COMERCIAL DE PRODUTOS PETROLIFEROS, S.A.',
    aliases: ['REPSOL', 'REPSOL COMERCIAL'],
    setor: 'Combustiveis',
    contaSncPredita: '6223',
    tiposDocumento: ['FC', 'FS', 'VD'],
  },
  {
    nif: '502465127',
    nomeOficial: 'BP PORTUGAL - COMERCIO DE COMBUSTIVEIS E LUBRIFICANTES, S.A.',
    aliases: ['BP', 'BP PORTUGAL', 'BP COMBUSTIVEIS'],
    setor: 'Combustiveis',
    contaSncPredita: '6223',
    tiposDocumento: ['FC', 'FS'],
  },
  {
    nif: '507000099',
    nomeOficial: 'ENDESA ENERGIA, S.A.',
    aliases: ['ENDESA', 'ENDESA ENERGIA'],
    setor: 'Energia',
    contaSncPredita: '6224',
    tiposDocumento: ['FC', 'FT'],
  },

  // TELECOMUNICACOES
  {
    nif: '506634621',
    nomeOficial: 'MEO - SERVICOS DE COMUNICACOES E MULTIMEDIA, S.A.',
    aliases: ['MEO', 'PT COMUNICACOES', 'PORTUGAL TELECOM', 'PT'],
    setor: 'Telecomunicacoes',
    contaSncPredita: '6224',
    tiposDocumento: ['FC', 'FT'],
  },
  {
    nif: '504550470',
    nomeOficial: 'NOS COMUNICACOES, S.A.',
    aliases: ['NOS', 'NOS COMUNICACOES', 'ZON', 'ZON MULTIMEDIA'],
    setor: 'Telecomunicacoes',
    contaSncPredita: '6224',
    tiposDocumento: ['FC', 'FT'],
  },
  {
    nif: '502797324',
    nomeOficial: 'VODAFONE PORTUGAL - COMUNICACOES PESSOAIS, S.A.',
    aliases: ['VODAFONE', 'VODAFONE PT', 'VFA'],
    setor: 'Telecomunicacoes',
    contaSncPredita: '6224',
    tiposDocumento: ['FC', 'FT'],
  },

  // RETAIL / ALIMENTAR
  {
    nif: '500322873',
    nomeOficial: 'MODELO CONTINENTE HIPERMERCADOS, S.A.',
    aliases: ['CONTINENTE', 'MODELO CONTINENTE', 'WELLS'],
    setor: 'Retalho',
    contaSncPredita: '6111',
    tiposDocumento: ['FS', 'FT'],
  },
  {
    nif: '501224690',
    nomeOficial: 'JERONIMO MARTINS SGPS, S.A.',
    aliases: ['JERONIMO MARTINS', 'PINGO DOCE', 'PINGO DOCE SGPS'],
    setor: 'Retalho',
    contaSncPredita: '6111',
    tiposDocumento: ['FS', 'FT'],
  },
  {
    nif: '503118913',
    nomeOficial: 'AUCHAN RETAIL PORTUGAL, S.A.',
    aliases: ['AUCHAN', 'PAO DE ACUCAR', 'JUMBO'],
    setor: 'Retalho',
    contaSncPredita: '6111',
    tiposDocumento: ['FS', 'FT'],
  },
  {
    nif: '500281265',
    nomeOficial: 'LIDL PORTUGAL - COMERCIO DE PRODUTOS ALIMENTARES, S.A.',
    aliases: ['LIDL', 'LIDL PORTUGAL'],
    setor: 'Retalho',
    contaSncPredita: '6111',
    tiposDocumento: ['FS', 'FT'],
  },

  // TRANSPORTES
  {
    nif: '500794880',
    nomeOficial: 'TAP - TRANSPORTES AEREOS PORTUGUESES, S.A.',
    aliases: ['TAP', 'TAP AIR PORTUGAL'],
    setor: 'Transportes',
    contaSncPredita: '6251',
    tiposDocumento: ['FC', 'FT'],
  },
  {
    nif: '502220570',
    nomeOficial: 'COMBOIOS DE PORTUGAL - CP, E.P.E.',
    aliases: ['CP', 'COMBOIOS DE PORTUGAL', 'COMBOIOS PORTUGAL'],
    setor: 'Transportes',
    contaSncPredita: '6251',
    tiposDocumento: ['FC', 'FT'],
  },

  // SEGUROS
  {
    nif: '500758286',
    nomeOficial: 'FIDELIDADE - COMPANHIA DE SEGUROS, S.A.',
    aliases: ['FIDELIDADE', 'FIDELIDADE SEGUROS'],
    setor: 'Seguros',
    contaSncPredita: '6261',
    tiposDocumento: ['FC', 'FT'],
  },
  {
    nif: '500247766',
    nomeOficial: 'COMPANHIA DE SEGUROS ALLIANZ PORTUGAL, S.A.',
    aliases: ['ALLIANZ', 'ALLIANZ SEGUROS'],
    setor: 'Seguros',
    contaSncPredita: '6261',
    tiposDocumento: ['FC', 'FT'],
  },

  // SERVICOS DIGITAIS
  {
    nif: '980173842',
    nomeOficial: 'GOOGLE IRELAND LIMITED',
    aliases: ['GOOGLE', 'GOOGLE ADS', 'GOOGLE IRELAND'],
    setor: 'Publicidade',
    contaSncPredita: '6227',
    tiposDocumento: ['FC', 'FT'],
  },
  {
    nif: '982648498',
    nomeOficial: 'META PLATFORMS IRELAND LIMITED',
    aliases: ['META', 'FACEBOOK', 'INSTAGRAM', 'FACEBOOK IRELAND'],
    setor: 'Publicidade',
    contaSncPredita: '6227',
    tiposDocumento: ['FC', 'FT'],
  },
  {
    nif: '000000000',
    nomeOficial: 'AMAZON EU S.A R.L.',
    aliases: ['AMAZON', 'AMAZON WEB SERVICES', 'AWS', 'AMAZON EU'],
    setor: 'Servicos Externos',
    contaSncPredita: '6278',
    tiposDocumento: ['FC', 'FT'],
  },
];

/**
 * Procura fornecedor no dicionario por nome ou alias
 */
export function findSupplierByName(nameFragment: string): SupplierEntry | null {
  const normalized = nameFragment.toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '');
  
  for (const supplier of PT_SUPPLIERS_DICTIONARY) {
    // Verifica nome oficial
    if (supplier.nomeOficial.toLowerCase().includes(normalized)) {
      return supplier;
    }
    // Verifica aliases
    for (const alias of supplier.aliases) {
      if (alias.toLowerCase().includes(normalized) || normalized.includes(alias.toLowerCase())) {
        return supplier;
      }
    }
  }
  
  return null;
}

/**
 * Procura fornecedor por NIF
 */
export function findSupplierByNif(nif: string): SupplierEntry | null {
  const cleanNif = nif.replace(/\D/g, '');
  return PT_SUPPLIERS_DICTIONARY.find((s) => s.nif === cleanNif) || null;
}

/**
 * Sugere conta SNC com base no fornecedor identificado
 */
export function suggestAccountFromSupplier(
  supplierName: string
): { accountCode: string; accountName: string; confidence: number } | null {
  const supplier = findSupplierByName(supplierName);
  
  if (!supplier) return null;
  
  const accountNames: Record<string, string> = {
    '6224': 'Agua, luz, gas e comunicacoes',
    '6223': 'Combustiveis e lubrificantes',
    '6111': 'Compras de mercadorias',
    '6251': 'Deslocacoes em servico',
    '6261': 'Premios de seguros',
    '6227': 'Despesas de publicidade',
    '6278': 'Outros servicos externos',
  };
  
  return {
    accountCode: supplier.contaSncPredita,
    accountName: accountNames[supplier.contaSncPredita] || 'Fornecimentos',
    confidence: 0.95,
  };
}
