/**
 * Email Service
 * Supports SendGrid, Resend, and SMTP fallback
 */
import { createTransport, Transporter } from 'nodemailer';

export type EmailTemplate =
  | 'invoice-approved'
  | 'invoice-rejected'
  | 'payment-received'
  | 'payment-failed'
  | 'onboarding-welcome'
  | 'bank-reconciliation-complete'
  | 'export-ready'
  | 'password-reset'
  | 'weekly-summary';

interface EmailPayload {
  to: string;
  subject: string;
  html: string;
  text?: string;
}

const FROM_EMAIL = process.env.FROM_EMAIL || 'noreply@contasaas.pt';
const FROM_NAME = process.env.FROM_NAME || 'ContaSaaS';

let transporter: Transporter | null = null;

function getTransporter(): Transporter | null {
  if (transporter) return transporter;

  // SendGrid
  if (process.env.SENDGRID_API_KEY) {
    transporter = createTransport({
      host: 'smtp.sendgrid.net',
      port: 587,
      auth: {
        user: 'apikey',
        pass: process.env.SENDGRID_API_KEY,
      },
    });
    return transporter;
  }

  // Resend
  if (process.env.RESEND_API_KEY) {
    transporter = createTransport({
      host: 'smtp.resend.com',
      port: 587,
      auth: {
        user: 'resend',
        pass: process.env.RESEND_API_KEY,
      },
    });
    return transporter;
  }

  // SMTP fallback
  if (process.env.SMTP_HOST) {
    transporter = createTransport({
      host: process.env.SMTP_HOST,
      port: parseInt(process.env.SMTP_PORT || '587', 10),
      secure: process.env.SMTP_SECURE === 'true',
      auth: {
        user: process.env.SMTP_USER,
        pass: process.env.SMTP_PASS,
      },
    });
    return transporter;
  }

  return null;
}

export async function sendEmail(payload: EmailPayload): Promise<{ success: boolean; error?: string }> {
  const transport = getTransporter();
  if (!transport) {
    console.warn('📧 No email provider configured. Email not sent:', payload.subject);
    return { success: false, error: 'No email provider configured' };
  }

  try {
    await transport.sendMail({
      from: `"${FROM_NAME}" <${FROM_EMAIL}>`,
      to: payload.to,
      subject: payload.subject,
      html: payload.html,
      text: payload.text || payload.html.replace(/<[^>]*>/g, ''),
    });
    console.log(`📧 Email sent: ${payload.subject} → ${payload.to}`);
    return { success: true };
  } catch (error) {
    console.error('❌ Email failed:', error);
    return { success: false, error: String(error) };
  }
}

// ── Template Helpers ───────────────────────────────────────────

export function buildInvoiceApprovedEmail(data: {
  userName: string;
  invoiceNumber: string;
  amount: string;
  companyName: string;
}): EmailPayload {
  return {
    to: '', // filled by caller
    subject: `✅ Fatura ${data.invoiceNumber} aprovada`,
    html: `
      <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
        <h2 style="color: #16a34a;">Fatura Aprovada ✅</h2>
        <p>Olá ${data.userName},</p>
        <p>A fatura <strong>${data.invoiceNumber}</strong> da empresa <strong>${data.companyName}</strong> foi aprovada.</p>
        <p><strong>Valor:</strong> ${data.amount}</p>
        <p>Pode consultar todos os detalhes na sua área de cliente.</p>
        <hr style="border: none; border-top: 1px solid #e5e7eb; margin: 24px 0;" />
        <p style="color: #6b7280; font-size: 12px;">ContaSaaS — Gestão Contabilística Automatizada</p>
      </div>
    `,
  };
}

