"""Dates en UTC « naïves » : même comportement sous SQLite et PostgreSQL."""

from datetime import datetime, timezone


def utcnow() -> datetime:
    return datetime.now(timezone.utc).replace(tzinfo=None)


def iso(value: datetime | None) -> str | None:
    """Date UTC au format ISO 8601 avec le suffixe Z (lu correctement par le navigateur)."""
    return None if value is None else value.isoformat(timespec="seconds") + "Z"
