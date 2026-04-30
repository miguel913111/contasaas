import { getServerSession } from 'next-auth/next';
import { redirect } from 'next/navigation';
import { authOptions } from '@/lib/auth';
import { prisma } from '@/lib/prisma';
import { UserRole } from '@/types';

export default async function AccountantDashboard() {
  const session = await getServerSession(authOptions);

  if (!session?.user || session.user.role !== UserRole.ACCOUNTANT) {
    redirect('/selfservice/dashboard');
  }

  const userId = session.user.id;

  // Estatisticas
  const totalClients = await prisma.company.count({
    where: { accountantId: userId },
  });

  const totalInvoices = await prisma.invoice.count({
    where: { company: { accountantId: userId } },
  });

  const pendingInvoices = await prisma.invoice.count({
    where: {
      company: { accountantId: userId },
      status: 'PENDING',
    },
  });

  const pendingBankReconciliation = await prisma.bankTransaction.count({
    where: {
      company: { accountantId: userId },
      isReconciled: false,
    },
  });

  const recentInvoices = await prisma.invoice.findMany({
    where: { company: { accountantId: userId } },
    orderBy: { createdAt: 'desc' },
    take: 5,
    include: { company: true },
  });

  return (
    <div className="space-y-6">
      <h2 className="text-2xl font-bold text-gray-900">Dashboard do Contabilista</h2>

      {/* KPI Cards */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
        <KpiCard title="Clientes Ativos" value={totalClients} color="blue" />
        <KpiCard title="Faturas Totais" value={totalInvoices} color="green" />
        <KpiCard title="Pendentes Revisao" value={pendingInvoices} color="yellow" />
        <KpiCard title="Banco por Conciliar" value={pendingBankReconciliation} color="red" />
      </div>

      {/* Faturas Recentes */}
      <div className="bg-white rounded-lg shadow border border-gray-200">
        <div className="px-6 py-4 border-b border-gray-200">
          <h3 className="text-lg font-semibold text-gray-900">Faturas Recentes</h3>
        </div>
        <div className="divide-y divide-gray-200">
          {recentInvoices.map((inv: any) => (
            <div key={inv.id} className="px-6 py-4 flex justify-between items-center">
              <div>
                <p className="text-sm font-medium text-gray-900">
                  {inv.supplierName || 'Fornecedor Desconhecido'}
                </p>
                <p className="text-xs text-gray-500">
                  {inv.documentNumber} | {inv.company.name}
                </p>
              </div>
              <div className="text-right">
                <p className="text-sm font-bold text-gray-900">
                  {parseFloat(inv.totalValue.toString()).toFixed(2)} EUR
                </p>
                <span
                  className={`inline-flex items-center px-2 py-0.5 rounded text-xs font-medium ${
                    inv.status === 'PENDING'
                      ? 'bg-yellow-100 text-yellow-800'
                      : inv.status === 'APPROVED'
                      ? 'bg-green-100 text-green-800'
                      : 'bg-gray-100 text-gray-800'
                  }`}
                >
                  {inv.status}
                </span>
              </div>
            </div>
          ))}
          {recentInvoices.length === 0 && (
            <div className="px-6 py-8 text-center text-gray-500">
              Nenhuma fatura encontrada
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

function KpiCard({ title, value, color }: { title: string; value: number; color: string }) {
  const colors: Record<string, string> = {
    blue: 'bg-blue-50 border-blue-200',
    green: 'bg-green-50 border-green-200',
    yellow: 'bg-yellow-50 border-yellow-200',
    red: 'bg-red-50 border-red-200',
  };

  return (
    <div className={`rounded-lg border p-4 ${colors[color] || colors.blue}`}>
      <p className="text-sm font-medium text-gray-600">{title}</p>
      <p className="text-2xl font-bold text-gray-900 mt-1">{value}</p>
    </div>
  );
}
