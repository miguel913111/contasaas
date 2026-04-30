import { describe, it, expect } from 'vitest';

describe('Email Templates', () => {
  it('buildInvoiceApprovedEmail creates correct payload', async () => {
    const { buildInvoiceApprovedEmail } = await import('@/lib/email');
    const email = buildInvoiceApprovedEmail({
      userName: 'João',
      invoiceNumber: 'FT-2024-001',
      amount: '123.45 EUR',
      companyName: 'Test Lda',
    });

    expect(email.subject).toContain('FT-2024-001');
    expect(email.subject).toContain('aprovada');
    expect(email.html).toContain('João');
    expect(email.html).toContain('Test Lda');
    expect(email.html).toContain('123.45 EUR');
    expect(email.to).toBe('');
  });

  it('buildPaymentReceivedEmail creates correct payload', async () => {
    const { buildPaymentReceivedEmail } = await import('@/lib/email');
    const email = buildPaymentReceivedEmail({
      userName: 'Maria',
      amount: '10.00 EUR',
      plan: 'ENI',
      nextBilling: '2024-02-01',
    });

    expect(email.subject).toContain('Pagamento recebido');
    expect(email.html).toContain('Maria');
    expect(email.html).toContain('ENI');
    expect(email.html).toContain('10.00 EUR');
  });

  it('buildPaymentFailedEmail creates correct payload', async () => {
    const { buildPaymentFailedEmail } = await import('@/lib/email');
    const email = buildPaymentFailedEmail({
      userName: 'Carlos',
      amount: '10.00 EUR',
      plan: 'Contabilista',
      retryUrl: 'http://localhost/billing',
    });

    expect(email.subject).toContain('Falha no pagamento');
    expect(email.html).toContain('Carlos');
    expect(email.html).toContain('Atualizar Pagamento');
  });

  it('buildOnboardingWelcomeEmail creates correct payload', async () => {
    const { buildOnboardingWelcomeEmail } = await import('@/lib/email');
    const email = buildOnboardingWelcomeEmail({
      userName: 'Ana',
      companyName: 'Ana Lda',
      portalUrl: 'http://localhost:3000/selfservice/dashboard',
    });

    expect(email.subject).toContain('Bem-vindo');
    expect(email.html).toContain('Ana');
    expect(email.html).toContain('Ana Lda');
    expect(email.html).toContain('Aceder ao Portal');
  });

  it('buildExportReadyEmail creates correct payload', async () => {
    const { buildExportReadyEmail } = await import('@/lib/email');
    const email = buildExportReadyEmail({
      userName: 'Pedro',
      erpType: 'TOConline',
      fileName: 'export_2024.csv',
      downloadUrl: 'http://localhost:3000/downloads/123',
    });

    expect(email.subject).toContain('TOConline');
    expect(email.html).toContain('Pedro');
    expect(email.html).toContain('export_2024.csv');
  });
});
