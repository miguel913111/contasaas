#!/bin/bash
# ============================================================
# Script de Setup de Desenvolvimento (Linux/Mac/Docker)
# ContaSaaS - SaaS Contabilistico
# ============================================================
#
# USO:
#   chmod +x scripts/setup-dev.sh
#   ./scripts/setup-dev.sh
# ============================================================

set -e

RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
CYAN='\033[0;36m'
WHITE='\033[1;37m'
NC='\033[0m' # No Color

echo -e "${CYAN}=============================================${NC}"
echo -e "${CYAN}SETUP: ContaSaaS Development Environment${NC}"
echo -e "${CYAN}=============================================${NC}"
echo ""

# --- Verificar Node.js ---
echo -e "${YELLOW}[1/6] Verificando Node.js...${NC}"
if command -v node &> /dev/null; then
    NODE_VERSION=$(node --version)
    echo -e "${GREEN}      OK: Node.js $NODE_VERSION${NC}"
else
    echo -e "${RED}      ERRO: Node.js nao encontrado.${NC}"
    echo -e "${RED}      Instale em: https://nodejs.org/${NC}"
    exit 1
fi

# --- Verificar PostgreSQL ---
echo -e "${YELLOW}[2/6] Verificando PostgreSQL...${NC}"
if command -v psql &> /dev/null; then
    PG_VERSION=$(psql --version | head -n1)
    echo -e "${GREEN}      OK: $PG_VERSION${NC}"
else
    echo -e "${RED}      ERRO: PostgreSQL (psql) nao encontrado!${NC}"
    echo ""
    echo -e "${RED}      =============================================${NC}"
    echo -e "${RED}      COMO INSTALAR POSTGRESQL 16:${NC}"
    echo -e "${RED}      =============================================${NC}"
    echo -e "${WHITE}      Ubuntu/Debian: sudo apt install postgresql-16 postgresql-contrib${NC}"
    echo -e "${WHITE}      macOS:         brew install postgresql@16${NC}"
    echo -e "${WHITE}      Docker:        docker-compose up -d db${NC}"
    echo ""
    exit 1
fi

# --- Verificar .env ---
echo -e "${YELLOW}[3/6] Verificando .env...${NC}"
if [ ! -f ".env" ]; then
    if [ -f ".env.example" ]; then
        cp .env.example .env
        echo -e "${YELLOW}      AVISO: .env criado a partir de .env.example${NC}"
        echo -e "${YELLOW}      Edite .env antes de continuar!${NC}"
    else
        echo -e "${RED}      ERRO: Nem .env nem .env.example encontrados${NC}"
        exit 1
    fi
fi
echo -e "${GREEN}      OK: .env existe${NC}"

# --- Verificar node_modules ---
echo -e "${YELLOW}[4/6] Verificando dependencias...${NC}"
if [ ! -d "node_modules" ]; then
    echo -e "${YELLOW}      Instalando dependencias npm...${NC}"
    npm install
fi
echo -e "${GREEN}      OK: node_modules existe${NC}"

# --- Criar base de dados ---
echo -e "${YELLOW}[5/6] Criando base de dados...${NC}"
DB_NAME="saas_contabilistico"

# Tenta criar DB (ignora erro se ja existir)
psql -U postgres -c "CREATE DATABASE $DB_NAME ENCODING 'UTF8';" 2>/dev/null || true
echo -e "${GREEN}      OK: Base de dados '$DB_NAME' pronta${NC}"

# --- Prisma Migrate + Seed ---
echo -e "${YELLOW}[6/6] Correndo Prisma Migrate e Seed...${NC}"

npx prisma migrate dev --name init || npx prisma db push
npx prisma db seed || true

echo -e "${GREEN}      OK: Migrations e Seed concluidos${NC}"

echo ""
echo -e "${CYAN}=============================================${NC}"
echo -e "${GREEN}SETUP CONCLUIDO!${NC}"
echo -e "${CYAN}=============================================${NC}"
echo ""
echo -e "${WHITE}Proximos passos:${NC}"
echo -e "${WHITE}  npm run dev          # Iniciar servidor${NC}"
echo -e "${WHITE}  npx prisma studio    # GUI da base de dados${NC}"
echo ""
