import { describe, it, expect } from 'vitest';
import { validateNif, calculateNifCheckDigit } from '@/modules/ocr_extraction/nifValidator';

describe('NIF Validator', () => {
  it('valida NIF correto (123456789 e valido)', () => {
    const result = validateNif('123456789');
    expect(result.valid).toBe(true);
    expect(result.formatted).toBe('123 456 789');
    expect(result.type).toBe('singular');
  });

  it('rejeita NIF com check digit errado', () => {
    const result = validateNif('123456788');
    expect(result.valid).toBe(false);
  });

  it('valida NIF com 8 digitos (invalido)', () => {
    const result = validateNif('12345678');
    expect(result.valid).toBe(false);
  });

  it('valida NIF com 10 digitos (invalido)', () => {
    const result = validateNif('1234567890');
    expect(result.valid).toBe(false);
  });

  it('valida NIF com letras (invalido)', () => {
    const result = validateNif('12345678A');
    expect(result.valid).toBe(false);
  });

  it('rejeita NIF vazio', () => {
    const result = validateNif('');
    expect(result.valid).toBe(false);
  });

  it('calcula digito de controlo', () => {
    const digit = calculateNifCheckDigit('12345678');
    expect(typeof digit).toBe('number');
    expect(digit).toBeGreaterThanOrEqual(0);
    expect(digit).toBeLessThanOrEqual(9);
  });
});
