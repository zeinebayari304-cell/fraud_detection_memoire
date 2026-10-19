"""Routes /results/* : résultats scientifiques du mémoire.

Tout provient des fichiers du dépôt (tableaux exécutés des notebooks et JSON
de `artifacts/`) lus à la demande. Quand une source est absente, la route
renvoie `available: false` plutôt qu'une valeur inventée.
"""

import math

from fastapi import APIRouter

from model_service import MODEL_FILES, THRESHOLD, service
from notebook_tables import canonical_model, find_table, read_json

router = APIRouter(prefix="/results", tags=["Résultats du mémoire"])

NB03 = "03_baseline"
NB09 = "09_augmented_models"
NB10 = "10_zoo_hsj_attacks"
NB11 = "11_adversarial_training_defense"
NB12 = "12_final_model_selection"
NB01 = "01_data_audit"

MODEL_ORDER = list(MODEL_FILES)


def clean(value):
    """Rend la valeur sérialisable en JSON (NaN/inf -> None)."""
    if isinstance(value, float) and not math.isfinite(value):
        return None
    if isinstance(value, dict):
        return {k: clean(v) for k, v in value.items()}
    if isinstance(value, list):
        return [clean(v) for v in value]
    return value


def num(value):
    """Nombre depuis un float ou une chaîne « 99.90% » ; None si absent."""
    if value is None:
        return None
    if isinstance(value, str):
        text = value.strip().rstrip("%")
        try:
            return float(text)
        except ValueError:
            return None
    return None if (isinstance(value, float) and not math.isfinite(value)) else value


def pct(value):
    """Fraction (0-1) -> pourcentage ; None si absent."""
    value = num(value)
    return None if value is None else round(value * 100, 4)


def by_model(rows: list[dict] | None, key: str = "Model") -> dict[str, dict]:
    return {canonical_model(r[key]): r for r in (rows or []) if key in r}


def model_rank(name: str) -> int:
    return MODEL_ORDER.index(name) if name in MODEL_ORDER else len(MODEL_ORDER)


# ---------------------------------------------------------------- comparaison
@router.get("/models")
def models_comparison():
    stages = []

    # Baseline (notebook 03) : le premier tableau est le jeu de test, formaté en %.
    rows = find_table(NB03, ["Accuracy", "Average Precision"], 0)
    if rows:
        stages.append(
            {
                "id": "baseline",
                "label": "Baseline (jeu de test)",
                "source": f"{NB03}.ipynb",
                "models": [
                    {
                        "name": canonical_model(r["_index"]),
                        "accuracy": num(r["Accuracy"]),
                        "precision": num(r["Precision"]),
                        "recall": num(r["Recall"]),
                        "f1": num(r["F1-score"]),
                        "rocAuc": num(r["ROC-AUC"]),
                        "prAuc": num(r["Average Precision"]),
                    }
                    for r in rows
                ],
            }
        )

    # Après augmentation SMOTE (notebook 09).
    rows = find_table(NB09, ["Temps_s", "Accuracy", "AP", "TN"], 1)
    if rows:
        stages.append(
            {
                "id": "smote",
                "label": "Après SMOTE (jeu de test)",
                "source": f"{NB09}.ipynb",
                "models": [
                    {
                        "name": canonical_model(r["Modèle"]),
                        "accuracy": pct(r["Accuracy"]),
                        "precision": pct(r["Precision"]),
                        "recall": pct(r["Recall"]),
                        "f1": pct(r["F1"]),
                        "rocAuc": pct(r["ROC_AUC"]),
                        "prAuc": pct(r["AP"]),
                    }
                    for r in rows
                ],
            }
        )

    # Modèles défendus retenus (synthèse du notebook 11, jeu de test).
    # Attention : le tableau « Original / Defended » du même notebook porte sur
    # la validation ; il ne doit pas être présenté comme un résultat de test.
    rows = find_table(
        NB11,
        ["Model", "Selected_Version", "Accuracy", "Precision", "Recall", "F1",
         "ROC_AUC", "Before_HSJ_Local_ASR_%"],
        0,
    )
    if rows:
        # La PR-AUC de test n'est publiée que pour le modèle final (notebook 12).
        summary = read_json("notebook12_final_selection", "12_final_summary.json") or {}
        final_name = summary.get("selected_model")
        final_ap = (summary.get("test_clean") or {}).get("AP")

        stages.append(
            {
                "id": "defended",
                "label": "Après adversarial training (jeu de test)",
                "source": f"{NB11}.ipynb",
                "models": [
                    {
                        "name": canonical_model(r["Model"]),
                        "accuracy": pct(r["Accuracy"]),
                        "precision": pct(r["Precision"]),
                        "recall": pct(r["Recall"]),
                        "f1": pct(r["F1"]),
                        "rocAuc": pct(r["ROC_AUC"]),
                        "prAuc": pct(final_ap)
                        if final_ap is not None
                        and canonical_model(r["Model"]) == canonical_model(final_name or "")
                        else None,
                    }
                    for r in rows
                ],
            }
        )

    return clean({"available": bool(stages), "stages": stages})


