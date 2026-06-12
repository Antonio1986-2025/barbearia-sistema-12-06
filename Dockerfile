# ==========================================
# Dockerfile para Frontend - Barbearia Status
# Runtime: Node.js com TanStack Start SSR
# ==========================================

FROM node:22-alpine

WORKDIR /app

# Copiar package files
COPY package*.json ./

# Instalar dependências
RUN npm install

# Copiar código fonte
COPY . .

# Build do frontend (gera dist/ com client + server)
RUN npm run build

# Expor porta 3000 (TanStack Start SSR)
EXPOSE 3000

# Variáveis de ambiente
ENV NODE_ENV=production
ENV PORT=3000

# Health check
HEALTHCHECK --interval=30s --timeout=3s --start-period=10s --retries=3 \
  CMD wget --no-verbose --tries=1 --spider http://localhost:3000/health || exit 1

# Iniciar servidor TanStack Start
CMD ["node", "dist/server/server.js"]
