# ✅ Checklist de Deploy VPS - Guia Rápido

## 📋 Antes de Começar

Você vai precisar de:
- [ ] **VPS contratada** (DigitalOcean, Vultr, Linode, etc)
- [ ] **IP da VPS** anotado
- [ ] **Domínio configurado** apontando para o IP
- [ ] **Acesso SSH** (root ou sudo)
- [ ] **Credenciais** (.env completo)

---

## 🚀 Passo a Passo Simplificado

### 1. Preparar VPS (15 min)

```bash
# 1.1. Conectar
ssh root@SEU_IP_VPS

# 1.2. Atualizar sistema
apt update && apt upgrade -y

# 1.3. Criar usuário
adduser barbearia
usermod -aG sudo barbearia
su - barbearia

# 1.4. Firewall
sudo ufw allow OpenSSH
sudo ufw allow 80
sudo ufw allow 443
sudo ufw enable
```

**✅ Checkpoint:** Você deve estar logado como `barbearia`

---

### 2. Instalar Software (10 min)

```bash
# 2.1. Node.js
curl -fsSL https://deb.nodesource.com/setup_20.x | sudo -E bash -
sudo apt install -y nodejs
node --version  # Deve mostrar v20.x

# 2.2. PM2
sudo npm install -g pm2

# 2.3. Nginx
sudo apt install -y nginx

# 2.4. Certbot (SSL)
sudo apt install -y certbot python3-certbot-nginx

# 2.5. Git
sudo apt install -y git
```

**✅ Checkpoint:** Todos os comandos acima devem funcionar sem erro

---

### 3. Subir o Código (5 min)

**Opção A: Via Git (recomendado)**
```bash
cd /home/barbearia
git clone https://github.com/SEU_USUARIO/barbearia-status.git
cd barbearia-status
```

**Opção B: Via SCP (se não tiver Git)**

No seu PC Windows (PowerShell):
```powershell
scp -r "C:\Users\Admin\Downloads\KIRO PROJETOS\barbearia-kiro\barbearia-sistema\barbearia-status-main" barbearia@SEU_IP:/home/barbearia/barbearia-status
```

Depois na VPS:
```bash
cd /home/barbearia/barbearia-status
```

**✅ Checkpoint:** Arquivo `package.json` deve existir

---

### 4. Configurar Ambiente (5 min)

```bash
# 4.1. Criar .env
nano .env
```

Cole suas credenciais completas (do seu `.env` local), **MAS MUDE:**
```env
PUBLIC_BOOKING_URL="https://SEU_DOMINIO.com/agendar"
```

Salve: `Ctrl+X`, `Y`, `Enter`

```bash
# 4.2. Instalar dependências
npm install

# 4.3. Build
npm run build
```

**✅ Checkpoint:** Pasta `dist/client` deve existir

---

### 5. Iniciar Agente (2 min)

```bash
# 5.1. Criar configuração PM2
cat > ecosystem.config.js << 'EOF'
module.exports = {
  apps: [{
    name: 'ai-agent',
    script: 'ai-server.js',
    env: { NODE_ENV: 'production', AI_PORT: 3001 },
    instances: 1,
    autorestart: true,
    watch: false,
    max_memory_restart: '500M',
    error_file: './logs/ai-agent-error.log',
    out_file: './logs/ai-agent-out.log',
    log_date_format: 'YYYY-MM-DD HH:mm:ss Z'
  }]
};
EOF

# 5.2. Criar pasta logs
mkdir logs

# 5.3. Iniciar
pm2 start ecosystem.config.js
pm2 save
pm2 startup

# 5.4. Verificar
pm2 status
pm2 logs ai-agent --lines 20
```

**✅ Checkpoint:** Deve mostrar "Aguardando mensagens..." nos logs

---

### 6. Configurar Nginx (10 min)

```bash
# 6.1. Criar configuração
sudo nano /etc/nginx/sites-available/barbearia
```

Cole (substitua `SEU_DOMINIO.com`):
```nginx
server {
    listen 80;
    server_name SEU_DOMINIO.com www.SEU_DOMINIO.com;
    root /home/barbearia/barbearia-status/dist/client;
    index index.html;

    location / {
        try_files $uri $uri/ /index.html;
    }

    location /webhook {
        proxy_pass http://localhost:3001;
        proxy_http_version 1.1;
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
    }

    location /health {
        proxy_pass http://localhost:3001;
    }
}
```

