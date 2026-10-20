"""CRUD des transactions et analyse d'une transaction enregistrée."""

from conftest import sample_features


def test_crud_flow(client, make_user):
    _, headers = make_user("analyste")

    created = client.post("/transactions", headers=headers, json={
        "features": sample_features(), "reference": "TX-2026-001",
        "description": "Paiement carte", "true_label": 0,
    })
    assert created.status_code == 201, created.text
    tx = created.json()
    assert tx["amount"] == 42.5 and tx["last_is_fraud"] is None

    listing = client.get("/transactions", headers=headers)
    assert listing.json()["total"] == 1

    read = client.get(f"/transactions/{tx['id']}", headers=headers)
    assert read.json()["features"]["V14"] == 0.0

    updated = client.put(f"/transactions/{tx['id']}", headers=headers,
                         json={"reference": "TX-2026-001-B", "true_label": 1})
    assert updated.json()["reference"] == "TX-2026-001-B" and updated.json()["true_label"] == 1

    cleared = client.put(f"/transactions/{tx['id']}", headers=headers, json={"clear_label": True})
    assert cleared.json()["true_label"] is None

    assert client.delete(f"/transactions/{tx['id']}", headers=headers).status_code == 200
    assert client.get(f"/transactions/{tx['id']}", headers=headers).status_code == 404


def test_validation_of_transactions(client, make_user):
    _, headers = make_user("analyste")
    missing = dict(sample_features())
    missing.pop("V7")
    assert "V7" in client.post("/transactions", headers=headers, json={"features": missing}).json()["detail"]

    negative = {**sample_features(), "Amount": -3}
    response = client.post("/transactions", headers=headers, json={"features": negative})
    assert response.status_code == 422 and "positifs" in response.json()["detail"]

    extra = {**sample_features(), "V99": 1}
    assert client.post("/transactions", headers=headers, json={"features": extra}).status_code == 422

    bad_label = client.post("/transactions", headers=headers, json={"features": sample_features(), "true_label": 5})
    assert bad_label.status_code == 422

    long_ref = client.post("/transactions", headers=headers,
                           json={"features": sample_features(), "reference": "x" * 65})
    assert long_ref.status_code == 422

    bad_ref = client.post("/transactions", headers=headers,
                          json={"features": sample_features(), "reference": "<script>"})
    assert bad_ref.status_code == 422


def test_owner_isolation(client, make_user):
    _, alice = make_user("analyste", username="alice")
    _, bruno = make_user("analyste", username="bruno")
    tx = client.post("/transactions", headers=alice, json={"features": sample_features()}).json()

    assert client.get("/transactions", headers=bruno).json()["total"] == 0
    for method in ("get", "put", "delete"):
        kwargs = {"json": {"reference": "pirate"}} if method == "put" else {}
        assert getattr(client, method)(f"/transactions/{tx['id']}", headers=bruno, **kwargs).status_code == 404
    assert client.post(f"/transactions/{tx['id']}/analyze", headers=bruno).status_code == 404


def test_analyze_updates_transaction_and_history(client, make_user):
    _, headers = make_user("analyste")
    tx = client.post("/transactions", headers=headers,
                     json={"features": sample_features(fraud=True), "true_label": 1}).json()

    result = client.post(f"/transactions/{tx['id']}/analyze", headers=headers)
    assert result.status_code == 200, result.text
    body = result.json()
    assert body["is_fraud"] is True
    assert body["transaction"]["last_is_fraud"] is True
    assert body["transaction"]["last_model"] == "Random Forest"

    entry = client.get(f"/history/{body['analysis_id']}", headers=headers).json()
    assert entry["kind"] == "transaction" and entry["transaction_id"] == tx["id"]
    assert entry["labelled"] == 1 and entry["correct"] == 1

    # Modifier les variables efface l'ancien verdict.
    edited = client.put(f"/transactions/{tx['id']}", headers=headers, json={"features": sample_features()})
    assert edited.json()["last_is_fraud"] is None


def test_analyze_with_missing_model(client, make_user):
    _, headers = make_user("analyste")
    tx = client.post("/transactions", headers=headers, json={"features": sample_features()}).json()
    response = client.post(f"/transactions/{tx['id']}/analyze", headers=headers, params={"model": "LightGBM"})
    assert response.status_code == 503


def test_filters(client, make_user):
    _, headers = make_user("analyste")
    a = client.post("/transactions", headers=headers,
                    json={"features": sample_features(fraud=True), "reference": "suspect", "true_label": 1}).json()
    client.post("/transactions", headers=headers, json={"features": sample_features(), "reference": "courant"})
    client.post(f"/transactions/{a['id']}/analyze", headers=headers)

    def total(**params):
        return client.get("/transactions", headers=headers, params=params).json()["total"]

    assert total(q="susp") == 1
    assert total(label="fraud") == 1 and total(label="unknown") == 1
    assert total(verdict="fraud") == 1 and total(verdict="pending") == 1
