"""Authentification (JWT), mots de passe (bcrypt) et rôles du diagramme UML.

Rôles :
- analyste : analyse des transactions (transaction, CSV, CRUD, historique, export)
- expert   : résultats scientifiques (comparaison, attaques, défense, modèle final)
- admin    : administration (utilisateurs et rôles, journaux d'audit),
             et accès à toutes les autres fonctions
Le tableau de bord est accessible à tous les rôles connectés.
"""

import logging
import os
import secrets
from datetime import timedelta

import bcrypt
import jwt
from fastapi import Depends, HTTPException
from fastapi.security import HTTPAuthorizationCredentials, HTTPBearer
from sqlalchemy.orm import Session

from database import DATA_DIR, get_db
from db_models import User
from timeutil import utcnow

logger = logging.getLogger("fraud-api")

ANALYST = "analyste"
EXPERT = "expert"
ADMIN = "admin"
ROLES = (ANALYST, EXPERT, ADMIN)
ROLE_LABELS = {
    ANALYST: "Analyste antifraude",
    EXPERT: "Expert cybersécurité / Data Scientist",
    ADMIN: "Administrateur",
}

JWT_ALGORITHM = "HS256"
JWT_EXPIRE_MINUTES = int(os.getenv("FRAUD_JWT_EXPIRE_MINUTES", "120"))
BCRYPT_ROUNDS = int(os.getenv("FRAUD_BCRYPT_ROUNDS", "12"))

# Verrouillage après plusieurs échecs de connexion.
MAX_FAILED_LOGINS = 5
LOCK_MINUTES = 15


def _load_secret() -> str:
    """Secret JWT : variable d'environnement, sinon fichier local généré une fois."""
    secret = os.getenv("FRAUD_JWT_SECRET", "").strip()
    if secret:
        return secret
    path = DATA_DIR / ".jwt_secret"
    if path.is_file():
        return path.read_text(encoding="utf-8").strip()
    DATA_DIR.mkdir(parents=True, exist_ok=True)
    secret = secrets.token_urlsafe(48)
    path.write_text(secret, encoding="utf-8")
    logger.warning("[auth] FRAUD_JWT_SECRET absent : secret généré dans %s", path)
    return secret


JWT_SECRET = _load_secret()


# ---------------------------------------------------------------- mots de passe
def hash_password(password: str) -> str:
    return bcrypt.hashpw(password.encode("utf-8"), bcrypt.gensalt(BCRYPT_ROUNDS)).decode()


def verify_password(password: str, password_hash: str) -> bool:
    try:
        return bcrypt.checkpw(password.encode("utf-8"), password_hash.encode())
    except ValueError:
        return False


# Empreinte factice : un identifiant inconnu prend le même temps qu'un mauvais
# mot de passe (on ne révèle pas quels comptes existent).
DUMMY_HASH = hash_password(secrets.token_urlsafe(16))


# ------------------------------------------------------------------------ JWT
def create_token(user: User) -> str:
    now = utcnow()
    payload = {
        "sub": str(user.id),
        "role": user.role,
        "tv": user.token_version,
        "iat": now,
        "exp": now + timedelta(minutes=JWT_EXPIRE_MINUTES),
    }
    return jwt.encode(payload, JWT_SECRET, algorithm=JWT_ALGORITHM)


_bearer = HTTPBearer(auto_error=False)


def _unauthorized(message: str) -> HTTPException:
    return HTTPException(401, message, headers={"WWW-Authenticate": "Bearer"})


def get_current_user(
    credentials: HTTPAuthorizationCredentials | None = Depends(_bearer),
    db: Session = Depends(get_db),
) -> User:
    if credentials is None:
        raise _unauthorized("Authentification requise : connectez-vous.")
    try:
        payload = jwt.decode(
            credentials.credentials, JWT_SECRET, algorithms=[JWT_ALGORITHM]
        )
        user_id = int(payload["sub"])
        version = int(payload["tv"])
    except (jwt.PyJWTError, KeyError, ValueError) as exc:
        raise _unauthorized("Session expirée ou invalide : reconnectez-vous.") from exc

    user = db.get(User, user_id)
    if user is None or not user.is_active or user.token_version != version:
        raise _unauthorized("Session expirée ou invalide : reconnectez-vous.")
    return user


def require_roles(*roles: str):
    """Dépendance : l'utilisateur connecté doit avoir l'un des rôles donnés.

    L'administrateur a accès à tout (il peut aussi réaliser les cas des autres
    acteurs) ; l'analyste et l'expert restent limités à leurs cas d'utilisation.
    Le rôle est relu en base à chaque requête : un changement de rôle par
    l'administrateur s'applique immédiatement.
    """

    def dependency(user: User = Depends(get_current_user)) -> User:
        if user.role != ADMIN and user.role not in roles:
            raise HTTPException(403, "Accès refusé : votre rôle ne permet pas cette action.")
        return user

    return dependency
