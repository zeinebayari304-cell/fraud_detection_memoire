"""Connexion à la base de données (SQLAlchemy).

- Docker : PostgreSQL, via FRAUD_DATABASE_URL=postgresql://utilisateur:motdepasse@db:5432/fraud
- Local sans Docker / tests : SQLite (fichier backend/data/app.db par défaut)

Le même code fonctionne sur les deux moteurs : seule l'URL change.
"""

import logging
import os
import time
from pathlib import Path

from sqlalchemy import create_engine, event, text
from sqlalchemy.orm import DeclarativeBase, Session, sessionmaker

logger = logging.getLogger("fraud-api")

BACKEND_DIR = Path(__file__).resolve().parent
DATA_DIR = BACKEND_DIR / "data"


def _database_url() -> str:
    url = os.getenv("FRAUD_DATABASE_URL", "").strip()
    if not url:
        return f"sqlite:///{(DATA_DIR / 'app.db').as_posix()}"
    # Pilote psycopg 3 pour PostgreSQL (postgresql:// ou postgres:// acceptés).
    for prefix in ("postgresql://", "postgres://"):
        if url.startswith(prefix):
            return "postgresql+psycopg://" + url[len(prefix):]
    return url


DATABASE_URL = _database_url()
IS_SQLITE = DATABASE_URL.startswith("sqlite")


def _make_engine():
    if IS_SQLITE:
        path = DATABASE_URL.removeprefix("sqlite:///")
        if path and path != ":memory:":
            Path(path).parent.mkdir(parents=True, exist_ok=True)
        engine = create_engine(DATABASE_URL, connect_args={"check_same_thread": False})

        @event.listens_for(engine, "connect")
        def _enable_foreign_keys(dbapi_connection, _record):
            cursor = dbapi_connection.cursor()
            cursor.execute("PRAGMA foreign_keys=ON")
            cursor.close()

        return engine
    return create_engine(DATABASE_URL, pool_pre_ping=True)


engine = _make_engine()
SessionLocal = sessionmaker(bind=engine, autoflush=False, expire_on_commit=False)


class Base(DeclarativeBase):
    pass


def get_db():
    """Dépendance FastAPI : une session par requête."""
    db = SessionLocal()
    try:
        yield db
    finally:
        db.close()


def init_db(retries: int = 15, delay: float = 2.0) -> None:
    """Crée les tables ; attend la base (utile au démarrage des conteneurs)."""
    import db_models  # noqa: F401  (enregistre les tables)

    for attempt in range(1, retries + 1):
        try:
            with engine.connect() as connection:
                connection.execute(text("SELECT 1"))
            break
        except Exception as exc:  # noqa: BLE001
            if attempt == retries:
                raise
            logger.warning("[db] base indisponible (%s), nouvel essai %d/%d", exc, attempt, retries)
            time.sleep(delay)

    Base.metadata.create_all(engine)
    logger.info("[db] prête : %s", "SQLite" if IS_SQLITE else "PostgreSQL")


def session_scope() -> Session:
    return SessionLocal()
