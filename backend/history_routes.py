"""Historique des analyses et des tests (cas « Consulter l'historique » et « Exporter les résultats »)."""

import csv
import io
from datetime import date, datetime, timedelta

from fastapi import APIRouter, Depends, HTTPException, Query, Request
from fastapi.responses import StreamingResponse
from sqlalchemy import and_, case, func, or_, select
from sqlalchemy.orm import Session

import audit
import history
from database import get_db
from db_models import Analysis, AnalysisResult, User
from security import ANALYST, EXPERT, require_roles

router = APIRouter(prefix="/history", tags=["Historique"])
history_roles = require_roles(ANALYST, EXPERT)


def _get_owned(db: Session, analysis_id: int, user: User) -> Analysis:
    analysis = db.get(Analysis, analysis_id)
    if analysis is None or analysis.user_id != user.id:
        raise HTTPException(404, "Analyse introuvable.")
    return analysis


def _parse_day(value: str | None, label: str) -> date | None:
    if not value:
        return None
    try:
        return date.fromisoformat(value)
    except ValueError as exc:
        raise HTTPException(422, f"{label} invalide (format AAAA-MM-JJ).") from exc


@router.get("")
def list_history(
    kind: str = Query("all"),
    model: str = Query("all"),
    date_from: str | None = Query(None),
    date_to: str | None = Query(None),
    page: int = Query(1, ge=1),
    page_size: int = Query(15, ge=1, le=100),
    user: User = Depends(history_roles),
    db: Session = Depends(get_db),
):
    query = select(Analysis).where(Analysis.user_id == user.id)
    if kind != "all":
        if kind not in history.KIND_LABELS:
            raise HTTPException(422, f"Type d'analyse inconnu : {kind}")
        query = query.where(Analysis.kind == kind)
    if model != "all":
        query = query.where(Analysis.model == model)

    start = _parse_day(date_from, "Date de début")
    end = _parse_day(date_to, "Date de fin")
    if start and end and start > end:
        raise HTTPException(422, "La date de début doit précéder la date de fin.")
    if start:
        query = query.where(Analysis.created_at >= datetime.combine(start, datetime.min.time()))
    if end:
        query = query.where(Analysis.created_at < datetime.combine(end + timedelta(days=1), datetime.min.time()))

    total = db.scalar(select(func.count()).select_from(query.subquery()))
    rows = db.scalars(
        query.order_by(Analysis.created_at.desc(), Analysis.id.desc())
        .offset((page - 1) * page_size)
        .limit(page_size)
    ).all()

    models = db.scalars(
        select(Analysis.model).where(Analysis.user_id == user.id, Analysis.model.is_not(None))
        .distinct()
    ).all()
    return {
        "total": total,
        "page": page,
        "page_size": page_size,
        "rows": [history.serialize(a, user.username) for a in rows],
        "kinds": history.KIND_LABELS,
        "models": sorted(models),
    }


@router.get("/{analysis_id}")
def get_history_entry(
    analysis_id: int,
    page: int = Query(1, ge=1),
    page_size: int = Query(50, ge=1, le=500),
    user: User = Depends(history_roles),
    db: Session = Depends(get_db),
):
    analysis = _get_owned(db, analysis_id, user)
    results = db.scalars(
        select(AnalysisResult)
        .where(AnalysisResult.analysis_id == analysis.id)
        .order_by(AnalysisResult.row_index)
        .offset((page - 1) * page_size)
        .limit(page_size)
    ).all()

    # Prédiction correcte : fraude prédite et classe réelle 1, ou normale et classe 0.
    correct = case(
        (
            or_(
                and_(AnalysisResult.is_fraud.is_(True), AnalysisResult.true_label == 1),
                and_(AnalysisResult.is_fraud.is_(False), AnalysisResult.true_label == 0),
            ),
            1,
        ),
        else_=0,
    )
    labelled = db.execute(
        select(func.count(AnalysisResult.id), func.coalesce(func.sum(correct), 0)).where(
            AnalysisResult.analysis_id == analysis.id, AnalysisResult.true_label.is_not(None)
        )
    ).one()

    return {
        **history.serialize(analysis, user.username),
        "page": page,
        "page_size": page_size,
        "labelled": int(labelled[0]),
        "correct": int(labelled[1]),
        "results": [
            {
                "row_index": r.row_index,
                "amount": r.amount,
                "probability": r.probability,
                "risk_score": round(r.probability * 100, 1),
                "is_fraud": r.is_fraud,
                "true_label": r.true_label,
                "risk_level": history.risk_level(r.probability),
            }
            for r in results
        ],
    }


@router.get("/{analysis_id}/export")
def export_history_entry(
    analysis_id: int,
    request: Request,
    user: User = Depends(history_roles),
    db: Session = Depends(get_db),
):
    analysis = _get_owned(db, analysis_id, user)
    results = db.scalars(
        select(AnalysisResult)
        .where(AnalysisResult.analysis_id == analysis.id)
        .order_by(AnalysisResult.row_index)
    ).all()

    buffer = io.StringIO()
    writer = csv.writer(buffer, delimiter=";")
    if results:
        writer.writerow(["Ligne", "Montant", "Probabilite_fraude", "Score_%", "Prediction", "Classe_reelle"])
        for r in results:
            writer.writerow([
                r.row_index,
                f"{r.amount:.2f}",
                f"{r.probability:.6f}",
                f"{r.probability * 100:.1f}",
                "Fraude suspectée" if r.is_fraud else "Normale",
                "" if r.true_label is None else ("Fraude" if r.true_label == 1 else "Normale"),
            ])
    else:
        # Test de modèle : pas de lignes, on exporte les métriques.
        writer.writerow(["Indicateur", "Valeur"])
        for key, value in (analysis.summary or {}).items():
            if not isinstance(value, (dict, list)):
                writer.writerow([key, value])
        for key, value in ((analysis.summary or {}).get("metrics") or {}).items():
            writer.writerow([key, value])

    audit.log(db, "history.export", user=user, target=f"analysis:{analysis.id}",
              details={"rows": len(results)}, request=request)

    filename = f"fraudshield_analyse_{analysis.id}.csv"
    return StreamingResponse(
        iter(["﻿" + buffer.getvalue()]),
        media_type="text/csv; charset=utf-8",
        headers={"Content-Disposition": f'attachment; filename="{filename}"'},
    )


@router.delete("/{analysis_id}")
def delete_history_entry(
    analysis_id: int,
    request: Request,
    user: User = Depends(history_roles),
    db: Session = Depends(get_db),
):
    analysis = _get_owned(db, analysis_id, user)
    kind = analysis.kind
    db.delete(analysis)
    db.commit()
    audit.log(db, "history.delete", user=user, target=f"analysis:{analysis_id}",
              details={"kind": kind}, request=request)
    return {"detail": "Entrée de l'historique supprimée."}
