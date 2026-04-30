'use client';

import { useState, useEffect } from 'react';
import { useSession } from 'next-auth/react';
import { useRouter } from 'next/navigation';

export default function UploadPage() {
  const { data: session } = useSession();
  const router = useRouter();
  const [file, setFile] = useState<File | null>(null);
  const [companyId, setCompanyId] = useState<string>('');
  const [companyName, setCompanyName] = useState<string>('');
  const [loading, setLoading] = useState(false);
  const [result, setResult] = useState<any>(null);
  const [error, setError] = useState('');
  const [jobStatus, setJobStatus] = useState<string>('');
  const [jobId, setJobId] = useState<string>('');

  // Obtem companyId do utilizador logado
  useEffect(() => {
    if (!session) return;
    
    fetch('/api/user/company')
      .then(res => {
        if (res.status === 404) {
          router.push('/selfservice/onboarding');
          return null;
        }
        return res.json();
      })
      .then(data => {
        if (data?.companyId) {
          setCompanyId(data.companyId);
          setCompanyName(data.name);
        }
      })
      .catch(() => setError('Erro ao obter dados da empresa'));
  }, [session, router]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!file || !companyId) return;

    setLoading(true);
    setError('');
    setResult(null);
    setJobStatus('');

    const formData = new FormData();
    formData.append('file', file);
    formData.append('companyId', companyId);

    try {
      const response = await fetch('/api/ocr', {
        method: 'POST',
        body: formData,
      });

      const data = await response.json();

      if (response.ok) {
        if (data.jobId) {
          // OCR assincrono — comecar a poll status
          setJobId(data.jobId);
          pollJobStatus(data.jobId);
        } else {
          // OCR sincrono (fallback)
          setResult(data);
        }
      } else {
        setError(data.error || 'Erro ao processar fatura');
      }
    } catch {
      setError('Erro de rede');
    } finally {
      setLoading(false);
    }
  };

  const pollJobStatus = async (id: string) => {
    const interval = setInterval(async () => {
      try {
        const res = await fetch(`/api/ocr/${id}`);
        const data = await res.json();
        
        setJobStatus(data.status);
        
        if (data.status === 'completed') {
          clearInterval(interval);
          setResult(data.result);
        } else if (data.status === 'failed') {
          clearInterval(interval);
          setError(data.error || 'Erro no processamento');
        }
      } catch {
        clearInterval(interval);
      }
    }, 2000);

    // Timeout de 60 segundos
    setTimeout(() => clearInterval(interval), 60000);
  };

  if (!session) {
    return (
      <div className="text-center py-12">
        <p className="text-gray-600">A carregar...</p>
      </div>
    );
  }

  return (
    <div className="max-w-2xl mx-auto space-y-6">
      <div className="flex justify-between items-center">
        <h2 className="text-2xl font-bold text-gray-900">Lancar Fatura</h2>
        {companyName && (
          <span className="text-sm text-gray-500 bg-gray-100 px-3 py-1 rounded-full">
            {companyName}
          </span>
        )}
      </div>

      <div className="bg-white rounded-lg shadow border border-gray-200 p-6">
        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <label className="block text-sm font-medium text-gray-700">
              Ficheiro (PDF ou Imagem)
            </label>
            <input
              type="file"
              accept=".pdf,image/*"
              onChange={(e) => setFile(e.target.files?.[0] || null)}
              className="mt-1 block w-full text-sm text-gray-500 file:mr-4 file:py-2 file:px-4 file:rounded-md file:border-0 file:text-sm file:font-semibold file:bg-blue-50 file:text-blue-700 hover:file:bg-blue-100"
            />
            <p className="mt-1 text-xs text-gray-500">
              Max 10MB. Formatos: PDF, JPG, PNG, WEBP
            </p>
          </div>

          <button
            type="submit"
            disabled={!file || loading || !companyId}
            className="w-full flex justify-center py-2 px-4 border border-transparent rounded-md shadow-sm text-sm font-medium text-white bg-blue-600 hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500 disabled:opacity-50"
          >
            {loading ? 'A enviar...' : 'Processar Fatura'}
          </button>
        </form>
      </div>

      {jobStatus && jobStatus !== 'completed' && (
        <div className="bg-blue-50 border border-blue-200 rounded-md p-4">
          <div className="flex items-center space-x-3">
            <div className="animate-spin h-4 w-4 border-2 border-blue-600 border-t-transparent rounded-full"></div>
            <p className="text-sm text-blue-700">
              Processamento em background: <strong>{jobStatus}</strong>
            </p>
          </div>
        </div>
      )}

      {error && (
        <div className="bg-red-50 border border-red-200 rounded-md p-4">
          <p className="text-sm text-red-700">{error}</p>
        </div>
      )}

      {result && (
        <div className="bg-green-50 border border-green-200 rounded-md p-4 space-y-2">
          <h3 className="text-lg font-semibold text-green-900">Fatura Processada</h3>
          <div className="text-sm text-green-800 space-y-1">
            <p><strong>Fornecedor:</strong> {result.data?.supplier_name || result.supplierName}</p>
            <p><strong>NIF:</strong> {result.data?.supplier_nif || result.supplierNif}</p>
            <p><strong>Data:</strong> {result.data?.date || result.date}</p>
            <p><strong>Valor:</strong> {(result.data?.total_value ?? result.totalValue)?.toFixed(2)} EUR</p>
            <p><strong>Metodo:</strong> {result.method || result.extractionMethod}</p>
            {result.accounting?.requiresManualReview && (
              <p className="text-yellow-700 font-medium">
                ⚠️ Requer revisao manual (regras CIVA aplicadas)
              </p>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
