# ============================================================
# Verificacao de APIs externas
# ============================================================

Write-Host "=== Verificacao de APIs Externas ===" -ForegroundColor Cyan

# --- Google OAuth ---
Write-Host "`n[1/3] Google OAuth" -ForegroundColor Yellow
$googleClientId = (Select-String -Path ".env" -Pattern 'GOOGLE_CLIENT_ID="([^"]+)"').Matches.Groups[1].Value
$googleSecret = (Select-String -Path ".env" -Pattern 'GOOGLE_CLIENT_SECRET="([^"]+)"').Matches.Groups[1].Value

if ($googleClientId -and $googleSecret) {
    Write-Host "   ✅ Configurado (Client ID presente)" -ForegroundColor Green
} else {
    Write-Host "   ❌ NAO configurado" -ForegroundColor Red
    Write-Host "   Como configurar:" -ForegroundColor White
    Write-Host "   1. Va a https://console.cloud.google.com/apis/credentials" -ForegroundColor Gray
    Write-Host "   2. Crie um OAuth 2.0 Client ID (Web application)" -ForegroundColor Gray
    Write-Host "   3. Adicione Authorized redirect URI: http://localhost:3000/api/auth/callback/google" -ForegroundColor Gray
    Write-Host "   4. Copie Client ID e Client Secret para o .env" -ForegroundColor Gray
}

# --- Gemini API ---
Write-Host "`n[2/3] Gemini API (Google AI)" -ForegroundColor Yellow
$geminiKey = (Select-String -Path ".env" -Pattern 'GEMINI_API_KEY="([^"]+)"').Matches.Groups[1].Value

if ($geminiKey) {
    Write-Host "   ✅ Configurado" -ForegroundColor Green
} else {
    Write-Host "   ❌ NAO configurado" -ForegroundColor Red
    Write-Host "   Como configurar:" -ForegroundColor White
    Write-Host "   1. Va a https://aistudio.google.com/app/apikey" -ForegroundColor Gray
    Write-Host "   2. Clique em " -NoNewline; Write-Host "'Create API key'" -ForegroundColor Cyan
    Write-Host "   3. Copie a chave para o .env (GEMINI_API_KEY)" -ForegroundColor Gray
    Write-Host "   Nota: Free tier ate 1.5B tokens/mes" -ForegroundColor DarkGray
}

# --- Meta WhatsApp ---
Write-Host "`n[3/3] Meta WhatsApp Business API" -ForegroundColor Yellow
$waToken = (Select-String -Path ".env" -Pattern 'WHATSAPP_ACCESS_TOKEN="([^"]+)"').Matches.Groups[1].Value
$waPhoneId = (Select-String -Path ".env" -Pattern 'WHATSAPP_PHONE_NUMBER_ID="([^"]+)"').Matches.Groups[1].Value

if ($waToken -and $waPhoneId) {
    Write-Host "   ✅ Configurado" -ForegroundColor Green
} else {
    Write-Host "   ❌ NAO configurado (opcional)" -ForegroundColor Yellow
    Write-Host "   Como configurar:" -ForegroundColor White
    Write-Host "   1. Va a https://developers.facebook.com/apps" -ForegroundColor Gray
    Write-Host "   2. Crie app > Tipo: Business > WhatsApp" -ForegroundColor Gray
    Write-Host "   3. Adicione produto WhatsApp" -ForegroundColor Gray
    Write-Host "   4. Copie Phone Number ID e Access Token para o .env" -ForegroundColor Gray
    Write-Host "   5. Configure webhook: {APP_URL}/api/whatsapp/webhook" -ForegroundColor Gray
}

Write-Host "`n=== Concluido ===" -ForegroundColor Cyan
