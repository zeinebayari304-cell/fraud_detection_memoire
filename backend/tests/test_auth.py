"""Inscription, connexion, contrôle de saisie, verrouillage, déconnexion."""

import pytest

from conftest import TEST_PASSWORD


def register(client, **overrides):
    payload = {
        "username": "Nadia.B",
        "email": "nadia@exemple.test",
        "password": "Fraude2026x",
        "password_confirm": "Fraude2026x",
        "full_name": "Nadia Ben Ali",
    }
    payload.update(overrides)
    return client.post("/auth/register", json=payload)


def test_register_creates_analyst_and_returns_token(client):
    response = register(client)
    assert response.status_code == 201, response.text
    body = response.json()
    assert body["user"]["username"] == "nadia.b"  # normalisé en minuscules
    assert body["user"]["role"] == "analyste"
    assert body["access_token"]
    me = client.get("/auth/me", headers={"Authorization": f"Bearer {body['access_token']}"})
    assert me.status_code == 200 and me.json()["email"] == "nadia@exemple.test"


@pytest.mark.parametrize(
    "field, value, expected",
    [
        ("username", "ab", "Nom d'utilisateur invalide"),
        ("username", "1abc", "Nom d'utilisateur invalide"),
        ("username", "nadia b", "Nom d'utilisateur invalide"),
        ("email", "pas-un-email", "Adresse e-mail invalide"),
        ("password", "court1A", "au moins 8 caractères"),
        ("password", "toutminuscule1", "une majuscule"),
        ("password", "TOUTMAJUSCULE1", "une minuscule"),
        ("password", "SansChiffreXX", "un chiffre"),
        ("full_name", "Nadia <script>", "Nom complet invalide"),
    ],
)
def test_register_rejects_invalid_input(client, field, value, expected):
    overrides = {field: value}
    if field == "password":
        overrides["password_confirm"] = value
    response = register(client, **overrides)
    assert response.status_code == 422
    body = response.json()
    assert expected in body["detail"]
    assert any(e["field"] == field for e in body["errors"])


def test_register_rejects_mismatched_confirmation(client):
    response = register(client, password_confirm="Autre2026x")
    assert response.status_code == 422
    assert "ne correspondent pas" in response.json()["detail"]


def test_register_rejects_password_containing_username(client):
    response = register(client, username="karim", password="Karim2026x", password_confirm="Karim2026x")
    assert response.status_code == 422
    assert "nom d'utilisateur" in response.json()["detail"]


def test_register_rejects_missing_fields(client):
    response = client.post("/auth/register", json={"username": "nadia"})
    assert response.status_code == 422
    assert "Champ obligatoire" in response.json()["detail"]


def test_register_duplicates_are_refused(client):
    assert register(client).status_code == 201
    same_name = register(client, email="autre@exemple.test")
    assert same_name.status_code == 409 and "nom d'utilisateur" in same_name.json()["detail"]
    same_email = register(client, username="autre")
    assert same_email.status_code == 409 and "e-mail" in same_email.json()["detail"]


def test_login_with_username_or_email(client, make_user):
    user, _ = make_user("analyste", username="samir")
    for identifier in ("samir", "SAMIR", "samir@exemple.test"):
        response = client.post("/auth/login", json={"identifier": identifier, "password": TEST_PASSWORD})
        assert response.status_code == 200, identifier
        assert response.json()["user"]["id"] == user.id


def test_login_wrong_password_and_unknown_user_give_same_message(client, make_user):
    make_user("analyste", username="samir")
    wrong = client.post("/auth/login", json={"identifier": "samir", "password": "Mauvais123"})
    unknown = client.post("/auth/login", json={"identifier": "personne", "password": "Mauvais123"})
    assert wrong.status_code == unknown.status_code == 401
    assert wrong.json()["detail"] == unknown.json()["detail"] == "Identifiants invalides."


def test_login_locks_account_after_five_failures(client, make_user):
    make_user("analyste", username="samir")
    for _ in range(5):
        client.post("/auth/login", json={"identifier": "samir", "password": "Mauvais123"})
    locked = client.post("/auth/login", json={"identifier": "samir", "password": TEST_PASSWORD})
    assert locked.status_code == 423
    assert "verrouillé" in locked.json()["detail"]


def test_login_inactive_account_is_refused(client, make_user, db):
    from db_models import User

    user, _ = make_user("analyste", username="samir")
    db.get(User, user.id).is_active = False
    db.commit()
    response = client.post("/auth/login", json={"identifier": "samir", "password": TEST_PASSWORD})
    assert response.status_code == 403


def test_logout_invalidates_the_token(client, make_user):
    _, headers = make_user("analyste")
    assert client.post("/auth/logout", headers=headers).status_code == 200
    assert client.get("/auth/me", headers=headers).status_code == 401


def test_invalid_or_missing_token(client):
    assert client.get("/auth/me").status_code == 401
    bad = client.get("/auth/me", headers={"Authorization": "Bearer pas.un.jeton"})
    assert bad.status_code == 401


def test_change_password(client, make_user):
    _, headers = make_user("analyste", username="samir")
    wrong = client.put("/auth/password", headers=headers, json={
        "current_password": "Mauvais123", "new_password": "Nouveau2026x", "new_password_confirm": "Nouveau2026x"})
    assert wrong.status_code == 400

    ok = client.put("/auth/password", headers=headers, json={
        "current_password": TEST_PASSWORD, "new_password": "Nouveau2026x", "new_password_confirm": "Nouveau2026x"})
    assert ok.status_code == 200
    assert client.get("/auth/me", headers=headers).status_code == 401  # ancien jeton invalide
    login = client.post("/auth/login", json={"identifier": "samir", "password": "Nouveau2026x"})
    assert login.status_code == 200


def test_health_is_public(client):
    response = client.get("/health")
    assert response.status_code == 200 and response.json()["models_ready"] is True
