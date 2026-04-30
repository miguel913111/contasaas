# ============================================================
# Script de Setup de Desenvolvimento
# ContaSaaS - SaaS Contabilistico
# ============================================================
# 
# Este script verifica o ambiente, cria a base de dados PostgreSQL,
# corre as migrations Prisma e popula com seed data.
#
# REQUISITOS:
#   1. PostgreSQL 16+ instalado (https://www.postgresql.org/download/windows/)
#   2. Node.js 22+ instalado
#   3. npm install ja corrido
#
# USO:
#   .\scripts\setup-dev.ps1
# ============================================================

$ErrorActionPreference = "Stop"

Write-Host "=============================================" -ForegroundColor Cyan
Write-Host "SETUP: ContaSaaS Development Environment" -ForegroundColor Cyan
Write-Host "=============================================" -ForegroundColor Cyan
Write-Host ""

# --- Verificar Node.js ---
Write-Host "[1/6] Verificando Node.js..." -ForegroundColor Yellow
try {
    $nodeVersion = node --version
    Write-Host "      OK: Node.js $nodeVersion" -ForegroundColor Green
} catch {
    Write-Host "      ERRO: Node.js nao encontrado." -ForegroundColor Red
    Write-Host "      Instale em: https://nodejs.org/" -ForegroundColor Red
    exit 1
}

# --- Verificar PostgreSQL ---
Write-Host "[2/6] Verificando PostgreSQL..." -ForegroundColor Yellow
$pgFound = $false
$pgPaths = @(
    "C:\Program Files\PostgreSQL\16\bin\psql.exe",
    "C:\Program Files\PostgreSQL\15\bin\psql.exe",
    "C:\Program Files\PostgreSQL\14\bin\psql.exe",
    "C:\Program Files (x86)\PostgreSQL\16\bin\psql.exe",
    "C:\PostgreSQL\16\bin\psql.exe"
)

$pgPath = $null
foreach ($path in $pgPaths) {
    if (Test-Path $path) {
        $pgFound = $true
        $pgPath = $path
        break
    }
}

if (-not $pgFound) {
    Write-Host "      ERRO: PostgreSQL nao encontrado!" -ForegroundColor Red
    Write-Host ""
    Write-Host "      =============================================" -ForegroundColor Red
    Write-Host "      COMO INSTALAR POSTGRESQL 16 (2 minutos):" -ForegroundColor Red
    Write-Host "      =============================================" -ForegroundColor Red
    Write-Host "      1. Va a: https://www.postgresql.org/download/windows/" -ForegroundColor White
    Write-Host "      2. Clique em 'Download the installer' (EnterpriseDB)" -ForegroundColor White
    Write-Host "      3. Execute o instalador PostgreSQL 16.x" -ForegroundColor White
    Write-Host "      4. Na instalacao, anote a password do usuario 'postgres'" -ForegroundColor White
    Write-Host "      5. Deixe a porta 5432 (default)" -ForegroundColor White
    Write-Host "      6. NAO precisa instalar Stack Builder" -ForegroundColor White
    Write-Host "      7. Volte a correr este script" -ForegroundColor White
    Write-Host ""
    Write-Host "      ALTERNATIVA: Use Docker Compose:" -ForegroundColor Yellow
    Write-Host "      docker-compose up -d db redis" -ForegroundColor Yellow
    Write-Host ""
    exit 1
}

Write-Host "      OK: PostgreSQL encontrado em $pgPath" -ForegroundColor Green

# --- Verificar .env ---
Write-Host "[3/6] Verificando .env..." -ForegroundColor Yellow
if (-not (Test-Path ".env")) {
    if (Test-Path ".env.example") {
        Copy-Item ".env.example" ".env"
        Write-Host "      AVISO: .env criado a partir de .env.example" -ForegroundColor Yellow
        Write-Host "      Edite .env e preencha as credenciais antes de continuar!" -ForegroundColor Yellow
    } else {
        Write-Host "      ERRO: Nem .env nem .env.example encontrados" -ForegroundColor Red
        exit 1
    }
}
Write-Host "      OK: .env existe" -ForegroundColor Green

# --- Verificar node_modules ---
Write-Host "[4/6] Verificando dependencias..." -ForegroundColor Yellow
if (-not (Test-Path "node_modules")) {
    Write-Host "      Instalando dependencias npm..." -ForegroundColor Yellow
    npm install
}
Write-Host "      OK: node_modules existe" -ForegroundColor Green

# --- Criar base de dados (se nao existir) ---
Write-Host "[5/6] Criando base de dados..." -ForegroundColor Yellow

# Extrai credenciais do DATABASE_URL do .env
$envContent = Get-Content ".env" -Raw
if ($envContent -match 'DATABASE_URL="([^"]+)"') {
    $dbUrl = $Matches[1]
    Write-Host "      URL: $dbUrl" -ForegroundColor Gray
} else {
    Write-Host "      ERRO: DATABASE_URL nao encontrado no .env" -ForegroundColor Red
    exit 1
}

# Tenta conectar e criar DB
$pgBinDir = Split-Path $pgPath -Parent
try {
    $env:PGPASSWORD = "postgres"
    & "$pgBinDir\psql.exe" -U postgres -c "SELECT 1;" -q 2>$null
    Write-Host "      OK: Conexao a PostgreSQL bem-sucedida" -ForegroundColor Green
} catch {
    Write-Host "      AVISO: Nao foi possivel conectar com usuario 'postgres' / password 'postgres'" -ForegroundColor Yellow
    Write-Host "      Se a password for diferente, crie a base de dados manualmente:" -ForegroundColor Yellow
    Write-Host "      CREATE DATABASE saas_contabilistico;" -ForegroundColor White
}

try {
    $env:PGPASSWORD = "postgres"
    & "$pgBinDir\createdb.exe" -U postgres -E UTF8 saas_contabilistico 2>$null
    Write-Host "      OK: Base de dados 'saas_contabilistico' criada (ou ja existia)" -ForegroundColor Green
} catch {
    Write-Host "      AVISO: Base de dados pode ja existir. Continuando..." -ForegroundColor Yellow
}

# --- Prisma Migrate + Seed ---
Write-Host "[6/6] Correndo Prisma Migrate e Seed..." -ForegroundColor Yellow

try {
    npx prisma migrate dev --name init
    Write-Host "      OK: Migrations aplicadas" -ForegroundColor Green
} catch {
    Write-Host "      ERRO ao correr migrations. Tentando prisma db push..." -ForegroundColor Yellow
    npx prisma db push
}

try {
    npx prisma db seed
    Write-Host "      OK: Seed data inserida" -ForegroundColor Green
} catch {
    Write-Host "      AVISO: Seed falhou (pode ser normal se ja tiver dados)" -ForegroundColor Yellow
}

Write-Host ""
Write-Host "=============================================" -ForegroundColor Cyan
Write-Host "SETUP CONCLUIDO!" -ForegroundColor Green
Write-Host "=============================================" -ForegroundColor Cyan
Write-Host ""
Write-Host "Proximos passos:" -ForegroundColor White
Write-Host "  1. npm run dev          # Iniciar servidor Next.js"
Write-Host "  2. npx prisma studio    # Abrir Prisma Studio (GUI da DB)"
Write-Host ""
Write-Host "URLs:" -ForegroundColor White
Write-Host "  App:      http://localhost:3000"
Write-Host "  Studio:   http://localhost:5555"
Write-Host ""
