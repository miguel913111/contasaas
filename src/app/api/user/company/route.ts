/**
 * API Route: Obter empresa do utilizador logado
 * GET /api/user/company
 * 
 * Response: { companyId: string, name: string, nif: string } | { error: string }
 */

import { NextRequest, NextResponse } from 'next/server';
import { getToken } from 'next-auth/jwt';
import { getCurrentCompanyId, getAccessibleCompanies } from '@/lib/auth';

export async function GET(request: NextRequest) {
  try {
    const token = await getToken({ req: request });
    if (!token) {
      return NextResponse.json({ error: 'Nao autenticado' }, { status: 401 });
    }

    const userId = token.id as string;
    const role = token.role as string;

    const companyId = await getCurrentCompanyId(userId, role as any);
    
    if (!companyId) {
      return NextResponse.json(
        { error: 'Nenhuma empresa encontrada', needsOnboarding: true },
        { status: 404 }
      );
    }

    const companies = await getAccessibleCompanies(userId, role as any);
    const currentCompany = companies.find(c => c.id === companyId);

    return NextResponse.json({
      companyId,
      name: currentCompany?.name || '',
      nif: currentCompany?.nif || '',
      companies: role === 'ACCOUNTANT' ? companies : undefined, // Contabilista ve lista completa
    });

  } catch (error) {
    console.error('[API/User/Company] Erro:', error);
    return NextResponse.json(
      { error: 'Erro interno no servidor' },
      { status: 500 }
    );
  }
}
