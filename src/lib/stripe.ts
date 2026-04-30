/**
 * Stripe Configuration
 * 
 * Planos:
 * - ENI Basico: 5€/mes (1 empresa, 50 faturas)
 * - Contabilista: 10€/mes por cliente gerido
 * 
 * Requer configurar no Stripe Dashboard:
 * 1. Criar products e prices
 * 2. Copiar STRIPE_SECRET_KEY e STRIPE_WEBHOOK_SECRET
 * 3. Configurar webhook endpoint: {APP_URL}/api/stripe/webhook
 */

import Stripe from 'stripe';

export const stripe = new Stripe(process.env.STRIPE_SECRET_KEY || '', {
  typescript: true,
});

export const STRIPE_PRICE_ENI = process.env.STRIPE_PRICE_ENI || '';
export const STRIPE_PRICE_ACCOUNTANT = process.env.STRIPE_PRICE_ACCOUNTANT || '';
