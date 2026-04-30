/**
 * Validador de NIF Portugues
 * Algoritmo: Modulo 11 com pesos [9,8,7,6,5,4,3,2]
 */

export interface NifValidationResult {
  valid: boolean;
  formatted: string;
  type?: 'singular' | 'coletivo' | 'estrangeiro';
  message?: string;
}

export function validateNif(nif: string): NifValidationResult {
  const clean = nif.replace(/\D/g, '');

  if (clean.length !== 9) {
    return { valid: false, formatted: clean, message: 'NIF deve ter 9 digitos' };
  }

  const firstDigit = parseInt(clean[0]);
  const validFirstDigits = [1, 2, 3, 5, 6, 8, 9];
  if (!validFirstDigits.includes(firstDigit)) {
    return { valid: false, formatted: formatNif(clean), message: 'Primeiro digito invalido' };
  }

  const checkDigit = calculateNifCheckDigit(clean.substring(0, 8));
  const valid = checkDigit === parseInt(clean[8]);

  return {
    valid,
    formatted: formatNif(clean),
    type: firstDigit === 1 || firstDigit === 2 || firstDigit === 3 ? 'singular' : 'coletivo',
    message: valid ? undefined : 'Digito de controlo invalido',
  };
}

export function calculateNifCheckDigit(base: string): number {
  const weights = [9, 8, 7, 6, 5, 4, 3, 2];
  let sum = 0;

  for (let i = 0; i < 8; i++) {
    sum += parseInt(base[i]) * weights[i];
  }

  const remainder = sum % 11;
  const checkDigit = remainder === 0 || remainder === 1 ? 0 : 11 - remainder;
  return checkDigit;
}

function formatNif(nif: string): string {
  if (nif.length !== 9) return nif;
  return `${nif.slice(0, 3)} ${nif.slice(3, 6)} ${nif.slice(6, 9)}`;
}
