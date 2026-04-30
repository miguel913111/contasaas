/**
 * API Route: Stripe Webhook
 * POST /api/stripe/webhook
 * 
 * Processa eventos do Stripe:
 * - checkout.session.completed → ativa subscricao + envia email
 * - invoice.payment_failed → notifica user por email
 * - customer.subscription.deleted → cancela subscricao
 */

import { NextRequest, NextResponse } from 'next/server';
import { stripe } from '@/lib/stripe';
import { prisma } from '@/lib/prisma';
import { sendEmail, buildPaymentReceivedEmail, buildPaymentFailedEmail } from '@/lib/email';

const webhookSecret = process.env.STRIPE_WEBHOOK_SECRET || '';

export async function POST(request: NextRequest) {
  try {
    const payload = await request.text();
    const signature = request.headers.get('stripe-signature') || '';

    let event;
    try {
      event = stripe.webhooks.constructEvent(payload, signature, webhookSecret);
    } catch (err: any) {
      console.error('[Stripe Webhook] Assinatura invalida:', err.message);
      return NextResponse.json({ error: 'Assinatura invalida' }, { status: 400 });
    }

    console.log(`[Stripe Webhook] Evento recebido: ${event.type}`);

    switch (event.type) {
      case 'checkout.session.completed': {
        const session = event.data.object as any;
        const userId = session.metadata?.userId;
        const plan = session.metadata?.plan;

        console.log('[Stripe] Checkout completado:', session.id, 'User:', userId, 'Plan:', plan);

        if (userId) {
          // Update user subscription
          await prisma.user.update({
            where: { id: userId },
            data: {
              role: plan === 'contabilista' ? 'ACCOUNTANT' : 'SELF_SERVICE',
            },
          });

          // Send welcome email
          const user = await prisma.user.findUnique({
            where: { id: userId },
            select: { email: true, name: true },
          });

          if (user?.email) {
            const email = buildPaymentReceivedEmail({
              userName: user.name || 'Cliente',
              amount: `${(session.amount_total / 100).toFixed(2)} EUR`,
              plan: plan === 'contabilista' ? 'Contabilista' : 'ENI',
              nextBilling: 'Mensal',
            });
            await sendEmail({ ...email, to: user.email });
          }
        }
        break;
      }

      case 'invoice.payment_failed': {
        const invoice = event.data.object as any;
        const customerId = invoice.customer;

        console.log('[Stripe] Pagamento falhou:', invoice.id);

        // Find user by Stripe customer ID
        const user = await prisma.user.findFirst({
          where: { stripeCustomerId: customerId },
          select: { email: true, name: true, id: true },
        });

        if (user?.email) {
          const email = buildPaymentFailedEmail({
            userName: user.name || 'Cliente',
            amount: `${(invoice.amount_due / 100).toFixed(2)} EUR`,
            plan: 'ContaSaaS',
            retryUrl: `${process.env.APP_URL}/billing`,
          });
          await sendEmail({ ...email, to: user.email });
        }
        break;
      }

      case 'customer.subscription.deleted': {
        const subscription = event.data.object as any;
        const customerId = subscription.customer;

        console.log('[Stripe] Subscricao cancelada:', subscription.id);

        await prisma.user.updateMany({
          where: { stripeCustomerId: customerId },
          data: { role: 'SELF_SERVICE' },
        });
        break;
      }
    }

    return NextResponse.json({ received: true });

  } catch (error) {
    console.error('[API/Stripe/Webhook] Erro:', error);
    return NextResponse.json({ error: 'Erro interno' }, { status: 500 });
  }
}
