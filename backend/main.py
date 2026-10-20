import io
import logging
import math
import os
from contextlib import asynccontextmanager
from pathlib import Path

import pandas as pd
from fastapi import Depends, FastAPI, File, HTTPException, Query, Request, UploadFile
from fastapi.exceptions import RequestValidationError
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import JSONResponse
from pydantic import BaseModel
from sqlalchemy import func, select
from sqlalchemy.orm import Session

import audit
import history
from audit_routes import router as audit_router
from auth_routes import router as auth_router
from database import DATA_DIR, SessionLocal, get_db, init_db
from dataset import router as dataset_router
from db_models import User
from history_routes import router as history_router
from model_service import (
    DEFAULT_MODEL,
    FEATURES,
    MODEL_FILES,
    THRESHOLD,
    ModelNotLoadedError,
    service,
)
from results import router as results_router
from schemas import check_email, check_password, check_username
from security import ADMIN, ANALYST, get_current_user, hash_password, require_roles
from transactions_routes import router as transactions_router
from users_routes import router as users_router

logging.basicConfig(level=logging.INFO)
logger = logging.getLogger("fraud-api")

MAX_FILE_BYTES = 20 * 1024 * 1024
MAX_ROWS = 100_000


def _bootstrap_admin() -> None:
    """Crée le premier administrateur depuis l'environnement (FRAUD_ADMIN_*)."""
    username = os.getenv("FRAUD_ADMIN_USERNAME", "").strip()
    email = os.getenv("FRAUD_ADMIN_EMAIL", "").strip()
    password = os.getenv("FRAUD_ADMIN_PASSWORD", "")

    with SessionLocal() as db:
        if db.scalar(select(func.count(User.id)).where(User.role == ADMIN)):
            return
        if not (username and email and password):
            logger.warning(
                "[auth] aucun administrateur : définissez FRAUD_ADMIN_USERNAME, "
                "FRAUD_ADMIN_EMAIL et FRAUD_ADMIN_PASSWORD, ou lancez "
                "« python manage.py create-user --role admin »."
            )
            return
        try:
            user = User(
                username=check_username(username),
                email=check_email(email),
                password_hash=hash_password(check_password(password)),
                role=ADMIN,
            )
        except ValueError as exc:
            logger.error("[auth] administrateur initial refusé : %s", exc)
            return
        db.add(user)
        db.commit()
        audit.log(db, "user.create", username="système", target=f"user:{user.id}",
                  details={"username": user.username, "role": ADMIN, "bootstrap": True})
        logger.info("[auth] administrateur initial créé : %s", user.username)


@asynccontextmanager
async def lifespan(_: FastAPI):
    service.load()
    init_db()
    legacy = os.getenv("FRAUD_LEGACY_ACTIVITY_DB") or str(DATA_DIR / "activity.db")
    with SessionLocal() as db:
        history.import_legacy_activity(db, Path(legacy))
    _bootstrap_admin()
    yield


