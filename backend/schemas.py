"""Contrôle de saisie (validation côté serveur).

Les mêmes règles sont appliquées dans l'interface (frontend/src/validation.ts),
mais seul le serveur fait foi.
"""

import math
import os
import re

from email_validator import EmailNotValidError, validate_email
from pydantic import BaseModel, field_validator, model_validator

from model_service import FEATURES
from security import ROLES

# Démonstrations / tests uniquement : autorise les domaines réservés (ex. « .test »).
ALLOW_TEST_EMAILS = os.getenv("FRAUD_ALLOW_TEST_EMAILS", "") == "1"

USERNAME_RE = re.compile(r"^[A-Za-z][A-Za-z0-9._-]{2,29}$")
FULL_NAME_RE = re.compile(r"^[A-Za-zÀ-ÖØ-öø-ÿ' .-]{2,100}$")


def check_username(value: str) -> str:
    value = value.strip()
    if not USERNAME_RE.fullmatch(value):
        raise ValueError(
            "Nom d'utilisateur invalide : 3 à 30 caractères, commence par une lettre, "
            "puis lettres, chiffres, point, tiret ou tiret bas."
        )
    return value.lower()


def check_email(value: str) -> str:
    try:
        return validate_email(
            value.strip(),
            check_deliverability=False,
            test_environment=ALLOW_TEST_EMAILS,
        ).normalized.lower()
    except EmailNotValidError as exc:
        raise ValueError("Adresse e-mail invalide.") from exc


def check_password(value: str) -> str:
    problems = []
    if len(value) < 8:
        problems.append("au moins 8 caractères")
    if len(value) > 64 or len(value.encode("utf-8")) > 72:
        problems.append("au plus 64 caractères")
    if not re.search(r"[a-z]", value):
        problems.append("une minuscule")
    if not re.search(r"[A-Z]", value):
        problems.append("une majuscule")
    if not re.search(r"\d", value):
        problems.append("un chiffre")
    if value != value.strip():
        problems.append("pas d'espace au début ni à la fin")
    if problems:
        raise ValueError("Mot de passe trop faible : " + ", ".join(problems) + ".")
    return value


def check_full_name(value: str | None) -> str | None:
    if value is None or not value.strip():
        return None
    value = " ".join(value.split())
    if not FULL_NAME_RE.fullmatch(value):
        raise ValueError("Nom complet invalide : 2 à 100 lettres (espaces, tirets et apostrophes permis).")
    return value


def check_role(value: str) -> str:
    if value not in ROLES:
        raise ValueError(f"Rôle inconnu : choisissez parmi {', '.join(ROLES)}.")
    return value


# ------------------------------------------------------------------- comptes
class RegisterIn(BaseModel):
    username: str
    email: str
    password: str
    password_confirm: str
    full_name: str | None = None

    _u = field_validator("username")(lambda cls, v: check_username(v))
    _e = field_validator("email")(lambda cls, v: check_email(v))
    _p = field_validator("password")(lambda cls, v: check_password(v))
    _n = field_validator("full_name")(lambda cls, v: check_full_name(v))

    @model_validator(mode="after")
    def _passwords_match(self):
        if self.password != self.password_confirm:
            raise ValueError("Les deux mots de passe ne correspondent pas.")
        if self.username.lower() in self.password.lower():
            raise ValueError("Le mot de passe ne doit pas contenir le nom d'utilisateur.")
        return self


class LoginIn(BaseModel):
    identifier: str  # nom d'utilisateur ou e-mail
    password: str

    @field_validator("identifier")
    @classmethod
    def _identifier(cls, value: str) -> str:
        value = value.strip().lower()
        if not 3 <= len(value) <= 254:
            raise ValueError("Saisissez votre nom d'utilisateur ou votre e-mail.")
        return value

    @field_validator("password")
    @classmethod
    def _password(cls, value: str) -> str:
        if not value or len(value) > 128:
            raise ValueError("Saisissez votre mot de passe.")
        return value