Salve: `Ctrl+X`, `Y`, `Enter`

```bash
# 6.2. Ativar site
sudo ln -s /etc/nginx/sites-available/barbearia /etc/nginx/sites-enabled/
sudo rm /etc/nginx/sites-enabled/default

# 6.3. Testar
sudo nginx -t

# 6.4. Reiniciar
sudo systemctl reload nginx
```

**✅ Checkpoint:** `nginx -t` deve mostrar "test is successful"

---

### 7. Configurar SSL (5 min)

```bash
sudo certbot --nginx -d SEU_DOMINIO.com -d www.SEU_DOMINIO.com
```

Responda:
- Email: `seu-email@exemplo.com`
- Termos: `Y`
- Compartilhar email: `N`
- Redirect HTTPS: `2` (Sim)

**✅ Checkpoint:** Deve mostrar "Congratulations!"

---

### 8. Configurar Webhook Evolution (2 min)

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

**✅ Checkpoint:** Deve retornar JSON confirmando configuração

---

### 9. Testar Tudo (5 min)

```bash
# 9.1. Testar frontend
curl -I https://SEU_DOMINIO.com
# Deve retornar: HTTP/2 200

# 9.2. Testar health
curl https://SEU_DOMINIO.com/health
# Deve retornar: {"status":"ok",...}

# 9.3. Ver logs
pm2 logs ai-agent
```

**9.4. Testar WhatsApp**
- Envie mensagem: "Oi, quero agendar"
- Deve receber resposta do agente

**✅ Checkpoint:** Tudo funcionando!

---

## 🎉 Deploy Concluído!

### Seu sistema está rodando em:
- 🌐 **Frontend:** `https://SEU_DOMINIO.com`
- 📱 **Agendamento público:** `https://SEU_DOMINIO.com/agendar`
- 🤖 **Webhook:** `https://SEU_DOMINIO.com/webhook`
- 🏥 **Health check:** `https://SEU_DOMINIO.com/health`

---

## 📊 Comandos Úteis

```bash
# Ver status
pm2 status

# Ver logs em tempo real
pm2 logs ai-agent

# Reiniciar agente
pm2 restart ai-agent

# Reiniciar Nginx
sudo systemctl reload nginx

# Ver logs Nginx
sudo tail -f /var/log/nginx/barbearia-access.log

# Atualizar código (após git push)
cd /home/barbearia/barbearia-status
git pull
npm install
npm run build
pm2 restart ai-agent
```

---

## 🐛 Se Algo Der Errado

### Frontend não abre
```bash
# Verificar build
ls -la /home/barbearia/barbearia-status/dist/client

# Verificar Nginx
sudo nginx -t
sudo systemctl status nginx
```

### Agente não responde
```bash
# Ver logs
pm2 logs ai-agent --err

# Reiniciar
pm2 restart ai-agent

# Verificar porta
curl http://localhost:3001/health
```

### Webhook não funciona
```bash
# Testar localmente
curl -X POST https://SEU_DOMINIO.com/webhook \
  -H "Content-Type: application/json" \
  -d '{"event":"test"}'

# Ver logs
pm2 logs ai-agent
sudo tail -f /var/log/nginx/barbearia-error.log
```

---

## 📝 Notas Importantes

1. **Backup do .env**: Guarde suas credenciais em lugar seguro
2. **Atualizações**: Use `git pull` para atualizar código
3. **Monitoramento**: Configure alertas (Uptime Robot, etc)
4. **Backups**: Configure backup automático do banco
5. **Domínio**: DNS pode levar até 48h para propagar

---

## ⏱️ Tempo Total Estimado

- Preparação: 15 min
- Instalação: 10 min
- Upload código: 5 min
- Configuração: 5 min
- Nginx: 10 min
- SSL: 5 min
- Webhook: 2 min
- Testes: 5 min

**Total: ~1 hora** ⏰

---

## 🆘 Precisa de Ajuda?

Consulte a documentação completa em:
- `DEPLOY_VPS.md` - Guia detalhado
- `CONFIGURACAO_AGENTE_IA.md` - Configuração do agente
- `README_AGENTE_IA.md` - Como usar o agente

---

**✅ Pronto! Sistema em produção! 🚀🎉**