app = FastAPI(
    title="API de détection de fraude bancaire",
    description=(
        "Backend du projet de fin d'études : "
        "Détection robuste de la fraude bancaire "
        "par apprentissage automatique."
    ),
    version="0.3.0",
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


@app.exception_handler(RequestValidationError)
async def validation_error_handler(_: Request, exc: RequestValidationError):
    """Messages de validation lisibles, avec le champ concerné pour le formulaire."""
    errors = []
    for error in exc.errors():
        location = [str(part) for part in error.get("loc", ()) if part not in ("body", "query", "path")]
        message = str(error.get("msg", "Valeur invalide."))
        message = message.removeprefix("Value error, ")
        if error.get("type") == "missing":
            message = "Champ obligatoire."
        errors.append({"field": location[0] if location else None, "message": message})
    detail = " ; ".join(
        (f"{e['field']} : {e['message']}" if e["field"] and e["message"] == "Champ obligatoire." else e["message"])
        for e in errors
    )
    return JSONResponse(status_code=422, content={"detail": detail, "errors": errors})


for router in (
    auth_router,
    users_router,
    transactions_router,
    history_router,
    audit_router,
    results_router,
    dataset_router,
):
    app.include_router(router)

analyst_only = require_roles(ANALYST)


class PredictRequest(BaseModel):
    features: dict[str, float]
    model: str = DEFAULT_MODEL
    # Facultatif : classe réelle connue (ligne du jeu de données), gardée dans l'historique.
    true_label: int | None = None
    dataset_row: int | None = None


def _check_model_name(name: str) -> None:
    if name not in MODEL_FILES:
        raise HTTPException(422, f"Modèle inconnu : {name}")


def _predict(df: pd.DataFrame, model: str):
    try:
        return service.predict_proba(df, model)
    except ModelNotLoadedError as exc:
        raise HTTPException(503, f"Modèle non chargé : {exc}") from exc


def _label(value) -> int | None:
    return value if value in (0, 1) else None


@app.get("/health", tags=["Health"])
def health_check():
    """Public : état de l'API et des modèles (sans données personnelles)."""
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
def dashboard(
    period: str = Query("7j"),
    _: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    if period not in history.PERIODS:
        raise HTTPException(422, f"Période inconnue : {period}")
    return {
        **history.dashboard(db, period),
        "platform": {
            "models_ready": service.ready,
            "default_model": DEFAULT_MODEL,
            "threshold": THRESHOLD,
            "models": service.status(),
        },
    }


@app.get("/models", tags=["Models"])
def list_models(_: User = Depends(get_current_user)):
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
def predict_all(
    request_data: CompareRequest,
    request: Request,
    user: User = Depends(analyst_only),
    db: Session = Depends(get_db),
):
    """Score une transaction avec chaque modèle chargé (gardé dans l'historique)."""
    df = _single_frame(request_data.features)
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

    votes = sum(r["is_fraud"] for r in scored)
    entry = history.record(
        db, user, "comparison", model=None, threshold=THRESHOLD,
        summary={
            "amount": request_data.features["Amount"],
            "fraud_votes": votes,
            "models_scored": len(scored),
            "results": [
                {"model": r["model"], "probability": r["probability"], "is_fraud": r["is_fraud"]}
                for r in scored
            ],
        },
    )
    audit.log(db, "analysis.comparison", user=user, target=f"analysis:{entry.id}",
              details={"fraud_votes": votes, "models_scored": len(scored)}, request=request)
    return {
        "threshold": THRESHOLD,
        "results": results,
        "fraud_votes": votes,
        "models_scored": len(scored),
        "analysis_id": entry.id,
    }


@app.post("/predict", tags=["Prediction"])
def predict(
    request_data: PredictRequest,
    request: Request,
    user: User = Depends(analyst_only),
    db: Session = Depends(get_db),
):
    _check_model_name(request_data.model)

    df = _single_frame(request_data.features)
    probability = float(_predict(df, request_data.model)[0])
    is_fraud = probability >= THRESHOLD
    label = _label(request_data.true_label)

    entry = history.record(
        db, user, "single", model=request_data.model, threshold=THRESHOLD,
        rows=[(request_data.features["Amount"], probability, is_fraud, label)],
        summary={"dataset_row": request_data.dataset_row} if request_data.dataset_row else None,
    )
    audit.log(db, "analysis.single", user=user, target=f"analysis:{entry.id}",
              details={"model": request_data.model, "is_fraud": is_fraud}, request=request)

    return {
        "model": request_data.model,
        "probability": probability,
        "risk_score": round(probability * 100, 1),
        "is_fraud": is_fraud,
        "threshold": THRESHOLD,
        "risk_level": history.risk_level(probability),
        "analysis_id": entry.id,
    }


@app.post("/predict-file", tags=["Prediction"])
async def predict_file(
    request: Request,
    file: UploadFile = File(...),
    model: str = Query(DEFAULT_MODEL),
    user: User = Depends(analyst_only),
    db: Session = Depends(get_db),
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

    # Colonne Class facultative : la classe réelle est gardée dans l'historique.
    labels = [None] * len(df)
    if "Class" in df.columns:
        labels = [_label(v) for v in pd.to_numeric(df["Class"], errors="coerce").fillna(-1).astype(int)]

    entry = history.record(
        db, user, "file", model=model, threshold=THRESHOLD,
        rows=[
            (float(a), float(p), bool(p >= THRESHOLD), lab)
            for a, p, lab in zip(features["Amount"], probabilities, labels)
        ],
        filename=(file.filename or "fichier.csv")[:255],
    )
    audit.log(db, "analysis.file", user=user, target=f"analysis:{entry.id}",
              details={"model": model, "rows": entry.total, "frauds": entry.fraud_count,
                       "filename": entry.filename}, request=request)

    rows = [
        {
            "index": i + 1,
            "probability": float(p),
            "risk_score": round(float(p) * 100, 1),
            "is_fraud": bool(p >= THRESHOLD),
        }
        for i, p in enumerate(probabilities)
    ]

    return {
        "model": model,
        "threshold": THRESHOLD,
        "count": len(rows),
        "fraud_count": entry.fraud_count,
        "rows": rows,
        "analysis_id": entry.id,
    }
