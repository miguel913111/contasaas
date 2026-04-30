/**
 * API Route: Status de processamento OCR
 * GET /api/ocr/{jobId}
 * 
 * Response:
 *   { status: 'waiting'|'active'|'completed'|'failed', result?, error? }
 */

import { NextRequest, NextResponse } from 'next/server';
import { getToken } from 'next-auth/jwt';
import { ocrQueue } from '@/lib/queue';

export async function GET(
  request: NextRequest,
  { params }: { params: { jobId: string } }
) {
  try {
    const token = await getToken({ req: request });
    if (!token) {
      return NextResponse.json({ error: 'Nao autenticado' }, { status: 401 });
    }

    const { jobId } = params;

    const job = await ocrQueue.getJob(jobId);
    if (!job) {
      return NextResponse.json({ error: 'Job nao encontrado' }, { status: 404 });
    }

    const state = await job.getState();
    const progress = job.progress || 0;

    // Se completed, retorna o resultado guardado no returnvalue
    if (state === 'completed') {
      return NextResponse.json({
        status: 'completed',
        result: job.returnvalue,
        progress: 100,
      });
    }

    // Se failed, retorna o erro
    if (state === 'failed') {
      return NextResponse.json({
        status: 'failed',
        error: job.failedReason || 'Erro desconhecido no processamento',
        progress,
      });
    }

    // Em progresso
    return NextResponse.json({
      status: state, // waiting | active
      progress,
    });

  } catch (error) {
    console.error('[API/OCR/Status] Erro:', error);
    return NextResponse.json(
      { error: 'Erro interno no servidor' },
      { status: 500 }
    );
  }
}
