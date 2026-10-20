# API FastAPI + modèles. Contexte de construction : la racine du dépôt
# (les pages de résultats lisent notebooks/*.ipynb et artifacts/).
FROM python:3.14-slim

ENV PYTHONDONTWRITEBYTECODE=1 \
    PYTHONUNBUFFERED=1 \
    PIP_NO_CACHE_DIR=1 \
    PIP_DISABLE_PIP_VERSION_CHECK=1

# libgomp1 : nécessaire à LightGBM et XGBoost.
RUN apt-get update \
    && apt-get install -y --no-install-recommends libgomp1 \
    && rm -rf /var/lib/apt/lists/*

WORKDIR /app

COPY backend/requirements.txt backend/requirements-dev.txt backend/
# Sur x86-64, « xgboost » tire la bibliothèque GPU NCCL (≈ 300 Mo) : on installe
# la variante officielle « xgboost-cpu » (même version, même module xgboost).
RUN if [ "$(uname -m)" = "x86_64" ]; then \
        sed 's/^xgboost==/xgboost-cpu==/' backend/requirements.txt > /tmp/requirements.txt; \
    else \
        cp backend/requirements.txt /tmp/requirements.txt; \
    fi \
    && pip install -r /tmp/requirements.txt

COPY backend/ backend/
COPY notebooks/*.ipynb notebooks/
COPY artifacts/ artifacts/

# Les modèles (models/) et le jeu de données (data/raw/) sont montés en volumes.
RUN useradd --create-home --uid 1000 app \
    && mkdir -p /app/models /app/data/raw /app/backend/data \
    && chown -R app:app /app/backend /app/data
USER app

WORKDIR /app/backend
EXPOSE 8000

HEALTHCHECK --interval=15s --timeout=5s --start-period=60s --retries=5 \
    CMD python -c "import urllib.request; urllib.request.urlopen('http://127.0.0.1:8000/health', timeout=4)"

# --root-path /api : l'API est servie derrière nginx sous /api (docs : /api/docs).
CMD ["uvicorn", "main:app", "--host", "0.0.0.0", "--port", "8000", "--root-path", "/api", "--proxy-headers", "--forwarded-allow-ips", "*"]
