# =========================================================================
# Étape 1 : Construction du client Web (Vite + TypeScript)
# =========================================================================
FROM node:20-alpine AS builder

WORKDIR /app

COPY package*.json ./
RUN npm ci

COPY . .
RUN npm run build

# =========================================================================
# Étape 2 : Image d'exécution de production
# =========================================================================
FROM node:20-alpine

WORKDIR /app

# Installation de curl pour le healthcheck Docker
RUN apk add --no-cache curl

ENV NODE_ENV=production
ENV PORT=3001

COPY package*.json ./
RUN npm ci

# Récupération des fichiers statiques compilés et des sources serveur
COPY --from=builder /app/dist ./dist
COPY --from=builder /app/server ./server
COPY --from=builder /app/src/types ./src/types

EXPOSE 3001

HEALTHCHECK --interval=15s --timeout=5s --start-period=5s --retries=3 \
  CMD curl -f http://localhost:3001/health || exit 1

CMD ["npm", "run", "server"]
