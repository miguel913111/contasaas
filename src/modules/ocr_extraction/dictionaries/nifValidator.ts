/**
 * Validador de NIF Portugues
 * 
 * Regras:
 * 1. NIF = 9 digitos
 * 2. Primeiro digito depende do tipo de entidade:
 *    1 - Pessoa singular
 *    2 - Pessoa singular (nao residente)
 *    3 - Pessoa coletiva
 *    4 - Pessoa coletiva (nao residente)
 *    5 - Organismo da Administracao Publica
 *    6 - Heranca Indivisa
 *    7 - Pessoa coletiva (isenta de NIPC)
 *    8 - Empresario em Nome Individual (extinto)
 *    9 - Sociedade Irregular ou Defesa
 * 3. Algoritmo de validacao: check digit mod 11
 */

/**
 * Valida se um NIF portugues e sintaticamente correto
 */
export function isValidNif(nif: string): boolean {
  const cleanNif = nif.replace(/\D/g, '');
  
  // Deve ter 9 digitos
  if (cleanNif.length !== 9) return false;
  
  // Primeiro digito deve ser 1-9
  const firstDigit = parseInt(cleanNif[0]);
  if (firstDigit < 1 || firstDigit > 9) return false;
  
  // Algoritmo de validacao do digito de controlo
  return validateCheckDigit(cleanNif);
}

/**
 * Valida o digito de controlo (mod 11)
 */
function validateCheckDigit(nif: string): boolean {
  const weights = [9, 8, 7, 6, 5, 4, 3, 2];
  let sum = 0;
  
  for (let i = 0; i < 8; i++) {
    sum += parseInt(nif[i]) * weights[i];
  }
  
  const remainder = sum % 11;
  let checkDigit: number;
  
  if (remainder === 0 || remainder === 1) {
    checkDigit = 0;
  } else {
    checkDigit = 11 - remainder;
  }
  
  return checkDigit === parseInt(nif[8]);
}

/**
 * Determina o tipo de entidade pelo primeiro digito do NIF
 */
export function getNifType(nif: string): string {
  const cleanNif = nif.replace(/\D/g, '');
  if (cleanNif.length !== 9) return 'INVALIDO';
  
  const firstDigit = cleanNif[0];
  const types: Record<string, string> = {
    '1': 'Pessoa Singular',
    '2': 'Pessoa Singular Nao Residente',
    '3': 'Pessoa Coletiva',
    '4': 'Pessoa Coletiva Nao Residente',
    '5': 'Organismo Administracao Publica',
    '6': 'Heranca Indivisa',
    '7': 'Pessoa Coletiva Isenta NIPC',
    '8': 'Empresario em Nome Individual',
    '9': 'Sociedade Irregular / Defesa',
  };
  
  return types[firstDigit] || 'Desconhecido';
}

/**
 * Normaliza um NIF (remove espacos, letras, prefixos PT)
 */
export function normalizeNif(nif: string): string {
  return nif.replace(/\D/g, '').substring(0, 9);
}

/**
 * Formata NIF para exibicao (XXX XXX XXX)
 */
export function formatNif(nif: string): string {
  const clean = normalizeNif(nif);
  if (clean.length !== 9) return clean;
  return `${clean.slice(0, 3)} ${clean.slice(3, 6)} ${clean.slice(6, 9)}`;
}

/**
 * Valida se NIF de fornecedor corresponde ao nome (heuristica)
 * 
 * Nota: Em producao, isto faria consulta a API da AT
 * ou base de dados de NIFs para validacao em tempo real.
 */
export function validateSupplierNif(
  nif: string,
  supplierName: string
): { valid: boolean; warning?: string } {
  if (!isValidNif(nif)) {
    return { valid: false, warning: 'NIF invalido (digito de controlo incorreto)' };
  }
  
  const nifType = getNifType(nif);
  
  // Heuristica: Fornecedores empresariais geralmente sao pessoas coletivas (3, 5)
  if (nifType === 'Pessoa Singular' && supplierName.toLowerCase().includes('sa')) {
    return {
      valid: true,
      warning: 'Alerta: NIF de pessoa singular mas nome sugere empresa (S.A.)',
    };
  }
  
  return { valid: true };
}
