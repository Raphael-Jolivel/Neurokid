#!/bin/sh
# ------------------------------------------------------------
# Génère /usr/share/nginx/html/config.json à partir de la
# variable d'environnement API_URL au démarrage du conteneur.
#
# Cela permet de construire l'image une seule fois et de la
# déployer sur N environnements (dev, labo, prod) en passant
# simplement -e API_URL=... au `docker run` / `docker compose up`.
# ------------------------------------------------------------
set -e

API_URL="${API_URL:-http://localhost:5000}"

cat > /usr/share/nginx/html/config.json <<EOF
{
  "apiUrl": "${API_URL}"
}
EOF

echo "[entrypoint] Wrote config.json with apiUrl=${API_URL}"
