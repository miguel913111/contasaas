'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';

interface InvoiceLine {
  id: string;
  description: string;
  taxableAmount: number;
  vatAmount: number;
  vatRateValue: number;
  accountCode: string;
}

interface InvoiceData {
  documentNumber: string;
  supplierName: string;
  supplierNif: string;
  date: string;
  totalValue: number;
  taxableBase: number;
  vatTotal: number;
  status: string;
  accountCode: string;
  suggestedAccount: string;
  extractionMethod: string;
  extractionConfidence: number;
  companyName: string;
  lines: InvoiceLine[];
}

export default function InvoiceReviewForm({
  invoiceId,
  initialData,
}: {
  invoiceId: string;
  initialData: InvoiceData;
}) {
  const router = useRouter();
  const [data, setData] = useState(initialData);
  const [loading, setLoading] = useState(false);
  const [message, setMessage] = useState('');
  const [error, setError] = useState('');

  const handleChange = (field: keyof InvoiceData, value: string) => {
    setData((prev) => ({ ...prev, [field]: value }));
  };

  const handleSave = async () => {
    setLoading(true);
    setError('');
    setMessage('');

    try {
      const response = await fetch(`/api/invoices/${invoiceId}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          documentNumber: data.documentNumber,
          supplierName: data.supplierName,
          supplierNif: data.supplierNif,
          accountCode: data.accountCode,
        }),
      });

      const result = await response.json();
      if (response.ok) {
        setMessage('Fatura atualizada com sucesso');
      } else {
        setError(result.error || 'Erro ao atualizar');
      }
    } catch {
      setError('Erro de rede');
    } finally {
      setLoading(false);
    }
  };

  const handleStatusChange = async (newStatus: 'APPROVED' | 'REJECTED') => {
    setLoading(true);
    setError('');
    setMessage('');

    try {
      const response = await fetch(`/api/invoices/${invoiceId}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ status: newStatus }),
      });

      const result = await response.json();
      if (response.ok) {
        setData((prev) => ({ ...prev, status: newStatus }));
        setMessage(
          newStatus === 'APPROVED'
            ? '✅ Fatura aprovada com sucesso'
            : '❌ Fatura rejeitada'
        );
      } else {
        setError(result.error || 'Erro ao atualizar status');
      }
    } catch {
      setError('Erro de rede');
    } finally {
      setLoading(false);
    }
  };

  const statusColor =
    data.status === 'APPROVED'
      ? 'bg-green-100 text-green-800'
      : data.status === 'REJECTED'
      ? 'bg-red-100 text-red-800'
      : 'bg-yellow-100 text-yellow-800';

  return (
    <div className="space-y-6">
      {/* Header com status */}
      <div className="bg-white rounded-lg shadow border border-gray-200 p-6">
        <div className="flex justify-between items-start">
          <div>
            <p className="text-sm text-gray-500">Empresa: {data.companyName}</p>
            <p className="text-sm text-gray-500">
              Metodo OCR: {data.extractionMethod} | Confiança:{' '}
              {(data.extractionConfidence * 100).toFixed(0)}%
            </p>
          </div>
          <span className={`inline-flex px-3 py-1 text-sm font-semibold rounded-full ${statusColor}`}>
            {data.status}
          </span>
        </div>
      </div>

      {/* Formulario de edicao */}
      <div className="bg-white rounded-lg shadow border border-gray-200 p-6 space-y-4">
        <h3 className="text-lg font-semibold text-gray-900">Detalhes da Fatura</h3>

        <div className="grid grid-cols-2 gap-4">
          <div>
            <label className="block text-sm font-medium text-gray-700">Nr. Documento</label>
            <input
              type="text"
              value={data.documentNumber}
              onChange={(e) => handleChange('documentNumber', e.target.value)}
              className="mt-1 block w-full rounded-md border-gray-300 shadow-sm focus:border-blue-500 focus:ring-blue-500 sm:text-sm px-3 py-2 border"
            />
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700">Data</label>
            <input
              type="date"
              value={data.date}
              readOnly
              className="mt-1 block w-full rounded-md border-gray-300 bg-gray-50 sm:text-sm px-3 py-2 border"
            />
          </div>
        </div>

        <div className="grid grid-cols-2 gap-4">
          <div>
            <label className="block text-sm font-medium text-gray-700">Fornecedor</label>
            <input
              type="text"
              value={data.supplierName}
              onChange={(e) => handleChange('supplierName', e.target.value)}
              className="mt-1 block w-full rounded-md border-gray-300 shadow-sm focus:border-blue-500 focus:ring-blue-500 sm:text-sm px-3 py-2 border"
            />
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700">NIF Fornecedor</label>
            <input
              type="text"
              value={data.supplierNif}
              onChange={(e) => handleChange('supplierNif', e.target.value)}
              className="mt-1 block w-full rounded-md border-gray-300 shadow-sm focus:border-blue-500 focus:ring-blue-500 sm:text-sm px-3 py-2 border"
            />
          </div>
        </div>

        <div className="grid grid-cols-3 gap-4">
          <div>
            <label className="block text-sm font-medium text-gray-700">Valor Total</label>
            <input
              type="text"
              value={`${data.totalValue.toFixed(2)} EUR`}
              readOnly
              className="mt-1 block w-full rounded-md border-gray-300 bg-gray-50 sm:text-sm px-3 py-2 border"
            />
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700">Base Tributavel</label>
            <input
              type="text"
              value={`${data.taxableBase.toFixed(2)} EUR`}
              readOnly
              className="mt-1 block w-full rounded-md border-gray-300 bg-gray-50 sm:text-sm px-3 py-2 border"
            />
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700">Total IVA</label>
            <input
              type="text"
              value={`${data.vatTotal.toFixed(2)} EUR`}
              readOnly
              className="mt-1 block w-full rounded-md border-gray-300 bg-gray-50 sm:text-sm px-3 py-2 border"
            />
          </div>
        </div>

        <div>
          <label className="block text-sm font-medium text-gray-700">
            Conta SNC {data.suggestedAccount && `(Sugerida: ${data.suggestedAccount})`}
          </label>
          <input
            type="text"
            value={data.accountCode}
            onChange={(e) => handleChange('accountCode', e.target.value)}
            placeholder="Ex: 6224"
            className="mt-1 block w-full rounded-md border-gray-300 shadow-sm focus:border-blue-500 focus:ring-blue-500 sm:text-sm px-3 py-2 border"
          />
        </div>

        {message && (
          <div className="bg-green-50 border border-green-200 rounded-md p-3">
            <p className="text-sm text-green-700">{message}</p>
          </div>
        )}

        {error && (
          <div className="bg-red-50 border border-red-200 rounded-md p-3">
            <p className="text-sm text-red-700">{error}</p>
          </div>
        )}

        <div className="flex space-x-3">
          <button
            onClick={handleSave}
            disabled={loading}
            className="px-4 py-2 border border-transparent rounded-md shadow-sm text-sm font-medium text-white bg-blue-600 hover:bg-blue-700 disabled:opacity-50"
          >
            {loading ? 'A guardar...' : 'Guardar Alteracoes'}
          </button>

          {data.status === 'PENDING' && (
            <>
              <button
                onClick={() => handleStatusChange('APPROVED')}
                disabled={loading}
                className="px-4 py-2 border border-transparent rounded-md shadow-sm text-sm font-medium text-white bg-green-600 hover:bg-green-700 disabled:opacity-50"
              >
                ✅ Aprovar
              </button>
              <button
                onClick={() => handleStatusChange('REJECTED')}
                disabled={loading}
                className="px-4 py-2 border border-transparent rounded-md shadow-sm text-sm font-medium text-white bg-red-600 hover:bg-red-700 disabled:opacity-50"
              >
                ❌ Rejeitar
              </button>
            </>
          )}
        </div>
      </div>

      {/* Linhas da fatura */}
      <div className="bg-white rounded-lg shadow border border-gray-200 overflow-hidden">
        <div className="px-6 py-4 border-b border-gray-200">
          <h3 className="text-lg font-semibold text-gray-900">Linhas da Fatura</h3>
        </div>
        <table className="min-w-full divide-y divide-gray-200">
          <thead className="bg-gray-50">
            <tr>
              <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Descricao</th>
              <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Base</th>
              <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">IVA</th>
              <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Taxa</th>
              <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Conta</th>
            </tr>
          </thead>
          <tbody className="bg-white divide-y divide-gray-200">
            {data.lines.map((line) => (
              <tr key={line.id}>
                <td className="px-6 py-4 text-sm text-gray-900">{line.description}</td>
                <td className="px-6 py-4 text-sm text-gray-500">{line.taxableAmount.toFixed(2)}</td>
                <td className="px-6 py-4 text-sm text-gray-500">{line.vatAmount.toFixed(2)}</td>
                <td className="px-6 py-4 text-sm text-gray-500">{line.vatRateValue}%</td>
                <td className="px-6 py-4 text-sm text-gray-500">{line.accountCode || '-'}</td>
              </tr>
            ))}
            {data.lines.length === 0 && (
              <tr>
                <td colSpan={5} className="px-6 py-4 text-center text-gray-500">
                  Sem linhas detalhadas
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}
