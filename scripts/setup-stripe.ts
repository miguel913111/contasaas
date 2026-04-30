/**
 * Script: Setup Stripe Price IDs
 * 
 * Cria Price IDs (mensais, recorrentes) a partir dos Product IDs existentes.
 * Requer STRIPE_SECRET_KEY configurada no .env
 * 
 * Uso: npx tsx scripts/setup-stripe.ts
 */

import 'dotenv/config'; // Carrega .env antes de tudo
import { stripe } from '../src/lib/stripe';

const PRODUCTS = [
  { name: 'ENI Basico', productId: process.env.STRIPE_PRODUCT_ENI, amount: 500, currency: 'eur' },   // 5.00 EUR
  { name: 'Contabilista', productId: process.env.STRIPE_PRODUCT_ACCOUNTANT, amount: 1000, currency: 'eur' }, // 10.00 EUR
];

async function main() {
  if (!process.env.STRIPE_SECRET_KEY) {
    console.error('❌ STRIPE_SECRET_KEY nao configurada no .env');
    console.log('   Configure em: https://dashboard.stripe.com/apikeys');
    process.exit(1);
  }

  console.log('=== Stripe Price Setup ===\n');

  for (const product of PRODUCTS) {
    if (!product.productId) {
      console.log(`⏭️  ${product.name}: Product ID nao configurado`);
      continue;
    }

    try {
      // Verifica se ja existe um price para este produto
      const existingPrices = await stripe.prices.list({
        product: product.productId,
        active: true,
        type: 'recurring',
      });

      if (existingPrices.data.length > 0) {
        const price = existingPrices.data[0];
        console.log(`✅ ${product.name}: Price ja existe`);
        console.log(`   Price ID: ${price.id}`);
        console.log(`   Valor: ${(price.unit_amount! / 100).toFixed(2)} EUR/mes`);
        console.log(`   ➜ Adicione ao .env: STRIPE_PRICE_${product.name === 'ENI Basico' ? 'ENI' : 'ACCOUNTANT'}="${price.id}"`);
      } else {
        // Cria novo price
        const price = await stripe.prices.create({
          product: product.productId,
          unit_amount: product.amount,
          currency: product.currency,
          recurring: { interval: 'month' },
        });

        console.log(`✅ ${product.name}: Price criado com sucesso`);
        console.log(`   Price ID: ${price.id}`);
        console.log(`   Valor: ${(price.unit_amount! / 100).toFixed(2)} EUR/mes`);
        console.log(`   ➜ Adicione ao .env: STRIPE_PRICE_${product.name === 'ENI Basico' ? 'ENI' : 'ACCOUNTANT'}="${price.id}"`);
      }
      console.log('');
    } catch (error: any) {
      console.error(`❌ ${product.name}: Erro — ${error.message}`);
    }
  }

  console.log('=== Setup concluido ===');
  console.log('\nProximos passos:');
  console.log('1. Copie os Price IDs acima para o .env');
  console.log('2. Configure o webhook em: https://dashboard.stripe.com/webhooks');
  console.log('   Endpoint: {APP_URL}/api/stripe/webhook');
  console.log('   Eventos: checkout.session.completed, invoice.payment_failed, customer.subscription.deleted');
}

main().catch(console.error);
