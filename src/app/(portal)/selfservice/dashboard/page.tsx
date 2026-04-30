import { getServerSession } from 'next-auth/next';
import { redirect } from 'next/navigation';
import { authOptions } from '@/lib/auth';
import { prisma } from '@/lib/prisma';
import { UserRole } from '@/types';

export default async function SelfServiceDashboard() {
  const session = await getServerSession(authOptions);

  if (!session?.user) {
    redirect('/auth/signin');
  }

  if (session.user.role === UserRole.ACCOUNTANT) {
    redirect('/accountant/dashboard');
  }

  const userId = session.user.id;

  // Busca empresa do ENI
  const company = await prisma.company.findFirst({
    where: { ownerId: userId },
  });

  if (!company) {
    return (
      <div className="space-y-6">
        <h2 className="text-2xl font-bold text-gray-900">A Minha Empresa</h2>
        <div className="bg-white rounded-lg shadow border border-gray-200 p-8 text-center">
          <p className="text-gray-600 mb-4">Ainda nao tem uma empresa registada.</p>
          <a
            href="/selfservice/onboarding"
            className="inline-flex items-center px-4 py-2 border border-transparent text-sm font-medium rounded-md text-white bg-blue-600 hover:bg-blue-700"
          >
            Registar Empresa
          </a>
        </div>
      </div>
    );
  }

  const companyId = company.id;

  // Estatisticas
  const totalInvoices = await prisma.invoice.count({
    where: { companyId },
  });

  const totalValue = await prisma.invoice.aggregate({
    where: { companyId },
    _sum: { totalValue: true },
  });

  const pendingInvoices = await prisma.invoice.count({
    where: { companyId, status: 'PENDING' },
  });

  const recentInvoices = await prisma.invoice.findMany({
    where: { companyId },
    orderBy: { createdAt: 'desc' },
    take: 5,
  });

  const vatEstimate = parseFloat(totalValue._sum.totalValue?.toString() || '0') * 0.23;

  return (
    <div className="space-y-6">
      <div className="flex justify-between items-center">
        <h2 className="text-2xl font-bold text-gray-900">{company.name}</h2>
        <span className="text-sm text-gray-500">NIF: {company.nif}</span>
      </div>

      {/* KPI Cards */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
        <KpiCard title="Faturas" value={totalInvoices} color="blue" />
        <KpiCard
          title="Valor Total"
          value={`${parseFloat(totalValue._sum.totalValue?.toString() || '0').toFixed(2)} EUR`}
          color="green"
          isText
        />
        <KpiCard title="Pendentes" value={pendingInvoices} color="yellow" />
        <KpiCard
          title="IVA Estimado"
          value={`${vatEstimate.toFixed(2)} EUR`}
          color="red"
          isText
        />
      </div>

      {/* Acoes Rapidas */}
      <div className="bg-white rounded-lg shadow border border-gray-200 p-6">
        <h3 className="text-lg font-semibold text-gray-900 mb-4">Acoes Rapidas</h3>
        <div className="flex flex-wrap gap-3">
          <a
            href="/selfservice/upload"
            className="inline-flex items-center px-4 py-2 border border-transparent text-sm font-medium rounded-md text-white bg-blue-600 hover:bg-blue-700"
          >
            + Lancar Fatura
          </a>
          <a
            href="/selfservice/rag"
            className="inline-flex items-center px-4 py-2 border border-gray-300 text-sm font-medium rounded-md text-gray-700 bg-white hover:bg-gray-50"
          >
            Perguntar ao Assistente IA
          </a>
          <a
            href="/selfservice/risk"
            className="inline-flex items-center px-4 py-2 border border-gray-300 text-sm font-medium rounded-md text-gray-700 bg-white hover:bg-gray-50"
          >
            Analisar Risco
          </a>
        </div>
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
                <p className="text-xs text-gray-500">{inv.documentNumber}</p>
              </div>
              <div className="text-right">
                <p className="text-sm font-bold text-gray-900">
                  {parseFloat(inv.totalValue.toString()).toFixed(2)} EUR
                </p>
                <span
                  className={`inline-flex items-center px-2 py-0.5 rounded text-xs font-medium ${
                    inv.status === 'PENDING'
                      ? 'bg-yellow-100 text-yellow-800'
                      : 'bg-green-100 text-green-800'
                  }`}
                >
                  {inv.status === 'PENDING' ? 'Pendente' : 'Aprovada'}
                </span>
              </div>
            </div>
          ))}
          {recentInvoices.length === 0 && (
            <div className="px-6 py-8 text-center text-gray-500">
              Nenhuma fatura encontrada. Comece por lancar a primeira!
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

function KpiCard({
  title,
  value,
  color,
  isText,
}: {
  title: string;
  value: number | string;
  color: string;
  isText?: boolean;
}) {
  const colors: Record<string, string> = {
    blue: 'bg-blue-50 border-blue-200',
    green: 'bg-green-50 border-green-200',
    yellow: 'bg-yellow-50 border-yellow-200',
    red: 'bg-red-50 border-red-200',
  };

  return (
    <div className={`rounded-lg border p-4 ${colors[color] || colors.blue}`}>
      <p className="text-sm font-medium text-gray-600">{title}</p>
      <p className={`font-bold text-gray-900 mt-1 ${isText ? 'text-lg' : 'text-2xl'}`}>
        {value}
      </p>
    </div>
  );
}
