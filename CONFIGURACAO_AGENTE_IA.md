# 🤖 Configuração do Agente de IA para WhatsApp

## 📋 Visão Geral

O agente de IA da Barbearia Status permite que clientes façam agendamentos via WhatsApp de forma totalmente conversacional. O agente:

- ✅ Conversa naturalmente em português
- ✅ Guia o cliente pelo processo de agendamento
- ✅ Mostra barbeiros, serviços e horários disponíveis
- ✅ Confirma dados antes de finalizar
- ✅ Cria agendamento automaticamente no sistema
- ✅ **Não duplica clientes** (usa o mesmo sistema UPSERT)

---

## 🛠️ Pré-requisitos

### 1. OpenAI API Key
1. Acesse https://platform.openai.com/api-keys
2. Crie uma nova API Key
3. Copie e adicione no `.env`: `OPENAI_API_KEY`

### 2. Evolution API
A Evolution API é um gerenciador de WhatsApp Multi-Device.

**Opções de instalação:**
- **Self-hosted**: https://github.com/EvolutionAPI/evolution-api
- **Cloud (recomendado)**: Contratar servidor gerenciado

**Credenciais necessárias:**
- `EVOLUTION_URL`: URL da sua Evolution API
- `EVOLUTION_API_KEY`: API Key global
- `EVOLUTION_INSTANCE`: Nome da instância do WhatsApp

---

## ⚙️ Configuração

### 1. Atualizar `.env`

Adicione as seguintes variáveis:

```env
# === AGENTE DE IA (WHATSAPP) ===
OPENAI_API_KEY="sk-proj-..."
OPENAI_MODEL="gpt-4o-mini"

EVOLUTION_URL="https://sua-evolution-api.com"
EVOLUTION_API_KEY="sua-api-key"
EVOLUTION_INSTANCE="navalha"

AI_PORT="3001"
WEBHOOK_SECRET="secret-aleatorio-forte"
```

### 2. Criar Instância na Evolution API

**Via API:**
```bash
curl -X POST https://sua-evolution-api.com/instance/create \
  -H "apikey: SUA_API_KEY" \
  -H "Content-Type: application/json" \
  -d '{
    "instanceName": "navalha",
    "qrcode": true,
    "integration": "WHATSAPP-BAILEYS"
  }'
```

**Conectar WhatsApp:**
1. Escaneie o QR Code que aparecerá
2. Aguarde conexão
3. Verifique status: `GET /instance/connectionState/navalha`

### 3. Configurar Webhook na Evolution API

**Configurar webhook para receber mensagens:**
```bash
curl -X POST https://sua-evolution-api.com/webhook/set/navalha \
  -H "apikey: SUA_API_KEY" \
  -H "Content-Type: application/json" \
  -d '{
    "url": "http://SEU_SERVIDOR:3001/webhook",
    "webhook_by_events": false,
    "webhook_base64": false,
    "events": [
      "MESSAGES_UPSERT"
    ]
  }'
```

