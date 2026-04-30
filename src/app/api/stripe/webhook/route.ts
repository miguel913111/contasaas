/**
 * API Route: Stripe Webhook
 * POST /api/stripe/webhook
 * 
 * Processa eventos do Stripe:
 * - checkout.session.completed → ativa subscricao
 * - invoice.payment_failed → notifica user
 * - customer.subscription.deleted → cancela subscricao
 */

import { NextRequest, NextResponse } from 'next/server';
import { stripe } from '@/lib/stripe';

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
        console.log('[Stripe] Checkout completado:', session.id, 'User:', session.metadata?.userId);
        // TODO: Atualizar DB com subscription info
        break;
      }

      case 'invoice.payment_failed': {
        const invoice = event.data.object as any;
        console.log('[Stripe] Pagamento falhou:', invoice.id);
        // TODO: Notificar user
        break;
      }

      case 'customer.subscription.deleted': {
        const subscription = event.data.object as any;
        console.log('[Stripe] Subscricao cancelada:', subscription.id);
        // TODO: Downgrade user para plano free
        break;
      }
    }

    return NextResponse.json({ received: true });

  } catch (error) {
    console.error('[API/Stripe/Webhook] Erro:', error);
    return NextResponse.json({ error: 'Erro interno' }, { status: 500 });
  }
}
