# FraudShield — robust bank fraud detection

Final-year project (PFE). A web application that scores bank transactions as
**fraud / normal** with the machine-learning models studied in the thesis, and
presents the thesis results (model comparison, adversarial robustness,
adversarial training, final model).

- **Backend:** FastAPI (Python) — loads the trained models and serves predictions and results.
- **Frontend:** React + TypeScript + Vite — the user interface (in French).
- **Data:** the Kaggle *Credit Card Fraud Detection* dataset (`creditcard.csv`).
- **Models:** Random Forest, XGBoost, LightGBM (final model: **Random Forest, defence V1**), plus linear SVM and logistic regression when their files are provided.

```
Browser (React, :5173)  ──HTTP/JSON──▶  FastAPI (:8000)  ──▶  models/*.joblib
                                              │                data/raw/creditcard.csv
                                              │                notebooks/*.ipynb  (thesis results)
                                              └──────────────▶  backend/data/activity.db (SQLite log)
```

---

## Quick start (Windows)

New to the project? Do these five steps, in order. Details are in the sections below.

1. **Install** [Python 3.11+](https://www.python.org/downloads/) (tick *Add Python to PATH*), [Node.js 20.19+](https://nodejs.org/) and [Git](https://git-scm.com/).
2. **Get the code:**
   ```bash
   git clone https://github.com/zeinebayari304-cell/fraud_detection_memoire.git
   cd fraud_detection_memoire
   git checkout feat/api-prediction-fraude-frontend-connecte
   ```
3. **Add the files that are not in git** (see [section 2](#2-files-that-are-not-in-git)):
   the 4+ model files into `models/` and `creditcard.csv` into `data/raw/` (or import it later from the app).
4. **Install the dependencies** (once):
   ```bash
   py -m venv backend\.venv
   backend\.venv\Scripts\python.exe -m pip install -r backend\requirements.txt
   cd frontend
   npm install
   cd ..
   ```
5. **Run it:** open the folder in VS Code and press **Ctrl+Shift+B**, then open http://localhost:5173.
   (No VS Code? Use the two commands of [section 3.2](#32-start-the-application).)

Then follow the step-by-step guide **[`docs/guide-utilisation.html`](docs/guide-utilisation.html)** (in French, with a test checklist) to check that everything works. Ready-made test files are in [`docs/test_files/`](docs/test_files/).

On macOS / Linux the commands are the same except: `python3 -m venv backend/.venv`, `backend/.venv/bin/python -m pip install -r backend/requirements.txt`, and `backend/.venv/bin/python -m uvicorn main:app --reload --port 8000` (the VS Code tasks are Windows-specific).

---

## 1. Prerequisites

| Tool | Version | Notes |
|---|---|---|
| Python | 3.11 or newer | `py` launcher on Windows; scikit-learn is pinned to the thesis version in `backend/requirements.txt` |
| Node.js | **20.19 or newer** | 20.17 needs the workaround in [Troubleshooting](#8-troubleshooting) |
| Git | any | to clone the repository |
| VS Code | any | optional but recommended (tasks are provided) |

## 2. Files that are not in git

Three things are intentionally **not versioned** (size / licence / privacy). You must add them locally.

| What | Where to put it | Where it comes from |
|---|---|---|
| Trained models and scaler | `models/` | thesis notebooks (see below) |
| Dataset `creditcard.csv` (~144 MB) | `data/raw/creditcard.csv` | [Kaggle: mlg-ulb/creditcardfraud](https://www.kaggle.com/datasets/mlg-ulb/creditcardfraud) |
| Activity log | `backend/data/activity.db` | created automatically on the first analysis |

**Model files** (all in `models/`):

| File | Model | Required? |
|---|---|---|
| `minmax_scaler.joblib` | MinMax scaler fitted on the training set | **yes** (every prediction uses it) |
| `random_forest_selected.joblib` | Random Forest (final model) | yes |
| `xgboost_selected.joblib` | XGBoost | optional |
| `lightgbm_selected.joblib` | LightGBM | optional |
| `logistic_regression_selected.joblib` | Logistic regression | optional |
| `linear_svm_selected.joblib` | Linear SVM | optional |

They are written by notebook 11 into
`notebooks/notebook11_adversarial_training/defence_v2/final_selected_models/`
(the scaler by notebook 02 into `models/`). Copy them into this repo's `models/` folder.
They must be loaded with the same scikit-learn version that saved them (1.9.0, pinned in `backend/requirements.txt`).

The dataset can also be imported from the app itself (see [Dataset panel](#42-analyse-de-transaction)).

## 3. Install and run

### 3.1 First-time setup

**With VS Code:** open the folder, then **Terminal → Run Task** and run, once each:

1. `Backend : installer les dépendances (une seule fois)`
2. `Frontend : installer les dépendances (une seule fois)`

**Or by hand** (from the repository root):

```bash
py -m venv backend\.venv
backend\.venv\Scripts\python.exe -m pip install -r backend\requirements.txt
cd frontend
npm install
```

### 3.2 Start the application

**With VS Code:** press **Ctrl+Shift+B** (task `Lancer l'application (API + interface)`). Two terminals open.

**Or by hand**, in two terminals:

```bash
cd backend
.venv\Scripts\python.exe -m uvicorn main:app --reload --port 8000
```

```bash
cd frontend
npm run dev
```

Then open:

| URL | What |
|---|---|
| http://localhost:5173 | the application |
| http://localhost:8000/health | API status — must show `"models_ready": true` |
| http://localhost:8000/docs | interactive API documentation (Swagger) |

## 4. Using the application

The sidebar shows the API status (`API connectée · Random Forest`) and the topbar shows `API EN LIGNE` / `API HORS LIGNE`.

### 4.1 Tableau de bord
Live overview of what was analysed **in the app**: transactions analysed, frauds flagged, fraud rate, an activity chart (7 / 30 / 90 days), the latest alerts and the platform state (which models are loaded). It refreshes every 15 seconds. A "Jeu de données du mémoire" card shows the audit of the dataset (284 807 transactions, 492 frauds).
Right after a fresh install everything is 0 until you analyse something.

### 4.2 Analyse de transaction
Score **one transaction** (30 variables: `Time`, `V1`…`V28`, `Amount`).

1. Choose the model (the list shows `(non chargé)` for models whose file is missing).
2. Fill the form by hand, or use the **Jeu de données** panel above it:
   - **Importer creditcard.csv** (if the file is not in `data/raw/` yet): progress bar, validation, then the panel switches to "DISPONIBLE".
   - **Fraude aléatoire / Normale aléatoire**, **Ligne n°**, or the table (filter by class and by Test / Validation / Entraînement, then **Utiliser**) fill the 30 fields with a real transaction.
3. Click **Analyser la transaction**. You get the verdict, the fraud probability, the risk level and the decision threshold. If the score is at or above the threshold a **« ⚠ Alerte de fraude »** banner appears.
4. For a row taken from the dataset, the result also shows its **real class** and whether the model was right (correct / missed fraud / false alarm).
5. **Comparer tous les modèles** scores the same transaction with every loaded model and shows how many flag it as fraud.

### 4.3 Analyse CSV
Score **many transactions** at once.

1. Drop a CSV containing at least `Time`, `V1`…`V28`, `Amount` (other columns such as `Class` are ignored). Limit in the interface: 5 MB.
2. Choose the model and click **Lancer l'analyse**.
3. Filter the results (Toutes / Normale / Fraude suspectée) and **Exporter les résultats CSV**.

### 4.4 Research pages (read from the notebooks)
These pages show the thesis results. They are **read live from the executed notebooks** in `notebooks/` and the JSON files in `artifacts/` — nothing is typed into the interface, so re-running a notebook updates the page. If a source is missing the page says so instead of inventing numbers.

| Page | Content | Source |
|---|---|---|
| Comparaison des modèles | metrics per model for three phases: baseline, after SMOTE, after adversarial training (all on the **test** set) | notebooks 03, 09, 11 |
| Robustesse adversariale | ZOO and HopSkipJump attacks: attack success rate with 95 % interval, perturbation size, cost, recall before/after | notebook 10 |
| Adversarial Training | ASR before/after the defence, recall preserved (**validation** set), training cost, validation gates | notebook 11 |
| Modèle final | selection rule and ranking, test results, hybrid-model check, deployment status, and the **live check** below | notebooks 12 and 13, `artifacts/` |

**Vérification en direct** (page *Modèle final*, needs the dataset): the model is run on the test set rebuilt with the notebook's exact split (duplicates removed, then two stratified splits 70 / 15 / 15, `random_state=42`). For the final model the expected result is **TP 56 / FP 7 / FN 15**, and the page tells you whether the application matches the thesis.

## 5. API reference

Interactive documentation: http://localhost:8000/docs.

| Method | Route | Purpose |
|---|---|---|
| GET | `/health` | status, threshold, which models are loaded |
| GET | `/models` | loaded / missing models |
| POST | `/predict` | score one transaction: `{ "model": "Random Forest", "features": { "Time": …, "V1": …, …, "Amount": … } }` |
| POST | `/predict-all` | score one transaction with every loaded model |
| POST | `/predict-file?model=…` | score a CSV (multipart field `file`; max 20 MB / 100 000 rows) |
| GET | `/dashboard?period=7j\|30j\|90j` | dashboard data from the activity log |
| GET | `/results/models` · `/results/robustness` · `/results/defense` · `/results/final-model` · `/results/dataset` | thesis results read from the notebooks |
| GET | `/dataset/status` | dataset presence, size, split counts |
| POST | `/dataset/upload` | import `creditcard.csv` (validated, max 600 MB) |
| GET | `/dataset/transactions?split=&label=&page=&page_size=` | browse the dataset |
| GET | `/dataset/transactions/{id}` · `/dataset/random?label=&split=` | one full transaction |
| GET | `/dataset/evaluation?model=&split=test\|validation` | confusion matrix and metrics of a model on a rebuilt split |

Errors are explicit: `422` invalid input, `503 Modèle non chargé` when a model file is missing, `404` unknown row or dataset absent.

## 6. How a prediction is computed

1. `Amount` → `log1p(Amount)` (the same transform as notebook 02).
2. The 30 columns, in the order `Time, V1…V28, Amount`, go through the MinMax scaler.
3. The model returns a fraud probability.
4. The transaction is flagged as fraud when the probability is **≥ threshold** (default **0.5**, the models' native decision rule, which reproduces the thesis test results).

## 7. Configuration (environment variables)

| Variable | Default | Meaning |
|---|---|---|
| `FRAUD_MODELS_DIR` | `models/` | folder containing the `.joblib` files |
| `FRAUD_DATA_DIR` | `data/raw/` | folder containing `creditcard.csv` |
| `FRAUD_DB_PATH` | `backend/data/activity.db` | SQLite activity log |
| `FRAUD_THRESHOLD` | `0.5` | decision threshold |
| `FRAUD_CORS_ORIGINS` | `http://localhost:5173,http://127.0.0.1:5173` | allowed frontend origins (comma separated) |
| `VITE_API_URL` | `http://localhost:8000` | API address used by the frontend |

To reset the dashboard, stop the API and delete `backend/data/activity.db`.

## 8. Troubleshooting

| Symptom | Cause / fix |
|---|---|
| Pages show a red error and **Réessayer** | The API is not running. Start it (section 3.2) and click *Réessayer*. |
| `Modèle non chargé` | A model or the scaler is missing in `models/`. Check `/health`, copy the file, restart the API. |
| Model fails to load / version warning | scikit-learn version differs from the one that saved the models. Use the pinned version: `pip install -r backend\requirements.txt`. |
| Vite fails with **Cannot find native binding** | Node 20.17 + an npm optional-dependency bug. Upgrade Node to 20.19+, or in `frontend/` run `npm install --no-save @rolldown/binding-win32-x64-msvc@<installed rolldown version>`. |
| `Address already in use` on port 8000 / 5173 | Another instance is already running. Close it, or start on another port (`--port 8010`; for the frontend set `VITE_API_URL` and add the new origin to `FRAUD_CORS_ORIGINS`). |
| The page shows an old interface after a code change | The dev server missed a file change. Save the file again or restart `npm run dev`. |
| *Jeu de données* panel says "À IMPORTER" | `data/raw/creditcard.csv` is missing. Import it from the panel or copy it there. |

## 9. Project layout

```
backend/
  main.py             API entry point: health, predictions, dashboard
  model_service.py    loads models + scaler, applies the preprocessing, predicts
  dataset.py          dataset import / browsing / live evaluation (split of notebook 02)
  results.py          /results/* routes (thesis results)
  notebook_tables.py  reads result tables from executed notebooks and artifacts/
  activity.py         SQLite log feeding the dashboard
  requirements.txt
frontend/src/
  App.tsx             layout, navigation, API status
  Dashboard.tsx · TransactionAnalysis.tsx · CsvAnalysis.tsx
  ModelComparison.tsx · AdversarialRobustness.tsx · AdversarialTraining.tsx · FinalModel.tsx
  DatasetPanel.tsx · EvaluationPanel.tsx
  api.ts              typed API client
  useAsync.tsx        loading / error / retry helper
notebooks/            the 13 thesis notebooks (data audit → hybrid ensemble)
artifacts/ results/   thesis outputs read by the results pages
models/               model files (not in git, see section 2)
data/raw/             dataset (not in git, see section 2)
.vscode/              tasks to install and launch everything
docs/                 user guide (HTML) and small test files
```

## 10. Scope and roadmap

Implemented: single and batch prediction with 3+ models, fraud alert, dataset browser and import, live reproduction of the thesis test result, dashboard, and all four thesis-results pages.

Planned (from the use-case diagram), not implemented yet:

- login / logout with JWT sessions and the three roles (Analyste antifraude, Expert cybersécurité / Data Scientist, Administrateur);
- per-user analysis history, with export from the history;
- audit log and user / role management for the administrator.

## 11. Checking your installation

Follow **[`docs/guide-utilisation.html`](docs/guide-utilisation.html)** (open it in a browser): it explains each page and contains a 57-step checklist with the expected result of every step. The test files it uses are in `docs/test_files/` (a 20-transaction CSV with 10 real frauds and 10 normal rows, plus deliberately broken files to check the error messages).

The three checks that matter most:

1. a known fraud entered by hand is flagged by Random Forest (≈ 81 %);
2. `docs/test_files/transactions_test.csv` gives 10 frauds out of 20 with Random Forest;
3. *Modèle final* → *Vérification en direct* reports **TP 56 / FP 7 / FN 15** and "✓ identique".

## 12. Limits worth knowing

- The thesis models were evaluated on one dataset (European card transactions, 2013). Results on other data are not guaranteed.
- Adversarial-robustness figures come from small attack panels (≈ 53 attacked frauds): they are empirical observations, not certified guarantees.
- The application is a research / decision-support tool; a flagged transaction should be reviewed, not treated as a definitive verdict.
