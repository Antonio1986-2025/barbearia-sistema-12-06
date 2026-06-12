# ==========================================
# Dockerfile para AI Agent - Barbearia Status
# Runtime: Node.js 22
# App: Express + OpenAI + Supabase
# ==========================================

FROM node:22-alpine

# Metadados
LABEL maintainer="Barbearia Status"
LABEL description="AI Agent for WhatsApp booking"

# Criar diretório da aplicação
WORKDIR /app

# Copiar package files
COPY package*.json ./

# Instalar dependências
RUN npm install

# Copiar código fonte
COPY ai-server.js ./
COPY src/ ./src/

# Criar pasta de logs
RUN mkdir -p logs

# Expor porta
EXPOSE 3001

# Health check
HEALTHCHECK --interval=30s --timeout=3s --start-period=10s --retries=3 \
  CMD wget --no-verbose --tries=1 --spider http://localhost:3001/health || exit 1

# Variáveis de ambiente padrão (podem ser sobrescritas)
ENV NODE_ENV=production
ENV PORT=3001

# Iniciar aplicação
CMD ["node", "ai-server.js"]
