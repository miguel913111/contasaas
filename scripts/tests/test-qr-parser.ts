/**
 * Testes Unitarios do Parser QR Code Portugues
 * 
 * Baseado nos exemplos oficiais da AT (Portaria 195/2020):
 * - Exemplo 1: Fatura completa com IVA em PT, PT-AC, PT-MA
 * - Exemplo 2: Fatura simplificada
 * - Exemplo 3: Fatura pro-forma
 * - Exemplo 4: Documento de transporte
 * 
 * Executar: npx tsx scripts/tests/test-qr-parser.ts
 */

import {
  parsePortugueseQr,
  convertQrToInvoiceData,
  validateQrIntegrity,
  isPortugueseInvoiceQr,
} from '../../src/modules/ocr_extraction/portugueseQrParser';

// ============================================================
// EXEMPLOS OFICIAIS DA AT
// ============================================================

const EXEMPLO_FATURA_COMPLETA = 'A:123456789*B:999999990*C:PT*D:FT*E:N*F:20191231*G:FT AB2019/0035*H:CSDF7T5H-0035*I1:PT*I2:12000.00*I3:15000.00*I4:900.00*I5:50000.00*I6:6500.00*I7:80000.00*I8:18400.00*J1:PT-AC*J2:10000.00*J3:25000.56*J4:1000.02*J5:75000.00*J6:6750.00*J7:100000.00*J8:18000.00*K1:PT-MA*K2:5000.00*K3:12500.00*K4:625.00*K5:25000.00*K6:3000.00*K7:40000.00*K8:8800.00*L:100.00*M:25.00*N:64000.02*O:513600.58*P:100.00*Q:kLp0*R:9999*S:TB;PT00000000000000000000000;513500.58';

const EXEMPLO_FATURA_SIMPLIFICADA = 'A:123456789*B:999999990*C:PT*D:FS*E:N*F:20190812*G:FS CDVF/12345*H:CDF7T5HD-2345*I1:PT*I7:1250.00*N:287.50*O:1537.50*Q:0F99*R:9999*S:NU:0.80';

const EXEMPLO_FATURA_PROFORMA = 'A:500000000*B:123456789*C:PT*D:PF*E:N*F:20190123*G:PF G2019CB/145789*H:HB6FT7RV-145789*I1:PT*I2:12345.34*I3:12532.65*I4:751.96*I5:52789.00*I6:6862.57*I7:32425.69*I8:7457.91*N:15072.44*O:125165.12*Q:r/fY*R:9999';

const EXEMPLO_DOCUMENTO_TRANSPORTE = 'A:500000000*B:123456789*C:PT*D:GT*E:N*F:20190720*G:GT 2019/00001*H:ABC12345-00001*I1:PT*I7:1000.00*N:230.00*O:1230.00*Q:xyz1*R:9999';

// ============================================================
// UTILITARIOS DE TESTE
// ============================================================

let passed = 0;
let failed = 0;

function test(name: string, fn: () => void) {
  try {
    fn();
    console.log(`  ✅ ${name}`);
    passed++;
  } catch (error) {
    console.error(`  ❌ ${name}`);
    console.error(`     ${error}`);
    failed++;
  }
}

function assertEqual(actual: any, expected: any, msg?: string) {
  if (actual !== expected) {
    throw new Error(`${msg || 'Assertion failed'}: expected ${expected}, got ${actual}`);
  }
}

function assertClose(actual: number, expected: number, tolerance: number = 0.01, msg?: string) {
  if (Math.abs(actual - expected) > tolerance) {
    throw new Error(`${msg || 'Assertion failed'}: expected ~${expected}, got ${actual}`);
  }
}

function assertTrue(value: boolean, msg?: string) {
  if (!value) {
    throw new Error(msg || 'Expected true, got false');
  }
}

// ============================================================
// TESTES
// ============================================================

console.log('=============================================');
console.log('TESTES: Parser QR Code Portugues (AT)');
console.log('=============================================');
console.log();

// --- Teste 1: Fatura Completa ---
console.log('Teste 1: Fatura Completa (PT + PT-AC + PT-MA)');
const faturaCompleta = parsePortugueseQr(EXEMPLO_FATURA_COMPLETA);

test('Deve parsear com sucesso', () => {
  assertTrue(faturaCompleta !== null, 'Fatura completa nao parseada');
});

test('NIF emitente correto', () => {
  assertEqual(faturaCompleta!.nifEmitente, '123456789');
});

test('NIF adquirente (consumidor final)', () => {
  assertEqual(faturaCompleta!.nifAdquirente, '999999990');
});

test('Tipo de documento FT', () => {
  assertEqual(faturaCompleta!.tipoDocumento, 'FT');
});

test('Estado Normal (N)', () => {
  assertEqual(faturaCompleta!.estadoDocumento, 'N');
});

