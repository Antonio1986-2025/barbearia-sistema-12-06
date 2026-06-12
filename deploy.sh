#!/bin/bash

##############################################################################
# Script de Deploy Automático - Barbearia Status
# Uso: ./deploy.sh [opcao]
# Opções:
#   setup    - Primeira instalação (instala tudo)
#   update   - Atualizar código e reiniciar
#   restart  - Apenas reiniciar serviços
#   logs     - Ver logs do agente
##############################################################################

set -e  # Para se houver erro

# Cores para output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

# Variáveis
PROJECT_DIR="/home/barbearia/barbearia-status"
DOMAIN="SEU_DOMINIO.com"

# Funções auxiliares
print_header() {
    echo -e "\n${BLUE}━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━${NC}"
    echo -e "${BLUE}  $1${NC}"
    echo -e "${BLUE}━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━${NC}\n"
}

print_success() {
    echo -e "${GREEN}✅ $1${NC}"
}

print_error() {
    echo -e "${RED}❌ $1${NC}"
}

print_warning() {
    echo -e "${YELLOW}⚠️  $1${NC}"
}

print_info() {
    echo -e "${BLUE}ℹ️  $1${NC}"
}

# Verificar se está rodando como barbearia user
check_user() {
    if [ "$USER" != "barbearia" ]; then
        print_error "Execute este script como usuário 'barbearia'"
        exit 1
    fi
}

# Setup inicial
setup() {
    print_header "🚀 SETUP INICIAL - BARBEARIA STATUS"
    
    print_info "Instalando dependências do sistema..."
    
    # Node.js
    if ! command -v node &> /dev/null; then
        print_info "Instalando Node.js 20.x..."
        curl -fsSL https://deb.nodesource.com/setup_20.x | sudo -E bash -
        sudo apt install -y nodejs
        print_success "Node.js instalado: $(node --version)"
    else
        print_success "Node.js já instalado: $(node --version)"
    fi
    
    # PM2
    if ! command -v pm2 &> /dev/null; then
        print_info "Instalando PM2..."
        sudo npm install -g pm2
        pm2 startup systemd -u barbearia --hp /home/barbearia
        print_success "PM2 instalado"
    else
        print_success "PM2 já instalado"
    fi
    
    # Nginx
    if ! command -v nginx &> /dev/null; then
        print_info "Instalando Nginx..."
        sudo apt install -y nginx
        sudo systemctl enable nginx
        sudo systemctl start nginx
        print_success "Nginx instalado"
    else
        print_success "Nginx já instalado"
    fi
    
    # Certbot
    if ! command -v certbot &> /dev/null; then
        print_info "Instalando Certbot..."
        sudo apt install -y certbot python3-certbot-nginx
        print_success "Certbot instalado"
    else
        print_success "Certbot já instalado"
    fi
    
    # Firewall
    print_info "Configurando firewall..."
    sudo ufw allow OpenSSH
    sudo ufw allow 80/tcp
    sudo ufw allow 443/tcp
    sudo ufw --force enable
    print_success "Firewall configurado"
    
    print_header "📦 INSTALANDO PROJETO"
    
    cd $PROJECT_DIR
    
    # Instalar dependências
    print_info "Instalando dependências Node.js..."
    npm install
    print_success "Dependências instaladas"
    
    # Build
    print_info "Fazendo build do frontend..."
    npm run build
    print_success "Build concluído"
    
    # Criar pasta de logs
    mkdir -p logs
    
    # Criar ecosystem.config.js se não existir
    if [ ! -f "ecosystem.config.js" ]; then
        print_info "Criando configuração PM2..."
        cat > ecosystem.config.js << 'EOF'
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
EOF
        print_success "Configuração PM2 criada"
    fi
    
    # Iniciar agente
    print_info "Iniciando agente de IA..."
    pm2 start ecosystem.config.js
    pm2 save
    print_success "Agente iniciado"
    
    print_header "🌐 CONFIGURANDO NGINX"
    
    # Configurar Nginx
    print_warning "Configure o Nginx manualmente:"
    print_info "1. sudo nano /etc/nginx/sites-available/barbearia"
    print_info "2. Cole a configuração do DEPLOY_VPS.md"
    print_info "3. sudo ln -s /etc/nginx/sites-available/barbearia /etc/nginx/sites-enabled/"
    print_info "4. sudo nginx -t"
    print_info "5. sudo systemctl reload nginx"
    
    print_header "🔒 CONFIGURANDO SSL"
    
    print_warning "Configure o SSL manualmente:"
    print_info "sudo certbot --nginx -d $DOMAIN -d www.$DOMAIN"
    
    print_header "✅ SETUP CONCLUÍDO"
    
    print_success "Sistema instalado com sucesso!"
    print_info ""
    print_info "Próximos passos:"
    print_info "1. Configure o Nginx (veja acima)"
    print_info "2. Configure o SSL (veja acima)"
    print_info "3. Configure o webhook na Evolution API"
    print_info ""
    print_info "Comandos úteis:"
    print_info "  ./deploy.sh logs     - Ver logs"
    print_info "  ./deploy.sh update   - Atualizar código"
    print_info "  ./deploy.sh restart  - Reiniciar"
}

# Atualizar código
update() {
    print_header "🔄 ATUALIZANDO SISTEMA"
    
    cd $PROJECT_DIR
    
    print_info "Parando agente..."
    pm2 stop ai-agent
    
    print_info "Baixando código atualizado..."
    git pull
    
    print_info "Instalando novas dependências..."
    npm install
    
    print_info "Fazendo novo build..."
    npm run build
    
    print_info "Reiniciando agente..."
    pm2 restart ai-agent
    
    print_success "Sistema atualizado!"
    
    print_info "Ver logs: ./deploy.sh logs"
}

# Reiniciar serviços
restart() {
    print_header "🔄 REINICIANDO SERVIÇOS"
    
    print_info "Reiniciando agente..."
    pm2 restart ai-agent
    
    print_info "Recarregando Nginx..."
    sudo systemctl reload nginx
    
    print_success "Serviços reiniciados!"
}

# Ver logs
logs() {
    print_header "📋 LOGS DO AGENTE"
    pm2 logs ai-agent --lines 50
}

# Status
status() {
    print_header "📊 STATUS DO SISTEMA"
    
    print_info "Status PM2:"
    pm2 status
    
    echo ""
    print_info "Status Nginx:"
    sudo systemctl status nginx --no-pager | head -n 10
    
    echo ""
    print_info "Uso de recursos:"
    pm2 monit
}

# Menu principal
case "$1" in
    setup)
        check_user
        setup
        ;;
    update)
        check_user
        update
        ;;
    restart)
        check_user
        restart
        ;;
    logs)
        logs
        ;;
    status)
        status
        ;;
    *)
        echo "╔════════════════════════════════════════════════╗"
        echo "║   Deploy Automático - Barbearia Status         ║"
        echo "╚════════════════════════════════════════════════╝"
        echo ""
        echo "Uso: ./deploy.sh [opção]"
        echo ""
        echo "Opções disponíveis:"
        echo "  setup    - Primeira instalação completa"
        echo "  update   - Atualizar código do Git e reiniciar"
        echo "  restart  - Reiniciar apenas os serviços"
        echo "  logs     - Ver logs do agente em tempo real"
        echo "  status   - Ver status dos serviços"
        echo ""
        echo "Exemplos:"
        echo "  ./deploy.sh setup     # Primeira vez"
        echo "  ./deploy.sh update    # Após fazer git push"
        echo "  ./deploy.sh logs      # Ver o que está acontecendo"
        echo ""
        exit 1
        ;;
esac