**⚠️ Importante:**
- Se estiver testando localmente, use um serviço como [ngrok](https://ngrok.com) para expor localhost
- Em produção, use o domínio/IP público do servidor

---

## 🚀 Como Usar

### Iniciar o Agente

**Opção 1: Apenas o agente**
```bash
npm run ai-agent
```

**Opção 2: Sistema completo + agente**
```bash
npm run dev:all
```

### Verificar Status

```bash
curl http://localhost:3001/health
```

Resposta esperada:
```json
{
  "status": "ok",
  "conversations": 0,
  "timestamp": "2026-06-12T..."
}
```

---

## 📱 Fluxo de Conversa

### Exemplo de Interação:

```
Cliente: Oi
Agente: Olá! Seja bem-vindo à Barbearia Status! 😊
        Para começar, qual é o seu nome completo?

Cliente: João Silva
Agente: Prazer, João! O corte é para você mesmo?

Cliente: Sim
Agente: Perfeito! Temos os seguintes barbeiros disponíveis:
        1. JUNIO (Barbeiro Master)
        2. DIOGO (Barbeiro Profissional)
        Qual você prefere?

Cliente: 1
Agente: Ótima escolha! JUNIO é excelente! ✂️
        Agora, qual serviço você deseja?
        1. Corte - 30min - R$ 50,00
        2. Barba - 30min - R$ 45,00
        3. Corte + Barba - 60min - R$ 90,00

Cliente: 3
Agente: Show! Corte + Barba com JUNIO.
        Qual data você prefere? (ex: amanhã, sexta, 15/06)

Cliente: amanhã
Agente: Perfeito! Horários disponíveis para amanhã:
        1. 09:00  2. 09:30  3. 10:00
        4. 10:30  5. 11:00  6. 14:00
        Qual horário?

Cliente: 10:00
Agente: Confirma os dados? ✅
        • João Silva
        • Amanhã, 13 de junho
        • 10:00
        • Corte + Barba
        • Com JUNIO
        • R$ 90,00
        
        Tudo certo?

Cliente: Sim
Agente: ✅ *Agendamento confirmado!*

        Seu horário está garantido! 🎉

        📋 *Detalhes:*
        • quinta-feira, 13 de junho
        • Horário: 10:00
        • Serviço: Corte + Barba
        • Profissional: JUNIO
        • Valor: R$ 90,00

        🔔 Você receberá um lembrete 30 minutos antes.

        📍 *Barbearia Status*
        Coxim, MS

        Até lá! ✂️
```

---

## 🔧 Arquitetura

```
┌─────────────┐         ┌──────────────┐         ┌─────────────┐
│  Cliente    │────────▶│  Evolution   │────────▶│  AI Server  │
│ (WhatsApp)  │◀────────│     API      │◀────────│ (webhook)   │
└─────────────┘         └──────────────┘         └─────────────┘
                                                          │
                                                          ▼
                        ┌──────────────┐         ┌─────────────┐
                        │   Supabase   │◀────────│   OpenAI    │
                        │  (Database)  │         │    GPT-4    │
                        └──────────────┘         └─────────────┘
```

**Fluxo:**
1. Cliente envia mensagem no WhatsApp
2. Evolution API recebe e envia para webhook
3. AI Server processa com OpenAI
4. OpenAI gera resposta conversacional
5. AI Server busca dados do Supabase (barbeiros, horários, etc)
6. Resposta é enviada de volta pelo Evolution
7. Quando completo, cria agendamento no Supabase

---

## 🧪 Testando

### 1. Teste Local (via ngrok)

```bash
# Terminal 1: Inicie o ngrok
ngrok http 3001

# Terminal 2: Inicie o agente
npm run ai-agent

# Configure o webhook na Evolution com a URL do ngrok
```

### 2. Teste de Mensagem

Envie uma mensagem para o número do WhatsApp conectado na Evolution API:

```
"Oi, quero agendar um corte"
```

### 3. Ver Logs

O agente mostra logs no console:
```
📱 [5567999999999]: Oi, quero agendar um corte
✅ Mensagem enviada para 5567999999999
```

---

## 🐛 Troubleshooting

### Agente não responde

**1. Verificar se o servidor está rodando:**
```bash
curl http://localhost:3001/health
```

**2. Verificar conexão WhatsApp na Evolution:**
```bash
curl https://sua-evolution-api.com/instance/connectionState/navalha \
  -H "apikey: SUA_API_KEY"
```

**3. Verificar webhook configurado:**
```bash
curl https://sua-evolution-api.com/webhook/find/navalha \
  -H "apikey: SUA_API_KEY"
```

### Mensagens não chegam no webhook

- ✅ Verificar se o webhook URL está acessível publicamente
- ✅ Testar com `curl` manualmente
- ✅ Verificar logs da Evolution API
- ✅ Confirmar que a instância está conectada

### Erros do OpenAI

- ✅ Verificar saldo da conta OpenAI
- ✅ Confirmar API Key válida
- ✅ Verificar rate limits

### Agendamento não é criado

- ✅ Verificar credenciais Supabase no `.env`
- ✅ Conferir se profissionais e serviços estão ativos
- ✅ Ver logs do console para erros específicos

---

## 📊 Monitoramento

### Conversas Ativas

```bash
curl http://localhost:3001/health
```

Retorna número de conversas em andamento.

### Logs

O agente registra no console:
- 📱 Mensagens recebidas
- ✅ Mensagens enviadas  
- 🎉 Agendamentos criados
- ❌ Erros

---

## 🔒 Segurança

### Boas Práticas:

1. **Nunca exponha** suas API Keys
2. **Use WEBHOOK_SECRET** para validar requisições
3. **HTTPS** obrigatório em produção
4. **Rate limiting** na Evolution API
5. **Backup** regular das conversas (se necessário)

### Exemplo de validação de webhook:

```javascript
if (req.headers['x-webhook-secret'] !== process.env.WEBHOOK_SECRET) {
  return res.status(401).json({ error: 'Unauthorized' });
}
```

---

## 📈 Próximos Passos

- [ ] Adicionar suporte a áudio/voz
- [ ] Integrar com sistemas de pagamento
- [ ] Dashboard de métricas do agente
- [ ] Respostas automáticas para horários fechados
- [ ] Remarketing para clientes inativos
- [ ] Avaliação pós-atendimento

---

## 📚 Recursos

- [Evolution API Docs](https://doc.evolution-api.com/)
- [OpenAI API Reference](https://platform.openai.com/docs/api-reference)
- [Supabase Docs](https://supabase.com/docs)

---

✅ **Agente pronto para uso!**

Se tiver dúvidas, consulte os logs ou entre em contato com o suporte técnico.
