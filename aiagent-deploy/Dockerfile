# ==========================================
# AI Agent - Barbearia Status
# Express + OpenAI + Supabase
# ==========================================

FROM node:22-alpine

WORKDIR /app

COPY package*.json ./

RUN npm ci --omit=dev

COPY ai-server.js ./

RUN mkdir -p logs

EXPOSE 3001

HEALTHCHECK --interval=30s --timeout=3s --start-period=10s --retries=3 \
  CMD wget --no-verbose --tries=1 --spider http://localhost:3001/health || exit 1

ENV NODE_ENV=production
ENV PORT=3001

CMD ["node", "ai-server.js"]
