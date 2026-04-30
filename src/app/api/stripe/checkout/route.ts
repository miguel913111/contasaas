/**
 * API Route: Stripe Checkout Session
 * POST /api/stripe/checkout
 * 
 * Body: { plan: 'eni' | 'accountant' }
 * Response: { url: string } — redireciona para Stripe Checkout
 * 
 * Funciona com:
 * - Price IDs diretos (STRIPE_PRICE_ENI / STRIPE_PRICE_ACCOUNTANT)
 * - Product IDs (STRIPE_PRODUCT_ENI / STRIPE_PRODUCT_ACCOUNTANT) — procura/cria price automaticamente
 */

import { NextRequest, NextResponse } from 'next/server';
import { getToken } from 'next-auth/jwt';
import { stripe, STRIPE_PRICE_ENI, STRIPE_PRICE_ACCOUNTANT } from '@/lib/stripe';
import { applyRateLimit } from '@/lib/rateLimit';

const STRIPE_PRODUCT_ENI = process.env.STRIPE_PRODUCT_ENI || '';
const STRIPE_PRODUCT_ACCOUNTANT = process.env.STRIPE_PRODUCT_ACCOUNTANT || '';

async function getOrCreatePriceId(plan: 'eni' | 'accountant'): Promise<string | null> {
  const existingPriceId = plan === 'eni' ? STRIPE_PRICE_ENI : STRIPE_PRICE_ACCOUNTANT;
  if (existingPriceId) return existingPriceId;

  const productId = plan === 'eni' ? STRIPE_PRODUCT_ENI : STRIPE_PRODUCT_ACCOUNTANT;
  if (!productId) return null;

  try {
    // Procura price existente para o product
    const prices = await stripe.prices.list({
      product: productId,
      active: true,
      type: 'recurring',
      limit: 1,
    });

    if (prices.data.length > 0) {
      return prices.data[0].id;
    }

    // Cria novo price se nao existir
    const amount = plan === 'eni' ? 500 : 1000; // 5.00 EUR ou 10.00 EUR
    const newPrice = await stripe.prices.create({
      product: productId,
      unit_amount: amount,
      currency: 'eur',
      recurring: { interval: 'month' },
    });

    console.log(`[Stripe] Price criado automaticamente: ${newPrice.id} para ${plan}`);
    return newPrice.id;
  } catch (error) {
    console.error(`[Stripe] Erro ao procurar/criar price para ${plan}:`, error);
    return null;
  }
}

export async function POST(request: NextRequest) {
  try {
    const rateLimitResponse = await applyRateLimit(request, 'general');
    if (rateLimitResponse) return rateLimitResponse;

    const token = await getToken({ req: request });
    if (!token) {
      return NextResponse.json({ error: 'Nao autenticado' }, { status: 401 });
    }

    const body = await request.json();
    const { plan } = body;

    if (!plan || !['eni', 'accountant'].includes(plan)) {
      return NextResponse.json({ error: 'Plano invalido' }, { status: 400 });
    }

    const priceId = await getOrCreatePriceId(plan);

    if (!priceId) {
      return NextResponse.json(
        { error: 'Plano nao configurado. Contacte o administrador.' },
        { status: 500 }
      );
    }

    const session = await stripe.checkout.sessions.create({
      customer_email: token.email as string,
      line_items: [
        {
          price: priceId,
          quantity: 1,
        },
      ],
      mode: 'subscription',
      success_url: `${process.env.APP_URL}/selfservice/dashboard?checkout=success`,
      cancel_url: `${process.env.APP_URL}/?checkout=cancel`,
      metadata: {
        userId: token.id as string,
        plan,
      },
    });

    return NextResponse.json({ url: session.url });

  } catch (error) {
    console.error('[API/Stripe/Checkout] Erro:', error);
    return NextResponse.json(
      { error: 'Erro ao criar sessao de checkout' },
      { status: 500 }
    );
  }
}
