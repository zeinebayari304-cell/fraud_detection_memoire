"""Consultation du journal d'audit (cas « Consulter les journaux d'audit »)."""

from datetime import date, datetime, timedelta

from fastapi import APIRouter, Depends, HTTPException, Query
from sqlalchemy import func, select
from sqlalchemy.orm import Session

from database import get_db
from db_models import AuditLog, User
from security import ADMIN, require_roles
from timeutil import iso

router = APIRouter(prefix="/audit", tags=["Journal d'audit"])
admin_only = require_roles(ADMIN)

ACTION_LABELS = {
    "auth.register": "Inscription",
    "auth.login": "Connexion",
    "auth.logout": "Déconnexion",
    "auth.password": "Changement de mot de passe",
    "user.create": "Création d'utilisateur",
    "user.update": "Modification d'utilisateur",
    "user.delete": "Suppression d'utilisateur",
    "transaction.create": "Création de transaction",
    "transaction.update": "Modification de transaction",
    "transaction.delete": "Suppression de transaction",
    "transaction.analyze": "Analyse de transaction enregistrée",
    "analysis.single": "Analyse d'une transaction",
    "analysis.file": "Analyse d'un fichier CSV",
    "analysis.comparison": "Comparaison des modèles",
    "dataset.upload": "Import du jeu de données",
    "dataset.evaluation": "Test d'un modèle",
    "history.export": "Export de résultats",
    "history.delete": "Suppression d'une analyse",
}


def _day(value: str | None, label: str) -> date | None:
    if not value:
        return None
    try:
        return date.fromisoformat(value)
    except ValueError as exc:
        raise HTTPException(422, f"{label} invalide (format AAAA-MM-JJ).") from exc


@router.get("")
def list_audit(
    action: str = Query("all"),
    username: str = Query("", max_length=254),
    outcome: str = Query("all"),
    date_from: str | None = Query(None),
    date_to: str | None = Query(None),
    page: int = Query(1, ge=1),
    page_size: int = Query(25, ge=1, le=200),
    _: User = Depends(admin_only),
    db: Session = Depends(get_db),
):
    query = select(AuditLog)
    if action != "all":
        query = query.where(AuditLog.action == action)
    if username.strip():
        query = query.where(func.lower(AuditLog.username).like(f"%{username.strip().lower()}%"))
    if outcome == "success":
        query = query.where(AuditLog.success.is_(True))
    elif outcome == "failure":
        query = query.where(AuditLog.success.is_(False))

    start, end = _day(date_from, "Date de début"), _day(date_to, "Date de fin")
    if start:
        query = query.where(AuditLog.created_at >= datetime.combine(start, datetime.min.time()))
    if end:
        query = query.where(AuditLog.created_at < datetime.combine(end + timedelta(days=1), datetime.min.time()))

    total = db.scalar(select(func.count()).select_from(query.subquery()))
    rows = db.scalars(
        query.order_by(AuditLog.id.desc()).offset((page - 1) * page_size).limit(page_size)
    ).all()
    return {
        "total": total,
        "page": page,
        "page_size": page_size,
        "actions": ACTION_LABELS,
        "rows": [
            {
                "id": r.id,
                "created_at": iso(r.created_at),
                "username": r.username,
                "action": r.action,
                "action_label": ACTION_LABELS.get(r.action, r.action),
                "target": r.target,
                "success": r.success,
                "ip": r.ip,
                "details": r.details,
            }
            for r in rows
        ],
    }
