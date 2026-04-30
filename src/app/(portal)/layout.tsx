/**
 * Layout base para portais autenticados
 * Inclui navegacao, header e container principal
 */

import { getServerSession } from 'next-auth/next';
import { redirect } from 'next/navigation';
import { authOptions } from '@/lib/auth';
import { UserRole } from '@/types';

export default async function PortalLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const session = await getServerSession(authOptions);

  if (!session?.user) {
    redirect('/auth/signin');
  }

  const role = session.user.role as UserRole;

  return (
    <div className="min-h-screen bg-gray-50">
      <header className="bg-white border-b border-gray-200">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex justify-between items-center h-16">
            <div className="flex items-center gap-4">
              <h1 className="text-xl font-bold text-blue-900">ContaSaaS</h1>
              <span className="text-xs px-2 py-1 rounded-full bg-blue-100 text-blue-800">
                {role === UserRole.ACCOUNTANT ? 'Portal Contabilista' : 'Portal ENI'}
              </span>
            </div>
            <div className="flex items-center gap-4">
              <span className="text-sm text-gray-600">{session.user.name || session.user.email}</span>
              <a
                href="/api/auth/signout"
                className="text-sm text-red-600 hover:text-red-800"
              >
                Sair
              </a>
            </div>
          </div>
        </div>
      </header>

      <nav className="bg-white border-b border-gray-200">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex space-x-8 h-12 items-center">
            {role === UserRole.ACCOUNTANT ? (
              <>
                <NavLink href="/accountant/dashboard">Dashboard</NavLink>
                <NavLink href="/accountant/clients">Clientes</NavLink>
                <NavLink href="/accountant/invoices">Faturas</NavLink>
                <NavLink href="/accountant/bank">Banco</NavLink>
                <NavLink href="/accountant/rag">Assistente IA</NavLink>
                <NavLink href="/accountant/export">Exportar</NavLink>
              </>
            ) : (
              <>
                <NavLink href="/selfservice/dashboard">Dashboard</NavLink>
                <NavLink href="/selfservice/invoices">Minhas Faturas</NavLink>
                <NavLink href="/selfservice/upload">Lancar Fatura</NavLink>
                <NavLink href="/selfservice/rag">Perguntar a IA</NavLink>
                <NavLink href="/selfservice/risk">Analise Risco</NavLink>
              </>
            )}
          </div>
        </div>
      </nav>

      <main className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        {children}
      </main>
    </div>
  );
}

function NavLink({ href, children }: { href: string; children: React.ReactNode }) {
  return (
    <a
      href={href}
      className="text-sm font-medium text-gray-700 hover:text-blue-900 transition-colors"
    >
      {children}
    </a>
  );
}