export function buildPaymentReceivedEmail(data: {
  userName: string;
  amount: string;
  plan: string;
  nextBilling: string;
}): EmailPayload {
  return {
    to: '',
    subject: `💳 Pagamento recebido — ${data.plan}`,
    html: `
      <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
        <h2 style="color: #16a34a;">Pagamento Confirmado 💳</h2>
        <p>Olá ${data.userName},</p>
        <p>Recebemos o seu pagamento de <strong>${data.amount}</strong> para o plano <strong>${data.plan}</strong>.</p>
        <p><strong>Próximo pagamento:</strong> ${data.nextBilling}</p>
        <p>Obrigado por usar o ContaSaaS!</p>
        <hr style="border: none; border-top: 1px solid #e5e7eb; margin: 24px 0;" />
        <p style="color: #6b7280; font-size: 12px;">ContaSaaS — Gestão Contabilística Automatizada</p>
      </div>
    `,
  };
}

export function buildPaymentFailedEmail(data: {
  userName: string;
  amount: string;
  plan: string;
  retryUrl: string;
}): EmailPayload {
  return {
    to: '',
    subject: `⚠️ Falha no pagamento — ${data.plan}`,
    html: `
      <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
        <h2 style="color: #dc2626;">Pagamento Falhou ⚠️</h2>
        <p>Olá ${data.userName},</p>
        <p>Não conseguimos processar o pagamento de <strong>${data.amount}</strong> para o plano <strong>${data.plan}</strong>.</p>
        <p>Por favor atualize os seus dados de pagamento para evitar interrupção do serviço.</p>
        <a href="${data.retryUrl}" style="display: inline-block; background: #2563eb; color: white; padding: 12px 24px; text-decoration: none; border-radius: 6px; margin: 16px 0;">Atualizar Pagamento</a>
        <hr style="border: none; border-top: 1px solid #e5e7eb; margin: 24px 0;" />
        <p style="color: #6b7280; font-size: 12px;">ContaSaaS — Gestão Contabilística Automatizada</p>
      </div>
    `,
  };
}

export function buildOnboardingWelcomeEmail(data: {
  userName: string;
  companyName: string;
  portalUrl: string;
}): EmailPayload {
  return {
    to: '',
    subject: '🎉 Bem-vindo ao ContaSaaS!',
    html: `
      <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
        <h2 style="color: #2563eb;">Bem-vindo ao ContaSaaS! 🎉</h2>
        <p>Olá ${data.userName},</p>
        <p>A empresa <strong>${data.companyName}</strong> foi registada com sucesso.</p>
        <p>A partir de agora pode:</p>
        <ul>
          <li>📤 Fazer upload de faturas</li>
          <li>🤖 Usar o assistente AI para perguntas contabilísticas</li>
          <li>📊 Consultar o seu dashboard</li>
        </ul>
        <a href="${data.portalUrl}" style="display: inline-block; background: #2563eb; color: white; padding: 12px 24px; text-decoration: none; border-radius: 6px; margin: 16px 0;">Aceder ao Portal</a>
        <hr style="border: none; border-top: 1px solid #e5e7eb; margin: 24px 0;" />
        <p style="color: #6b7280; font-size: 12px;">ContaSaaS — Gestão Contabilística Automatizada</p>
      </div>
    `,
  };
}

export function buildExportReadyEmail(data: {
  userName: string;
  erpType: string;
  fileName: string;
  downloadUrl: string;
}): EmailPayload {
  return {
    to: '',
    subject: `📁 Exportação ${data.erpType} pronta`,
    html: `
      <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
        <h2 style="color: #2563eb;">Exportação Concluída 📁</h2>
        <p>Olá ${data.userName},</p>
        <p>O ficheiro de exportação para <strong>${data.erpType}</strong> está pronto.</p>
        <p><strong>Ficheiro:</strong> ${data.fileName}</p>
        <a href="${data.downloadUrl}" style="display: inline-block; background: #2563eb; color: white; padding: 12px 24px; text-decoration: none; border-radius: 6px; margin: 16px 0;">Descarregar</a>
        <hr style="border: none; border-top: 1px solid #e5e7eb; margin: 24px 0;" />
        <p style="color: #6b7280; font-size: 12px;">ContaSaaS — Gestão Contabilística Automatizada</p>
      </div>
    `,
  };
}
