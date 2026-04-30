import { getServerSession } from 'next-auth/next';
import { redirect } from 'next/navigation';
import { authOptions } from '@/lib/auth';
import { prisma } from '@/lib/prisma';
import { UserRole } from '@/types';

export default async function SelfServiceInvoicesPage() {
  const session = await getServerSession(authOptions);
  if (!session?.user) redirect('/auth/signin');
  if (session.user.role === UserRole.ACCOUNTANT) redirect('/accountant/dashboard');

  const company = await prisma.company.findFirst({
    where: { ownerId: session.user.id },
  });

  if (!company) {
    return (
      <div className="text-center py-12">
        <p className="text-gray-600">Nenhuma empresa registada.</p>
      </div>
    );
  }

  const invoices = await prisma.invoice.findMany({
    where: { companyId: company.id },
    orderBy: { createdAt: 'desc' },
    include: { lines: true },
  });

  return (
    <div className="space-y-6">
      <h2 className="text-2xl font-bold text-gray-900">Minhas Faturas</h2>

      <div className="bg-white rounded-lg shadow border border-gray-200 overflow-hidden">
        <table className="min-w-full divide-y divide-gray-200">
          <thead className="bg-gray-50">
            <tr>
              <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Documento</th>
              <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Fornecedor</th>
              <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Data</th>
              <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Valor</th>
              <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Estado</th>
            </tr>
          </thead>
          <tbody className="bg-white divide-y divide-gray-200">
            {invoices.map((inv: any) => (
              <tr key={inv.id}>
                <td className="px-6 py-4 text-sm font-medium text-gray-900">{inv.documentNumber}</td>
                <td className="px-6 py-4 text-sm text-gray-500">{inv.supplierName || '-'}</td>
                <td className="px-6 py-4 text-sm text-gray-500">{inv.date.toLocaleDateString('pt-PT')}</td>
                <td className="px-6 py-4 text-sm font-medium">{parseFloat(inv.totalValue.toString()).toFixed(2)} EUR</td>
                <td className="px-6 py-4">
                  <span className={`inline-flex px-2 py-1 text-xs font-semibold rounded-full ${
                    inv.status === 'PENDING' ? 'bg-yellow-100 text-yellow-800' : 'bg-green-100 text-green-800'
                  }`}>
                    {inv.status === 'PENDING' ? 'Pendente' : 'Aprovada'}
                  </span>
                </td>
              </tr>
            ))}
            {invoices.length === 0 && (
              <tr>
                <td colSpan={5} className="px-6 py-8 text-center text-gray-500">
                  Nenhuma fatura encontrada
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}
