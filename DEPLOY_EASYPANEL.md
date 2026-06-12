# 🚀 Deploy no Easypanel - Barbearia Status

## 📋 O que é o Easypanel?

Easypanel é uma interface visual para gerenciar aplicações Docker em VPS. É como um Vercel/Heroku para seu próprio servidor.

**Vantagens:**
- ✅ Interface visual (sem terminal!)
- ✅ Deploy automático via Git
- ✅ SSL automático (Let's Encrypt)
- ✅ Logs em tempo real
- ✅ Environment variables fáceis
- ✅ Restart automático se cair

---

## 🎯 Arquitetura no Easypanel

Vamos criar **2 aplicações**:

1. **Frontend (Vite/React)** - Porta 80/443
2. **AI Agent (Node.js)** - Porta 3001

---

## 📝 Passo a Passo Completo

### 1️⃣ Preparar Repositório Git (5 min)

#### 1.1. Criar Repositório no GitHub

1. Acesse: https://github.com/new
2. Nome: `barbearia-status`
3. Privado: ✅ Sim (recomendado)
4. Criar

#### 1.2. Subir Código

No seu PC (PowerShell):

```powershell
cd "C:\Users\Admin\Downloads\KIRO PROJETOS\barbearia-kiro\barbearia-sistema\barbearia-status-main"

# Inicializar Git
git init
git add .
git commit -m "Initial commit: Barbearia Status"

# Conectar com GitHub
git remote add origin https://github.com/SEU_USUARIO/barbearia-status.git
git branch -M main
git push -u origin main
```

**✅ Checkpoint:** Código deve aparecer no GitHub

---

### 2️⃣ Criar App do Frontend no Easypanel (10 min)

#### 2.1. Acessar Easypanel

1. Acesse: `https://SEU_PAINEL.easypanel.host`
2. Login com suas credenciais

#### 2.2. Criar Novo Projeto

1. Clique: **+ Create Project**
2. Nome: `barbearia-status`
3. Criar

#### 2.3. Adicionar Aplicação Frontend

1. Dentro do projeto, clique: **+ Add Service**
2. Escolha: **App**
3. Nome: `frontend`
4. Source: **GitHub**
5. Conecte sua conta GitHub (se não conectado)
6. Selecione repositório: `barbearia-status`
7. Branch: `main`

#### 2.4. Configurar Build do Frontend

**Build Settings:**
```yaml
Build Method: Nixpacks (ou Docker se preferir)
Build Command: npm run build
Start Command: deixe vazio (serve estático)
```

**OU use Dockerfile** (recomendado - vou criar um):

Crie arquivo `Dockerfile.frontend` no projeto:

```dockerfile
# Build stage
FROM node:20-alpine AS builder
WORKDIR /app
COPY package*.json ./
RUN npm ci
COPY . .
RUN npm run build

# Production stage
FROM nginx:alpine
COPY --from=builder /app/dist/client /usr/share/nginx/html
COPY nginx.conf /etc/nginx/conf.d/default.conf
EXPOSE 80
CMD ["nginx", "-g", "daemon off;"]
```

E `nginx.conf`:

```nginx
server {
    listen 80;
    server_name _;
    root /usr/share/nginx/html;
    index index.html;

    location / {
        try_files $uri $uri/ /index.html;
    }

    location ~* \.(js|css|png|jpg|jpeg|gif|svg|ico|woff|woff2|ttf|eot)$ {
        expires 1y;
        add_header Cache-Control "public, immutable";
    }

    gzip on;
    gzip_vary on;
    gzip_types text/plain text/css text/xml text/javascript application/javascript application/xml+rss application/json;
}
```

#### 2.5. Configurar Variáveis de Ambiente

No Easypanel, na aba **Environment**:

```env
VITE_SUPABASE_URL=https://cineibugpcuxvdkkwzau.supabase.co
VITE_SUPABASE_PUBLISHABLE_KEY=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImNpbmVpYnVncGN1eHZka2t3emF1Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3ODAxMTkxOTYsImV4cCI6MjA5NTY5NTE5Nn0._ioSagsnR3wppw6du1zxCvW_Nuy3v6VwIfvQtQ2jxpI
VITE_SUPABASE_PROJECT_ID=cineibugpcuxvdkkwzau
NODE_ENV=production
```

#### 2.6. Configurar Domínio

1. Aba **Domains**
2. **+ Add Domain**
3. Digite: `barbeariastatus.com.br` (seu domínio)
4. SSL: ✅ Enable (automático)
5. Salvar

#### 2.7. Deploy

1. Clique: **Deploy**
2. Aguarde build (2-5 min)
3. Verifique logs se der erro

**✅ Checkpoint:** Frontend acessível em `https://SEU_DOMINIO.com`

---

### 3️⃣ Criar App do AI Agent no Easypanel (10 min)

#### 3.1. Adicionar Nova Aplicação

1. No mesmo projeto `barbearia-status`
2. **+ Add Service** → **App**
3. Nome: `ai-agent`
4. Source: **Same as frontend** (mesmo repo)
5. Branch: `main`

#### 3.2. Configurar Build do AI Agent

**Criar `Dockerfile.aiagent`:**

```dockerfile
FROM node:20-alpine
WORKDIR /app

# Copiar package files
COPY package*.json ./
RUN npm ci --only=production

# Copiar código
COPY . .

# Expor porta
EXPOSE 3001

# Comando de start
CMD ["node", "ai-server.js"]
```

**No Easypanel:**
```yaml
Dockerfile: Dockerfile.aiagent
Port: 3001
```

#### 3.3. Configurar Variáveis de Ambiente

Aba **Environment**:

```env
NODE_ENV=production
AI_PORT=3001

# Supabase
SUPABASE_URL=https://cineibugpcuxvdkkwzau.supabase.co
SUPABASE_SERVICE_ROLE_KEY=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImNpbmVpYnVncGN1eHZka2t3emF1Iiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc4MDExOTE5NiwiZXhwIjoyMDk1Njk1MTk2fQ.BCOY8H1Rsq_1p1Kn0_F1C5FI-mzTPz_fuK-odjazZ1g

# OpenAI
OPENAI_API_KEY=sk-proj-SUA_OPENAI_KEY_AQUI
OPENAI_MODEL=gpt-4o-mini

# Evolution API
EVOLUTION_URL=https://robert-v2-evolution-api.5jysmf.easypanel.host
EVOLUTION_API_KEY=C6FAA7B063F6-4857-BEDA-D93C4BA4AC3B
EVOLUTION_INSTANCE=navalha

# Public URL
PUBLIC_BOOKING_URL=https://SEU_DOMINIO.com/agendar
WEBHOOK_SECRET=change-me-to-random-string-12345
```

#### 3.4. Configurar Rota do Webhook

**Opção A: Subdomínio separado**
- Domínio: `api.barbeariastatus.com.br`
- Webhook: `https://api.barbeariastatus.com.br/webhook`

**Opção B: Mesmo domínio (requer proxy)**
- Vou explicar depois

Por enquanto, use **Opção A** (mais fácil).

#### 3.5. Deploy

1. Clique: **Deploy**
2. Aguarde build
3. Verifique logs

**✅ Checkpoint:** AI Agent rodando em `https://api.SEU_DOMINIO.com`

---

### 4️⃣ Configurar Webhook na Evolution API (2 min)

```bash
curl -X POST https://robert-v2-evolution-api.5jysmf.easypanel.host/webhook/set/navalha \
  -H "apikey: C6FAA7B063F6-4857-BEDA-D93C4BA4AC3B" \
  -H "Content-Type: application/json" \
  -d '{
    "url": "https://api.SEU_DOMINIO.com/webhook",
    "webhook_by_events": false,
    "webhook_base64": false,
    "events": ["MESSAGES_UPSERT"]
  }'
```

---

### 5️⃣ Testar (5 min)

#### 5.1. Testar Frontend
```bash
curl -I https://SEU_DOMINIO.com
# Deve retornar: 200 OK
```

#### 5.2. Testar AI Agent
```bash
curl https://api.SEU_DOMINIO.com/health
# Deve retornar: {"status":"ok",...}
```

#### 5.3. Testar WhatsApp
- Envie: "Oi, quero agendar"
- Deve receber resposta

---

## 📊 Monitoramento no Easypanel

### Ver Logs:
1. Easypanel → Seu App
2. Aba **Logs**
3. Logs em tempo real

### Ver Métricas:
1. Aba **Metrics**
2. CPU, RAM, Network

### Restart:
1. Aba **General**
2. Botão **Restart**

---

## 🔄 Deploy Automático

### Configurar Auto Deploy:

1. Easypanel → App → **Settings**
2. **Auto Deploy:** ✅ Enable
3. **Trigger:** Push to `main`

Agora qualquer `git push` faz deploy automático! 🎉

---

## 🎯 Estrutura Final

```
Projeto: barbearia-status
├── App: frontend
│   ├── Domínio: barbeariastatus.com.br
│   ├── SSL: ✅ Automático
│   ├── Port: 80/443
│   └── Status: 🟢 Running
│
└── App: ai-agent
    ├── Domínio: api.barbeariastatus.com.br
    ├── SSL: ✅ Automático
    ├── Port: 3001
    ├── Webhook: /webhook
    └── Status: 🟢 Running
```

---

## 🔧 Troubleshooting

### Build falha:

1. Ver logs no Easypanel
2. Verificar Dockerfile
3. Testar localmente: `docker build -f Dockerfile.frontend .`

### App não inicia:

1. Verificar variáveis de ambiente
2. Verificar logs de runtime
3. Verificar porta correta

### Webhook não funciona:

1. Testar: `curl -X POST https://api.SEU_DOMINIO.com/webhook`
2. Ver logs do ai-agent
3. Verificar configuração Evolution

---

## 💡 Dicas Easypanel

### Backup:
- Easypanel faz backup automático
- Pode restaurar versões anteriores

### Escalabilidade:
- Pode aumentar recursos (CPU/RAM) facilmente
- Pode criar múltiplas réplicas

### Logs:
- Ficam salvos por 7 dias
- Pode baixar logs

### Environment:
- Pode ter diferentes envs (staging, production)
- Variáveis secretas são criptografadas

---

## 📈 Próximos Passos

- [ ] Configurar domínio próprio
- [ ] Testar auto-deploy
- [ ] Configurar alertas (opcional)
- [ ] Backup adicional do Supabase

---

**✅ Sistema 24/7 no Easypanel configurado!** 🎉
