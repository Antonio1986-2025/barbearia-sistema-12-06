# ⚡ Deploy Rápido - Easypanel Hostinger

## 🎯 Objetivo
Colocar seu sistema 24/7 no ar usando Easypanel que você já tem!

---

## ✅ Checklist Pré-Deploy

Você precisa ter:
- [x] VPS Hostinger com Easypanel instalado
- [ ] Acesso ao painel Easypanel
- [ ] Conta GitHub (para hospedar código)
- [ ] Domínio (opcional mas recomendado)

---

## 📋 Passo a Passo (30 min)

### PASSO 1: Subir Código pro GitHub (5 min)

No seu PC (PowerShell):

```powershell
# Entrar na pasta do projeto
cd "C:\Users\Admin\Downloads\KIRO PROJETOS\barbearia-kiro\barbearia-sistema\barbearia-status-main"

# Inicializar Git (se ainda não tiver)
git init
git add .
git commit -m "Deploy: Barbearia Status v1.0"

# Criar repositório no GitHub
# Vá em: https://github.com/new
# Nome: barbearia-status
# Privado: Sim
# Criar

# Conectar e enviar
git remote add origin https://github.com/SEU_USUARIO/barbearia-status.git
git branch -M main
git push -u origin main
```

**✅ Código no GitHub!**

---

### PASSO 2: Easypanel - Criar Projeto (2 min)

1. Acesse seu Easypanel: `https://seu-painel.easypanel.host`
2. Login
3. **+ New Project**
4. Nome: `barbearia`
5. Criar

---

### PASSO 3: Deploy do Frontend (10 min)

#### 3.1. Criar App Frontend

1. Dentro do projeto `barbearia`
2. **+ New Service** → **App**
3. Configurar:
   - **Name:** `frontend`
   - **Source:** GitHub
   - **Repository:** `barbearia-status`
   - **Branch:** `main`
   - **Build:** Dockerfile
   - **Dockerfile:** `Dockerfile.frontend`

#### 3.2. Environment Variables

Clique em **Environment** e adicione:

```
VITE_SUPABASE_URL=https://cineibugpcuxvdkkwzau.supabase.co
VITE_SUPABASE_PUBLISHABLE_KEY=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImNpbmVpYnVncGN1eHZka2t3emF1Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3ODAxMTkxOTYsImV4cCI6MjA5NTY5NTE5Nn0._ioSagsnR3wppw6du1zxCvW_Nuy3v6VwIfvQtQ2jxpI
VITE_SUPABASE_PROJECT_ID=cineibugpcuxvdkkwzau
NODE_ENV=production
```

#### 3.3. Domain

1. Aba **Domains**
2. **+ Add Domain**
3. Se tiver domínio: `barbeariastatus.com`
4. Se não tiver: Use o domínio gerado pelo Easypanel
5. **SSL:** ✅ Enable

#### 3.4. Deploy!

1. Botão **Deploy**
2. Aguarde 3-5 min
3. Ver logs se der erro

**✅ Frontend no ar!**

---

### PASSO 4: Deploy do AI Agent (10 min)

#### 4.1. Criar App AI Agent

1. Ainda no projeto `barbearia`
2. **+ New Service** → **App**
3. Configurar:
   - **Name:** `ai-agent`
   - **Source:** Same repository (barbearia-status)
   - **Branch:** `main`
   - **Build:** Dockerfile
   - **Dockerfile:** `Dockerfile.aiagent`
   - **Port:** `3001`

#### 4.2. Environment Variables

```
NODE_ENV=production
AI_PORT=3001

SUPABASE_URL=https://cineibugpcuxvdkkwzau.supabase.co
SUPABASE_SERVICE_ROLE_KEY=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImNpbmVpYnVncGN1eHZka2t3emF1Iiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc4MDExOTE5NiwiZXhwIjoyMDk1Njk1MTk2fQ.BCOY8H1Rsq_1p1Kn0_F1C5FI-mzTPz_fuK-odjazZ1g

OPENAI_API_KEY=sk-proj-SUA_OPENAI_KEY_AQUI
OPENAI_MODEL=gpt-4o-mini

EVOLUTION_URL=https://robert-v2-evolution-api.5jysmf.easypanel.host
EVOLUTION_API_KEY=C6FAA7B063F6-4857-BEDA-D93C4BA4AC3B
EVOLUTION_INSTANCE=navalha

PUBLIC_BOOKING_URL=https://SEU_DOMINIO_FRONTEND.com/agendar
WEBHOOK_SECRET=mude-para-algo-aleatorio-123abc
```

