"""Gestion des utilisateurs et des rôles (cas « Gérer les utilisateurs et les rôles »)."""

from fastapi import APIRouter, Depends, HTTPException, Query, Request
from sqlalchemy import func, or_, select
from sqlalchemy.orm import Session

import audit
from auth_routes import ensure_unique, serialize_user
from database import get_db
from db_models import User
from schemas import UserCreateIn, UserUpdateIn
from security import ADMIN, ROLES, hash_password, require_roles

router = APIRouter(prefix="/users", tags=["Utilisateurs"])
admin_only = require_roles(ADMIN)


def _get_user(db: Session, user_id: int) -> User:
    user = db.get(User, user_id)
    if user is None:
        raise HTTPException(404, "Utilisateur introuvable.")
    return user


def _active_admins(db: Session) -> int:
    return db.scalar(
        select(func.count(User.id)).where(User.role == ADMIN, User.is_active.is_(True))
    )


@router.get("")
def list_users(
    q: str = Query("", max_length=100),
    role: str = Query("all"),
    status: str = Query("all"),
    page: int = Query(1, ge=1),
    page_size: int = Query(20, ge=1, le=100),
    _: User = Depends(admin_only),
    db: Session = Depends(get_db),
):
    query = select(User)
    if q.strip():
        pattern = f"%{q.strip().lower()}%"
        query = query.where(
            or_(
                func.lower(User.username).like(pattern),
                func.lower(User.email).like(pattern),
                func.lower(func.coalesce(User.full_name, "")).like(pattern),
            )
        )
    if role != "all":
        if role not in ROLES:
            raise HTTPException(422, f"Rôle inconnu : {role}")
        query = query.where(User.role == role)
    if status == "active":
        query = query.where(User.is_active.is_(True))
    elif status == "inactive":
        query = query.where(User.is_active.is_(False))

    total = db.scalar(select(func.count()).select_from(query.subquery()))
    users = db.scalars(
        query.order_by(User.created_at.desc(), User.id.desc())
        .offset((page - 1) * page_size)
        .limit(page_size)
    ).all()
    return {
        "total": total,
        "page": page,
        "page_size": page_size,
        "rows": [serialize_user(u) for u in users],
        "roles": list(ROLES),
    }


@router.get("/{user_id}")
def get_user(user_id: int, _: User = Depends(admin_only), db: Session = Depends(get_db)):
    return serialize_user(_get_user(db, user_id))


@router.post("", status_code=201)
def create_user(
    data: UserCreateIn,
    request: Request,
    admin: User = Depends(admin_only),
    db: Session = Depends(get_db),
):
    ensure_unique(db, data.username, data.email)
    user = User(
        username=data.username,
        email=data.email,
        full_name=data.full_name,
        role=data.role,
        is_active=data.is_active,
        password_hash=hash_password(data.password),
    )
    db.add(user)
    db.commit()
    audit.log(db, "user.create", user=admin, target=f"user:{user.id}",
              details={"username": user.username, "role": user.role}, request=request)
    return serialize_user(user)


@router.put("/{user_id}")
def update_user(
    user_id: int,
    data: UserUpdateIn,
    request: Request,
    admin: User = Depends(admin_only),
    db: Session = Depends(get_db),
):
    user = _get_user(db, user_id)
    changes: dict = {}

    loses_admin = user.role == ADMIN and user.is_active and (
        (data.role is not None and data.role != ADMIN) or data.is_active is False
    )
    if loses_admin and _active_admins(db) <= 1:
        raise HTTPException(409, "Impossible : il doit rester au moins un administrateur actif.")
    if user.id == admin.id and data.is_active is False:
        raise HTTPException(409, "Vous ne pouvez pas désactiver votre propre compte.")

    if data.email is not None and data.email != user.email:
        ensure_unique(db, None, data.email, exclude_id=user.id)
        changes["email"] = [user.email, data.email]
        user.email = data.email
    if "full_name" in data.model_fields_set and data.full_name != user.full_name:
        changes["full_name"] = [user.full_name, data.full_name]
        user.full_name = data.full_name

    invalidate_sessions = False
    if data.role is not None and data.role != user.role:
        changes["role"] = [user.role, data.role]
        user.role = data.role
        invalidate_sessions = True
    if data.is_active is not None and data.is_active != user.is_active:
        changes["is_active"] = [user.is_active, data.is_active]
        user.is_active = data.is_active
        invalidate_sessions = invalidate_sessions or not data.is_active
    if data.password is not None:
        user.password_hash = hash_password(data.password)
        changes["password"] = "réinitialisé"
        invalidate_sessions = True
    if data.unlock or (data.is_active and changes.get("is_active")):
        if user.locked_until or user.failed_logins:
            changes["unlocked"] = True
        user.locked_until = None
        user.failed_logins = 0

    if invalidate_sessions:
        user.token_version += 1
    db.commit()
    audit.log(db, "user.update", user=admin, target=f"user:{user.id}",
              details={"username": user.username, "changes": changes}, request=request)
    return serialize_user(user)


@router.delete("/{user_id}")
def delete_user(
    user_id: int,
    request: Request,
    admin: User = Depends(admin_only),
    db: Session = Depends(get_db),
):
    user = _get_user(db, user_id)
    if user.id == admin.id:
        raise HTTPException(409, "Vous ne pouvez pas supprimer votre propre compte.")
    if user.role == ADMIN and user.is_active and _active_admins(db) <= 1:
        raise HTTPException(409, "Impossible : il doit rester au moins un administrateur actif.")

    username = user.username
    db.delete(user)
    db.commit()
    audit.log(db, "user.delete", user=admin, target=f"user:{user_id}",
              details={"username": username}, request=request)
    return {"detail": f"Utilisateur « {username} » supprimé."}
