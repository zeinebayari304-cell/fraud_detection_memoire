"""Historique, export, journal d'audit, tableau de bord, reprise de l'ancien journal, tests de modèle."""

import sqlite3

from conftest import TEST_PASSWORD, csv_bytes, sample_features


def test_single_prediction_is_recorded(client, make_user):
    _, headers = make_user("analyste")
    response = client.post("/predict", headers=headers,
                           json={"features": sample_features(fraud=True), "true_label": 1, "dataset_row": 12})
    assert response.status_code == 200
    analysis_id = response.json()["analysis_id"]

    listing = client.get("/history", headers=headers).json()
    assert listing["total"] == 1 and listing["rows"][0]["kind"] == "single"
    detail = client.get(f"/history/{analysis_id}", headers=headers).json()
    assert detail["results"][0]["true_label"] == 1 and detail["summary"]["dataset_row"] == 12


def test_file_prediction_history_and_export(client, make_user):
    _, headers = make_user("analyste")
    response = client.post("/predict-file", headers=headers,
                           files={"file": ("lot.csv", csv_bytes(rows=10, frauds=3), "text/csv")})
    assert response.status_code == 200, response.text
    body = response.json()
    assert body["count"] == 10 and body["fraud_count"] == 3

    detail = client.get(f"/history/{body['analysis_id']}", headers=headers).json()
    assert detail["kind"] == "file" and detail["filename"] == "lot.csv"
    assert detail["total"] == 10 and detail["labelled"] == 10 and detail["correct"] == 10
    assert len(detail["results"]) == 10

    export = client.get(f"/history/{body['analysis_id']}/export", headers=headers)
    assert export.status_code == 200
    assert export.headers["content-type"].startswith("text/csv")
    lines = export.content.decode("utf-8-sig").strip().splitlines()
    assert lines[0].startswith("Ligne;Montant;Probabilite_fraude")
    assert len(lines) == 11 and lines[1].endswith("Fraude suspectée;Fraude")


def test_file_prediction_validation(client, make_user):
    _, headers = make_user("analyste")
    bad = client.post("/predict-file", headers=headers, files={"file": ("x.csv", b"a,b\n1,2\n", "text/csv")})
    assert bad.status_code == 422 and "Colonnes manquantes" in bad.json()["detail"]
    empty = client.post("/predict-file", headers=headers,
                        files={"file": ("x.csv", csv_bytes(rows=0, frauds=0), "text/csv")})
    assert empty.status_code == 422


def test_history_filters_isolation_and_delete(client, make_user):
    _, alice = make_user("analyste", username="alice")
    _, bruno = make_user("analyste", username="bruno")
    client.post("/predict", headers=alice, json={"features": sample_features()})
    client.post("/predict-all", headers=alice, json={"features": sample_features(fraud=True)})

    rows = client.get("/history", headers=alice).json()["rows"]
    assert {r["kind"] for r in rows} == {"single", "comparison"}
    comparison = next(r for r in rows if r["kind"] == "comparison")
    assert comparison["summary"]["models_scored"] == 2

    only = client.get("/history", headers=alice, params={"kind": "comparison"}).json()
    assert only["total"] == 1
    assert client.get("/history", headers=alice, params={"kind": "inconnu"}).status_code == 422
    assert client.get("/history", headers=alice, params={"date_from": "hier"}).status_code == 422

    assert client.get("/history", headers=bruno).json()["total"] == 0
    assert client.get(f"/history/{comparison['id']}", headers=bruno).status_code == 404

    assert client.delete(f"/history/{comparison['id']}", headers=alice).status_code == 200
    assert client.get("/history", headers=alice).json()["total"] == 1


def test_dashboard_counts_analyses_but_not_comparisons(client, make_user):
    _, headers = make_user("analyste")
    client.post("/predict", headers=headers, json={"features": sample_features(fraud=True)})
    client.post("/predict-file", headers=headers,
                files={"file": ("lot.csv", csv_bytes(rows=4, frauds=1), "text/csv")})
    client.post("/predict-all", headers=headers, json={"features": sample_features()})

    dashboard = client.get("/dashboard", headers=headers, params={"period": "7j"}).json()
    assert dashboard["totals"]["analyzed"] == 5
    assert dashboard["totals"]["fraud"] == 2
    assert len(dashboard["series"]) == 7 and dashboard["series"][-1]["total"] == 5
    assert len(dashboard["alerts"]) == 2
    assert client.get("/dashboard", headers=headers, params={"period": "1an"}).status_code == 422


