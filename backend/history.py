"""Historique des analyses et indicateurs du tableau de bord."""

import logging
import sqlite3
from datetime import datetime, timedelta
from pathlib import Path

from sqlalchemy import case, func, insert, select
from sqlalchemy.orm import Session

from db_models import Analysis, AnalysisResult, User
from timeutil import iso, utcnow

logger = logging.getLogger("fraud-api")

# Analyses de transactions comptées dans le tableau de bord. Les comparaisons
# de modèles et les tests (évaluations) restent dans l'historique seulement.
COUNTED_KINDS = ("single", "file", "transaction")
KIND_LABELS = {
    "single": "Transaction unique",
    "file": "Fichier CSV",
    "transaction": "Transaction enregistrée",
    "comparison": "Comparaison des modèles",
    "evaluation": "Test du modèle",
}
PERIODS = {"7j": 7, "30j": 30, "90j": 90}

# Nombre de fraudes : somme portable (SQLite et PostgreSQL) d'une colonne booléenne.
FRAUD_SUM = func.coalesce(func.sum(case((AnalysisResult.is_fraud.is_(True), 1), else_=0)), 0)


def risk_level(probability: float) -> str:
    return "Élevé" if probability >= 0.75 else "Moyen" if probability >= 0.4 else "Faible"


def record(
    db: Session,
    user: User | None,
    kind: str,
    *,
    model: str | None,
    threshold: float | None,
    rows: list[tuple[float, float, bool, int | None]] = (),
    filename: str | None = None,
    transaction_id: int | None = None,
    summary: dict | None = None,
    created_at: datetime | None = None,
) -> Analysis:
    """Enregistre une analyse et ses résultats (montant, probabilité, fraude, classe réelle)."""
    analysis = Analysis(
        user_id=user.id if user else None,
        kind=kind,
        model=model,
        threshold=threshold,
        filename=filename,
        transaction_id=transaction_id,
        total=len(rows) if rows else (summary or {}).get("rows", 0),
        fraud_count=sum(1 for r in rows if r[2]) if rows else (summary or {}).get("frauds_flagged", 0),
        summary=summary,
        created_at=created_at or utcnow(),
    )
    db.add(analysis)
    db.flush()

    if rows:
        db.execute(
            insert(AnalysisResult),
            [
                {
                    "analysis_id": analysis.id,
                    "row_index": index,
                    "amount": float(amount),
                    "probability": float(probability),
                    "is_fraud": bool(is_fraud),
                    "true_label": None if label is None else int(label),
                }
                for index, (amount, probability, is_fraud, label) in enumerate(rows, start=1)
            ],
        )
    db.commit()
    return analysis


def serialize(analysis: Analysis, username: str | None = None) -> dict:
    return {
        "id": analysis.id,
        "kind": analysis.kind,
        "kind_label": KIND_LABELS.get(analysis.kind, analysis.kind),
        "model": analysis.model,
        "threshold": analysis.threshold,
        "filename": analysis.filename,
        "transaction_id": analysis.transaction_id,
        "total": analysis.total,
        "fraud_count": analysis.fraud_count,
        "summary": analysis.summary,
        "created_at": iso(analysis.created_at),
        "username": username,
    }


