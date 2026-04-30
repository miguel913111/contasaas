import { getServerSession } from 'next-auth/next';
import { redirect } from 'next/navigation';
import { authOptions, getAccessibleCompanies } from '@/lib/auth';
import { prisma } from '@/lib/prisma';
import { UserRole } from '@/types';
import ExportPageClient from './ExportPageClient';

export default async function ExportPage() {
  const session = await getServerSession(authOptions);
  if (!session?.user || session.user.role !== UserRole.ACCOUNTANT) {
    redirect('/selfservice/dashboard');
  }

  const companies = await getAccessibleCompanies(session.user.id, session.user.role as UserRole);

  // Busca faturas aprovadas de todas as empresas do contabilista
  const invoices = await prisma.invoice.findMany({
    where: {
      company: { accountantId: session.user.id },
      status: 'APPROVED',
    },
    include: { company: true },
    orderBy: { date: 'desc' },
    take: 100,
  });

  const serializedInvoices = invoices.map((inv) => ({
    id: inv.id,
    documentNumber: inv.documentNumber,
    companyName: inv.company.name,
    totalValue: parseFloat(inv.totalValue.toString()),
    date: inv.date.toISOString().split('T')[0],
    companyId: inv.companyId,
  }));

  return (
    <ExportPageClient
      companies={companies}
      invoices={serializedInvoices}
    />
  );
}
