"""Inscription, connexion, déconnexion, profil (cas « Se connecter / se déconnecter »)."""

from datetime import timedelta

from fastapi import APIRouter, Depends, HTTPException, Request
from sqlalchemy import func, or_, select
from sqlalchemy.orm import Session

import audit
from database import get_db
from db_models import User
from schemas import LoginIn, PasswordChangeIn, RegisterIn
from security import (
    ANALYST,
    DUMMY_HASH,
    JWT_EXPIRE_MINUTES,
    LOCK_MINUTES,
    MAX_FAILED_LOGINS,
    ROLE_LABELS,
    create_token,
    get_current_user,
    hash_password,
    verify_password,
)
from timeutil import iso, utcnow

router = APIRouter(prefix="/auth", tags=["Authentification"])

INVALID_CREDENTIALS = "Identifiants invalides."


def serialize_user(user: User) -> dict:
    return {
        "id": user.id,
        "username": user.username,
        "email": user.email,
        "full_name": user.full_name,
        "role": user.role,
        "role_label": ROLE_LABELS.get(user.role, user.role),
        "is_active": user.is_active,
        "locked": bool(user.locked_until and user.locked_until > utcnow()),
        "last_login_at": iso(user.last_login_at),
        "created_at": iso(user.created_at),
    }


def _token_response(user: User) -> dict:
    return {
        "access_token": create_token(user),
        "token_type": "bearer",
        "expires_in": JWT_EXPIRE_MINUTES * 60,
        "user": serialize_user(user),
    }


def ensure_unique(db: Session, username: str | None, email: str | None, exclude_id: int | None = None):
    """409 si le nom d'utilisateur ou l'e-mail est déjà pris."""
    for field, value, label in (
        (User.username, username, "Ce nom d'utilisateur est déjà utilisé."),
        (User.email, email, "Cette adresse e-mail est déjà utilisée."),
    ):
        if value is None:
            continue
        query = select(User.id).where(func.lower(field) == value.lower())
        if exclude_id is not None:
            query = query.where(User.id != exclude_id)
        if db.scalar(query) is not None:
            raise HTTPException(409, label)


@router.post("/register", status_code=201)
def register(data: RegisterIn, request: Request, db: Session = Depends(get_db)):
    """Crée un compte « Analyste antifraude » ; l'administrateur peut ensuite changer le rôle."""
    ensure_unique(db, data.username, data.email)
    user = User(
        username=data.username,
        email=data.email,
        full_name=data.full_name,
        password_hash=hash_password(data.password),
        role=ANALYST,
        last_login_at=utcnow(),
    )
    db.add(user)
    db.commit()
    audit.log(db, "auth.register", user=user, target=f"user:{user.id}", request=request)
    return _token_response(user)


@router.post("/login")
def login(data: LoginIn, request: Request, db: Session = Depends(get_db)):
    user = db.scalar(
        select(User).where(
            or_(func.lower(User.username) == data.identifier, func.lower(User.email) == data.identifier)
        )
    )
    now = utcnow()

    if user is None:
        verify_password(data.password, DUMMY_HASH)  # même durée qu'un vrai échec
        audit.log(db, "auth.login", username=data.identifier, success=False,
                  details={"reason": "compte inconnu"}, request=request)
        raise HTTPException(401, INVALID_CREDENTIALS)

    if user.locked_until and user.locked_until > now:
        minutes = max(1, int((user.locked_until - now).total_seconds() // 60) + 1)
        audit.log(db, "auth.login", user=user, success=False,
                  details={"reason": "compte verrouillé"}, request=request)
        raise HTTPException(
            423, f"Compte temporairement verrouillé après plusieurs échecs : réessayez dans {minutes} min."
        )

    if not verify_password(data.password, user.password_hash):
        user.failed_logins += 1
        details = {"reason": "mot de passe incorrect", "attempt": user.failed_logins}
        if user.failed_logins >= MAX_FAILED_LOGINS:
            user.locked_until = now + timedelta(minutes=LOCK_MINUTES)
            user.failed_logins = 0
            details["locked_minutes"] = LOCK_MINUTES
        db.commit()
        audit.log(db, "auth.login", user=user, success=False, details=details, request=request)
        raise HTTPException(401, INVALID_CREDENTIALS)

    if not user.is_active:
        audit.log(db, "auth.login", user=user, success=False,
                  details={"reason": "compte désactivé"}, request=request)
        raise HTTPException(403, "Compte désactivé : contactez l'administrateur.")

    user.failed_logins = 0
    user.locked_until = None
    user.last_login_at = now
    db.commit()
    audit.log(db, "auth.login", user=user, request=request)
    return _token_response(user)


@router.get("/me")
def me(user: User = Depends(get_current_user)):
    return serialize_user(user)


@router.post("/logout")
def logout(request: Request, user: User = Depends(get_current_user), db: Session = Depends(get_db)):
    """Invalide les jetons déjà émis pour ce compte (déconnexion côté serveur)."""
    user.token_version += 1
    db.commit()
    audit.log(db, "auth.logout", user=user, request=request)
    return {"detail": "Déconnecté."}


@router.put("/password")
def change_password(
    data: PasswordChangeIn,
    request: Request,
    user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    if not verify_password(data.current_password, user.password_hash):
        audit.log(db, "auth.password", user=user, success=False,
                  details={"reason": "mot de passe actuel incorrect"}, request=request)
        raise HTTPException(400, "Mot de passe actuel incorrect.")
    user.password_hash = hash_password(data.new_password)
    user.token_version += 1
    db.commit()
    audit.log(db, "auth.password", user=user, request=request)
    return _token_response(user)
