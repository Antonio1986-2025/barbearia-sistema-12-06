# 🚀 Deploy na Cloudflare - Passo a Passo

## ETAPA 1: Frontend → Cloudflare Pages

### 1️⃣ Commit das alterações

```bash
cd "c:\Users\Admin\Downloads\KIRO PROJETOS\barbearia-kiro\barbearia-sistema\barbearia-status-main"
git add vite.config.ts public/_redirects wrangler.toml CLOUDFLARE_DEPLOY.md
git commit -m "feat: configura deploy para Cloudflare Pages"
git push origin main
```

### 2️⃣ No Dashboard da Cloudflare

1. Acesse https://dash.cloudflare.com
2. No menu lateral: **Workers & Pages**
3. Clique em **Create application** → aba **Pages** → **Connect to Git**
4. Autorize o GitHub e selecione o repositório `barbearia-sistema-12-06`
5. Clique em **Begin setup**

### 3️⃣ Configurações de Build

Preencha exatamente assim:

| Campo | Valor |
|-------|-------|
| **Project name** | `barbearia-status` |
| **Production branch** | `main` |
| **Framework preset** | None (deixar vazio) |
| **Build command** | `npm run build` |
| **Build output directory** | `dist` |
| **Root directory** | `/` (vazio) |

### 4️⃣ Environment Variables (Build & Runtime)

Clique em **Add variable** e adicione:

```
NODE_VERSION=22
CF_PAGES=1
VITE_SUPABASE_URL=https://cineibugpcuxvdkkwzau.supabase.co
VITE_SUPABASE_PUBLISHABLE_KEY=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImNpbmVpYnVncGN1eHZka2t3emF1Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3ODAxMTkxOTYsImV4cCI6MjA5NTY5NTE5Nn0._ioSagsnR3wppw6du1zxCvW_Nuy3v6VwIfvQtQ2jxpI
VITE_SUPABASE_ANON_KEY=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImNpbmVpYnVncGN1eHZka2t3emF1Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3ODAxMTkxOTYsImV4cCI6MjA5NTY5NTE5Nn0._ioSagsnR3wppw6du1zxCvW_Nuy3v6VwIfvQtQ2jxpI
```

### 5️⃣ Deploy

Clique em **Save and Deploy**.

A Cloudflare vai:
1. Clonar o repositório
2. Rodar `npm install`
3. Rodar `npm run build`
4. Publicar em `https://barbearia-status.pages.dev`

Tempo estimado: **2-3 minutos**.

### 6️⃣ Validação

Após deploy, abra a URL gerada (`https://barbearia-status.pages.dev`).

Deve carregar a tela de login do sistema. Se aparecer:
- ✅ Tela de login → SUCESSO
- ❌ Erro 500/404 → veja a aba "Functions" → "Logs" no Cloudflare

---

## ETAPA 2: AI Agent (depois)

Vamos fazer depois que o frontend estiver no ar.

## ETAPA 3: Evolution API (depois)

Vamos fazer depois.

---

## ⚠️ Observações

### Custos
- **Frontend** no Cloudflare Pages: **GRÁTIS** (até 500 builds/mês e 100GB de banda/mês)
- **AI Agent** (Etapa 2): **GRÁTIS** (até 100k requests/dia)
- **Evolution API** (Etapa 3): R$15-25/mês (VPS pequena)

### Por que não dá pra rodar Evolution API na Cloudflare?
- Workers/Pages são serverless (sem servidor persistente)
- Evolution API mantém WebSocket ativo 24/7 com WhatsApp
- Precisa de uma VPS com Node/Docker rodando continuamente
