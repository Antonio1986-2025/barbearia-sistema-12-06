# ==========================================
# Dockerfile para Frontend - Barbearia Status
# Build: Vite + React
# Serve: Nginx
# ==========================================

# Stage 1: Build
FROM node:22-alpine AS builder

WORKDIR /app

# Copiar package files da raiz
COPY ../package*.json ./

# Instalar dependências
RUN npm install

# Copiar código fonte da raiz
COPY ../ .

# Build do frontend (gera dist/client)
RUN npm run build

# Stage 2: Production
FROM nginx:alpine

# Copiar build do stage anterior
COPY --from=builder /app/dist/client /usr/share/nginx/html

# Copiar configuração customizada do Nginx da raiz
COPY ../nginx.conf /etc/nginx/conf.d/default.conf

# Expor porta 80
EXPOSE 80

# Health check
HEALTHCHECK --interval=30s --timeout=3s --start-period=5s --retries=3 \
  CMD wget --no-verbose --tries=1 --spider http://localhost/ || exit 1

# Iniciar Nginx
CMD ["nginx", "-g", "daemon off;"]