test('Data correta (2019-12-31)', () => {
  assertEqual(faturaCompleta!.data, '2019-12-31');
});

test('Numero da fatura', () => {
  assertEqual(faturaCompleta!.numeroDocumento, 'FT AB2019/0035');
});

test('ATCUD correto', () => {
  assertEqual(faturaCompleta!.atcud, 'CSDF7T5H-0035');
});

test('Base isenta PT (I2)', () => {
  assertClose(faturaCompleta!.baseIsenta!, 12000.00);
});

test('Base reduzida PT (I3)', () => {
  assertClose(faturaCompleta!.baseReduzida!, 15000.00);
});

test('IVA reduzido PT (I4)', () => {
  assertClose(faturaCompleta!.ivaReduzido!, 900.00);
});

test('Base intermedia PT (I5)', () => {
  assertClose(faturaCompleta!.baseIntermedia!, 50000.00);
});

test('IVA intermedio PT (I6)', () => {
  assertClose(faturaCompleta!.ivaIntermedio!, 6500.00);
});

test('Base normal PT (I7)', () => {
  assertClose(faturaCompleta!.baseNormal!, 80000.00);
});

test('IVA normal PT (I8)', () => {
  assertClose(faturaCompleta!.ivaNormal!, 18400.00);
});

test('Total impostos (N)', () => {
  assertClose(faturaCompleta!.totalImpostos, 64000.02);
});

test('Total documento (O)', () => {
  assertClose(faturaCompleta!.totalDocumento, 513600.58);
});

test('Hash QR (Q)', () => {
  assertEqual(faturaCompleta!.hashQr, 'kLp0');
});

test('Certificado (R)', () => {
  assertEqual(faturaCompleta!.numeroCertificado, '9999');
});

test('Outras info (S) - IBAN', () => {
  assertTrue(faturaCompleta!.outrasInfo!.includes('TB;'));
});

// --- Teste 2: Fatura Simplificada ---
console.log();
console.log('Teste 2: Fatura Simplificada');
const faturaSimplificada = parsePortugueseQr(EXEMPLO_FATURA_SIMPLIFICADA);

test('Deve parsear com sucesso', () => {
  assertTrue(faturaSimplificada !== null);
});

test('Tipo FS (Fatura Simplificada)', () => {
  assertEqual(faturaSimplificada!.tipoDocumento, 'FS');
});

test('Base normal apenas (I7)', () => {
  assertClose(faturaSimplificada!.baseNormal!, 1250.00);
});

test('Total IVA (N)', () => {
  assertClose(faturaSimplificada!.totalImpostos, 287.50);
});

test('Total documento (O)', () => {
  assertClose(faturaSimplificada!.totalDocumento, 1537.50);
});

test('Sem bases isenta/reduzida/intermedia', () => {
  assertEqual(faturaSimplificada!.baseIsenta, undefined);
  assertEqual(faturaSimplificada!.baseReduzida, undefined);
  assertEqual(faturaSimplificada!.baseIntermedia, undefined);
});

// --- Teste 3: Fatura Pro-forma ---
console.log();
console.log('Teste 3: Fatura Pro-forma');
const faturaProforma = parsePortugueseQr(EXEMPLO_FATURA_PROFORMA);

test('Deve parsear com sucesso', () => {
  assertTrue(faturaProforma !== null);
});

test('Tipo PF (Pro-forma)', () => {
  assertEqual(faturaProforma!.tipoDocumento, 'PF');
});

test('NIF adquirente diferente', () => {
  assertEqual(faturaProforma!.nifAdquirente, '123456789');
});

test('Todas as taxas presentes', () => {
  assertTrue(faturaProforma!.baseIsenta !== undefined);
  assertTrue(faturaProforma!.baseReduzida !== undefined);
  assertTrue(faturaProforma!.baseIntermedia !== undefined);
  assertTrue(faturaProforma!.baseNormal !== undefined);
});

// --- Teste 4: Documento de Transporte ---
console.log();
console.log('Teste 4: Documento de Transporte');
const docTransporte = parsePortugueseQr(EXEMPLO_DOCUMENTO_TRANSPORTE);

test('Deve parsear com sucesso', () => {
  assertTrue(docTransporte !== null);
});

test('Tipo GT (Guia de Transporte)', () => {
  assertEqual(docTransporte!.tipoDocumento, 'GT');
});

// --- Teste 5: Conversao para InvoiceExtractedData ---
console.log();
console.log('Teste 5: Conversao para formato interno');
const invoiceData = convertQrToInvoiceData(faturaCompleta!);

test('Fornecedor = NIF emitente', () => {
  assertEqual(invoiceData.supplier_nif, '123456789');
});

test('Numero do documento', () => {
  assertEqual(invoiceData.document_number, 'FT AB2019/0035');
});

test('Data ISO', () => {
  assertEqual(invoiceData.date, '2019-12-31');
});

