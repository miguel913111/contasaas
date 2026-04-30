import { describe, it, expect, vi } from 'vitest';
import { sendEmail, buildInvoiceApprovedEmail, buildPaymentReceivedEmail } from '@/lib/email';

// Mock nodemailer
const mockSendMail = vi.fn().mockResolvedValue({ messageId: 'test-123' });
vi.mock('nodemailer', () => ({
  createTransport: vi.fn(() => ({
    sendMail: mockSendMail,
  })),
}));

describe('Email Service', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    process.env.SENDGRID_API_KEY = 'test-key';
  });

  afterEach(() => {
    delete process.env.SENDGRID_API_KEY;
    delete process.env.RESEND_API_KEY;
    delete process.env.SMTP_HOST;
  });

  it('buildInvoiceApprovedEmail creates correct payload', () => {
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
  });

  it('buildPaymentReceivedEmail creates correct payload', () => {
    const email = buildPaymentReceivedEmail({
      userName: 'Maria',
      amount: '10.00 EUR',
      plan: 'ENI',
      nextBilling: '2024-02-01',
    });

    expect(email.subject).toContain('Pagamento recebido');
    expect(email.html).toContain('Maria');
    expect(email.html).toContain('ENI');
  });

  it('sendEmail returns success when transporter works', async () => {
    const result = await sendEmail({
      to: 'test@example.com',
      subject: 'Test',
      html: '<p>Test</p>',
    });

    expect(result.success).toBe(true);
    expect(mockSendMail).toHaveBeenCalledWith(
      expect.objectContaining({
        to: 'test@example.com',
        subject: 'Test',
      })
    );
  });

  it('sendEmail returns false when no provider configured', async () => {
    delete process.env.SENDGRID_API_KEY;
    delete process.env.RESEND_API_KEY;
    delete process.env.SMTP_HOST;

    const result = await sendEmail({
      to: 'test@example.com',
      subject: 'Test',
      html: '<p>Test</p>',
    });

    expect(result.success).toBe(false);
    expect(mockSendMail).not.toHaveBeenCalled();
  });
});
