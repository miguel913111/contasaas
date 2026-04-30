/**
 * API Route: WhatsApp Webhook
 * 
 * GET: Verificacao do webhook (Meta)
 * POST: Recepcao de mensagens e status updates
 */

import { NextRequest, NextResponse } from 'next/server';
import {
  verifyWebhookToken,
  verifyWebhookSignature,
  processWebhookPayload,
} from '@/modules/whatsapp_bot/webhookHandler';

export async function GET(request: NextRequest) {
  const searchParams = request.nextUrl.searchParams;
  const mode = searchParams.get('hub.mode');
  const token = searchParams.get('hub.verify_token');
  const challenge = searchParams.get('hub.challenge');

  if (!mode || !token || !challenge) {
    return NextResponse.json({ error: 'Parametros invalidos' }, { status: 400 });
  }

  const verifiedChallenge = verifyWebhookToken(mode, token, challenge);

  if (verifiedChallenge) {
    return new NextResponse(verifiedChallenge, { status: 200 });
  }

  return NextResponse.json({ error: 'Verificacao falhou' }, { status: 403 });
}

export async function POST(request: NextRequest) {
  try {
    // Verifica assinatura HMAC
    const signature = request.headers.get('x-hub-signature-256') || '';
    const body = await request.text();

    if (!verifyWebhookSignature(body, signature.replace('sha256=', ''))) {
      return NextResponse.json({ error: 'Assinatura invalida' }, { status: 401 });
    }

    // Processa payload
    const payload = JSON.parse(body);
    await processWebhookPayload(payload);

    return NextResponse.json({ success: true }, { status: 200 });
  } catch (error) {
    console.error('[API/WhatsApp] Erro:', error);
    return NextResponse.json({ success: false }, { status: 200 }); // Sempre 200 para Meta
  }
}
