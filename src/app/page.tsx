import Link from 'next/link';

export default function LandingPage() {
  return (
    <div className="min-h-screen bg-white">
      {/* Hero */}
      <div className="relative bg-blue-900">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-24">
          <div className="text-center">
            <h1 className="text-4xl font-extrabold text-white sm:text-5xl md:text-6xl">
              ContaSaaS
            </h1>
            <p className="mt-4 text-xl text-blue-100 max-w-2xl mx-auto">
              Automacao documental inteligente para escritorios de contabilidade
              e empresarios em nome individual em Portugal.
            </p>
            <div className="mt-8 flex justify-center gap-4">
              <Link
                href="/auth/signin"
                className="px-8 py-3 border border-transparent text-base font-medium rounded-md text-blue-900 bg-white hover:bg-gray-100 md:text-lg"
              >
                Comecar Agora
              </Link>
            </div>
          </div>
        </div>
      </div>

      {/* Features */}
      <div className="py-24 bg-gray-50">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="text-center">
            <h2 className="text-3xl font-extrabold text-gray-900">
              Tudo o que precisa para a contabilidade
            </h2>
          </div>
          <div className="mt-12 grid grid-cols-1 md:grid-cols-3 gap-8">
            <FeatureCard
              title="OCR Inteligente"
              description="Extrai dados de faturas automaticamente com IA. Suporta PDF e imagens."
              icon="📄"
            />
            <FeatureCard
              title="Assistente Tributario IA"
              description="Pergunte sobre CIVA, CIRC e SNC. Respostas baseadas na legislacao oficial."
              icon="🤖"
            />
            <FeatureCard
              title="Reconciliacao Bancaria"
              description="Importe extractos CAMT.053 e casa faturas automaticamente."
              icon="🏦"
            />
            <FeatureCard
              title="Exportacao ERP"
              description="Exporte para TOConline, Primavera v10 e PHC CS com um clique."
              icon="📤"
            />
            <FeatureCard
              title="WhatsApp Bot"
              description="Os seus clientes enviam faturas por WhatsApp. Processamento automatico."
              icon="📱"
            />
            <FeatureCard
              title="Detecao de Risco"
              description="Alertas preventivos sobre ajudas de custo e deducoes de IVA."
              icon="⚠️"
            />
          </div>
        </div>
      </div>

      {/* Pricing */}
      <div className="py-24 bg-white">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="text-center">
            <h2 className="text-3xl font-extrabold text-gray-900">Planos Simples</h2>
          </div>
          <div className="mt-12 grid grid-cols-1 md:grid-cols-2 gap-8 max-w-4xl mx-auto">
            <PricingCard
              title="ENI / Self-Service"
              price="5"
              description="Para empresarios em nome individual que fazem a propria contabilidade."
              features={[
                '1 empresa',
                'Ate 50 faturas/mes',
                'OCR de faturas',
                'Assistente IA tributario',
                'Analise de risco basica',
              ]}
            />
            <PricingCard
              title="Contabilista"
              price="10"
              description="Por cliente gerido. Ferramentas completas para escritorios."
              features={[
                'Clientes ilimitados',
                'Faturas ilimitadas',
                'Reconciliacao bancaria',
                'Exportacao ERP (TOConline, Primavera, PHC)',
                'WhatsApp Bot',
                'RAG juridico completo',
              ]}
            />
          </div>
        </div>
      </div>

      {/* Footer */}
      <footer className="bg-gray-900 text-white py-12">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 text-center">
          <p className="text-gray-400">
            ContaSaaS - Automacao contabilistica para Portugal
          </p>
          <p className="text-sm text-gray-500 mt-2">
            Conforme GDPR. Dados processados em infraestrutura UE.
          </p>
        </div>
      </footer>
    </div>
  );
}

function FeatureCard({ title, description, icon }: { title: string; description: string; icon: string }) {
  return (
    <div className="bg-white rounded-lg shadow p-6">
      <div className="text-4xl mb-4">{icon}</div>
      <h3 className="text-lg font-semibold text-gray-900">{title}</h3>
      <p className="mt-2 text-sm text-gray-600">{description}</p>
    </div>
  );
}

function PricingCard({
  title,
  price,
  description,
  features,
}: {
  title: string;
  price: string;
  description: string;
  features: string[];
}) {
  return (
    <div className="bg-white rounded-lg shadow-lg border border-gray-200 p-8">
      <h3 className="text-xl font-semibold text-gray-900">{title}</h3>
      <p className="mt-2 text-gray-600">{description}</p>
      <div className="mt-4">
        <span className="text-4xl font-extrabold text-gray-900">{price} EUR</span>
        <span className="text-gray-500">/mes</span>
      </div>
      <ul className="mt-6 space-y-3">
        {features.map((feature) => (
          <li key={feature} className="flex items-center text-sm text-gray-600">
            <svg className="w-5 h-5 text-green-500 mr-2" fill="currentColor" viewBox="0 0 20 20">
              <path
                fillRule="evenodd"
                d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z"
                clipRule="evenodd"
              />
            </svg>
            {feature}
          </li>
        ))}
      </ul>
      <div className="mt-8">
        <Link
          href="/auth/signin"
          className="w-full flex items-center justify-center px-4 py-2 border border-transparent text-base font-medium rounded-md text-white bg-blue-600 hover:bg-blue-700"
        >
          Escolher Plano
        </Link>
      </div>
    </div>
  );
}
