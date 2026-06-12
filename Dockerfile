# ==========================================
# Dockerfile para Frontend - Barbearia Status  
# Runtime: Node.js com TanStack Start
# ==========================================

FROM node:22-alpine

WORKDIR /app

# Copiar package files
COPY package*.json ./

# Instalar dependências
RUN npm install

# Copiar código fonte
COPY . .

# Build do frontend
RUN npm run build

# Expor porta 3000 (porta padrão do TanStack Start)
EXPOSE 3000

# Variáveis de ambiente
ENV NODE_ENV=production
ENV PORT=3000

# Iniciar servidor TanStack Start
CMD ["npm", "run", "start"]
