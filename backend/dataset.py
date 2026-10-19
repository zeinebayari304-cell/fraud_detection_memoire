"""Jeu de données `creditcard.csv` : import, navigation et évaluation.

Le fichier n'est pas versionné (trop volumineux, `*.csv` est dans .gitignore).
Il se place dans `data/raw/creditcard.csv` (chemin utilisé par les notebooks)
ou s'importe depuis l'application via POST /dataset/upload.

Le découpage train / validation / test reproduit exactement le notebook 02 :
suppression des doublons, puis deux `train_test_split` stratifiés
(70 % / 15 % / 15 %, random_state=42).
"""

import logging
import math
import os
import threading
from pathlib import Path

import numpy as np
import pandas as pd
from fastapi import APIRouter, File, HTTPException, Query, UploadFile
from sklearn.metrics import (
    average_precision_score,
    confusion_matrix,
    matthews_corrcoef,
    roc_auc_score,
)
from sklearn.model_selection import train_test_split

from model_service import FEATURES, MODEL_FILES, THRESHOLD, ModelNotLoadedError, service
from notebook_tables import read_json

logger = logging.getLogger("fraud-api")

DATA_DIR = Path(
    os.getenv("FRAUD_DATA_DIR", Path(__file__).resolve().parent.parent / "data" / "raw")
)
DATA_FILE = DATA_DIR / "creditcard.csv"
MAX_UPLOAD_BYTES = 600 * 1024 * 1024
REQUIRED = [*FEATURES, "Class"]

router = APIRouter(prefix="/dataset", tags=["Jeu de données"])

_lock = threading.Lock()
_cache: dict = {"key": None, "df": None, "split": None}
_eval_cache: dict = {}


# ------------------------------------------------------------------ chargement
def _load():
    """Charge le CSV (mis en cache tant que le fichier ne change pas)."""
    if not DATA_FILE.is_file():
        raise HTTPException(404, "Jeu de données absent : importez creditcard.csv.")

    stat = DATA_FILE.stat()
    key = (stat.st_mtime_ns, stat.st_size)

    with _lock:
        if _cache["key"] == key:
            return _cache["df"], _cache["split"]

        df = pd.read_csv(DATA_FILE)
        missing = [c for c in REQUIRED if c not in df.columns]
        if missing:
            raise HTTPException(422, f"Colonnes manquantes : {', '.join(missing)}")

        # Doublons supprimés comme dans le notebook 02 (on garde la 1re occurrence).
        duplicated = df.duplicated(keep="first").to_numpy()
        keep = np.flatnonzero(~duplicated)
        clean_y = df["Class"].to_numpy()[keep]

        split = np.full(len(df), "doublon", dtype=object)
        train_idx, temp_idx = train_test_split(
            np.arange(len(keep)), test_size=0.30, stratify=clean_y, random_state=42
        )
        val_idx, test_idx = train_test_split(
            temp_idx, test_size=0.50, stratify=clean_y[temp_idx], random_state=42
        )
        split[keep[train_idx]] = "train"
        split[keep[val_idx]] = "validation"
        split[keep[test_idx]] = "test"

        _cache.update(key=key, df=df, split=split)
        _eval_cache.clear()
        logger.info("[dataset] chargé : %d lignes", len(df))
        return df, split


def _row_payload(df: pd.DataFrame, split: np.ndarray, index: int, full: bool) -> dict:
    row = df.iloc[index]
    payload = {
        "id": index + 1,
        "split": str(split[index]),
        "label": int(row["Class"]),
        "time": float(row["Time"]),
        "amount": float(row["Amount"]),
    }
    if full:
        payload["features"] = {f: float(row[f]) for f in FEATURES}
    return payload


# ---------------------------------------------------------------------- routes
@router.get("/status")
def status():
    if not DATA_FILE.is_file():
        return {
            "available": False,
            "expected_path": str(DATA_FILE),
            "hint": "Importez creditcard.csv (Kaggle : mlg-ulb/creditcardfraud).",
        }
    try:
        df, split = _load()
    except HTTPException as exc:
        return {"available": False, "expected_path": str(DATA_FILE), "error": exc.detail}

    counts = {
        name: {
            "rows": int((split == name).sum()),
            "frauds": int(df["Class"].to_numpy()[split == name].sum()),
        }
        for name in ("train", "validation", "test", "doublon")
    }
    return {
        "available": True,
        "path": str(DATA_FILE),
        "size_mb": round(DATA_FILE.stat().st_size / 1e6, 1),
        "rows": len(df),
        "frauds": int(df["Class"].sum()),
        "splits": counts,
    }


@router.post("/upload")
async def upload(file: UploadFile = File(...)):
    """Importe creditcard.csv (flux en continu, validation avant remplacement)."""
    DATA_DIR.mkdir(parents=True, exist_ok=True)
    tmp = DATA_DIR / ".upload.tmp"
    total = 0
    try:
        with tmp.open("wb") as out:
            while chunk := await file.read(1024 * 1024):
                total += len(chunk)
                if total > MAX_UPLOAD_BYTES:
                    raise HTTPException(413, "Fichier trop volumineux (maximum 600 Mo).")
                out.write(chunk)

        try:
            header = pd.read_csv(tmp, nrows=5)
        except Exception as exc:  # noqa: BLE001
            raise HTTPException(422, f"CSV illisible : {exc}") from exc
        missing = [c for c in REQUIRED if c not in header.columns]
        if missing:
            raise HTTPException(
                422,
                "Ce n'est pas le jeu creditcard.csv : colonnes manquantes "
                + ", ".join(missing[:6]),
            )

        full = pd.read_csv(tmp, usecols=REQUIRED)
        if full[REQUIRED].isna().any().any():
            raise HTTPException(422, "Valeurs manquantes dans le fichier.")
        if not set(full["Class"].unique()) <= {0, 1} or full["Class"].sum() < 10:
            raise HTTPException(422, "Colonne Class invalide (0/1 attendus, fraudes trop rares).")

        os.replace(tmp, DATA_FILE)
    finally:
        if tmp.exists():
            tmp.unlink()

    return status()


