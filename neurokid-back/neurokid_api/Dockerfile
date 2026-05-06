# ============================================================
# NeuroKid API - Flask + scikit-learn (production image)
# ============================================================
FROM python:3.12-slim

# Logs visibles immédiatement dans `docker logs`
ENV PYTHONUNBUFFERED=1 \
    PYTHONDONTWRITEBYTECODE=1 \
    PIP_NO_CACHE_DIR=1

# curl est utilisé par le HEALTHCHECK ci-dessous.
RUN apt-get update && \
    apt-get install -y --no-install-recommends curl && \
    rm -rf /var/lib/apt/lists/*

WORKDIR /app

# Dépendances Python en premier pour profiter du cache de couches Docker.
COPY requirements.txt .
RUN pip install -r requirements.txt

# Code applicatif (incluant les artefacts du modèle dans /model).
COPY . .

# On tourne en utilisateur non-root pour réduire la surface d'attaque.
RUN useradd --create-home --uid 1000 appuser && chown -R appuser:appuser /app
USER appuser

EXPOSE 5000

HEALTHCHECK --interval=15s --timeout=5s --retries=5 --start-period=30s \
  CMD curl -fsS http://localhost:5000/health || exit 1

# Gunicorn en production : 2 workers x 2 threads suffisent pour la
# volumétrie du projet (classe d'élèves). Ajustable via le service compose.
CMD ["gunicorn", \
     "--bind", "0.0.0.0:5000", \
     "--workers", "2", \
     "--threads", "2", \
     "--timeout", "60", \
     "--access-logfile", "-", \
     "--error-logfile", "-", \
     "app:app"]
