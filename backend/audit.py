"""Écriture du journal d'audit."""

import logging
import os

from fastapi import Request
from sqlalchemy.orm import Session

from db_models import AuditLog, User

logger = logging.getLogger("fraud-api")


# Derrière le proxy nginx de Docker uniquement : l'IP réelle est dans X-Forwarded-For.
# Sans proxy, cet en-tête pourrait être falsifié par le client : on l'ignore.
TRUST_PROXY = os.getenv("FRAUD_TRUST_PROXY", "") == "1"


def client_ip(request: Request | None) -> str | None:
    if request is None:
        return None
    forwarded = request.headers.get("x-forwarded-for")
    if TRUST_PROXY and forwarded:
        return forwarded.split(",")[0].strip()[:45]
    return request.client.host[:45] if request.client else None


def log(
    db: Session,
    action: str,
    *,
    user: User | None = None,
    username: str | None = None,
    target: str | None = None,
    success: bool = True,
    details: dict | None = None,
    request: Request | None = None,
    commit: bool = True,
) -> None:
    """Ajoute une entrée. Une erreur d'audit ne doit jamais bloquer l'action."""
    try:
        db.add(
            AuditLog(
                user_id=user.id if user else None,
                username=(user.username if user else username),
                action=action,
                target=target,
                success=success,
                ip=client_ip(request),
                details=details,
            )
        )
        if commit:
            db.commit()
    except Exception:  # noqa: BLE001
        logger.exception("[audit] échec d'écriture (%s)", action)
        db.rollback()