#### 4.3. Domain para API

1. Aba **Domains**
2. **+ Add Domain**
3. Opção 1: Subdomínio `api.barbeariastatus.com`
4. Opção 2: Use domínio gerado pelo Easypanel
5. **SSL:** ✅ Enable

#### 4.4. Deploy!

1. Botão **Deploy**
2. Aguarde 2-3 min
3. Ver logs

**✅ AI Agent no ar!**

---

### PASSO 5: Configurar Webhook Evolution (2 min)

No seu PC (PowerShell ou CMD):

```bash
curl -X POST https://robert-v2-evolution-api.5jysmf.easypanel.host/webhook/set/navalha -H "apikey: C6FAA7B063F6-4857-BEDA-D93C4BA4AC3B" -H "Content-Type: application/json" -d "{\"url\": \"https://SEU_DOMINIO_API/webhook\", \"webhook_by_events\": false, \"events\": [\"MESSAGES_UPSERT\"]}"
```

**Substitua:** `SEU_DOMINIO_API` pelo domínio do ai-agent

**✅ Webhook configurado!**

---

### PASSO 6: Testar Tudo (5 min)

#### 6.1. Testar Frontend
- Abra no navegador: `https://SEU_DOMINIO_FRONTEND`
- Deve carregar o sistema

#### 6.2. Testar AI Agent
```bash
curl https://SEU_DOMINIO_API/health
```
Deve retornar: `{"status":"ok",...}`

#### 6.3. Testar WhatsApp
- Envie mensagem: "Oi, quero agendar"
- Deve receber resposta do agente

**✅ TUDO FUNCIONANDO 24/7!** 🎉

---

## 📊 Monitoramento no Easypanel

### Ver se está rodando:
1. Easypanel → Projeto `barbearia`
2. Ver status dos 2 apps (🟢 verde = funcionando)

### Ver logs:
1. Clicar no app
2. Aba **Logs**
3. Logs em tempo real

### Reiniciar se precisar:
1. Aba **General**
2. Botão **Restart**

---

## 🔄 Deploy Automático

### Configurar:
1. App → **Settings**
2. **GitHub Auto Deploy:** ✅ Enable

Agora qualquer `git push` faz deploy automático!

---

## 🐛 Se Algo Der Errado

### Frontend não carrega:
1. Easypanel → frontend → **Logs**
2. Ver erro no build
3. Verificar Environment variables

### AI Agent não responde:
1. Easypanel → ai-agent → **Logs**
2. Ver erro de conexão
3. Testar: `curl https://SEU_DOMINIO_API/health`

### Webhook não funciona:
1. Ver logs do ai-agent
2. Verificar URL do webhook
3. Testar manualmente: `curl -X POST https://SEU_DOMINIO_API/webhook`

---

## 📝 Resumo do que você tem agora

```
✅ Frontend rodando 24/7 com SSL
✅ AI Agent rodando 24/7 com SSL
✅ Webhook configurado
✅ Auto deploy no git push
✅ Logs em tempo real
✅ Restart automático se cair
✅ Backup automático (Easypanel)
```

---

## 🎯 URLs Finais

- **Sistema Admin:** `https://SEU_DOMINIO_FRONTEND`
- **Agendamento Público:** `https://SEU_DOMINIO_FRONTEND/agendar`
- **AI Agent API:** `https://SEU_DOMINIO_API`
- **Health Check:** `https://SEU_DOMINIO_API/health`
- **Webhook:** `https://SEU_DOMINIO_API/webhook`

---

## 💡 Dicas Finais

1. **Domínio próprio é importante** - Configure DNS apontando para IP da VPS
2. **Backup já está ativo** - Easypanel faz backup automático
3. **Logs ficam 7 dias** - Baixe se precisar guardar mais tempo
4. **Recursos podem ser aumentados** - Se precisar mais CPU/RAM

---

## 🆘 Precisa de Ajuda?

1. Ver logs no Easypanel
2. Consultar `DEPLOY_EASYPANEL.md` (guia completo)
3. Testar health checks

---

**🚀 Sistema online 24/7! Parabéns!** 🎉

*Tempo total: ~30 minutos*
