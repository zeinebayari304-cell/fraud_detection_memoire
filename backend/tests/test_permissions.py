"""Matrice des rôles du diagramme de cas d'utilisation."""

import pytest

from conftest import sample_features

# (méthode, chemin, corps) -> rôles autorisés (l'administrateur a accès à tout)
ROUTES = [
    ("get", "/dashboard", None, {"analyste", "expert", "admin"}),
    ("post", "/predict", {"features": sample_features()}, {"analyste", "admin"}),
    ("post", "/predict-all", {"features": sample_features()}, {"analyste", "admin"}),
    ("get", "/transactions", None, {"analyste", "admin"}),
    ("get", "/history", None, {"analyste", "expert", "admin"}),
    ("get", "/results/models", None, {"expert", "admin"}),
    ("get", "/results/robustness", None, {"expert", "admin"}),
    ("get", "/results/defense", None, {"expert", "admin"}),
    ("get", "/results/final-model", None, {"expert", "admin"}),
    ("get", "/results/dataset", None, {"analyste", "expert", "admin"}),
    ("get", "/dataset/status", None, {"analyste", "expert", "admin"}),
    ("get", "/users", None, {"admin"}),
    ("get", "/audit", None, {"admin"}),
]


@pytest.mark.parametrize("method, path, body, allowed", ROUTES)
@pytest.mark.parametrize("role", ["analyste", "expert", "admin"])
def test_role_matrix(client, make_user, method, path, body, allowed, role):
    _, headers = make_user(role)
    response = getattr(client, method)(path, headers=headers, **({"json": body} if body else {}))
    if role in allowed:
        assert response.status_code not in (401, 403), f"{role} devrait accéder à {path}"
    else:
        assert response.status_code == 403, f"{role} ne devrait pas accéder à {path}"


@pytest.mark.parametrize("method, path, body, _allowed", ROUTES)
def test_every_route_requires_login(client, method, path, body, _allowed):
    response = getattr(client, method)(path, **({"json": body} if body else {}))
    assert response.status_code == 401


def test_role_change_applies_immediately(client, make_user):
    admin, admin_headers = make_user("admin")
    analyst, analyst_headers = make_user("analyste", username="karim")
    assert client.get("/transactions", headers=analyst_headers).status_code == 200

    client.put(f"/users/{analyst.id}", headers=admin_headers, json={"role": "expert"})
    # Changement de rôle : la session est invalidée, il faut se reconnecter.
    assert client.get("/transactions", headers=analyst_headers).status_code == 401
