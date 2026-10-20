"""Gestion des utilisateurs par l'administrateur (CRUD et garde-fous)."""


from conftest import TEST_PASSWORD

NEW_USER = {
    "username": "leila",
    "email": "leila@exemple.test",
    "password": "Expert2026x",
    "role": "expert",
    "full_name": "Leila Trabelsi",
}


def test_admin_creates_lists_reads_updates_and_deletes(client, make_user):
    _, headers = make_user("admin")

    created = client.post("/users", headers=headers, json=NEW_USER)
    assert created.status_code == 201, created.text
    user_id = created.json()["id"]
    assert created.json()["role"] == "expert"

    listing = client.get("/users", headers=headers, params={"q": "leila"})
    assert listing.json()["total"] == 1

    by_role = client.get("/users", headers=headers, params={"role": "expert"})
    assert [u["username"] for u in by_role.json()["rows"]] == ["leila"]

    assert client.get(f"/users/{user_id}", headers=headers).json()["email"] == "leila@exemple.test"

    updated = client.put(f"/users/{user_id}", headers=headers,
                         json={"email": "leila.t@exemple.test", "role": "analyste", "full_name": "Leila T"})
    assert updated.status_code == 200
    assert updated.json()["role"] == "analyste" and updated.json()["email"] == "leila.t@exemple.test"

    deleted = client.delete(f"/users/{user_id}", headers=headers)
    assert deleted.status_code == 200
    assert client.get(f"/users/{user_id}", headers=headers).status_code == 404


def test_create_user_validation_and_duplicates(client, make_user):
    _, headers = make_user("admin")
    bad = client.post("/users", headers=headers, json={**NEW_USER, "role": "superviseur"})
    assert bad.status_code == 422 and "Rôle inconnu" in bad.json()["detail"]
    weak = client.post("/users", headers=headers, json={**NEW_USER, "password": "faible"})
    assert weak.status_code == 422

    assert client.post("/users", headers=headers, json=NEW_USER).status_code == 201
    assert client.post("/users", headers=headers, json=NEW_USER).status_code == 409


def test_deactivation_blocks_login_and_kills_sessions(client, make_user):
    _, admin_headers = make_user("admin")
    user, user_headers = make_user("analyste", username="karim")

    client.put(f"/users/{user.id}", headers=admin_headers, json={"is_active": False})
    assert client.get("/auth/me", headers=user_headers).status_code == 401
    login = client.post("/auth/login", json={"identifier": "karim", "password": TEST_PASSWORD})
    assert login.status_code == 403

    client.put(f"/users/{user.id}", headers=admin_headers, json={"is_active": True})
    login = client.post("/auth/login", json={"identifier": "karim", "password": TEST_PASSWORD})
    assert login.status_code == 200


def test_password_reset_and_unlock(client, make_user):
    _, admin_headers = make_user("admin")
    user, _ = make_user("analyste", username="karim")
    for _ in range(5):
        client.post("/auth/login", json={"identifier": "karim", "password": "Mauvais123"})
    assert client.get(f"/users/{user.id}", headers=admin_headers).json()["locked"] is True

    client.put(f"/users/{user.id}", headers=admin_headers, json={"password": "Reinit2026x", "unlock": True})
    assert client.get(f"/users/{user.id}", headers=admin_headers).json()["locked"] is False
    login = client.post("/auth/login", json={"identifier": "karim", "password": "Reinit2026x"})
    assert login.status_code == 200


def test_admin_cannot_delete_or_deactivate_self(client, make_user):
    admin, headers = make_user("admin")
    assert client.delete(f"/users/{admin.id}", headers=headers).status_code == 409
    assert client.put(f"/users/{admin.id}", headers=headers, json={"is_active": False}).status_code == 409


def test_last_admin_cannot_lose_admin_role(client, make_user):
    admin, headers = make_user("admin")
    demote = client.put(f"/users/{admin.id}", headers=headers, json={"role": "analyste"})
    assert demote.status_code == 409 and "au moins un administrateur" in demote.json()["detail"]

    second, _ = make_user("admin", username="admin2")
    assert client.put(f"/users/{second.id}", headers=headers, json={"role": "analyste"}).status_code == 200


def test_deleting_user_removes_their_transactions(client, make_user, db):
    from conftest import sample_features
    from db_models import Transaction

    _, admin_headers = make_user("admin")
    user, user_headers = make_user("analyste", username="karim")
    client.post("/transactions", headers=user_headers, json={"features": sample_features()})
    assert client.delete(f"/users/{user.id}", headers=admin_headers).status_code == 200
    assert db.query(Transaction).count() == 0
