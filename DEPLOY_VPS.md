# 🚀 Deploy VPS - Barbearia Status

## 📋 Visão Geral

Este guia completo mostra como fazer deploy do sistema na VPS, incluindo:
- ✅ Frontend (Vite/React)
- ✅ Agente de IA (Node.js)
- ✅ Nginx como proxy reverso
- ✅ PM2 para gerenciamento de processos
- ✅ HTTPS com Let's Encrypt
- ✅ Domínio personalizado

---

## 🖥️ Requisitos da VPS

### Especificações Mínimas:
- **CPU:** 1 core
- **RAM:** 2GB
- **Storage:** 20GB SSD
- **OS:** Ubuntu 22.04 LTS (recomendado)
- **Largura de banda:** Ilimitada

### Provedores Recomendados:
- **DigitalOcean** - Droplet básico ($6/mês)
- **Vultr** - Cloud Compute ($6/mês)
- **Linode** - Shared CPU ($5/mês)
- **Contabo** - VPS S ($4.99/mês)
- **Hetzner** - CX11 (€4.15/mês)

---

## 📝 Passo a Passo

### 1. Preparar VPS

#### 1.1. Conectar via SSH
```bash
ssh root@SEU_IP_VPS
```

#### 1.2. Atualizar Sistema
```bash
apt update && apt upgrade -y
```

#### 1.3. Criar Usuário (Segurança)
```bash
adduser barbearia
usermod -aG sudo barbearia
su - barbearia
```

#### 1.4. Configurar Firewall
```bash
sudo ufw allow OpenSSH
sudo ufw allow 80/tcp
sudo ufw allow 443/tcp
sudo ufw enable
```

---

### 2. Instalar Dependências

#### 2.1. Node.js 20.x
```bash
curl -fsSL https://deb.nodesource.com/setup_20.x | sudo -E bash -
sudo apt install -y nodejs
node --version  # Verificar: v20.x.x
npm --version   # Verificar: 10.x.x
```

#### 2.2. Nginx
```bash
sudo apt install -y nginx
sudo systemctl start nginx
sudo systemctl enable nginx
```

#### 2.3. PM2 (Process Manager)
```bash
sudo npm install -g pm2
pm2 startup systemd -u barbearia --hp /home/barbearia
```

#### 2.4. Git
```bash
sudo apt install -y git
```

#### 2.5. Certbot (SSL)
```bash
sudo apt install -y certbot python3-certbot-nginx
```

---

### 3. Fazer Deploy do Código

#### 3.1. Clonar Repositório
```bash
cd /home/barbearia
git clone https://github.com/SEU_USUARIO/barbearia-status.git
cd barbearia-status
```

**OU** se não tiver Git ainda, pode fazer upload via SCP:
```bash
# No seu PC Windows
scp -r "C:\Users\Admin\Downloads\KIRO PROJETOS\barbearia-kiro\barbearia-sistema\barbearia-status-main" barbearia@SEU_IP:/home/barbearia/
```

#### 3.2. Instalar Dependências
```bash
npm install
```

#### 3.3. Configurar Variáveis de Ambiente
```bash
nano .env
```

Cole as credenciais:
```env
# === SUPABASE ===
SUPABASE_URL="https://cineibugpcuxvdkkwzau.supabase.co"
VITE_SUPABASE_URL="https://cineibugpcuxvdkkwzau.supabase.co"
SUPABASE_PROJECT_ID="cineibugpcuxvdkkwzau"
VITE_SUPABASE_PROJECT_ID="cineibugpcuxvdkkwzau"
SUPABASE_PUBLISHABLE_KEY="eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImNpbmVpYnVncGN1eHZka2t3emF1Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3ODAxMTkxOTYsImV4cCI6MjA5NTY5NTE5Nn0._ioSagsnR3wppw6du1zxCvW_Nuy3v6VwIfvQtQ2jxpI"
VITE_SUPABASE_PUBLISHABLE_KEY="eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImNpbmVpYnVncGN1eHZka2t3emF1Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3ODAxMTkxOTYsImV4cCI6MjA5NTY5NTE5Nn0._ioSagsnR3wppw6du1zxCvW_Nuy3v6VwIfvQtQ2jxpI"
SUPABASE_SERVICE_ROLE_KEY="eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImNpbmVpYnVncGN1eHZka2t3emF1Iiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc4MDExOTE5NiwiZXhwIjoyMDk1Njk1MTk2fQ.BCOY8H1Rsq_1p1Kn0_F1C5FI-mzTPz_fuK-odjazZ1g"

# === OPENAI ===
OPENAI_API_KEY="sk-proj-SUA_OPENAI_KEY_AQUI"
OPENAI_MODEL="gpt-4o-mini"

# === EVOLUTION API ===
EVOLUTION_URL="https://robert-v2-evolution-api.5jysmf.easypanel.host"
EVOLUTION_API_KEY="C6FAA7B063F6-4857-BEDA-D93C4BA4AC3B"
EVOLUTION_INSTANCE="navalha"

# === SERVER ===
AI_PORT="3001"
PUBLIC_BOOKING_URL="https://SEU_DOMINIO.com/agendar"
WEBHOOK_SECRET="change-this-to-random-string-123456"
```

