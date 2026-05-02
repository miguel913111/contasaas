import { NextRequest, NextResponse } from "next/server";
import { getStripe, STRIPE_PRICE_ENI, STRIPE_PRICE_ACCOUNTANT } from "@/lib/stripe";

export async function POST(req: NextRequest) {
  try {
    const stripe = getStripe();
    const body = await req.json();
    const { plan, userId } = body;

    const priceId = plan === "eni" ? STRIPE_PRICE_ENI : STRIPE_PRICE_ACCOUNTANT;
    if (!priceId) {
      return NextResponse.json({ error: "Price ID nao configurado para este plano" }, { status: 500 });
    }

    const session = await stripe.checkout.sessions.create({
      mode: "subscription",
      payment_method_types: ["card"],
      line_items: [{ price: priceId, quantity: 1 }],
      success_url: `${process.env.APP_URL || ""}/?checkout=success`,
      cancel_url: `${process.env.APP_URL || ""}/?checkout=cancelled`,
      metadata: { userId, plan },
    });

    return NextResponse.json({ url: session.url });
  } catch (error: any) {
    console.error("Stripe checkout error:", error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
