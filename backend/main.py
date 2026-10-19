
from fastapi import FastAPI

app = FastAPI(
    title="API de détection de fraude bancaire",
    description=(
        "Backend du projet de fin d'études : "
        "Détection robuste de la fraude bancaire "
        "par apprentissage automatique."
    ),
    version="0.1.0"
)


@app.get("/health", tags=["Health"])
def health_check():
    return {
        "status": "ok",
        "service": "fraud-detection-api",
        "version": "0.1.0"
    }