@router.get("/transactions")
def transactions(
    split: str = Query("all"),
    label: str = Query("all"),
    page: int = Query(1, ge=1),
    page_size: int = Query(10, ge=1, le=100),
):
    df, sp = _load()
    mask = np.ones(len(df), dtype=bool)
    if split != "all":
        if split not in ("train", "validation", "test", "doublon"):
            raise HTTPException(422, f"Découpage inconnu : {split}")
        mask &= sp == split
    if label in ("fraud", "normal"):
        mask &= df["Class"].to_numpy() == (1 if label == "fraud" else 0)
    elif label != "all":
        raise HTTPException(422, f"Étiquette inconnue : {label}")

    indices = np.flatnonzero(mask)
    start = (page - 1) * page_size
    chunk = indices[start : start + page_size]
    return {
        "total": int(len(indices)),
        "page": page,
        "page_size": page_size,
        "rows": [_row_payload(df, sp, int(i), full=False) for i in chunk],
    }


@router.get("/random")
def random_transaction(
    label: str = Query("any"),
    split: str = Query("all"),
):
    df, sp = _load()
    mask = np.ones(len(df), dtype=bool)
    if split != "all":
        mask &= sp == split
    if label in ("fraud", "normal"):
        mask &= df["Class"].to_numpy() == (1 if label == "fraud" else 0)
    indices = np.flatnonzero(mask)
    if len(indices) == 0:
        raise HTTPException(404, "Aucune transaction ne correspond à ce filtre.")
    return _row_payload(df, sp, int(np.random.choice(indices)), full=True)


@router.get("/transactions/{row_id}")
def transaction(row_id: int):
    df, sp = _load()
    if not 1 <= row_id <= len(df):
        raise HTTPException(404, f"Ligne inconnue : {row_id} (1 à {len(df)}).")
    return _row_payload(df, sp, row_id - 1, full=True)


def _metrics(y_true: np.ndarray, score: np.ndarray) -> dict:
    pred = (score >= THRESHOLD).astype(int)
    tn, fp, fn, tp = (int(v) for v in confusion_matrix(y_true, pred, labels=[0, 1]).ravel())
    precision = tp / (tp + fp) if tp + fp else 0.0
    recall = tp / (tp + fn) if tp + fn else 0.0
    f1 = 2 * precision * recall / (precision + recall) if precision + recall else 0.0
    return {
        "tn": tn, "fp": fp, "fn": fn, "tp": tp,
        "accuracy": (tp + tn) / len(y_true),
        "precision": precision,
        "recall": recall,
        "f1": f1,
        "mcc": float(matthews_corrcoef(y_true, pred)),
        "ap": float(average_precision_score(y_true, score)),
        "roc_auc": float(roc_auc_score(y_true, score)),
    }


@router.get("/evaluation")
def evaluation(model: str = Query("Random Forest"), split: str = Query("test")):
    """Évalue un modèle chargé sur un sous-ensemble reconstruit du jeu de données."""
    if model not in MODEL_FILES:
        raise HTTPException(422, f"Modèle inconnu : {model}")
    if split not in ("validation", "test"):
        raise HTTPException(422, "Découpage autorisé : validation ou test.")

    df, sp = _load()
    key = (model, split, THRESHOLD, _cache["key"])
    if key in _eval_cache:
        return _eval_cache[key]

    rows = df[sp == split]
    try:
        score = service.predict_proba(rows[FEATURES], model)
    except ModelNotLoadedError as exc:
        raise HTTPException(503, f"Modèle non chargé : {exc}") from exc

    metrics = _metrics(rows["Class"].to_numpy(), score)

    # Référence du mémoire (notebook 12) pour le modèle final sur le test.
    reference = None
    summary = read_json("notebook12_final_selection", "12_final_summary.json")
    if summary and split == "test" and summary.get("selected_model") == model:
        ref = summary["test_clean"]
        reference = {
            "source": "notebook 12 (artifacts/12_final_summary.json)",
            "tp": ref.get("TP"), "fp": ref.get("FP"), "fn": ref.get("FN"),
            "precision": ref.get("Precision"), "recall": ref.get("Recall"),
            "f1": ref.get("F1"), "ap": ref.get("AP"), "mcc": ref.get("MCC"),
        }
        reference["matches"] = (
            metrics["tp"] == ref.get("TP")
            and metrics["fp"] == ref.get("FP")
            and metrics["fn"] == ref.get("FN")
        )

    result = {
        "model": model,
        "split": split,
        "threshold": THRESHOLD,
        "rows": int(len(rows)),
        "frauds": int(rows["Class"].sum()),
        "metrics": {k: (None if isinstance(v, float) and not math.isfinite(v) else v)
                    for k, v in metrics.items()},
        "reference": reference,
    }
    _eval_cache[key] = result
    return result
