# Configuracao WhatsApp Business API (Meta)

## Requisitos

- Conta Meta Business: https://business.facebook.com
- App no Meta Developers: https://developers.facebook.com/apps

## Passo a Passo

### 1. Criar App
1. Va a https://developers.facebook.com/apps
2. Clique em **"Create App"**
3. Selecione **"Business"** tipo
4. Adicione produto **WhatsApp**

### 2. Configurar WhatsApp
1. No app, va a **WhatsApp > API Setup**
2. Copie:
   - **Phone Number ID** → `WHATSAPP_PHONE_NUMBER_ID`
   - **Access Token** (temporary) → `WHATSAPP_ACCESS_TOKEN`

### 3. Gerar Token Permanente
1. Va a https://business.facebook.com/settings/system-users
2. Crie um **System User**
3. Gere token com permissoes:
   - `whatsapp_business_messaging`
   - `whatsapp_business_management`
4. Copie token para `WHATSAPP_ACCESS_TOKEN`

### 4. Configurar Webhook
1. No app, va a **WhatsApp > Configuration**
2. Em **Webhook**, clique **Edit**
3. Callback URL: `https://seudominio.com/api/whatsapp/webhook`
4. Verify Token: gere uma string aleatoria → `WHATSAPP_WEBHOOK_VERIFY_TOKEN`
5. Subscreva eventos:
   - `messages`
   - `message_statuses`

### 5. App Secret
1. Va a **App Settings > Basic**
2. Copie **App Secret** → `WHATSAPP_APP_SECRET`

### 6. Preencher .env
```env
WHATSAPP_API_VERSION="v18.0"
WHATSAPP_BUSINESS_ACCOUNT_ID=""
WHATSAPP_PHONE_NUMBER_ID=""
WHATSAPP_ACCESS_TOKEN=""
WHATSAPP_WEBHOOK_VERIFY_TOKEN="sua-string-secreta-aqui"
WHATSAPP_APP_SECRET=""
```

### 7. Verificar
```bash
curl "https://graph.facebook.com/v18.0/{PHONE_NUMBER_ID}?access_token={ACCESS_TOKEN}"
```

## Teste Local (ngrok)

Para testar webhooks localmente:
```bash
npx ngrok http 3000
# Copie URL https://xxx.ngrok.io
# Configure no Meta Developers como webhook URL
```

## Templates Aprovados

Para enviar mensagens fora da janela de 24h, precisa de templates aprovados:
1. Va a https://business.facebook.com/wa/manage/message-templates/
2. Crie template tipo **Utility**
3. Exemplo: `missing_document_v2` com variaveis {{1}}, {{2}}
4. Aguarde aprovacao (minutos a horas)