# ------------------------------------------------------------------ robustesse
@router.get("/robustness")
def robustness():
    asr = find_table(NB10, ["Attack", "Model", "Attacks", "Successful_Attacks", "ASR", "CI95_Low"])
    dist = find_table(NB10, ["Attack", "Model", "Mean_L2_All", "Mean_Linf_All"])
    cost = find_table(NB10, ["Attack", "Model", "Mean_Queries", "Total_Time_min"])
    recall = find_table(NB10, ["Model", "ASR_HSJ", "ASR_ZOO", "Recall_Clean"])
    cond = find_table(NB10, ["Model", "Condition", "Accuracy", "Recall", "FN", "TP"])
    if not asr:
        return {"available": False}

    def index(rows):
        return {(r["Attack"], canonical_model(r["Model"])): r for r in rows or []}

    dist_i, cost_i = index(dist), index(cost)
    recall_i = by_model(recall)
    cond_i = {
        (r["Condition"], canonical_model(r["Model"])): r for r in cond or []
    }

    attacks: dict[str, list[dict]] = {"ZOO": [], "HSJ": []}
    for row in asr:
        attack, model = row["Attack"], canonical_model(row["Model"])
        if attack not in attacks:
            continue
        d, c = dist_i.get((attack, model), {}), cost_i.get((attack, model), {})
        clean_row, after_row = cond_i.get(("Clean", model), {}), cond_i.get((attack, model), {})
        attacks[attack].append(
            {
                "model": model,
                "attacks": row["Attacks"],
                "successes": row["Successful_Attacks"],
                "asr": row["ASR"],
                "ci_low": (row["CI95_Low"] if row["CI95_Low"] > 0 else 0.0)
                if row["CI95_Low"] is not None
                else None,
                "ci_high": row["CI95_High"],
                "mean_l2": d.get("Mean_L2_All"),
                "mean_linf": d.get("Mean_Linf_All"),
                "mean_l2_success": d.get("Mean_L2_Success"),
                "mean_linf_success": d.get("Mean_Linf_Success"),
                "mean_queries": c.get("Mean_Queries"),
                "mean_time_s": c.get("Mean_Time_s"),
                "recall_clean": pct(recall_i.get(model, {}).get("Recall_Clean")),
                "recall_after": pct(recall_i.get(model, {}).get(f"Recall_{attack}")),
                "fn_clean": clean_row.get("FN"),
                "fn_after": after_row.get("FN"),
                "tp_clean": clean_row.get("TP"),
                "tp_after": after_row.get("TP"),
            }
        )
    for rows in attacks.values():
        rows.sort(key=lambda r: model_rank(r["model"]))

    return clean({"available": True, "source": f"{NB10}.ipynb", "attacks": attacks})


# --------------------------------------------------------------------- défense
@router.get("/defense")
def defense():
    main = find_table(NB11, ["Model", "Selected_Version", "Before_HSJ_Local_ASR_%", "After_ZOO_Raw_ASR_%"])
    if not main:
        return {"available": False}

    recall = by_model(find_table(NB11, ["Model", "Recall_Original", "Recall_Defended", "FN_Original"]))
    gate = by_model(find_table(NB11, ["Model", "Clean_Gate", "HSJ_Original", "HSJ_Defended", "PASS"]))
    train = by_model(find_table(NB11, ["Model", "Train_Size", "Adversarial_Examples", "Training_Time_s"]))

    models = []
    for r in main:
        name = canonical_model(r["Model"])
        rc, gt, tr = recall.get(name, {}), gate.get(name, {}), train.get(name, {})
        models.append(
            {
                "model": name,
                "version": r["Selected_Version"],
                "hsj_before": r["Before_HSJ_Local_ASR_%"],
                "hsj_after": r["HSJ_Local_ASR_%"],
                "hsj_gain_points": r["HSJ_Gain_points"],
                "hsj_relative_reduction": r["HSJ_Relative_Reduction_%"],
                "zoo_before": r["Before_ZOO_Raw_ASR_%"],
                "zoo_after": r["After_ZOO_Raw_ASR_%"],
                "clean_recall_original": pct(rc.get("Recall_Original")),
                "clean_recall_defended": pct(rc.get("Recall_Defended")),
                "f1_original": pct(rc.get("F1_Original")),
                "f1_defended": pct(rc.get("F1_Defended")),
                "fn_original": rc.get("FN_Original"),
                "fn_defended": rc.get("FN_Defended"),
                "clean_retention": r["HSJ_Clean_Retention_%"],
                "clean_gate": rc.get("Clean_Gate"),
                "robust_gain": gt.get("Robust_Gain"),
                "passed": gt.get("PASS"),
                "train_size": tr.get("Train_Size"),
                "adversarial_examples": tr.get("Adversarial_Examples"),
                "training_time_s": tr.get("Training_Time_s"),
            }
        )
    models.sort(key=lambda m: model_rank(m["model"]))
    return clean({"available": True, "source": f"{NB11}.ipynb", "models": models})


