import { getServerSession } from 'next-auth/next';
import { redirect } from 'next/navigation';
import { authOptions, getAccessibleCompanies } from '@/lib/auth';
import { UserRole } from '@/types';
import { prisma } from '@/lib/prisma';

export default async function BankPage() {
  const session = await getServerSession(authOptions);
  if (!session?.user || session.user.role !== UserRole.ACCOUNTANT) {
    redirect('/selfservice/dashboard');
  }

  const companies = await getAccessibleCompanies(session.user.id, session.user.role as UserRole);

  return (
    <div className="space-y-6">
      <h2 className="text-2xl font-bold text-gray-900">Reconciliacao Bancaria</h2>
      
      <div className="bg-white rounded-lg shadow border border-gray-200 p-6">
        <h3 className="text-lg font-semibold text-gray-900 mb-4">Importar Extrato Bancario</h3>
        <form action="/api/bank-reconciliation" method="POST" encType="multipart/form-data" className="space-y-4">
          <div>
            <label className="block text-sm font-medium text-gray-700">Empresa *</label>
            <select
              name="companyId"
              required
              className="mt-1 block w-full rounded-md border-gray-300 shadow-sm focus:border-blue-500 focus:ring-blue-500 sm:text-sm px-3 py-2 border"
            >
              <option value="">Selecione uma empresa...</option>
              {companies.map(company => (
                <option key={company.id} value={company.id}>
                  {company.name} (NIF: {company.nif})
                </option>
              ))}
            </select>
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700">Ficheiro de Extrato *</label>
            <input
              type="file"
              name="file"
              accept=".xml,.pdf"
              required
              className="mt-1 block w-full text-sm text-gray-500 file:mr-4 file:py-2 file:px-4 file:rounded-md file:border-0 file:text-sm file:font-semibold file:bg-blue-50 file:text-blue-700 hover:file:bg-blue-100"
            />
            <p className="mt-1 text-xs text-gray-500">
              Max 10MB. Formatos: XML (CAMT.053) ou PDF de extrato bancario
            </p>
          </div>

          <button
            type="submit"
            className="inline-flex items-center px-4 py-2 border border-transparent text-sm font-medium rounded-md text-white bg-blue-600 hover:bg-blue-700"
          >
            Importar e Conciliar
          </button>
        </form>
      </div>

      <div className="bg-blue-50 border border-blue-200 rounded-md p-4">
        <p className="text-sm text-blue-700">
          <strong>Como funciona:</strong> Exporte o extrato do seu homebanking em XML (CAMT.053 ISO 20022) ou PDF.
          O sistema ira automaticamente casar pagamentos com faturas pendentes.
        </p>
      </div>
    </div>
  );
}
