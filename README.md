# FraudShield — robust bank fraud detection

Final-year project (PFE). A web application that scores bank transactions as
**fraud / normal** with the machine-learning models studied in the thesis, keeps
the history of every analysis, and presents the thesis results (model
comparison, adversarial robustness, adversarial training, final model).
Access is protected by accounts and three roles taken from the use-case diagram.

- **Backend:** FastAPI (Python) — models, predictions, accounts (JWT), history, audit log.
- **Frontend:** React + TypeScript + Vite — the user interface (in French).
- **Database:** PostgreSQL in Docker, SQLite when run locally without Docker (same code, SQLAlchemy).
- **Data:** the Kaggle *Credit Card Fraud Detection* dataset (`creditcard.csv`).
- **Models:** Random Forest (final model, defence V1), XGBoost, LightGBM, plus linear SVM and logistic regression when their files are provided.

```
Browser ──▶ nginx (:8080) ──/api──▶ FastAPI (:8000) ──▶ PostgreSQL (users, transactions, history, audit)
                │                        ├──▶ models/*.joblib
                └─ React app             ├──▶ data/raw/creditcard.csv
                                         └──▶ notebooks/*.ipynb, artifacts/ (thesis results, read-only)
```

---

## Quick start with Docker (recommended — any machine)

You only need [Docker Desktop](https://www.docker.com/products/docker-desktop/) (Windows / macOS) or Docker Engine (Linux) and Git.

1. **Get the code**
   ```bash
   git clone https://github.com/zeinebayari304-cell/fraud_detection_memoire.git
   cd fraud_detection_memoire
   git checkout feat/auth-roles-crud-historique-docker
   ```
2. **Add the files that are not in git** (see [section 2](#2-files-that-are-not-in-git)): the model files into `models/`, and `creditcard.csv` into `data/raw/` (or import it later from the app).
3. **Create your configuration:** copy `.env.example` to `.env` and fill in `POSTGRES_PASSWORD`, `FRAUD_JWT_SECRET` and the first administrator (`FRAUD_ADMIN_USERNAME`, `FRAUD_ADMIN_EMAIL`, `FRAUD_ADMIN_PASSWORD`).
4. **Start everything:**
   ```bash
   docker compose up -d --build
   ```
5. Open **http://localhost:8080** and log in with the administrator from `.env`.

Useful commands:

| Command | Effect |
|---|---|
| `docker compose ps` | state of the three containers (`db`, `backend`, `frontend`) |
| `docker compose logs -f backend` | API logs |
| `docker compose down` | stop (data is kept in the `pgdata` volume) |
| `docker compose down -v` | stop **and delete the database** |
| `docker compose exec backend python manage.py create-user --role admin --username <name> --email <e-mail>` | create another administrator (password asked interactively) |

API documentation in Docker: http://localhost:8080/api/docs.

## Quick start without Docker (Windows, for development)

1. Install [Python 3.11+](https://www.python.org/downloads/) (tick *Add Python to PATH*), [Node.js 20.19+](https://nodejs.org/) and Git, then clone as above.
2. Add the model files and the dataset (section 2). Optionally create `.env` from `.env.example` (the first administrator and the session secret are read from it; the database stays SQLite in `backend/data/app.db`).
3. In VS Code, **Terminal → Run Task**, once each: `Backend : installer les dépendances` and `Frontend : installer les dépendances`.
4. Press **Ctrl+Shift+B** (`Lancer l'application`), open http://localhost:5173.
5. No administrator in `.env`? Run the task `Backend : créer un administrateur`.

Then follow the step-by-step guide **[`docs/guide-utilisation.html`](docs/guide-utilisation.html)** (in French, with a test checklist).

---

## 1. Accounts and roles (use-case diagram)

Every page and every API route requires a session (JWT), as stated in the diagram. Roles are checked **by the server** on each request; the interface only hides what the role cannot use. In the API table below, routes marked *analyste* or *expert* are also open to the administrator.

| Role | What it can do |
|---|---|
| **Analyste antifraude** | analyse a transaction, analyse a CSV file, manage saved transactions (CRUD), view and export **its** history, dashboard |
| **Expert cybersécurité / Data Scientist** | model comparison, ZOO / HopSkipJump attacks, adversarial training, final model and live model tests, **its** history, dashboard |
| **Administrateur** | users and roles (create, edit, deactivate, reset password, unlock, delete), audit log, dashboard — **and every analyst and expert feature** (the administrator can perform all use cases, so one account is enough to test the whole application) |

- **Registration** (`/register`) creates an *Analyste* account; the administrator changes roles.
- **Input validation** on both sides: username 3–30 characters starting with a letter; valid e-mail; password ≥ 8 characters with an upper-case letter, a lower-case letter and a digit, not containing the username; confirmation must match. Errors are shown under each field.
- **Security:** passwords hashed with bcrypt; 5 failed logins lock the account 15 minutes; logout, deactivation, role change and password reset close the user's open sessions; at least one active administrator always remains; an administrator cannot delete or deactivate their own account.

## 2. Files that are not in git

| What | Where to put it | Where it comes from |
|---|---|---|
| Trained models and scaler | `models/` | thesis notebooks (see below) |
| Dataset `creditcard.csv` (~144 MB) | `data/raw/creditcard.csv` | [Kaggle: mlg-ulb/creditcardfraud](https://www.kaggle.com/datasets/mlg-ulb/creditcardfraud) — or import it from the app |
| Configuration and secrets | `.env` | copy of `.env.example` |

**Model files** (all in `models/`): `minmax_scaler.joblib` (**required**), `random_forest_selected.joblib` (**required**), and optionally `xgboost_selected.joblib`, `lightgbm_selected.joblib`, `logistic_regression_selected.joblib`, `linear_svm_selected.joblib`. They are written by notebook 11 into `notebooks/notebook11_adversarial_training/defence_v2/final_selected_models/` (the scaler by notebook 02). They must be loaded with scikit-learn 1.9.0 (pinned).

## 3. Using the application

| Page | Role | Content |
|---|---|---|
| Tableau de bord | all | analyses done in the app (all users): volumes, fraud rate, activity 7 / 30 / 90 days, latest alerts, models loaded, dataset audit |
| Analyse de transaction | analyste, admin | 30 variables by hand or from the **Jeu de données** panel (import, random fraud / normal, line n°, table); verdict, probability, **⚠ fraud alert**, true class for dataset rows, **compare all models**, **save as transaction** |
| Analyse CSV | analyste, admin | batch scoring (`Time`, `V1`…`V28`, `Amount`; optional `Class` is kept as true class), filters, export |
| Transactions | analyste, admin | **CRUD**: add (form, pasted CSV line, or a dataset row), view, edit, delete (with confirmation), analyse with any loaded model; search and filters |
| Historique | analyste, expert, admin | every analysis, CSV batch, model comparison and model test, with filters (type, model, dates), detail, **CSV export**, delete |
| Comparaison des modèles · Robustesse adversariale · Adversarial Training · Modèle final | expert, admin | thesis results read live from the notebooks; *Modèle final* includes the **live test** on the rebuilt test set (expected **TP 56 / FP 7 / FN 15**), saved in the history |
| Utilisateurs et rôles | admin | user management (CRUD) |
| Journal d'audit | admin | who did what, when, from which IP, success or failure, with filters |
| Mon compte | all | profile, password change |

## 4. How a prediction is computed

1. `Amount` → `log1p(Amount)` (same transform as notebook 02).
2. The 30 columns `Time, V1…V28, Amount` go through the MinMax scaler.
3. The model returns a fraud probability; the transaction is flagged when it is **≥ threshold** (default 0.5, the models' native rule, which reproduces the thesis results).

## 5. API reference

Interactive documentation: `/docs` (local: http://localhost:8000/docs, Docker: http://localhost:8080/api/docs). All routes except `/health`, `/auth/login` and `/auth/register` need `Authorization: Bearer <token>`.

| Method | Route | Role | Purpose |
|---|---|---|---|
| POST | `/auth/register` · `/auth/login` | public | create an account / log in (returns a token) |
| GET · POST · PUT | `/auth/me` · `/auth/logout` · `/auth/password` | all | profile, logout (revokes tokens), change password |
| GET · POST · PUT · DELETE | `/users`, `/users/{id}` | admin | user management |
| GET | `/audit` | admin | audit log (filters: action, username, outcome, dates) |
| GET | `/dashboard?period=7j\|30j\|90j` | all | dashboard data |
| POST | `/predict` · `/predict-all` · `/predict-file?model=` | analyste | score one transaction / with all models / a CSV |
| GET · POST · PUT · DELETE | `/transactions`, `/transactions/{id}` | analyste | transaction CRUD (own transactions only) |
| POST | `/transactions/{id}/analyze?model=` | analyste | analyse a saved transaction |
| GET · DELETE | `/history`, `/history/{id}` | analyste, expert | history (own entries), detail, delete |
| GET | `/history/{id}/export` | analyste, expert | CSV export |
| GET | `/results/models` · `/robustness` · `/defense` · `/final-model` | expert | thesis results |
| GET | `/results/dataset` | all | dataset audit |
| GET | `/dataset/status` · POST `/dataset/upload` | analyste, expert | dataset presence / import |
| GET | `/dataset/transactions` · `/dataset/transactions/{id}` · `/dataset/random` | analyste | browse the dataset |
| GET | `/dataset/evaluation?model=&split=` | expert | live model test (saved in the history) |
| GET | `/health` · `/models` | public · all | status and loaded models |

Errors: `401` not logged in / session expired, `403` role not allowed, `404` not found (including another user's data), `409` duplicate or forbidden operation, `422` invalid input (with the field concerned), `423` account locked, `503` model not loaded.

## 6. Configuration (`.env` / environment variables)

| Variable | Default | Meaning |
|---|---|---|
| `FRAUD_DATABASE_URL` | SQLite `backend/data/app.db` | database URL (`postgresql://user:password@host:5432/db` in Docker, set by `docker-compose.yml`) |
| `POSTGRES_DB` · `POSTGRES_USER` · `POSTGRES_PASSWORD` | `fraud` · `fraud` · — | PostgreSQL (Docker) |
| `FRAUD_JWT_SECRET` | generated into `backend/data/.jwt_secret` | session signing secret (required in Docker) |
| `FRAUD_JWT_EXPIRE_MINUTES` | `120` | session duration |
| `FRAUD_ADMIN_USERNAME` · `FRAUD_ADMIN_EMAIL` · `FRAUD_ADMIN_PASSWORD` | — | first administrator, created at start-up if none exists |
| `FRAUD_THRESHOLD` | `0.5` | decision threshold |
| `FRAUD_MODELS_DIR` · `FRAUD_DATA_DIR` | `models/` · `data/raw/` | model and dataset folders |
| `FRAUD_CORS_ORIGINS` | `http://localhost:5173,…` | allowed frontend origins (local mode) |
| `APP_PORT` | `8080` | port of the application in Docker |
| `VITE_API_URL` | `http://localhost:8000` (`/api` in Docker) | API address used by the frontend |

The old dashboard log (`backend/data/activity.db`, earlier versions) is imported automatically into the new database on first start.

## 7. Tests

| Command (or VS Code task) | What it checks |
|---|---|
| `cd backend` then `.venv\Scripts\python.exe -m pytest -q` (*Tests : backend*) | 98 tests: registration and validation rules, login, lockout, logout, the full role matrix of the diagram, user CRUD and safeguards, transaction CRUD and isolation between users, history and export, audit log, dashboard, legacy import, model tests. They use a temporary database and stand-in models: nothing touches your data. |
| `cd frontend` then `npm test` (*Tests : frontend*) | 35 tests: the input-validation rules and the page-access map of each role |
| `docker compose exec -e FRAUD_TEST_DATABASE_URL=postgresql://... backend sh -c "pip install -r requirements-dev.txt && python -m pytest -q"` | the same backend tests against PostgreSQL |

Manual checklist: [`docs/guide-utilisation.html`](docs/guide-utilisation.html).

## 8. Troubleshooting

| Symptom | Cause / fix |
|---|---|
| Redirected to the login page | session expired (2 h), logged out elsewhere, or role changed by the administrator: log in again |
| « Accès refusé » | your role does not include this page (section 1) |
| « Compte temporairement verrouillé » | 5 wrong passwords: wait 15 minutes or ask the administrator to unlock |
| `Modèle non chargé` | a model or the scaler is missing in `models/` (check `/health`) |
| Docker: `backend` stays *unhealthy* | `docker compose logs backend` — usually missing model files or a wrong `.env` value |
| Docker: `POSTGRES_PASSWORD` / `FRAUD_JWT_SECRET` required | fill them in `.env` |
| Docker Desktop shows an *Inference manager* error | unrelated to this project (Docker's model runner); the engine still works. Disable *Docker Model Runner* in Docker Desktop settings if it bothers you |
| Vite: **Cannot find native binding** (local mode) | Node 20.17 + npm bug: upgrade Node to 20.19+, or in `frontend/` run `npm install --no-save @rolldown/binding-win32-x64-msvc@<installed rolldown version>` |
| `npm install` fails with `edgesOut` | npm 10.8 bug: use `npm ci --legacy-peer-deps` / `npm install --legacy-peer-deps` |

## 9. Project layout

```
backend/
  main.py               app, predictions, dashboard, start-up (tables, legacy import, first admin)
  database.py           SQLAlchemy engine (PostgreSQL or SQLite)
  db_models.py          tables: users, transactions, analyses, analysis_results, audit_logs
  security.py           bcrypt, JWT, roles
  schemas.py            input validation (server side)
  auth_routes.py        register / login / logout / password
  users_routes.py       user management (admin)
  transactions_routes.py transaction CRUD + analysis
  history.py · history_routes.py   history, dashboard figures, export
  audit.py · audit_routes.py       audit log
  dataset.py            dataset import, browsing, live model test
  results.py · notebook_tables.py  thesis results read from the notebooks
  model_service.py      models + preprocessing
  manage.py             command line: create-user, list-users, reset-password
  tests/                pytest suite
  Dockerfile
frontend/
  src/                  pages (Login, Register, Dashboard, TransactionAnalysis, CsvAnalysis, Transactions,
                        History, Users, Audit, Account, research pages), auth.tsx, api.ts, validation.ts (+ tests)
  Dockerfile · nginx.conf
docker-compose.yml · .env.example
notebooks/ artifacts/ results/   thesis material
docs/                 user guide (HTML) and test files
```

## 10. Limits worth knowing

- The thesis models were evaluated on one dataset (European card transactions, 2013). Results on other data are not guaranteed.
- Adversarial-robustness figures come from small attack panels (≈ 53 attacked frauds): empirical observations, not certified guarantees.
- The application is a research / decision-support tool; a flagged transaction should be reviewed, not treated as a definitive verdict.
- Tables are created automatically at start-up (no migration tool yet): if the schema changes in a later version, an Alembic migration should be added.
