import { getServerSession } from 'next-auth/next';
import { redirect } from 'next/navigation';
import { authOptions } from '@/lib/auth';
import { prisma } from '@/lib/prisma';
import { UserRole } from '@/types';

export default async function BankResultsPage() {
  const session = await getServerSession(authOptions);
  if (!session?.user || session.user.role !== UserRole.ACCOUNTANT) {
    redirect('/selfservice/dashboard');
  }

  // Busca as ultimas 20 transacoes reconciliadas do contabilista
  const transactions = await prisma.bankTransaction.findMany({
    where: {
      company: { accountantId: session.user.id },
    },
    include: {
      company: true,
      matchedInvoices: true,
    },
    orderBy: { createdAt: 'desc' },
    take: 20,
  });

  const summary = {
    total: transactions.length,
    exact: transactions.filter((t) => t.reconciliationMethod === 'exact').length,
    knapsack: transactions.filter((t) => t.reconciliationMethod === 'knapsack').length,
    manual: transactions.filter((t) => t.reconciliationMethod === 'manual').length,
    unreconciled: transactions.filter((t) => !t.isReconciled).length,
  };

  return (
    <div className="space-y-6">
      <div className="flex justify-between items-center">
        <h2 className="text-2xl font-bold text-gray-900">Resultados da Reconciliacao</h2>
        <a
          href="/accountant/bank"
          className="text-sm text-blue-600 hover:text-blue-800"
        >
          ← Novo upload
        </a>
      </div>

      {/* Resumo */}
      <div className="grid grid-cols-5 gap-4">
        {[
          { label: 'Total', value: summary.total, color: 'bg-gray-100 text-gray-800' },
          { label: 'Exato', value: summary.exact, color: 'bg-green-100 text-green-800' },
          { label: 'Subset', value: summary.knapsack, color: 'bg-blue-100 text-blue-800' },
          { label: 'Manual', value: summary.manual, color: 'bg-yellow-100 text-yellow-800' },
          { label: 'Pendente', value: summary.unreconciled, color: 'bg-red-100 text-red-800' },
        ].map((item) => (
          <div key={item.label} className={`rounded-lg p-4 text-center ${item.color}`}>
            <div className="text-2xl font-bold">{item.value}</div>
            <div className="text-xs font-medium uppercase">{item.label}</div>
          </div>
        ))}
      </div>

      {/* Tabela de transacoes */}
      <div className="bg-white rounded-lg shadow border border-gray-200 overflow-hidden">
        <div className="px-6 py-4 border-b border-gray-200">
          <h3 className="text-lg font-semibold text-gray-900">Transacoes Recentes</h3>
        </div>
        <table className="min-w-full divide-y divide-gray-200">
          <thead className="bg-gray-50">
            <tr>
              <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Data</th>
              <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Descricao</th>
              <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Empresa</th>
              <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Valor</th>
              <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Metodo</th>
              <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Faturas</th>
              <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Diferenca</th>
            </tr>
          </thead>
          <tbody className="bg-white divide-y divide-gray-200">
            {transactions.map((t) => (
              <tr key={t.id} className="hover:bg-gray-50">
                <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                  {t.bookingDate.toLocaleDateString('pt-PT')}
                </td>
                <td className="px-6 py-4 text-sm text-gray-900 max-w-xs truncate">
                  {t.description || '-'}
                </td>
                <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                  {t.company.name}
                </td>
                <td className="px-6 py-4 whitespace-nowrap text-sm font-medium text-gray-900">
                  {parseFloat(t.amount.toString()).toFixed(2)} EUR
                </td>
                <td className="px-6 py-4 whitespace-nowrap">
                  <span
                    className={`inline-flex px-2 py-1 text-xs font-semibold rounded-full ${
                      t.reconciliationMethod === 'exact'
                        ? 'bg-green-100 text-green-800'
                        : t.reconciliationMethod === 'knapsack'
                        ? 'bg-blue-100 text-blue-800'
                        : t.reconciliationMethod === 'manual'
                        ? 'bg-yellow-100 text-yellow-800'
                        : 'bg-gray-100 text-gray-800'
                    }`}
                  >
                    {t.reconciliationMethod || 'N/A'}
                  </span>
                </td>
                <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                  {t.matchedInvoices.length > 0
                    ? t.matchedInvoices.map((inv) => inv.documentNumber).join(', ')
                    : 'Nenhuma'}
                </td>
                <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                  {t.differenceAmount
                    ? `${parseFloat(t.differenceAmount.toString()).toFixed(2)} EUR`
                    : '-'}
                </td>
              </tr>
            ))}
            {transactions.length === 0 && (
              <tr>
                <td colSpan={7} className="px-6 py-8 text-center text-gray-500">
                  Nenhuma transacao encontrada. Importe um extrato CAMT.053 para comecar.
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}
