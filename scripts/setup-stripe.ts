import 'dotenv/config';
import { getStripe } from '../src/lib/stripe';

const PRODUCTS = [
  { name: 'ENI Basico', productId: process.env.STRIPE_PRODUCT_ENI, amount: 500, currency: 'eur' },
  { name: 'Contabilista', productId: process.env.STRIPE_PRODUCT_ACCOUNTANT, amount: 1000, currency: 'eur' },
];

async function setupStripe() {
  try {
    const stripe = getStripe();
    console.log('Conectado ao Stripe!');

    for (const product of PRODUCTS) {
      if (!product.productId) {
        console.log(`Pulando ${product.name}: productId nao configurado`);
        continue;
      }

      const existingPrices = await stripe.prices.list({ product: product.productId, limit: 1 });
      if (existingPrices.data.length > 0) {
        console.log(`${product.name}: Price ja existe -> ${existingPrices.data[0].id}`);
      } else {
        const price = await stripe.prices.create({
          unit_amount: product.amount,
          currency: product.currency,
          recurring: { interval: 'month' },
          product: product.productId,
        });
        console.log(`${product.name}: Price criado -> ${price.id}`);
      }
    }
  } catch (error: any) {
    console.error('Erro:', error.message);
    process.exit(1);
  }
}

setupStripe();
