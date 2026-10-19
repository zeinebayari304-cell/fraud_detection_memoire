"""Chargement des modèles entraînés et prédiction.

Pipeline d'inférence identique à celui du notebook 02 :
    1. Amount -> log1p(Amount)
    2. MinMaxScaler (ajusté sur le train) sur les 30 colonnes
    3. predict_proba du modèle, puis comparaison au seuil

Les fichiers .joblib ne sont pas versionnés (voir .gitignore) : ils sont
déposés dans le dossier `models/` à la racine du projet.
"""

import logging
import os
from pathlib import Path

import joblib
import numpy as np
import pandas as pd

logger = logging.getLogger("fraud-api")

FEATURES = ["Time", *[f"V{i}" for i in range(1, 29)], "Amount"]

MODELS_DIR = Path(
    os.getenv("FRAUD_MODELS_DIR", Path(__file__).resolve().parent.parent / "models")
)
SCALER_FILE = "minmax_scaler.joblib"

# Nom affiché dans l'interface -> fichier sauvegardé par le notebook 11.
MODEL_FILES = {
    "Random Forest": "random_forest_selected.joblib",
    "XGBoost": "xgboost_selected.joblib",
    "LightGBM": "lightgbm_selected.joblib",
    "Régression logistique": "logistic_regression_selected.joblib",
    "SVM linéaire": "linear_svm_selected.joblib",
}

# Modèle final retenu par le notebook 12.
DEFAULT_MODEL = "Random Forest"

# Seuil par défaut = predict() natif des modèles (0.5), qui reproduit les
# résultats de test du mémoire. Modifiable via la variable FRAUD_THRESHOLD.
THRESHOLD = float(os.getenv("FRAUD_THRESHOLD", "0.5"))


class ModelNotLoadedError(RuntimeError):
    """Le modèle (ou le scaler) demandé n'est pas disponible."""


class ModelService:
    def __init__(self) -> None:
        self.scaler = None
        self.models: dict[str, object] = {}
        self.errors: dict[str, str] = {}

    def load(self) -> None:
        self.scaler, self.models, self.errors = None, {}, {}

        scaler_path = MODELS_DIR / SCALER_FILE
        if scaler_path.is_file():
            try:
                self.scaler = joblib.load(scaler_path)
                logger.info("[models] scaler OK: %s", scaler_path)
            except Exception as exc:  # noqa: BLE001 - best effort
                self.errors["scaler"] = str(exc)
                logger.error("[models] scaler illisible: %s", exc)
        else:
            self.errors["scaler"] = f"Fichier absent : {scaler_path}"
            logger.warning("[models] skipping scaler, absent: %s", scaler_path)

        for name, filename in MODEL_FILES.items():
            path = MODELS_DIR / filename
            if not path.is_file():
                self.errors[name] = f"Fichier absent : {path}"
                logger.warning("[models] skipping %s, absent: %s", name, path)
                continue
            try:
                self.models[name] = joblib.load(path)
                logger.info("[models] %s OK", name)
            except Exception as exc:  # noqa: BLE001 - best effort
                self.errors[name] = str(exc)
                logger.error("[models] %s illisible: %s", name, exc)

    def status(self) -> list[dict]:
        return [
            {
                "name": name,
                "loaded": name in self.models and self.scaler is not None,
                "error": None
                if name in self.models and self.scaler is not None
                else self.errors.get(name) or self.errors.get("scaler"),
            }
            for name in MODEL_FILES
        ]

    @property
    def ready(self) -> bool:
        return self.scaler is not None and DEFAULT_MODEL in self.models

    def _get(self, name: str):
        if name not in MODEL_FILES:
            raise KeyError(f"Modèle inconnu : {name}")
        if self.scaler is None:
            raise ModelNotLoadedError(
                f"Scaler non chargé ({self.errors.get('scaler', 'raison inconnue')})."
            )
        if name not in self.models:
            raise ModelNotLoadedError(
                f"Modèle « {name} » non chargé "
                f"({self.errors.get(name, 'raison inconnue')})."
            )
        return self.models[name]

    def predict_proba(self, df: pd.DataFrame, name: str) -> np.ndarray:
        """Probabilité de fraude pour chaque ligne de `df` (colonnes brutes)."""
        model = self._get(name)

        raw = df[FEATURES].astype(float).copy()
        raw["Amount"] = np.log1p(raw["Amount"])
        scaled = pd.DataFrame(
            self.scaler.transform(raw), columns=FEATURES, index=raw.index
        )

        if hasattr(model, "predict_proba"):
            return model.predict_proba(scaled)[:, 1]
        # SVM linéaire sans probabilités : sigmoïde de la distance à l'hyperplan.
        return 1.0 / (1.0 + np.exp(-model.decision_function(scaled)))


service = ModelService()
