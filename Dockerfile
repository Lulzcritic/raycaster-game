# =========================================================================
# Étape 1 : Construction du client Web (Vite + TypeScript)
# =========================================================================
FROM node:20-alpine AS builder

WORKDIR /app

ARG VITE_APP_VERSION=0.1.1
ENV VITE_APP_VERSION=$VITE_APP_VERSION

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
ARG VITE_APP_VERSION=0.1.1
ENV VITE_APP_VERSION=$VITE_APP_VERSION

# Réutilisation directe des dépendances et des fichiers compilés de l'étape de build
COPY --from=builder /app/package*.json ./
COPY --from=builder /app/node_modules ./node_modules
COPY --from=builder /app/dist ./dist
COPY --from=builder /app/server ./server
COPY --from=builder /app/src/types ./src/types

EXPOSE 3001

HEALTHCHECK --interval=15s --timeout=5s --start-period=5s --retries=3 \
  CMD curl -f http://127.0.0.1:3001/health || exit 1

CMD ["npm", "run", "server"]
