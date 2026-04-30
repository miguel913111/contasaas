# Setup de Desenvolvimento - ContaSaaS

## Requisitos

- **Node.js** 22+ (LTS recomendado)
- **PostgreSQL** 16+ com extensao **pgvector**
- **Redis** 7+ (opcional para dev, obrigatorio para filas)
- **npm** 10+

## Opcao 1: Setup Automatico (Windows)

```powershell
# 1. Instale PostgreSQL 16:
#    https://www.postgresql.org/download/windows/
#    Anote a password do usuario 'postgres'

# 2. Clone o repo e entre na pasta

# 3. Instale dependencias
npm install

# 4. Configure .env (copie do exemplo)
copy .env.example .env
# Edite .env com a password do PostgreSQL

# 5. Corra o setup automatico
npm run db:setup
```

## Opcao 2: Docker Compose (Recomendado para Linux/Mac)

```bash
# 1. Suba os servicos
npm run docker:up
# ou: docker-compose up -d

# 2. Instale dependencias
npm install

# 3. Configure .env para Docker
cp .env.example .env
# Edite DATABASE_URL para usar 'db' em vez de 'localhost'
# DATABASE_URL="postgresql://postgres:postgres@db:5432/saas_contabilistico?schema=public"

# 4. Corra migrations e seed
npx prisma migrate dev
npx prisma db seed

# 5. Inicie a app
npm run dev
```

## Opcao 3: Setup Manual

```bash
# 1. Instale PostgreSQL 16 e crie a base de dados:
#    CREATE DATABASE saas_contabilistico;
#    CREATE EXTENSION IF NOT EXISTS vector;

# 2. Instale dependencias
npm install

# 3. Configure .env
#    DATABASE_URL="postgresql://user:pass@localhost:5432/saas_contabilistico?schema=public"
#    NEXTAUTH_SECRET="min-32-characters-secret-key"
#    GEMINI_API_KEY="sua-chave-do-gemini"

# 4. Corra Prisma
npx prisma generate
npx prisma migrate dev --name init
npx prisma db seed

# 5. Inicie
npm run dev
```

## Scripts Disponiveis

| Comando | Descricao |
|---------|-----------|
| `npm run dev` | Inicia servidor Next.js em dev mode |
| `npm run build` | Build de producao |
| `npm run db:studio` | Prisma Studio (GUI da base de dados) |
| `npm run db:migrate` | Cria/aplica migrations |
| `npm run db:push` | Sincroniza schema diretamente (sem migration files) |
| `npm run db:seed` | Popula DB com dados de teste |
| `npm run db:setup` | Setup automatico completo (Windows) |
| `npm run docker:up` | Sobe PostgreSQL + Redis via Docker |
| `npm run test:qr` | Corre testes do parser QR Code |
| `npm run ingest:rag` | Ingesta documentos RAG manualmente |

## Estrutura de Dados de Teste (Seed)

O seed cria automaticamente:
- 1 Contabilista: `contabilista@teste.pt`
- 1 ENI: `eni@teste.pt`
- 1 Empresa: `Construcoes Jose Ferreira, UNIPESSOAL LDA` (NIF: 123456789)

## Health Check

```bash
curl http://localhost:3000/api/health
```

## URLs Importantes

| URL | Descricao |
|-----|-----------|
| http://localhost:3000 | App |
| http://localhost:3000/api/health | Health check |
| http://localhost:5555 | Prisma Studio |

## Troubleshooting

### "PostgreSQL nao encontrado"
Instale PostgreSQL 16: https://www.postgresql.org/download/windows/

### "pgvector nao existe"
```sql
CREATE EXTENSION IF NOT EXISTS vector;
```

### "Redis connection refused"
Redis e opcional para desenvolvimento basico. As filas BullMQ funcionam em memoria se Redis nao estiver disponivel.

### "Prisma Client nao gerado"
```bash
npx prisma generate
```
