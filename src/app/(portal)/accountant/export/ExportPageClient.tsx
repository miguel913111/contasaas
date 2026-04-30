'use client';

import { useState } from 'react';

interface Invoice {
  id: string;
  documentNumber: string;
  companyName: string;
  totalValue: number;
  date: string;
  companyId: string;
}

interface Company {
  id: string;
  name: string;
  nif: string;
}

export default function ExportPageClient({
  companies,
  invoices,
}: {
  companies: Company[];
  invoices: Invoice[];
}) {
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [message, setMessage] = useState('');

  const toggleSelection = (id: string) => {
    setSelectedIds((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  };

  const toggleAll = () => {
    if (selectedIds.size === invoices.length) {
      setSelectedIds(new Set());
    } else {
      setSelectedIds(new Set(invoices.map((i) => i.id)));
    }
  };

  const handleExport = async (erpType: 'TOCONLINE' | 'PRIMAVERA_V10' | 'PHC_CS') => {
    if (selectedIds.size === 0) {
      setError('Selecione pelo menos uma fatura');
      return;
    }

    setLoading(true);
    setError('');
    setMessage('');

    try {
      // Para TOConline, agrupa por companyId (cada empresa precisa do seu companyId)
      if (erpType === 'TOCONLINE') {
        // TOConline exporta por companyId
        const selectedInvoices = invoices.filter((i) => selectedIds.has(i.id));
        const byCompany = selectedInvoices.reduce((acc, inv) => {
          if (!acc[inv.companyId]) acc[inv.companyId] = [];
          acc[inv.companyId].push(inv.id);
          return acc;
        }, {} as Record<string, string[]>);

        for (const [companyId, invoiceIds] of Object.entries(byCompany)) {
          const response = await fetch('/api/export', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ erpType, companyId, invoiceIds }),
          });

          if (!response.ok) {
            const data = await response.json();
            throw new Error(data.error || `Erro TOConline para empresa ${companyId}`);
          }
        }

        setMessage('Exportacao TOConline enviada com sucesso!');
      } else {
        // Primavera e PHC usam companyId da primeira fatura selecionada (ou selector)
        const firstInvoice = invoices.find((i) => selectedIds.has(i.id));
        if (!firstInvoice) return;

        const response = await fetch('/api/export', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            erpType,
            companyId: firstInvoice.companyId,
            invoiceIds: Array.from(selectedIds),
          }),
        });

        if (!response.ok) {
          const data = await response.json();
          throw new Error(data.error || 'Erro na exportacao');
        }

        // Download do ficheiro (blob)
        const blob = await response.blob();
        const url = window.URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = `export_${erpType.toLowerCase()}_${Date.now()}.${
          erpType === 'PRIMAVERA_V10' ? 'xlsx' : 'csv'
        }`;
        document.body.appendChild(a);
        a.click();
        window.URL.revokeObjectURL(url);
        document.body.removeChild(a);

        setMessage(`Exportacao ${erpType} concluida!`);
      }
    } catch (err: any) {
      setError(err.message || 'Erro na exportacao');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="space-y-6">
      <h2 className="text-2xl font-bold text-gray-900">Exportar para ERP</h2>

      {message && (
        <div className="bg-green-50 border border-green-200 rounded-md p-4">
          <p className="text-sm text-green-700">{message}</p>
        </div>
      )}

      {error && (
        <div className="bg-red-50 border border-red-200 rounded-md p-4">
          <p className="text-sm text-red-700">{error}</p>
        </div>
      )}

      <div className="bg-white rounded-lg shadow border border-gray-200 overflow-hidden">
        <div className="px-6 py-4 border-b border-gray-200 flex justify-between items-center">
          <h3 className="text-lg font-semibold text-gray-900">
            Faturas Aprovadas ({invoices.length})
          </h3>
          <span className="text-sm text-gray-500">
            {selectedIds.size} selecionada{selectedIds.size !== 1 ? 's' : ''}
          </span>
        </div>
        <table className="min-w-full divide-y divide-gray-200">
          <thead className="bg-gray-50">
            <tr>
              <th className="px-6 py-3 text-left">
                <input
                  type="checkbox"
                  checked={selectedIds.size === invoices.length && invoices.length > 0}
                  onChange={toggleAll}
                  className="rounded border-gray-300"
                />
              </th>
              <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Documento</th>
              <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Cliente</th>
              <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Data</th>
              <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Valor</th>
            </tr>
          </thead>
          <tbody className="bg-white divide-y divide-gray-200">
            {invoices.map((inv) => (
              <tr key={inv.id} className="hover:bg-gray-50">
                <td className="px-6 py-4">
                  <input
                    type="checkbox"
                    checked={selectedIds.has(inv.id)}
                    onChange={() => toggleSelection(inv.id)}
                    className="rounded border-gray-300"
                  />
                </td>
                <td className="px-6 py-4 text-sm text-gray-900">{inv.documentNumber}</td>
                <td className="px-6 py-4 text-sm text-gray-500">{inv.companyName}</td>
                <td className="px-6 py-4 text-sm text-gray-500">{inv.date}</td>
                <td className="px-6 py-4 text-sm font-medium">{inv.totalValue.toFixed(2)} EUR</td>
              </tr>
            ))}
            {invoices.length === 0 && (
              <tr>
                <td colSpan={5} className="px-6 py-8 text-center text-gray-500">
                  Nenhuma fatura aprovada para exportar
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>

      <div className="flex gap-3">
        <button
          onClick={() => handleExport('TOCONLINE')}
          disabled={loading || selectedIds.size === 0}
          className="px-4 py-2 border border-transparent text-sm font-medium rounded-md text-white bg-blue-600 hover:bg-blue-700 disabled:opacity-50"
        >
          {loading ? 'A exportar...' : 'Exportar TOConline'}
        </button>
        <button
          onClick={() => handleExport('PRIMAVERA_V10')}
          disabled={loading || selectedIds.size === 0}
          className="px-4 py-2 border border-gray-300 text-sm font-medium rounded-md text-gray-700 bg-white hover:bg-gray-50 disabled:opacity-50"
        >
          Exportar Primavera v10
        </button>
        <button
          onClick={() => handleExport('PHC_CS')}
          disabled={loading || selectedIds.size === 0}
          className="px-4 py-2 border border-gray-300 text-sm font-medium rounded-md text-gray-700 bg-white hover:bg-gray-50 disabled:opacity-50"
        >
          Exportar PHC CS
        </button>
      </div>
    </div>
  );
}