test('Total correto', () => {
  assertClose(invoiceData.total_value, 513600.58);
});

test('Linhas de IVA geradas', () => {
  assertTrue(invoiceData.lines.length >= 1);
});

test('Linha isenta tem vat_rate 0', () => {
  const isenta = invoiceData.lines.find(l => l.vat_rate === 0);
  assertTrue(isenta !== undefined);
});

test('Linha reduzida tem vat_rate 6', () => {
  const reduzida = invoiceData.lines.find(l => l.vat_rate === 6);
  assertTrue(reduzida !== undefined);
});

test('Linha intermedia tem vat_rate 13', () => {
  const intermedia = invoiceData.lines.find(l => l.vat_rate === 13);
  assertTrue(intermedia !== undefined);
});

test('Linha normal tem vat_rate 23', () => {
  const normal = invoiceData.lines.find(l => l.vat_rate === 23);
  assertTrue(normal !== undefined);
});

// --- Teste 6: Validacao de Integridade ---
console.log();
console.log('Teste 6: Validacao de Integridade');
const validation = validateQrIntegrity(faturaCompleta!);

test('Fatura completa valida', () => {
  assertTrue(validation.valid, `Warnings: ${validation.warnings.join(', ')}`);
});

test('Fatura simplificada valida', () => {
  const v = validateQrIntegrity(faturaSimplificada!);
  assertTrue(v.valid, `Warnings: ${v.warnings.join(', ')}`);
});

// --- Teste 7: Detecao de QR Portugues ---
console.log();
console.log('Teste 7: Detecao de QR Portugues');

test('Detecta QR portugues valido', () => {
  assertTrue(isPortugueseInvoiceQr(EXEMPLO_FATURA_COMPLETA));
});

test('Rejeita string aleatoria', () => {
  assertTrue(!isPortugueseInvoiceQr('https://google.com'));
});

test('Rejeita QR nao-portugues', () => {
  assertTrue(!isPortugueseInvoiceQr('A:123*C:FR'));
});

// --- Teste 8: Fatura simplificada com uma so taxa ---
console.log();
console.log('Teste 8: Fatura simplificada -> InvoiceData');
const simpleInvoice = convertQrToInvoiceData(faturaSimplificada!);

test('Uma unica linha de 23%', () => {
  assertEqual(simpleInvoice.lines.length, 1);
  assertEqual(simpleInvoice.lines[0].vat_rate, 23);
});

test('Valores corretos na linha', () => {
  assertClose(simpleInvoice.lines[0].taxable_amount, 1250.00);
  assertClose(simpleInvoice.lines[0].vat_amount, 287.50);
});

// --- Teste 9: Casos de erro ---
console.log();
console.log('Teste 9: Casos de Erro');

test('String vazia retorna null', () => {
  assertEqual(parsePortugueseQr(''), null);
});

test('String sem A: retorna null', () => {
  assertEqual(parsePortugueseQr('B:123*C:PT'), null);
});

test('Data invalida retorna null', () => {
  const badQr = parsePortugueseQr('A:123456789*B:999999990*C:PT*D:FT*E:N*F:20199999*G:FT 1*H:X-1*I1:PT*N:10.00*O:110.00*Q:abcd*R:9999');
  assertEqual(badQr, null);
});

test('NIF invalido -> aviso na validacao', () => {
  const badQr = parsePortugueseQr('A:12345*B:999999990*C:PT*D:FT*E:N*F:20190101*G:FT 1*H:X-1*I1:PT*N:10.00*O:110.00*Q:abcd*R:9999');
  assertTrue(badQr !== null, 'Deve parsear mesmo com NIF curto');
  const v = validateQrIntegrity(badQr!);
  assertTrue(!v.valid && v.warnings.length > 0, 'Deve ter warnings de NIF invalido');
});

// ============================================================
// RESUMO
// ============================================================

console.log();
console.log('=============================================');
console.log('RESUMO');
console.log('=============================================');
console.log(`✅ Passaram: ${passed}`);
console.log(`❌ Falharam: ${failed}`);
console.log();

if (failed > 0) {
  console.log('⚠️  ALGUNS TESTES FALHARAM!');
  process.exit(1);
} else {
  console.log('🎉 TODOS OS TESTES PASSARAM!');
  console.log();
  console.log('Estatisticas dos exemplos AT:');
  console.log(`  - Fatura completa (3 espacos fiscais): ${EXEMPLO_FATURA_COMPLETA.length} caracteres`);
  console.log(`  - Fatura simplificada: ${EXEMPLO_FATURA_SIMPLIFICADA.length} caracteres`);
  console.log(`  - Fatura pro-forma: ${EXEMPLO_FATURA_PROFORMA.length} caracteres`);
  console.log(`  - Documento transporte: ${EXEMPLO_DOCUMENTO_TRANSPORTE.length} caracteres`);
  process.exit(0);
}
