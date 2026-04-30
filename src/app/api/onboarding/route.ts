/**
 * API Route: Onboarding de ENI (criar empresa)
 * POST /api/onboarding
 * 
 * Body: { name, nif, address?, city?, postalCode?, phone?, email?, activityCode? }
 * Response: { companyId: string }
 * 
 * Seguranca:
 * - Apenas SELF_SERVICE pode criar empresa (primeira vez)
 * - Rate limit: general
 * - Zod validation
 */

import { NextRequest, NextResponse } from 'next/server';
import { getToken } from 'next-auth/jwt';
import { prisma } from '@/lib/prisma';
import { z } from 'zod';
import { applyRateLimit } from '@/lib/rateLimit';
import { logAudit, AuditActions } from '@/lib/auditLog';

const onboardingSchema = z.object({
  name: z.string().min(2, { message: 'Nome da empresa obrigatorio' }).max(200),
  nif: z.string().regex(/^\d{9}$/, { message: 'NIF deve ter 9 digitos' }),
  address: z.string().optional(),
  city: z.string().optional(),
  postalCode: z.string().optional(),
  phone: z.string().optional(),
  email: z.string().email().optional().or(z.literal('')),
  activityCode: z.string().optional(),
});

export async function POST(request: NextRequest) {
  try {
    const rateLimitResponse = await applyRateLimit(request, 'general');
    if (rateLimitResponse) return rateLimitResponse;

    const token = await getToken({ req: request });
    if (!token) {
      return NextResponse.json({ error: 'Nao autenticado' }, { status: 401 });
    }

    if (token.role !== 'SELF_SERVICE') {
      return NextResponse.json(
        { error: 'Apenas ENI podem criar empresa via onboarding' },
        { status: 403 }
      );
    }

    const userId = token.id as string;
    const body = await request.json();

    const result = onboardingSchema.safeParse(body);
    if (!result.success) {
      const issues = result.error.issues.map(i => `${i.path.join('.')}: ${i.message}`).join('; ');
      return NextResponse.json({ error: issues }, { status: 400 });
    }

    const data = result.data;

    // Verifica se NIF ja existe
    const existing = await prisma.company.findUnique({
      where: { nif: data.nif },
      select: { id: true },
    });

    if (existing) {
      return NextResponse.json(
        { error: 'Ja existe uma empresa com este NIF' },
        { status: 409 }
      );
    }

    // Verifica se user ja tem empresa
    const existingCompany = await prisma.company.findFirst({
      where: { ownerId: userId },
      select: { id: true },
    });

    if (existingCompany) {
      return NextResponse.json(
        { error: 'Utilizador ja possui uma empresa', companyId: existingCompany.id },
        { status: 409 }
      );
    }

    // Cria empresa
    const company = await prisma.company.create({
      data: {
        name: data.name,
        nif: data.nif,
        address: data.address || null,
        city: data.city || null,
        postalCode: data.postalCode || null,
        phone: data.phone || null,
        email: data.email || null,
        activityCode: data.activityCode || null,
        ownerId: userId,
      },
    });

    await logAudit({
      action: AuditActions.COMPANY_CREATED,
      entityType: 'Company',
      entityId: company.id,
      userId,
      details: { name: data.name, nif: data.nif },
    });

    return NextResponse.json({
      companyId: company.id,
      message: 'Empresa criada com sucesso',
    }, { status: 201 });

  } catch (error) {
    console.error('[API/Onboarding] Erro:', error);
    return NextResponse.json(
      { error: 'Erro interno no servidor' },
      { status: 500 }
    );
  }
}
