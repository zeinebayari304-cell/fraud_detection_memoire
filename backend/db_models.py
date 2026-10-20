"""Tables de l'application (diagramme de cas d'utilisation)."""

from datetime import datetime

from sqlalchemy import JSON, Boolean, DateTime, Float, ForeignKey, Integer, String
from sqlalchemy.orm import Mapped, mapped_column, relationship

from database import Base
from timeutil import utcnow


class User(Base):
    """Compte : Analyste antifraude, Expert / Data Scientist ou Administrateur."""

    __tablename__ = "users"

    id: Mapped[int] = mapped_column(primary_key=True)
    username: Mapped[str] = mapped_column(String(30), unique=True, index=True)
    email: Mapped[str] = mapped_column(String(254), unique=True, index=True)
    full_name: Mapped[str | None] = mapped_column(String(100))
    password_hash: Mapped[str] = mapped_column(String(100))
    role: Mapped[str] = mapped_column(String(20), default="analyste")
    is_active: Mapped[bool] = mapped_column(Boolean, default=True)
    # Incrémenté à la déconnexion / désactivation / nouveau mot de passe :
    # tous les jetons JWT déjà émis deviennent invalides.
    token_version: Mapped[int] = mapped_column(Integer, default=0)
    failed_logins: Mapped[int] = mapped_column(Integer, default=0)
    locked_until: Mapped[datetime | None] = mapped_column(DateTime)
    last_login_at: Mapped[datetime | None] = mapped_column(DateTime)
    created_at: Mapped[datetime] = mapped_column(DateTime, default=utcnow)
    updated_at: Mapped[datetime] = mapped_column(DateTime, default=utcnow, onupdate=utcnow)


class Transaction(Base):
    """Transaction enregistrée par un analyste (CRUD)."""

    __tablename__ = "transactions"

    id: Mapped[int] = mapped_column(primary_key=True)
    owner_id: Mapped[int] = mapped_column(
        ForeignKey("users.id", ondelete="CASCADE"), index=True
    )
    reference: Mapped[str | None] = mapped_column(String(64))
    description: Mapped[str | None] = mapped_column(String(500))
    features: Mapped[dict] = mapped_column(JSON)
    amount: Mapped[float] = mapped_column(Float)
    time: Mapped[float] = mapped_column(Float)
    true_label: Mapped[int | None] = mapped_column(Integer)
    source: Mapped[str] = mapped_column(String(20), default="manuel")
    dataset_row: Mapped[int | None] = mapped_column(Integer)
    last_model: Mapped[str | None] = mapped_column(String(40))
    last_probability: Mapped[float | None] = mapped_column(Float)
    last_is_fraud: Mapped[bool | None] = mapped_column(Boolean)
    last_analyzed_at: Mapped[datetime | None] = mapped_column(DateTime)
    created_at: Mapped[datetime] = mapped_column(DateTime, default=utcnow, index=True)
    updated_at: Mapped[datetime] = mapped_column(DateTime, default=utcnow, onupdate=utcnow)


class Analysis(Base):
    """Une entrée de l'historique : analyse, comparaison ou test d'un modèle."""

    __tablename__ = "analyses"

    id: Mapped[int] = mapped_column(primary_key=True)
    user_id: Mapped[int | None] = mapped_column(
        ForeignKey("users.id", ondelete="SET NULL"), index=True
    )
    # single | file | transaction | comparison | evaluation
    kind: Mapped[str] = mapped_column(String(20), index=True)
    model: Mapped[str | None] = mapped_column(String(40))
    threshold: Mapped[float | None] = mapped_column(Float)
    filename: Mapped[str | None] = mapped_column(String(255))
    transaction_id: Mapped[int | None] = mapped_column(
        ForeignKey("transactions.id", ondelete="SET NULL")
    )
    total: Mapped[int] = mapped_column(Integer, default=0)
    fraud_count: Mapped[int] = mapped_column(Integer, default=0)
    summary: Mapped[dict | None] = mapped_column(JSON)
    created_at: Mapped[datetime] = mapped_column(DateTime, default=utcnow, index=True)

    results: Mapped[list["AnalysisResult"]] = relationship(
        back_populates="analysis", cascade="all, delete-orphan", passive_deletes=True
    )


class AnalysisResult(Base):
    """Résultat d'une transaction dans une analyse."""

    __tablename__ = "analysis_results"

    id: Mapped[int] = mapped_column(primary_key=True)
    analysis_id: Mapped[int] = mapped_column(
        ForeignKey("analyses.id", ondelete="CASCADE"), index=True
    )
    row_index: Mapped[int] = mapped_column(Integer)
    amount: Mapped[float] = mapped_column(Float)
    probability: Mapped[float] = mapped_column(Float)
    is_fraud: Mapped[bool] = mapped_column(Boolean)
    true_label: Mapped[int | None] = mapped_column(Integer)

    analysis: Mapped[Analysis] = relationship(back_populates="results")


class AuditLog(Base):
    """Journal d'audit : qui a fait quoi, quand, depuis où, avec quel résultat."""

    __tablename__ = "audit_logs"

    id: Mapped[int] = mapped_column(primary_key=True)
    created_at: Mapped[datetime] = mapped_column(DateTime, default=utcnow, index=True)
    user_id: Mapped[int | None] = mapped_column(
        ForeignKey("users.id", ondelete="SET NULL"), index=True
    )
    username: Mapped[str | None] = mapped_column(String(254))
    action: Mapped[str] = mapped_column(String(50), index=True)
    target: Mapped[str | None] = mapped_column(String(120))
    success: Mapped[bool] = mapped_column(Boolean, default=True)
    ip: Mapped[str | None] = mapped_column(String(45))
    details: Mapped[dict | None] = mapped_column(JSON)