Salve: `Ctrl+X`, `Y`, `Enter`

#### 3.4. Build do Frontend
```bash
npm run build
```

Isso cria a pasta `dist/` com os arquivos estáticos.

---

### 4. Configurar PM2

#### 4.1. Criar Arquivo de Configuração PM2
```bash
nano ecosystem.config.js
```

Cole:
```javascript
module.exports = {
  apps: [
    {
      name: 'ai-agent',
      script: 'ai-server.js',
      env: {
        NODE_ENV: 'production',
        AI_PORT: 3001
      },
      instances: 1,
      autorestart: true,
      watch: false,
      max_memory_restart: '500M',
      error_file: './logs/ai-agent-error.log',
      out_file: './logs/ai-agent-out.log',
      log_date_format: 'YYYY-MM-DD HH:mm:ss Z'
    }
  ]
};
```

#### 4.2. Criar Pasta de Logs
```bash
mkdir logs
```

#### 4.3. Iniciar Agente com PM2
```bash
pm2 start ecosystem.config.js
pm2 save
pm2 startup
```

#### 4.4. Ver Status
```bash
pm2 status
pm2 logs ai-agent
```

---

### 5. Configurar Nginx

#### 5.1. Criar Configuração do Site
```bash
sudo nano /etc/nginx/sites-available/barbearia
```

Cole (substitua `SEU_DOMINIO.com`):
```nginx
# Frontend (React/Vite)
server {
    listen 80;
    server_name SEU_DOMINIO.com www.SEU_DOMINIO.com;

    root /home/barbearia/barbearia-status/dist/client;
    index index.html;

    # Logs
    access_log /var/log/nginx/barbearia-access.log;
    error_log /var/log/nginx/barbearia-error.log;

    # Frontend (SPA)
    location / {
        try_files $uri $uri/ /index.html;
    }

    # Assets estáticos
    location ~* \.(js|css|png|jpg|jpeg|gif|svg|ico|woff|woff2|ttf|eot)$ {
        expires 1y;
        add_header Cache-Control "public, immutable";
    }

    # Webhook do Agente de IA
    location /webhook {
        proxy_pass http://localhost:3001;
        proxy_http_version 1.1;
        proxy_set_header Upgrade $http_upgrade;
        proxy_set_header Connection 'upgrade';
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;
        proxy_cache_bypass $http_upgrade;
    }

    # Health check do agente
    location /health {
        proxy_pass http://localhost:3001;
        proxy_set_header Host $host;
    }

    # Security headers
    add_header X-Frame-Options "SAMEORIGIN" always;
    add_header X-Content-Type-Options "nosniff" always;
    add_header X-XSS-Protection "1; mode=block" always;

    # Gzip compression
    gzip on;
    gzip_vary on;
    gzip_min_length 1024;
    gzip_types text/plain text/css text/xml text/javascript application/x-javascript application/xml+rss application/json application/javascript;
}
```

#### 5.2. Habilitar Site
```bash
sudo ln -s /etc/nginx/sites-available/barbearia /etc/nginx/sites-enabled/
sudo rm /etc/nginx/sites-enabled/default  # Remove site padrão
```

#### 5.3. Testar Configuração
```bash
sudo nginx -t
```

Deve mostrar: `test is successful`

#### 5.4. Reiniciar Nginx
```bash
sudo systemctl reload nginx
```

---

### 6. Configurar SSL (HTTPS)

#### 6.1. Obter Certificado Let's Encrypt
```bash
sudo certbot --nginx -d SEU_DOMINIO.com -d www.SEU_DOMINIO.com
```

Siga as instruções:
- Email: Seu email
- Termos: Aceitar (Y)
- Compartilhar email: Opcional (N)
- Redirect HTTP → HTTPS: Sim (2)

#### 6.2. Renovação Automática
```bash
sudo certbot renew --dry-run
```

O Certbot cria um cron job automático para renovação.

---

### 7. Configurar Webhook na Evolution API

Agora que temos HTTPS, configure o webhook:

```bash
curl -X POST https://robert-v2-evolution-api.5jysmf.easypanel.host/webhook/set/navalha \
  -H "apikey: C6FAA7B063F6-4857-BEDA-D93C4BA4AC3B" \
  -H "Content-Type: application/json" \
  -d '{
    "url": "https://SEU_DOMINIO.com/webhook",
    "webhook_by_events": false,
    "webhook_base64": false,
    "events": ["MESSAGES_UPSERT"]
  }'
```

Verifique:
```bash
curl -X GET https://robert-v2-evolution-api.5jysmf.easypanel.host/webhook/find/navalha \
  -H "apikey: C6FAA7B063F6-4857-BEDA-D93C4BA4AC3B"
```

---

## ✅ Verificações Finais

### 1. Testar Frontend
```bash
curl -I https://SEU_DOMINIO.com
```
Deve retornar `200 OK`

