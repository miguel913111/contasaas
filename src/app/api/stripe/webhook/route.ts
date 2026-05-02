import { NextRequest, NextResponse } from 'next/server';

function getStripe() {
  const Stripe = require('stripe');
  const key = process.env.STRIPE_SECRET_KEY;
  if (!key) throw new Error('STRIPE_SECRET_KEY nao configurada');
  return new Stripe(key, { apiVersion: '2024-12-18.acacia' });
}

const webhookSecret = process.env.STRIPE_WEBHOOK_SECRET;

export async function POST(req: NextRequest) {
  try {
    const stripe = getStripe();
    const payload = await req.text();
    const signature = req.headers.get('stripe-signature') || '';

    if (!webhookSecret) {
      return NextResponse.json({ error: 'Webhook secret nao configurado' }, { status: 500 });
    }

    let event;
    try {
      event = stripe.webhooks.constructEvent(payload, signature, webhookSecret);
    } catch (err: any) {
      return NextResponse.json({ error: 'Webhook invalida' }, { status: 400 });
    }

    if (event.type === 'checkout.session.completed') {
      const session = event.data.object as any;
      const customerId = session.customer as string;
      const userId = session.metadata?.userId;

      if (userId) {
        const { prisma } = await import('@/lib/prisma');
        await prisma.user.update({
          where: { id: userId },
          data: {
            stripeCustomerId: customerId,
          },
        });
      }
    }

    return NextResponse.json({ received: true });
  } catch (error: any) {
    console.error('Stripe webhook error:', error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
