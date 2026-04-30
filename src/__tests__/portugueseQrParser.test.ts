import { describe, it, expect } from 'vitest';
import {
  parsePortugueseQr,
  convertQrToInvoiceData,
  validateQrIntegrity,
  isPortugueseInvoiceQr,
} from '@/modules/ocr_extraction/portugueseQrParser';

// Exemplos oficiais da AT (Portaria 195/2020)
const EXEMPLO_FATURA_COMPLETA = 'A:123456789*B:999999990*C:PT*D:FT*E:N*F:20191231*G:FT AB2019/0035*H:CSDF7T5H-0035*I1:PT*I2:12000.00*I3:15000.00*I4:900.00*I5:50000.00*I6:6500.00*I7:80000.00*I8:18400.00*J1:PT-AC*J2:10000.00*J3:25000.56*J4:1000.02*J5:75000.00*J6:6750.00*J7:100000.00*J8:18000.00*K1:PT-MA*K2:5000.00*K3:12500.00*K4:625.00*K5:25000.00*K6:3000.00*K7:40000.00*K8:8800.00*L:100.00*M:25.00*N:64000.02*O:513600.58*P:100.00*Q:kLp0*R:9999*S:TB;PT00000000000000000000000;513500.58';

const EXEMPLO_FATURA_SIMPLIFICADA = 'A:123456789*B:999999990*C:PT*D:FS*E:N*F:20190812*G:FS CDVF/12345*H:CDF7T5HD-2345*I1:PT*I7:1250.00*N:287.50*O:1537.50*Q:0F99*R:9999*S:NU:0.80';

const EXEMPLO_FATURA_PROFORMA = 'A:500000000*B:123456789*C:PT*D:PF*E:N*F:20190123*G:PF G2019CB/145789*H:HB6FT7RV-145789*I1:PT*I2:12345.34*I3:12532.65*I4:751.96*I5:52789.00*I6:6862.57*I7:32425.69*I8:7457.91*N:15072.44*O:125165.12*Q:r/fY*R:9999';

const EXEMPLO_DOCUMENTO_TRANSPORTE = 'A:500000000*B:123456789*C:PT*D:GT*E:N*F:20190720*G:GT 2019/00001*H:ABC12345-00001*I1:PT*I7:1000.00*N:230.00*O:1230.00*Q:xyz1*R:9999';

describe('parsePortugueseQr — Exemplos AT', () => {
  it('parseia fatura completa (3 espacos fiscais)', () => {
    const data = parsePortugueseQr(EXEMPLO_FATURA_COMPLETA);
    expect(data).not.toBeNull();
    expect(data!.nifEmitente).toBe('123456789');
    expect(data!.tipoDocumento).toBe('FT');
    expect(data!.data).toBe('2019-12-31');
    expect(data!.baseNormal).toBe(80000.00);
    expect(data!.ivaNormal).toBe(18400.00);
    expect(data!.hashQr).toBe('kLp0');
  });

  it('parseia fatura simplificada', () => {
    const data = parsePortugueseQr(EXEMPLO_FATURA_SIMPLIFICADA);
    expect(data).not.toBeNull();
    expect(data!.tipoDocumento).toBe('FS');
    expect(data!.baseNormal).toBe(1250.00);
    expect(data!.totalDocumento).toBe(1537.50);
  });

  it('parseia fatura pro-forma', () => {
    const data = parsePortugueseQr(EXEMPLO_FATURA_PROFORMA);
    expect(data).not.toBeNull();
    expect(data!.tipoDocumento).toBe('PF');
    expect(data!.nifAdquirente).toBe('123456789');
  });

  it('parseia guia de transporte', () => {
    const data = parsePortugueseQr(EXEMPLO_DOCUMENTO_TRANSPORTE);
    expect(data).not.toBeNull();
    expect(data!.tipoDocumento).toBe('GT');
  });

  it('retorna null para string vazia', () => {
    expect(parsePortugueseQr('')).toBeNull();
  });

  it('retorna null para string invalida', () => {
    expect(parsePortugueseQr('B:123*C:PT')).toBeNull();
  });

  it('retorna null para data invalida', () => {
    const qr = 'A:123456789*B:999999990*C:PT*D:FT*E:N*F:20199999*G:FT 1*H:X-1*I1:PT*N:10.00*O:110.00*Q:abcd*R:9999';
    expect(parsePortugueseQr(qr)).toBeNull();
  });
});

describe('validateQrIntegrity', () => {
  it('valida fatura completa sem warnings', () => {
    const data = parsePortugueseQr(EXEMPLO_FATURA_COMPLETA)!;
    const result = validateQrIntegrity(data);
    expect(result.valid).toBe(true);
    expect(result.warnings).toHaveLength(0);
  });

  it('valida fatura simplificada sem warnings', () => {
    const data = parsePortugueseQr(EXEMPLO_FATURA_SIMPLIFICADA)!;
    const result = validateQrIntegrity(data);
    expect(result.valid).toBe(true);
    expect(result.warnings).toHaveLength(0);
  });

  it('detecta NIF invalido', () => {
    const data = parsePortugueseQr('A:12345*B:999999990*C:PT*D:FT*E:N*F:20190101*G:FT 1*H:X-1*I1:PT*N:10.00*O:110.00*Q:abcd*R:9999')!;
    const result = validateQrIntegrity(data);
    expect(result.valid).toBe(false);
    expect(result.warnings.some(w => w.includes('NIF'))).toBe(true);
  });
});

describe('convertQrToInvoiceData', () => {
  it('converte fatura completa com 4 taxas', () => {
    const data = parsePortugueseQr(EXEMPLO_FATURA_COMPLETA)!;
    const invoice = convertQrToInvoiceData(data);
    expect(invoice.supplier_nif).toBe('123456789');
    expect(invoice.total_value).toBe(513600.58);
    expect(invoice.lines.length).toBeGreaterThanOrEqual(1);
    
    const rates = invoice.lines.map(l => l.vat_rate);
    expect(rates).toContain(0);
    expect(rates).toContain(6);
    expect(rates).toContain(13);
    expect(rates).toContain(23);
  });

  it('converte fatura simplificada com uma taxa', () => {
    const data = parsePortugueseQr(EXEMPLO_FATURA_SIMPLIFICADA)!;
    const invoice = convertQrToInvoiceData(data);
    expect(invoice.lines.length).toBe(1);
    expect(invoice.lines[0].vat_rate).toBe(23);
  });
});

describe('isPortugueseInvoiceQr', () => {
  it('detecta QR portugues valido', () => {
    expect(isPortugueseInvoiceQr(EXEMPLO_FATURA_COMPLETA)).toBe(true);
  });

  it('rejeita string aleatoria', () => {
    expect(isPortugueseInvoiceQr('https://google.com')).toBe(false);
  });

  it('rejeita QR nao-portugues', () => {
    expect(isPortugueseInvoiceQr('A:123*C:FR')).toBe(false);
  });
});
