"""Environnement de test isolé.

Chaque session de tests utilise :
- une base SQLite temporaire (recréée avant chaque test) ;
- des modèles de substitution entraînés sur des données synthétiques
  (les vrais .joblib ne sont pas nécessaires pour tester l'application) ;
- un petit jeu creditcard.csv synthétique.
Rien n'est écrit dans backend/data, models/ ou data/raw du projet.
"""

import os
import sys
import tempfile
from pathlib import Path

import numpy as np
import pandas as pd
import pytest

BACKEND = Path(__file__).resolve().parents[1]
sys.path.insert(0, str(BACKEND))

FEATURES = ["Time", *[f"V{i}" for i in range(1, 29)], "Amount"]
TEST_PASSWORD = "Motdepasse1"


def _build_environment() -> Path:
    root = Path(tempfile.mkdtemp(prefix="fraud_tests_"))
    models_dir, data_dir = root / "models", root / "raw"
    models_dir.mkdir()
    data_dir.mkdir()

    os.environ.update(
        # FRAUD_TEST_DATABASE_URL permet de lancer les mêmes tests sur PostgreSQL (Docker).
        FRAUD_DATABASE_URL=os.environ.get("FRAUD_TEST_DATABASE_URL")
        or f"sqlite:///{(root / 'test.db').as_posix()}",
        FRAUD_MODELS_DIR=str(models_dir),
        FRAUD_DATA_DIR=str(data_dir),
        FRAUD_JWT_SECRET="secret-de-test-uniquement-0123456789abcdef",
        FRAUD_BCRYPT_ROUNDS="4",
        FRAUD_LEGACY_ACTIVITY_DB=str(root / "absent.db"),
        FRAUD_ADMIN_USERNAME="",
        FRAUD_ADMIN_EMAIL="",
        FRAUD_ADMIN_PASSWORD="",
        FRAUD_ALLOW_TEST_EMAILS="1",
    )

    # Modèles de substitution : fraude quand V14 est très négatif (comme dans les vraies données).
    import joblib
    from sklearn.ensemble import RandomForestClassifier
    from sklearn.linear_model import LogisticRegression
    from sklearn.preprocessing import MinMaxScaler

    rng = np.random.default_rng(0)
    n = 3000
    X = pd.DataFrame(rng.normal(size=(n, 30)), columns=FEATURES)
    X["Time"] = rng.uniform(0, 170000, n)
    X["Amount"] = rng.exponential(80, n)
    y = (X["V14"] < -1.8).astype(int)

    prepared = X.copy()
    prepared["Amount"] = np.log1p(prepared["Amount"])
    scaler = MinMaxScaler().fit(prepared)
    scaled = pd.DataFrame(scaler.transform(prepared), columns=FEATURES)
    joblib.dump(scaler, models_dir / "minmax_scaler.joblib")
    joblib.dump(RandomForestClassifier(30, random_state=0).fit(scaled, y),
                models_dir / "random_forest_selected.joblib")
    # Deuxième modèle chargé (fichier « xgboost ») pour tester la comparaison.
    joblib.dump(LogisticRegression(max_iter=500).fit(scaled, y), models_dir / "xgboost_selected.joblib")

    # Petit jeu de données au format creditcard.csv (avec 20 doublons).
    data = X.assign(Class=y)
    data = pd.concat([data, data.iloc[:20]], ignore_index=True)
    data.to_csv(root / "creditcard_source.csv", index=False)
    return root


TEST_ROOT = _build_environment()


@pytest.fixture(scope="session")
def app_module():
    import main

    return main


@pytest.fixture()
def client(app_module):
    """Client HTTP avec une base vide à chaque test."""
    from fastapi.testclient import TestClient

    from database import Base, engine

    Base.metadata.drop_all(engine)
    Base.metadata.create_all(engine)
    with TestClient(app_module.app) as test_client:
        yield test_client


@pytest.fixture()
def db():
    from database import SessionLocal

    with SessionLocal() as session:
        yield session


@pytest.fixture()
def make_user(client):
    """Crée un utilisateur directement en base et renvoie (utilisateur, en-têtes)."""
    from database import SessionLocal
    from db_models import User
    from security import hash_password

    def factory(role: str = "analyste", username: str | None = None, password: str = TEST_PASSWORD):
        name = username or f"{role}{np.random.randint(10_000, 99_999)}"
        with SessionLocal() as session:
            user = User(
                username=name,
                email=f"{name}@exemple.test",
                password_hash=hash_password(password),
                role=role,
            )
            session.add(user)
            session.commit()
            session.refresh(user)
        response = client.post("/auth/login", json={"identifier": name, "password": password})
        assert response.status_code == 200, response.text
        return user, {"Authorization": f"Bearer {response.json()['access_token']}"}

    return factory


def sample_features(fraud: bool = False) -> dict:
    features = {f: 0.0 for f in FEATURES}
    features.update(Time=1000.0, Amount=42.5)
    if fraud:
        features["V14"] = -6.0
    return features


def csv_bytes(rows: int = 10, frauds: int = 3, with_class: bool = True) -> bytes:
    lines = [",".join(FEATURES + (["Class"] if with_class else []))]
    for i in range(rows):
        fraud = i < frauds
        values = [sample_features(fraud)[f] for f in FEATURES]
        if with_class:
            values.append(1 if fraud else 0)
        lines.append(",".join(str(v) for v in values))
    return ("\n".join(lines) + "\n").encode()


@pytest.fixture()
def dataset_file():
    """Installe le petit creditcard.csv synthétique pour la durée du test."""
    import shutil

    target = Path(os.environ["FRAUD_DATA_DIR"]) / "creditcard.csv"
    shutil.copy(TEST_ROOT / "creditcard_source.csv", target)
    yield target
    target.unlink(missing_ok=True)