# -------------------------------------------------------------- tableau de bord
def dashboard(db: Session, period: str) -> dict:
    days = PERIODS[period]
    now = utcnow()
    since = now - timedelta(days=days)

    counted = Analysis.kind.in_(COUNTED_KINDS)
    base = (
        select(func.count(AnalysisResult.id), FRAUD_SUM)
        .join(Analysis, Analysis.id == AnalysisResult.analysis_id)
        .where(counted)
    )
    total, fraud = db.execute(base.where(Analysis.created_at >= since)).one()
    all_time = db.execute(base).one()[0]

    by_model = db.execute(
        select(
            Analysis.model,
            func.count(AnalysisResult.id),
            FRAUD_SUM,
        )
        .join(Analysis, Analysis.id == AnalysisResult.analysis_id)
        .where(counted, Analysis.created_at >= since)
        .group_by(Analysis.model)
        .order_by(func.count(AnalysisResult.id).desc())
    ).all()

    day = func.date(Analysis.created_at)
    daily = {
        str(d)[:10]: (int(n), int(f))
        for d, n, f in db.execute(
            select(
                day,
                func.count(AnalysisResult.id),
                FRAUD_SUM,
            )
            .join(Analysis, Analysis.id == AnalysisResult.analysis_id)
            .where(counted, Analysis.created_at >= since)
            .group_by(day)
        ).all()
    }

    # 7j / 30j : un point par jour ; 90j : un point par semaine.
    bucket = 1 if days <= 30 else 7
    today = now.date()
    cursor = today - timedelta(days=days - 1)
    series = []
    while cursor <= today:
        end = min(cursor + timedelta(days=bucket - 1), today)
        n = f = 0
        current = cursor
        while current <= end:
            dn, df = daily.get(current.isoformat(), (0, 0))
            n, f = n + dn, f + df
            current += timedelta(days=1)
        series.append({"label": cursor.strftime("%d/%m"), "total": n, "alerts": f})
        cursor = end + timedelta(days=1)

    alerts = db.execute(
        select(AnalysisResult, Analysis.created_at, Analysis.model)
        .join(Analysis, Analysis.id == AnalysisResult.analysis_id)
        .where(counted, AnalysisResult.is_fraud.is_(True))
        .order_by(AnalysisResult.id.desc())
        .limit(8)
    ).all()

    total, fraud = int(total), int(fraud)
    return {
        "period": period,
        "totals": {
            "analyzed": total,
            "fraud": fraud,
            "normal": total - fraud,
            "fraud_rate": (fraud / total * 100) if total else 0.0,
            "all_time": int(all_time),
        },
        "series": series,
        "by_model": [
            {"model": m or "—", "total": int(n), "fraud": int(f)} for m, n, f in by_model
        ],
        "alerts": [
            {
                "id": f"TX-{result.id:06d}",
                "at": iso(created_at),
                "model": model,
                "amount": result.amount,
                "score": round(result.probability * 100, 1),
                "risk": risk_level(result.probability),
            }
            for result, created_at, model in alerts
        ],
    }



# ------------------------------------------------------------- reprise des données
def import_legacy_activity(db: Session, path: Path) -> int:
    """Reprend une fois l'ancien journal SQLite (backend/data/activity.db).

    Les analyses déjà faites avant l'ajout des comptes restent ainsi visibles
    dans le tableau de bord (sans utilisateur associé).
    """
    if not path.is_file():
        return 0
    if db.scalar(select(func.count(Analysis.id))):
        return 0  # base déjà utilisée : reprise inutile

    try:
        connection = sqlite3.connect(path)
        rows = connection.execute(
            "SELECT ts, source, model, amount, probability, is_fraud FROM predictions ORDER BY id"
        ).fetchall()
        connection.close()
    except sqlite3.Error as exc:
        logger.warning("[history] ancien journal illisible (%s)", exc)
        return 0

    groups: dict[tuple, list] = {}
    for ts, source, model, amount, probability, is_fraud in rows:
        groups.setdefault((ts, source, model), []).append((amount, probability, bool(is_fraud), None))

    for (ts, source, model), items in groups.items():
        created = datetime.fromisoformat(ts.replace("Z", "+00:00")).replace(tzinfo=None)
        record(
            db,
            None,
            "single" if source == "single" else "file",
            model=model,
            threshold=None,
            rows=items,
            filename=None if source == "single" else "(journal antérieur)",
            summary={"legacy": True},
            created_at=created,
        )
    logger.info("[history] %d analyses reprises de l'ancien journal", len(groups))
    return len(groups)
