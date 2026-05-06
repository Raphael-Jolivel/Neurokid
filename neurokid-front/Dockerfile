# ============================================================
# NeuroKid Front-end - Angular 20 + nginx (image multi-stage)
# ============================================================
# Stage 1 : build du bundle Angular
# ------------------------------------------------------------
FROM node:20-alpine AS builder

WORKDIR /app

# Dépendances en premier pour le cache Docker.
COPY package.json package-lock.json* ./
RUN npm ci

# Code source + build production.
COPY . .
RUN npm run build -- --configuration=production

# ============================================================
# Stage 2 : nginx servant le bundle statique.
# ------------------------------------------------------------
FROM nginx:1.27-alpine

# Conf nginx (SPA + headers de sécurité + no-cache config.json).
COPY nginx.conf /etc/nginx/conf.d/default.conf

# Bundle Angular 20 -> dist/<projet>/browser
COPY --from=builder /app/dist/neurokid-angular/browser /usr/share/nginx/html

# Script qui écrit /config.json à partir de la variable d'env API_URL
# au démarrage du conteneur (avant que nginx n'accepte des requêtes).
COPY docker-entrypoint.sh /docker-entrypoint.d/40-write-config.sh
RUN chmod +x /docker-entrypoint.d/40-write-config.sh

EXPOSE 80
# nginx:alpine fournit déjà un CMD correct.
