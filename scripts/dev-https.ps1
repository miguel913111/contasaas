# ============================================================
# Dev Server com HTTPS (localhost)
# Requer: certificados mkcert em .cert/
# ============================================================

$certPath = Join-Path $PSScriptRoot "..\.cert\cert.pem"
$keyPath = Join-Path $PSScriptRoot "..\.cert\key.pem"

if (-not (Test-Path $certPath) -or -not (Test-Path $keyPath)) {
    Write-Host "❌ Certificados nao encontrados em .cert/" -ForegroundColor Red
    Write-Host "   Corra primeiro: mkcert -install" -ForegroundColor Yellow
    Write-Host "   Depois: mkcert -key-file .cert/key.pem -cert-file .cert/cert.pem localhost 127.0.0.1 ::1" -ForegroundColor Yellow
    exit 1
}

Write-Host "🔒 A iniciar Next.js com HTTPS..." -ForegroundColor Cyan
Write-Host "   Certificado: $certPath" -ForegroundColor Gray
Write-Host "   Chave: $keyPath" -ForegroundColor Gray
Write-Host ""

$env:NODE_EXTRA_CA_CERTS = $certPath
$env:HTTPS = "true"
$env:SSL_CRT_FILE = $certPath
$env:SSL_KEY_FILE = $keyPath

& npx next dev --experimental-https