class PasswordChangeIn(BaseModel):
    current_password: str
    new_password: str
    new_password_confirm: str

    _p = field_validator("new_password")(lambda cls, v: check_password(v))

    @model_validator(mode="after")
    def _match(self):
        if self.new_password != self.new_password_confirm:
            raise ValueError("Les deux mots de passe ne correspondent pas.")
        if self.new_password == self.current_password:
            raise ValueError("Le nouveau mot de passe doit être différent de l'actuel.")
        return self


class UserCreateIn(BaseModel):
    username: str
    email: str
    password: str
    role: str
    full_name: str | None = None
    is_active: bool = True

    _u = field_validator("username")(lambda cls, v: check_username(v))
    _e = field_validator("email")(lambda cls, v: check_email(v))
    _p = field_validator("password")(lambda cls, v: check_password(v))
    _r = field_validator("role")(lambda cls, v: check_role(v))
    _n = field_validator("full_name")(lambda cls, v: check_full_name(v))


class UserUpdateIn(BaseModel):
    email: str | None = None
    full_name: str | None = None
    role: str | None = None
    is_active: bool | None = None
    password: str | None = None  # réinitialisation par l'administrateur
    unlock: bool = False

    @field_validator("email")
    @classmethod
    def _email(cls, value):
        return None if value is None else check_email(value)

    @field_validator("role")
    @classmethod
    def _role(cls, value):
        return None if value is None else check_role(value)

    @field_validator("password")
    @classmethod
    def _password(cls, value):
        return None if value is None else check_password(value)

    @field_validator("full_name")
    @classmethod
    def _full_name(cls, value):
        return check_full_name(value)


# --------------------------------------------------------------- transactions
def check_features(features: dict[str, float]) -> dict[str, float]:
    missing = [f for f in FEATURES if f not in features]
    if missing:
        raise ValueError(f"Variables manquantes : {', '.join(missing)}.")
    extra = [f for f in features if f not in FEATURES]
    if extra:
        raise ValueError(f"Variables inconnues : {', '.join(extra)}.")
    clean = {}
    for name in FEATURES:
        value = features[name]
        if not isinstance(value, (int, float)) or isinstance(value, bool) or not math.isfinite(value):
            raise ValueError(f"{name} doit être un nombre fini.")
        clean[name] = float(value)
    if clean["Time"] < 0 or clean["Amount"] < 0:
        raise ValueError("Time et Amount doivent être positifs ou nuls.")
    return clean


def check_reference(value: str | None) -> str | None:
    if value is None or not value.strip():
        return None
    value = value.strip()
    if len(value) > 64:
        raise ValueError("Référence : 64 caractères au maximum.")
    if not re.fullmatch(r"[\w .:/#-]+", value):
        raise ValueError("Référence : lettres, chiffres, espaces et . : / # - _ uniquement.")
    return value


def check_description(value: str | None) -> str | None:
    if value is None or not value.strip():
        return None
    value = value.strip()
    if len(value) > 500:
        raise ValueError("Description : 500 caractères au maximum.")
    return value


def check_label(value: int | None) -> int | None:
    if value is not None and value not in (0, 1):
        raise ValueError("Classe réelle : 0 (normale), 1 (fraude) ou vide.")
    return value


class TransactionIn(BaseModel):
    features: dict[str, float]
    reference: str | None = None
    description: str | None = None
    true_label: int | None = None
    source: str = "manuel"
    dataset_row: int | None = None

    _f = field_validator("features")(lambda cls, v: check_features(v))
    _r = field_validator("reference")(lambda cls, v: check_reference(v))
    _d = field_validator("description")(lambda cls, v: check_description(v))
    _l = field_validator("true_label")(lambda cls, v: check_label(v))

    @field_validator("source")
    @classmethod
    def _source(cls, value: str) -> str:
        if value not in ("manuel", "jeu de données", "csv"):
            raise ValueError("Source inconnue.")
        return value


class TransactionUpdateIn(BaseModel):
    features: dict[str, float] | None = None
    reference: str | None = None
    description: str | None = None
    true_label: int | None = None
    clear_label: bool = False

    @field_validator("features")
    @classmethod
    def _features(cls, value):
        return None if value is None else check_features(value)

    _r = field_validator("reference")(lambda cls, v: check_reference(v))
    _d = field_validator("description")(lambda cls, v: check_description(v))
    _l = field_validator("true_label")(lambda cls, v: check_label(v))
