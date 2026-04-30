# ContaSaaS

Plataforma SaaS para automacao documental de escritorios de contabilidade e empresarios em nome individual (ENI) em Portugal.

## Stack Tecnologico

- **Frontend/Backend**: Next.js 14 (App Router), TypeScript, Tailwind CSS
- **Base de Dados**: PostgreSQL + Prisma ORM + pgvector
- **IA**: Gemini 3.0 Flash (OCR + RAG) - Free tier
- **Auth**: NextAuth.js com Google OAuth + RBAC Dual Portal
- **Filas**: BullMQ + Redis (processamento assincrono)
- **WhatsApp**: Meta Business API (webhooks + templates)

## Dual Portal

| Portal | Publico | Funcionalidades |
|---|---|---|
| **Contabilista** | Escritorios de contabilidade | OCR, RAG, Reconciliacao bancaria, Exportacao ERP, WhatsApp Bot |
| **Self-Service** | ENIs | OCR simplificado, RAG basico, Lancamento de faturas, Analise de risco |

## Modulos

- `src/modules/ocr_extraction` - Motor OCR hibrido (pdf-parse + Gemini Vision)
- `src/modules/accounting_logic` - Heuristicas SNC + Artigo 21 CIVA
- `src/modules/bank_reconciliation` - Parser CAMT.053 + Knapsack subset matching
- `src/modules/whatsapp_bot` - Webhook handler + templates + janela 24h
- `src/modules/rag_tax_advisor` - Semantic search pgvector + Risk scanner
- `src/modules/erp_exporters` - TOConline, Primavera v10, PHC CS

## Configuracao

1. Copie `.env.example` para `.env` e preencha as variaveis
2. `npm install`
3. `npx prisma migrate dev`
4. `npx prisma db seed`
5. `npm run ingest:rag` (popular documentos tributarios)
6. `npm run dev`

## Comandos

```bash
npm run dev          # Desenvolvimento
npm run build        # Build de producao
npm run db:migrate   # Migracoes Prisma
npm run db:seed      # Dados de teste
npm run ingest:rag   # Ingestao de documentos tributarios
```

## Licenca

Proprietaria - Comercializacao sujeita a licenciamento.