# ----------------------------------------------------------------- modèle final
@router.get("/final-model")
def final_model():
    selection = read_json("notebook12_final_selection", "06_final_model_selection.json")
    summary = read_json("notebook12_final_selection", "12_final_summary.json")
    if not selection or not summary:
        return {"available": False}

    ranking = find_table(NB12, ["Primary_Rank", "Model", "Primary_Score"]) or []
    validation = find_table(NB12, ["Model", "Defense_Version", "AP", "HSJ_ASR", "HSJ_Robustness", "FN"]) or []

    hybrid = read_json("notebook13_hybrid", "30_final_summary.json") or {}

    deployed = next(
        (m for m in service.status() if m["name"] == selection["selected_model"]), None
    )

    return clean(
        {
            "available": True,
            "selected_model": selection["selected_model"],
            "defense_version": selection["defense_version"],
            "selection": {
                "dataset": selection.get("selection_dataset"),
                "rule": selection.get("selection_rule"),
                "criteria": selection.get("primary_criteria", []),
                "weights": selection.get("primary_weights", {}),
                "primary_score": selection.get("primary_score"),
                "pareto_efficient": selection.get("pareto_efficient"),
                "near_tie": selection.get("near_tie_under_1_percent"),
                "relative_gap_to_second": selection.get("relative_gap_to_second"),
                "stability": selection.get("stability_label"),
                "test_used_for_ranking": selection.get("test_used_to_rank_models_in_notebook12"),
                "threshold_optimized": selection.get("threshold_optimized_in_notebook12"),
                "retrained": selection.get("model_retrained_in_notebook12"),
            },
            "validation": summary.get("validation"),
            "test_clean": summary.get("test_clean"),
            "test_hsj": summary.get("test_hsj"),
            "ranking": [
                {
                    "rank": r["Primary_Rank"],
                    "model": canonical_model(r["Model"]),
                    "version": r["Defense_Version"],
                    "ap": r["AP"],
                    "f1": r["F1"],
                    "recall": r["Recall"],
                    "hsj_robustness": r["HSJ_Robustness"],
                    "score": r["Primary_Score"],
                    "pareto": r["Pareto"],
                }
                for r in ranking
            ],
            "candidates_validation": [
                {
                    "model": canonical_model(r["Model"]),
                    "version": r["Defense_Version"],
                    "ap": r["AP"],
                    "precision": r["Precision"],
                    "recall": r["Recall"],
                    "f1": r["F1"],
                    "mcc": r["MCC"],
                    "roc_auc": r["ROC_AUC"],
                    "fp": r["FP"],
                    "fn": r["FN"],
                    "tp": r["TP"],
                    "hsj_asr": r["HSJ_ASR"],
                    "hsj_robustness": r["HSJ_Robustness"],
                }
                for r in validation
            ],
            "hybrid_check": {
                "decision": hybrid.get("decision"),
                "limitations": hybrid.get("limitations", []),
            }
            if hybrid
            else None,
            "deployment": {
                "model_file_loaded": bool(deployed and deployed["loaded"]),
                "detail": deployed["error"] if deployed else None,
                "threshold": THRESHOLD,
            },
        }
    )


# -------------------------------------------------------------------- jeu de données
@router.get("/dataset")
def dataset():
    rows = find_table(NB01, ["Contrôle", "Résultat"])
    if not rows:
        return {"available": False}
    values = {r["Contrôle"]: r["Résultat"] for r in rows}
    return clean(
        {
            "available": True,
            "source": f"{NB01}.ipynb",
            "transactions": values.get("Nombre de transactions"),
            "normal": values.get("Transactions normales"),
            "fraud": values.get("Transactions frauduleuses"),
            "fraud_rate": values.get("Taux de fraude (%)"),
            "duplicates": values.get("Doublons exacts"),
        }
    )
