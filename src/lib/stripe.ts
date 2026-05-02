import Stripe from "stripe";

export function getStripe() {
  const key = process.env.STRIPE_SECRET_KEY;
  if (!key) {
    throw new Error("STRIPE_SECRET_KEY nao configurada");
  }
  return new Stripe(key, { apiVersion: "2024-12-18.acacia" as any });
}
