# ============================================================
# Verificacao de pgvector
# ============================================================
$pgPath = "C:\Program Files\PostgreSQL\18\bin\psql.exe"

if (-not (Test-Path $pgPath)) {
    Write-Host "❌ PostgreSQL 18 nao encontrado" -ForegroundColor Red
    exit 1
}

try {
    $env:PGPASSWORD = "postgres"
    $result = & $pgPath -U postgres -d saas_contabilistico -c "SELECT * FROM pg_extension WHERE extname = 'vector';" -t -A 2>$null
    
    if ($result) {
        Write-Host "✅ pgvector instalado e ativo" -ForegroundColor Green
    } else {
        Write-Host "⚠️  pgvector NAO instalado" -ForegroundColor Yellow
        Write-Host ""
        Write-Host "Para ativar pgvector, escolha uma opcao:" -ForegroundColor White
        Write-Host "  1. Docker (recomendado): docker-compose up -d db" -ForegroundColor Cyan
        Write-Host "  2. WSL2: sudo apt install postgresql-16-pgvector" -ForegroundColor Cyan
        Write-Host "  3. Windows: Compilar a partir do codigo fonte (complexo)" -ForegroundColor Cyan
        Write-Host ""
        Write-Host "Nota: Sem pgvector, o RAG funciona em memoria (fallback)." -ForegroundColor Gray
    }
} catch {
    Write-Host "❌ Erro ao verificar pgvector: $_" -ForegroundColor Red
}
