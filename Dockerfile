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

# Variáveis VITE precisam estar disponíveis ANTES do build (vite build as embute no JS)
ENV VITE_SUPABASE_URL=https://cineibugpcuxvdkkwzau.supabase.co
ENV VITE_SUPABASE_PUBLISHABLE_KEY=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImNpbmVpYnVncGN1eHZka2t3emF1Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3ODAxMTkxOTYsImV4cCI6MjA5NTY5NTE5Nn0._ioSagsnR3wppw6du1zxCvW_Nuy3v6VwIfvQtQ2jxpI

# Build do frontend (gera dist/ com client + server)
RUN npm run build

# Expor portas (frontend: 3000, AI agent: 3001)
EXPOSE 3000
EXPOSE 3001

# Variáveis de ambiente (runtime)
ENV NODE_ENV=production
ENV PORT=3000
ENV AI_PORT=3001
ENV SUPABASE_URL=https://cineibugpcuxvdkkwzau.supabase.co
ENV SUPABASE_PUBLISHABLE_KEY=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImNpbmVpYnVncGN1eHZka2t3emF1Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3ODAxMTkxOTYsImV4cCI6MjA5NTY5NTE5Nn0._ioSagsnR3wppw6du1zxCvW_Nuy3v6VwIfvQtQ2jxpI
ENV SUPABASE_ANON_KEY=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImNpbmVpYnVncGN1eHZka2t3emF1Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3ODAxMTkxOTYsImV4cCI6MjA5NTY5NTE5Nn0._ioSagsnR3wppw6du1zxCvW_Nuy3v6VwIfvQtQ2jxpI

# Health check
HEALTHCHECK --interval=30s --timeout=3s --start-period=10s --retries=3 \
  CMD wget --no-verbose --tries=1 --spider http://localhost:3000/health || exit 1

# Iniciar servidor HTTP (wrapping o handler TanStack Start)
CMD ["node", "server-run.mjs"]