def test_audit_log_records_actions(client, make_user):
    _, admin = make_user("admin", username="chef")
    _, analyst = make_user("analyste", username="karim")
    client.post("/auth/login", json={"identifier": "karim", "password": "Mauvais123"})
    client.post("/predict", headers=analyst, json={"features": sample_features()})

    log = client.get("/audit", headers=admin).json()
    actions = [(r["action"], r["username"], r["success"]) for r in log["rows"]]
    assert ("auth.login", "karim", False) in actions
    assert ("auth.login", "karim", True) in actions
    assert ("analysis.single", "karim", True) in actions

    failures = client.get("/audit", headers=admin, params={"outcome": "failure"}).json()
    assert all(not r["success"] for r in failures["rows"]) and failures["total"] >= 1
    by_user = client.get("/audit", headers=admin, params={"username": "chef"}).json()
    assert all(r["username"] == "chef" for r in by_user["rows"])


def test_legacy_activity_is_imported_once(client, db, tmp_path):
    import history
    from db_models import Analysis

    legacy = tmp_path / "activity.db"
    connection = sqlite3.connect(legacy)
    connection.execute(
        "CREATE TABLE predictions (id INTEGER PRIMARY KEY, ts TEXT, source TEXT, model TEXT,"
        " amount REAL, probability REAL, is_fraud INTEGER)"
    )
    connection.executemany(
        "INSERT INTO predictions (ts, source, model, amount, probability, is_fraud) VALUES (?,?,?,?,?,?)",
        [
            ("2026-10-19T10:00:00+00:00", "single", "Random Forest", 10, 0.9, 1),
            ("2026-10-19T11:00:00+00:00", "file", "Random Forest", 5, 0.1, 0),
            ("2026-10-19T11:00:00+00:00", "file", "Random Forest", 7, 0.8, 1),
        ],
    )
    connection.commit()
    connection.close()

    assert history.import_legacy_activity(db, legacy) == 2  # 1 analyse unique + 1 fichier
    assert db.query(Analysis).count() == 2
    assert history.import_legacy_activity(db, legacy) == 0  # pas de double import


def test_expert_model_test_is_recorded(client, make_user, dataset_file):
    _, expert = make_user("expert")
    response = client.get("/dataset/evaluation", headers=expert,
                          params={"model": "Random Forest", "split": "test"})
    assert response.status_code == 200, response.text
    body = response.json()
    assert body["rows"] == 450  # 15 % des 3 000 lignes sans doublons

    entry = client.get(f"/history/{body['analysis_id']}", headers=expert).json()
    assert entry["kind"] == "evaluation"
    assert entry["summary"]["metrics"]["tp"] == body["metrics"]["tp"]
    export = client.get(f"/history/{body['analysis_id']}/export", headers=expert)
    assert "Indicateur;Valeur" in export.content.decode("utf-8-sig")


def test_dataset_upload_is_audited(client, make_user):
    from conftest import TEST_ROOT

    _, admin = make_user("admin")
    _, analyst = make_user("analyste", username="karim")
    content = (TEST_ROOT / "creditcard_source.csv").read_bytes()
    upload = client.post("/dataset/upload", headers=analyst,
                         files={"file": ("creditcard.csv", content, "text/csv")})
    assert upload.status_code == 200 and upload.json()["rows"] == 3020
    actions = [r["action"] for r in client.get("/audit", headers=admin).json()["rows"]]
    assert "dataset.upload" in actions

    import os
    from pathlib import Path

    (Path(os.environ["FRAUD_DATA_DIR"]) / "creditcard.csv").unlink()


def test_password_is_never_stored_in_clear(client, db):
    from db_models import User
    client.post("/auth/register", json={
        "username": "secret", "email": "secret@exemple.test",
        "password": TEST_PASSWORD, "password_confirm": TEST_PASSWORD,
    })
    user = db.query(User).filter_by(username="secret").one()
    assert TEST_PASSWORD not in user.password_hash and user.password_hash.startswith("$2")
