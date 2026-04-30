import { NextRequest, NextResponse } from 'next/server';
import { getToken } from 'next-auth/jwt';
import { prisma } from '@/lib/prisma';
import { getOrSet, invalidateDashboard } from '@/lib/cache';
import { UserRole } from '@/types';

export async function GET(req: NextRequest) {
  const token = await getToken({ req });
  if (!token?.sub) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const userId = token.sub;
  const role = token.role as UserRole;
  const { searchParams } = new URL(req.url);
  const companyId = searchParams.get('companyId');

  try {
    if (role === UserRole.ACCOUNTANT) {
      const cacheKey = `dashboard:kpi:accountant:${userId}`;
      const data = await getOrSet(
        cacheKey,
        async () => {
          const [totalClients, totalInvoices, pendingInvoices, pendingBank] =
            await Promise.all([
              prisma.company.count({ where: { accountantId: userId } }),
              prisma.invoice.count({
                where: { company: { accountantId: userId } },
              }),
              prisma.invoice.count({
                where: {
                  company: { accountantId: userId },
                  status: 'PENDING',
                },
              }),
              prisma.bankTransaction.count({
                where: {
                  company: { accountantId: userId },
                  isReconciled: false,
                },
              }),
            ]);

          const recentInvoices = await prisma.invoice.findMany({
            where: { company: { accountantId: userId } },
            orderBy: { createdAt: 'desc' },
            take: 5,
            include: { company: { select: { name: true } } },
          });

          return {
            totalClients,
            totalInvoices,
            pendingInvoices,
            pendingBankReconciliation: pendingBank,
            recentInvoices: recentInvoices.map((inv) => ({
              id: inv.id,
              documentNumber: inv.documentNumber,
              supplierName: inv.supplierName,
              totalValue: inv.totalValue,
              status: inv.status,
              companyName: inv.company.name,
              createdAt: inv.createdAt,
            })),
          };
        },
        60 // 1 minute cache for dashboard
      );

      return NextResponse.json(data);
    }

    // Self-service user
    const company = companyId
      ? await prisma.company.findFirst({
          where: { id: companyId, ownerId: userId },
        })
      : await prisma.company.findFirst({ where: { ownerId: userId } });

    if (!company) {
      return NextResponse.json({ error: 'No company found' }, { status: 404 });
    }

    const cacheKey = `dashboard:kpi:selfservice:${company.id}`;
    const data = await getOrSet(
      cacheKey,
      async () => {
        const [totalInvoices, totalValue, pendingInvoices] = await Promise.all([
          prisma.invoice.count({ where: { companyId: company.id } }),
          prisma.invoice.aggregate({
            where: { companyId: company.id },
            _sum: { totalValue: true },
          }),
          prisma.invoice.count({
            where: { companyId: company.id, status: 'PENDING' },
          }),
        ]);

        const recentInvoices = await prisma.invoice.findMany({
          where: { companyId: company.id },
          orderBy: { createdAt: 'desc' },
          take: 5,
        });

        return {
          company: {
            id: company.id,
            name: company.name,
            nif: company.nif,
          },
          totalInvoices,
          totalValue: parseFloat(totalValue._sum.totalValue?.toString() || '0'),
          pendingInvoices,
          vatEstimate:
            parseFloat(totalValue._sum.totalValue?.toString() || '0') * 0.23,
          recentInvoices: recentInvoices.map((inv) => ({
            id: inv.id,
            documentNumber: inv.documentNumber,
            supplierName: inv.supplierName,
            totalValue: inv.totalValue,
            status: inv.status,
            createdAt: inv.createdAt,
          })),
        };
      },
      60
    );

    return NextResponse.json(data);
  } catch (error) {
    console.error('[API/Dashboard] Error:', error);
    return NextResponse.json({ error: 'Internal error' }, { status: 500 });
  }
}

// Invalidate dashboard cache on mutations
export async function POST(req: NextRequest) {
  const token = await getToken({ req });
  if (!token?.sub) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const { companyId } = await req.json();
  await invalidateDashboard(companyId || undefined);

  return NextResponse.json({ success: true });
}
