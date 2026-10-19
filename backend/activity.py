"""Journal d'activité : chaque transaction analysée via l'API est enregistrée.

Le tableau de bord lit ce journal (SQLite, fichier local `backend/data/`) :
volumes, fraudes signalées, séries temporelles et dernières alertes sont donc
calculés à partir des analyses réellement effectuées dans l'application.
"""

import os
import sqlite3
import threading
from contextlib import contextmanager
from datetime import datetime, timedelta, timezone
from pathlib import Path

DB_PATH = Path(
    os.getenv("FRAUD_DB_PATH", Path(__file__).resolve().parent / "data" / "activity.db")
)

_lock = threading.Lock()

_SCHEMA = """
CREATE TABLE IF NOT EXISTS predictions (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    ts TEXT NOT NULL,
    source TEXT NOT NULL,
    model TEXT NOT NULL,
    amount REAL NOT NULL,
    probability REAL NOT NULL,
    is_fraud INTEGER NOT NULL
);
CREATE INDEX IF NOT EXISTS idx_predictions_ts ON predictions (ts);
"""


@contextmanager
def _connect():
    DB_PATH.parent.mkdir(parents=True, exist_ok=True)
    with _lock:
        connection = sqlite3.connect(DB_PATH)
        try:
            connection.executescript(_SCHEMA)
            yield connection
            connection.commit()
        finally:
            connection.close()


def record(source: str, model: str, rows: list[tuple[float, float, bool]]) -> None:
    """Enregistre des prédictions : (montant, probabilité, fraude?)."""
    now = datetime.now(timezone.utc).isoformat(timespec="seconds")
    with _connect() as db:
        db.executemany(
            "INSERT INTO predictions (ts, source, model, amount, probability, is_fraud)"
            " VALUES (?, ?, ?, ?, ?, ?)",
            [(now, source, model, a, p, int(f)) for a, p, f in rows],
        )


def _risk_level(probability: float) -> str:
    return "Élevé" if probability >= 0.75 else "Moyen" if probability >= 0.4 else "Faible"


PERIODS = {"7j": 7, "30j": 30, "90j": 90}


def summary(period: str) -> dict:
    days = PERIODS[period]
    since = datetime.now(timezone.utc) - timedelta(days=days)
    since_iso = since.isoformat(timespec="seconds")

    with _connect() as db:
        total, fraud = db.execute(
            "SELECT COUNT(*), COALESCE(SUM(is_fraud), 0) FROM predictions WHERE ts >= ?",
            (since_iso,),
        ).fetchone()

        all_time = db.execute(
            "SELECT COUNT(*), COALESCE(SUM(is_fraud), 0) FROM predictions"
        ).fetchone()

        by_model = db.execute(
            "SELECT model, COUNT(*), COALESCE(SUM(is_fraud), 0) FROM predictions"
            " WHERE ts >= ? GROUP BY model ORDER BY COUNT(*) DESC",
            (since_iso,),
        ).fetchall()

        # 7j / 30j : un point par jour ; 90j : un point par semaine.
        bucket = 1 if days <= 30 else 7
        daily = dict(
            (day, (n, f))
            for day, n, f in db.execute(
                "SELECT substr(ts, 1, 10), COUNT(*), COALESCE(SUM(is_fraud), 0)"
                " FROM predictions WHERE ts >= ? GROUP BY substr(ts, 1, 10)",
                (since_iso,),
            )
        )

        alerts = db.execute(
            "SELECT id, ts, model, amount, probability FROM predictions"
            " WHERE is_fraud = 1 ORDER BY id DESC LIMIT 8"
        ).fetchall()

    today = datetime.now(timezone.utc).date()
    start = today - timedelta(days=days - 1)
    series = []
    cursor = start
    while cursor <= today:
        end = min(cursor + timedelta(days=bucket - 1), today)
        n = f = 0
        day = cursor
        while day <= end:
            dn, df = daily.get(day.isoformat(), (0, 0))
            n, f = n + dn, f + df
            day += timedelta(days=1)
        series.append({"label": cursor.strftime("%d/%m"), "total": n, "alerts": int(f)})
        cursor = end + timedelta(days=1)

    return {
        "period": period,
        "totals": {
            "analyzed": total,
            "fraud": int(fraud),
            "normal": total - int(fraud),
            "fraud_rate": (int(fraud) / total * 100) if total else 0.0,
            "all_time": all_time[0],
        },
        "series": series,
        "by_model": [{"model": m, "total": n, "fraud": int(f)} for m, n, f in by_model],
        "alerts": [
            {
                "id": f"TX-{row_id:06d}",
                "at": ts,
                "model": model,
                "amount": amount,
                "score": round(probability * 100, 1),
                "risk": _risk_level(probability),
            }
            for row_id, ts, model, amount, probability in alerts
        ],
    }
