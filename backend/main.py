import io
import logging
import math
import os
from contextlib import asynccontextmanager

import pandas as pd
from fastapi import FastAPI, File, HTTPException, Query, UploadFile
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel

import activity
from model_service import (
    DEFAULT_MODEL,
    FEATURES,
    MODEL_FILES,
    THRESHOLD,
    ModelNotLoadedError,
    service,
)
from dataset import router as dataset_router
from results import router as results_router

logging.basicConfig(level=logging.INFO)

MAX_FILE_BYTES = 20 * 1024 * 1024
MAX_ROWS = 100_000


@asynccontextmanager
async def lifespan(_: FastAPI):
    service.load()
    yield


app = FastAPI(
    title="API de détection de fraude bancaire",
    description=(
        "Backend du projet de fin d'études : "
        "Détection robuste de la fraude bancaire "
        "par apprentissage automatique."
    ),
    version="0.2.0",
    lifespan=lifespan,
)

app.add_middleware(
    CORSMiddleware,
    allow_origins=os.getenv(
        "FRAUD_CORS_ORIGINS", "http://localhost:5173,http://127.0.0.1:5173"
    ).split(","),
    allow_methods=["*"],
    allow_headers=["*"],
)


app.include_router(results_router)
app.include_router(dataset_router)


class PredictRequest(BaseModel):
    features: dict[str, float]
    model: str = DEFAULT_MODEL


def _check_model_name(name: str) -> None:
    if name not in MODEL_FILES:
        raise HTTPException(422, f"Modèle inconnu : {name}")


def _risk_level(probability: float) -> str:
    return "Élevé" if probability >= 0.75 else "Moyen" if probability >= 0.4 else "Faible"


def _predict(df: pd.DataFrame, model: str):
    try:
        return service.predict_proba(df, model)
    except ModelNotLoadedError as exc:
        raise HTTPException(503, f"Modèle non chargé : {exc}") from exc


@app.get("/health", tags=["Health"])
def health_check():
    return {
        "status": "ok",
        "service": "fraud-detection-api",
        "version": app.version,
        "models_ready": service.ready,
        "default_model": DEFAULT_MODEL,
        "threshold": THRESHOLD,
        "models": service.status(),
    }


@app.get("/dashboard", tags=["Dashboard"])
def dashboard(period: str = Query("7j")):
    if period not in activity.PERIODS:
        raise HTTPException(422, f"Période inconnue : {period}")
    return {
        **activity.summary(period),
        "platform": {
            "models_ready": service.ready,
            "default_model": DEFAULT_MODEL,
            "threshold": THRESHOLD,
            "models": service.status(),
        },
    }


@app.get("/models", tags=["Models"])
def list_models():
    return {"default": DEFAULT_MODEL, "models": service.status()}


def _single_frame(features: dict[str, float]) -> pd.DataFrame:
    """Valide une transaction (30 variables) et la met en DataFrame."""
    missing = [f for f in FEATURES if f not in features]
    if missing:
        raise HTTPException(422, f"Variables manquantes : {', '.join(missing)}")
    if not all(math.isfinite(features[f]) for f in FEATURES):
        raise HTTPException(422, "Toutes les variables doivent être finies.")
    if features["Time"] < 0 or features["Amount"] < 0:
        raise HTTPException(422, "Time et Amount doivent être positifs ou nuls.")
    return pd.DataFrame([{f: features[f] for f in FEATURES}])


class CompareRequest(BaseModel):
    features: dict[str, float]


@app.post("/predict-all", tags=["Prediction"])
def predict_all(request: CompareRequest):
    """Score une transaction avec chaque modèle chargé (comparaison, non journalisée)."""
    df = _single_frame(request.features)
    results = []
    for status in service.status():
        if not status["loaded"]:
            results.append({"model": status["name"], "loaded": False})
            continue
        probability = float(service.predict_proba(df, status["name"])[0])
        results.append(
            {
                "model": status["name"],
                "loaded": True,
                "probability": probability,
                "risk_score": round(probability * 100, 1),
                "is_fraud": probability >= THRESHOLD,
            }
        )
    scored = [r for r in results if r["loaded"]]
    if not scored:
        raise HTTPException(503, "Modèle non chargé : aucun modèle disponible.")
    return {
        "threshold": THRESHOLD,
        "results": results,
        "fraud_votes": sum(r["is_fraud"] for r in scored),
        "models_scored": len(scored),
    }


@app.post("/predict", tags=["Prediction"])
def predict(request: PredictRequest):
    _check_model_name(request.model)

    df = _single_frame(request.features)
    probability = float(_predict(df, request.model)[0])
    activity.record(
        "single",
        request.model,
        [(request.features["Amount"], probability, probability >= THRESHOLD)],
    )

    return {
        "model": request.model,
        "probability": probability,
        "risk_score": round(probability * 100, 1),
        "is_fraud": probability >= THRESHOLD,
        "threshold": THRESHOLD,
        "risk_level": _risk_level(probability),
    }


@app.post("/predict-file", tags=["Prediction"])
async def predict_file(
    file: UploadFile = File(...),
    model: str = Query(DEFAULT_MODEL),
):
    _check_model_name(model)

    content = await file.read(MAX_FILE_BYTES + 1)
    if len(content) > MAX_FILE_BYTES:
        raise HTTPException(413, "Fichier trop volumineux (maximum 20 Mo).")

    try:
        df = pd.read_csv(io.BytesIO(content), encoding="utf-8-sig")
    except Exception as exc:  # noqa: BLE001
        raise HTTPException(422, f"CSV illisible : {exc}") from exc

    df.columns = [str(c).strip() for c in df.columns]
    missing = [f for f in FEATURES if f not in df.columns]
    if missing:
        raise HTTPException(422, f"Colonnes manquantes : {', '.join(missing)}")
    if df.empty:
        raise HTTPException(422, "Le fichier ne contient aucune transaction.")
    if len(df) > MAX_ROWS:
        raise HTTPException(422, f"Trop de lignes (maximum {MAX_ROWS}).")

    try:
        features = df[FEATURES].apply(pd.to_numeric, errors="raise")
    except (ValueError, TypeError) as exc:
        raise HTTPException(422, "Valeurs non numériques dans le fichier.") from exc
    if features.isna().any().any() or not features.map(math.isfinite).all().all():
        raise HTTPException(422, "Valeurs manquantes ou infinies dans le fichier.")
    if (features["Time"] < 0).any() or (features["Amount"] < 0).any():
        raise HTTPException(422, "Time et Amount doivent être positifs ou nuls.")

    probabilities = _predict(features, model)
    activity.record(
        "file",
        model,
        [
            (float(a), float(p), bool(p >= THRESHOLD))
            for a, p in zip(features["Amount"], probabilities)
        ],
    )

    rows = [
        {
            "index": i + 1,
            "probability": float(p),
            "risk_score": round(float(p) * 100, 1),
            "is_fraud": bool(p >= THRESHOLD),
        }
        for i, p in enumerate(probabilities)
    ]
    fraud_count = sum(r["is_fraud"] for r in rows)

    return {
        "model": model,
        "threshold": THRESHOLD,
        "count": len(rows),
        "fraud_count": fraud_count,
        "rows": rows,
    }