### 2. Testar Agente
```bash
curl https://SEU_DOMINIO.com/health
```
Deve retornar JSON com status

### 3. Testar WhatsApp
Envie mensagem para o número conectado na Evolution:
```
"Oi, quero agendar"
```

### 4. Ver Logs
```bash
# Logs do agente
pm2 logs ai-agent

# Logs do Nginx
sudo tail -f /var/log/nginx/barbearia-access.log
sudo tail -f /var/log/nginx/barbearia-error.log
```

---

## 🔧 Comandos Úteis

### PM2
```bash
pm2 status              # Ver status
pm2 restart ai-agent    # Reiniciar
pm2 stop ai-agent       # Parar
pm2 logs ai-agent       # Ver logs
pm2 monit               # Monitor em tempo real
```

### Nginx
```bash
sudo nginx -t                    # Testar config
sudo systemctl reload nginx      # Recarregar
sudo systemctl restart nginx     # Reiniciar
sudo systemctl status nginx      # Status
```

### Deploy de Atualização
```bash
cd /home/barbearia/barbearia-status
git pull                # Baixar código novo
npm install             # Instalar novas deps
npm run build           # Build frontend
pm2 restart ai-agent    # Reiniciar agente
```

---

## 🔒 Segurança Adicional

### 1. Configurar Fail2Ban (Proteção contra força bruta)
```bash
sudo apt install -y fail2ban
sudo systemctl enable fail2ban
sudo systemctl start fail2ban
```

### 2. Configurar SSH Key (Desabilitar senha)
```bash
# No seu PC, gerar chave
ssh-keygen -t ed25519 -C "seu-email@exemplo.com"

# Copiar para VPS
ssh-copy-id barbearia@SEU_IP

# Na VPS, desabilitar senha
sudo nano /etc/ssh/sshd_config
# Alterar: PasswordAuthentication no
sudo systemctl restart ssh
```

### 3. Atualizar WEBHOOK_SECRET
```bash
nano .env
# Altere WEBHOOK_SECRET para algo forte
pm2 restart ai-agent
```

---

## 📊 Monitoramento

### 1. Configurar PM2 Plus (Opcional)
```bash
pm2 link YOUR_SECRET_KEY YOUR_PUBLIC_KEY
```

### 2. Alertas por Email
Configure alertas no PM2 Plus ou use scripts customizados.

### 3. Backup Automático
```bash
# Criar script de backup
nano ~/backup.sh
```

```bash
#!/bin/bash
DATE=$(date +%Y%m%d_%H%M%S)
BACKUP_DIR="/home/barbearia/backups"
mkdir -p $BACKUP_DIR

# Backup do código
tar -czf $BACKUP_DIR/code_$DATE.tar.gz /home/barbearia/barbearia-status

# Manter apenas últimos 7 backups
find $BACKUP_DIR -name "code_*.tar.gz" -mtime +7 -delete

echo "Backup concluído: $DATE"
```

```bash
chmod +x ~/backup.sh

# Adicionar ao crontab (diário às 3h)
crontab -e
# Adicionar: 0 3 * * * /home/barbearia/backup.sh
```

---

## 🐛 Troubleshooting

### Agente não inicia
```bash
pm2 logs ai-agent --err
# Verificar erros no log
```

### Webhook não recebe mensagens
```bash
# 1. Testar diretamente
curl -X POST https://SEU_DOMINIO.com/webhook \
  -H "Content-Type: application/json" \
  -d '{"event":"test"}'

# 2. Ver logs do Nginx
sudo tail -f /var/log/nginx/barbearia-access.log

# 3. Verificar configuração Evolution
curl -X GET https://robert-v2-evolution-api.5jysmf.easypanel.host/webhook/find/navalha \
  -H "apikey: C6FAA7B063F6-4857-BEDA-D93C4BA4AC3B"
```

### Frontend não carrega
```bash
# Verificar build
ls -la /home/barbearia/barbearia-status/dist/client

# Rebuild se necessário
npm run build

# Verificar permissões
sudo chown -R www-data:www-data /home/barbearia/barbearia-status/dist
```

### SSL não funciona
```bash
# Renovar certificado
sudo certbot renew --force-renewal

# Verificar configuração
sudo nginx -t
sudo systemctl reload nginx
```

---

## 📈 Próximos Passos

- [ ] Configurar backup automático do Supabase
- [ ] Implementar CI/CD com GitHub Actions
- [ ] Configurar monitoramento (Uptime Robot, StatusCake)
- [ ] Adicionar analytics (Google Analytics, Plausible)
- [ ] Implementar cache com Redis
- [ ] Configurar CDN (Cloudflare)

---

## 🎉 Deploy Concluído!

Seu sistema está rodando em:
- 🌐 Frontend: `https://SEU_DOMINIO.com`
- 🤖 Agente IA: `https://SEU_DOMINIO.com/webhook`
- 🏥 Health Check: `https://SEU_DOMINIO.com/health`

**Parabéns! Sistema em produção! 🚀**
