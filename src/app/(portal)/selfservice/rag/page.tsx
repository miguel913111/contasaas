'use client';

import { useState } from 'react';
import { useSession } from 'next-auth/react';

export default function RagChatPage() {
  const { data: session } = useSession();
  const [question, setQuestion] = useState('');
  const [loading, setLoading] = useState(false);
  const [response, setResponse] = useState<any>(null);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!question.trim()) return;

    setLoading(true);
    setResponse(null);

    try {
      const res = await fetch('/api/rag-chat', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ question }),
      });

      const data = await res.json();
      setResponse(data);
    } catch {
      setResponse({ error: 'Erro de rede' });
    } finally {
      setLoading(false);
    }
  };

  if (!session) {
    return <div className="text-center py-12">A carregar...</div>;
  }

  return (
    <div className="max-w-3xl mx-auto space-y-6">
      <h2 className="text-2xl font-bold text-gray-900">Assistente Tributario IA</h2>
      <p className="text-sm text-gray-600">
        Pergunte sobre CIVA, CIRC, SNC ou qualquer questao contabilistica.
        As respostas sao baseadas na legislacao portuguesa oficial.
      </p>

      <form onSubmit={handleSubmit} className="space-y-4">
        <textarea
          value={question}
          onChange={(e) => setQuestion(e.target.value)}
          placeholder="Ex: Posso deduzir o IVA do gasoleo do meu carro?"
          rows={3}
          className="w-full px-3 py-2 border border-gray-300 rounded-md shadow-sm focus:ring-blue-500 focus:border-blue-500"
        />
        <button
          type="submit"
          disabled={loading || !question.trim()}
          className="w-full flex justify-center py-2 px-4 border border-transparent rounded-md shadow-sm text-sm font-medium text-white bg-blue-600 hover:bg-blue-700 disabled:opacity-50"
        >
          {loading ? 'A pesquisar...' : 'Perguntar'}
        </button>
      </form>

      {response?.answer && (
        <div className="bg-white rounded-lg shadow border border-gray-200 p-6 space-y-4">
          <div className="prose max-w-none">
            <h3 className="text-lg font-semibold text-gray-900">Resposta</h3>
            <div className="text-gray-700 whitespace-pre-wrap">{response.answer}</div>
          </div>

          {response.sources && response.sources.length > 0 && (
            <div className="border-t border-gray-200 pt-4">
              <h4 className="text-sm font-semibold text-gray-900">Fontes Consultadas</h4>
              <ul className="mt-2 space-y-1">
                {response.sources.map((source: any, idx: number) => (
                  <li key={idx} className="text-xs text-gray-600">
                    {source.code} - {source.title} ({(source.relevance * 100).toFixed(0)}% relevancia)
                  </li>
                ))}
              </ul>
            </div>
          )}

          <div className="text-xs text-gray-500">
            Confidenca: {(response.confidence * 100).toFixed(0)}% | Tempo: {response.processingTimeMs}ms
          </div>
        </div>
      )}
    </div>
  );
}
