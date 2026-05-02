import Stripe from "stripe";

// Lazy initialization - nao crasha durante o build
export function getStripe() {
  const key = process.env.STRIPE_SECRET_KEY;
  if (!key) {
    throw new Error("STRIPE_SECRET_KEY nao configurada");
  }
  return new Stripe(key, { apiVersion: "2024-12-18.acacia" as any });
}

// Exporta tambem as constantes para compatibilidade
export const STRIPE_PRICE_ENI = process.env.STRIPE_PRICE_ENI || "";
export const STRIPE_PRICE_ACCOUNTANT = process.env.STRIPE_PRICE_ACCOUNTANT || "";

// Backward compatible - lazy stripe instance
export const stripe = new Proxy({} as Stripe, {
  get(_target, prop) {
    const s = getStripe();
    return (s as any)[prop];
  },
});
