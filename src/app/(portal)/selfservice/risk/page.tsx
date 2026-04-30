'use client';

import { useState } from 'react';
import { useSession } from 'next-auth/react';

export default function RiskPage() {
  const { data: session } = useSession();
  const [loading, setLoading] = useState(false);
  const [result, setResult] = useState<any>(null);

  const handleAnalyze = async () => {
    setLoading(true);
    try {
      // TODO: Implementar endpoint real de analise
      // const res = await fetch('/api/risk/ajudas-custo');
      // const data = await res.json();
      
      // Mock para demonstracao
      setResult({
        referencePeriod: '2026-Q2',
        totalPayroll: 15000,
        totalKmsDeclared: 4250,
        totalAjudasCusto: 1700,
        ratioAjudasPayroll: 11.3,
        kmRateApplied: 0.4,
        maxLegalRate: 0.4,
        isRateCompliant: true,
        isRatioAnomalous: false,
        riskLevel: 'LOW',
        alertMessages: [],
        recommendations: [
          'Manter mapa de deslocacoes atualizado.',
          'Verificar se nao ha dupla deducao com IVA do gasoleo.',
        ],
      });
    } catch {
      setResult({ error: 'Erro ao analisar' });
    } finally {
      setLoading(false);
    }
  };

  if (!session) {
    return <div className="text-center py-12">A carregar...</div>;
  }

  return (
    <div className="max-w-2xl mx-auto space-y-6">
      <h2 className="text-2xl font-bold text-gray-900">Analise de Risco - Ajudas de Custo</h2>
      <p className="text-sm text-gray-600">
        Verifique se os valores de ajudas de custo (KMs) estao dentro dos limites legais
        e se o ratio face a massa salarial e normal para o seu setor.
      </p>

      <button
        onClick={handleAnalyze}
        disabled={loading}
        className="w-full flex justify-center py-2 px-4 border border-transparent rounded-md shadow-sm text-sm font-medium text-white bg-blue-600 hover:bg-blue-700 disabled:opacity-50"
      >
        {loading ? 'A analisar...' : 'Executar Analise'}
      </button>

      {result && !result.error && (
        <div className="bg-white rounded-lg shadow border border-gray-200 p-6 space-y-4">
          <div className="flex items-center justify-between">
            <h3 className="text-lg font-semibold text-gray-900">Resultado da Analise</h3>
            <span className={`inline-flex px-3 py-1 text-sm font-semibold rounded-full ${
              result.riskLevel === 'LOW' ? 'bg-green-100 text-green-800' :
              result.riskLevel === 'MEDIUM' ? 'bg-yellow-100 text-yellow-800' :
              result.riskLevel === 'HIGH' ? 'bg-orange-100 text-orange-800' :
              'bg-red-100 text-red-800'
            }`}>
              Risco: {result.riskLevel}
            </span>
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div className="bg-gray-50 p-3 rounded">
              <p className="text-xs text-gray-500">Massa Salarial</p>
              <p className="text-lg font-bold">{result.totalPayroll.toFixed(2)} EUR</p>
            </div>
            <div className="bg-gray-50 p-3 rounded">
              <p className="text-xs text-gray-500">Ajudas de Custo</p>
              <p className="text-lg font-bold">{result.totalAjudasCusto.toFixed(2)} EUR</p>
            </div>
            <div className="bg-gray-50 p-3 rounded">
              <p className="text-xs text-gray-500">KMs Estimados</p>
              <p className="text-lg font-bold">{result.totalKmsDeclared.toFixed(0)} km</p>
            </div>
            <div className="bg-gray-50 p-3 rounded">
              <p className="text-xs text-gray-500">Ratio</p>
              <p className="text-lg font-bold">{result.ratioAjudasPayroll.toFixed(1)}%</p>
            </div>
          </div>

          {result.alertMessages.length > 0 && (
            <div className="bg-red-50 border border-red-200 rounded-md p-4">
              <h4 className="text-sm font-semibold text-red-900">Alertas</h4>
              <ul className="mt-2 list-disc list-inside text-sm text-red-700">
                {result.alertMessages.map((msg: string, i: number) => (
                  <li key={i}>{msg}</li>
                ))}
              </ul>
            </div>
          )}

          {result.recommendations.length > 0 && (
            <div className="bg-blue-50 border border-blue-200 rounded-md p-4">
              <h4 className="text-sm font-semibold text-blue-900">Recomendacoes</h4>
              <ul className="mt-2 list-disc list-inside text-sm text-blue-700">
                {result.recommendations.map((rec: string, i: number) => (
                  <li key={i}>{rec}</li>
                ))}
              </ul>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
