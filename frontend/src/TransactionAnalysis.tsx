
import { useEffect, useState, type FormEvent } from 'react'
import './TransactionAnalysis.css'
import {
  fetchHealth,
  predictAll,
  predictTransaction,
  type CompareResult,
  type DatasetRow,
  type Health,
} from './api'
import DatasetPanel from './DatasetPanel'

type ModelName =
  | 'XGBoost'
  | 'Random Forest'
  | 'LightGBM'
  | 'SVM linéaire'
  | 'Régression logistique'

type AnalysisResult = {
  status: 'normal' | 'fraud'
  riskScore: number
  model: ModelName
  riskLevel: string
  threshold: number
}

type DatasetSource = {
  id: number
  label: 0 | 1
  split: string
}

const features = Array.from(
  { length: 28 },
  (_, index) => `V${index + 1}`
)

const models: ModelName[] = [
  'Random Forest',
  'XGBoost',
  'LightGBM',
  'SVM linéaire',
  'Régression logistique',
]

const initialValues: Record<string, string> = {
  Time: '',
  Amount: '',
  ...Object.fromEntries(features.map((feature) => [feature, ''])),
}

export default function TransactionAnalysis() {
  const [values, setValues] = useState<Record<string, string>>(
    initialValues
  )
  const [model, setModel] = useState<ModelName>('Random Forest')
  const [result, setResult] = useState<AnalysisResult | null>(null)
  const [error, setError] = useState('')
  const [loading, setLoading] = useState(false)
  const [health, setHealth] = useState<Health | null>(null)
  const [backendDown, setBackendDown] = useState(false)
  const [source, setSource] = useState<DatasetSource | null>(null)
  const [compare, setCompare] = useState<CompareResult | null>(null)
  const [comparing, setComparing] = useState(false)

  useEffect(() => {
    fetchHealth()
      .then((data) => {
        setHealth(data)
        setBackendDown(false)
      })
      .catch(() => setBackendDown(true))
  }, [])

  const isLoaded = (name: string) =>
    health?.models.find((item) => item.name === name)?.loaded ?? false

  const updateField = (field: string, value: string) => {
    setValues((previous) => ({
      ...previous,
      [field]: value,
    }))
    setResult(null)
    setCompare(null)
    setSource(null)
    setError('')
  }

  // Remplit le formulaire avec une vraie transaction du jeu de données.
  const loadFromDataset = (row: DatasetRow) => {
    if (!row.features) return

    setValues(
      Object.fromEntries(
        Object.entries(row.features).map(([key, value]) => [
          key,
          String(value),
        ])
      )
    )
    setSource({ id: row.id, label: row.label, split: row.split })
    setResult(null)
    setCompare(null)
    setError('')
  }

  const numericFeatures = () =>
    Object.fromEntries(
      Object.entries(values).map(([key, value]) => [key, Number(value)])
    )

  const formProblem = () => {
    const invalid = Object.values(values).some(
      (value) => value.trim() === '' || !Number.isFinite(Number(value))
    )
    if (invalid) return 'Veuillez remplir les 30 caractéristiques numériques.'
    if (Number(values.Amount) < 0 || Number(values.Time) < 0) {
      return 'Time et Amount doivent être positifs ou nuls.'
    }
    return ''
  }

  const compareAll = async () => {
    const problem = formProblem()
    if (problem) {
      setError(problem)
      return
    }

    setComparing(true)
    setError('')
    try {
      setCompare(await predictAll(numericFeatures()))
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Erreur de comparaison.')
    } finally {
      setComparing(false)
    }
  }

  const fillExample = () => {
    setSource(null)
    setCompare(null)
    setValues({
      Time: '406',
      Amount: '149.62',
      ...Object.fromEntries(
        features.map((feature, index) => [
          feature,
          (Math.sin(index + 1) * 1.5).toFixed(5),
        ])
      ),
    })
    setResult(null)
    setError('')
  }

  const analyze = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault()

    const problem = formProblem()

    if (problem) {
      setError(problem)
      setResult(null)
      return
    }

    setLoading(true)
    setError('')
    setResult(null)
    setCompare(null)

    try {
      const prediction = await predictTransaction(model, numericFeatures())

      setResult({
        status: prediction.is_fraud ? 'fraud' : 'normal',
        riskScore: prediction.risk_score,
        model: prediction.model as ModelName,
        riskLevel: prediction.risk_level,
        threshold: prediction.threshold,
      })
      setBackendDown(false)
    } catch (err) {
      setError(
        err instanceof Error ? err.message : "Erreur d'analyse."
      )
    } finally {
      setLoading(false)
    }
  }

  const reset = () => {
    setValues({ ...initialValues })
    setResult(null)
    setCompare(null)
    setSource(null)
    setError('')
  }

  const riskLevel = result?.riskLevel ?? ''

  return (
    <main className="dashboard transaction-page">
      <div className="page-heading">
        <div>
          <div className="eyebrow">
            FRAUD DETECTION / SINGLE TRANSACTION
          </div>
          <h1>Analyse de transaction</h1>
          <p>
            Évaluation individuelle d'une transaction bancaire.
          </p>
        </div>
        <span className="dataset-label">
          Prédiction par modèle entraîné
        </span>
      </div>

      <DatasetPanel selectedId={source?.id ?? null} onUse={loadFromDataset} />

      <div className="transaction-grid">
        <form className="panel transaction-form" onSubmit={analyze}>
          <div className="panel-header">
            <div>
              <h2>Nouvelle analyse</h2>
              <p>Renseignez les caractéristiques de la transaction.</p>
            </div>
            <span className="panel-tag">30 variables</span>
          </div>

          {source && (
            <div className="info-note" style={{ marginTop: 18 }}>
              Transaction n° <strong>{source.id}</strong> du jeu de
              données ({source.split}) — classe réelle :{' '}
              <strong style={{ color: source.label === 1 ? '#fb7185' : '#34d399' }}>
                {source.label === 1 ? 'fraude' : 'normale'}
              </strong>
              .
            </div>
          )}

          <div className="form-section">
            <h3>01 / Modèle de classification</h3>
            <label className="field-label" htmlFor="model">
              Modèle utilisé
            </label>
            <select
              id="model"
              value={model}
              onChange={(e) => {
                setModel(e.target.value as ModelName)
                setResult(null)
              }}
              className="bank-input"
            >
              {models.map((item) => (
                <option key={item} value={item}>
                  {item}
                  {health && !isLoaded(item) ? ' (non chargé)' : ''}
                </option>
              ))}
            </select>
            <p className="field-help">
              {backendDown
                ? "Backend injoignable : démarrez l'API FastAPI."
                : health && !isLoaded(model)
                  ? "Ce modèle n'est pas chargé côté serveur."
                  : 'Random Forest : modèle final retenu dans le mémoire.'}
            </p>
          </div>

          <div className="form-section">
            <h3>02 / Informations principales</h3>
            <div className="form-two-columns">
              {(['Time', 'Amount'] as const).map((field) => (
                <div key={field}>
                  <label htmlFor={field} className="field-label">
                    {field === 'Time'
                      ? 'Time — Temps écoulé (secondes)'
                      : 'Amount — Montant du dataset'}
                  </label>
                  <input
                    id={field}
                    type="number"
                    step="any"
                    min="0"
                    className="bank-input"
                    placeholder="0.00"
                    value={values[field]}
                    onChange={(e) =>
                      updateField(field, e.target.value)
                    }
                  />
                </div>
              ))}
            </div>
          </div>

          <div className="form-section">
            <h3>03 / Caractéristiques anonymisées</h3>
            <p className="field-help">
              Composantes PCA V1 à V28 du dataset.
            </p>

            <div className="feature-grid">
              {features.map((feature) => (
                <div key={feature}>
                  <label htmlFor={feature} className="field-label">
                    {feature}
                  </label>
                  <input
                    id={feature}
                    type="number"
                    step="any"
                    className="bank-input"
                    placeholder="0.00000"
                    value={values[feature]}
                    onChange={(e) =>
                      updateField(feature, e.target.value)
                    }
                  />
                </div>
              ))}
            </div>
          </div>

          {error && (
            <div className="analysis-error" role="alert">
              {error}
            </div>
          )}

          <div className="form-actions">
            <button
              type="button"
              className="bank-button secondary"
              onClick={fillExample}
            >
              Charger un exemple fictif
            </button>
            <button
              type="button"
              className="bank-button secondary"
              onClick={reset}
            >
              Réinitialiser
            </button>
            <button
              type="submit"
              className="bank-button primary"
              disabled={loading}
            >
              {loading ? 'Analyse en cours...' : 'Analyser la transaction →'}
            </button>
          </div>
        </form>

        <section className="result-column" aria-live="polite">
          <article className="panel analysis-result">
            <div className="panel-header">
              <div>
                <h2>Résultat de l'analyse</h2>
                <p>Évaluation du niveau de risque</p>
              </div>
              <span className="panel-tag">Prédiction</span>
            </div>

            {result ? (
              <div className="result-content">
                {result.status === 'fraud' && (
                  <div className="analysis-error" role="alert" style={{ marginBottom: 18 }}>
                    <strong>⚠ Alerte de fraude</strong> — score{' '}
                    {result.riskScore} % ≥ seuil{' '}
                    {Math.round(result.threshold * 100)} %. Cette
                    transaction doit être vérifiée.
                  </div>
                )}

                <div className={`result-emblem ${result.status}`}>
                  {result.status === 'fraud' ? '!' : '✓'}
                </div>
                <span className={`result-label ${result.status}`}>
                  {result.status === 'fraud'
                    ? 'Fraude suspectée'
                    : 'Transaction normale'}
                </span>

                <div className="risk-number">
                  {result.riskScore}%
                </div>
                <p className="field-help">
                  Probabilité de fraude estimée par le modèle
                </p>

                <div className="result-track">
                  <div
                    className={`result-progress ${result.status}`}
                    style={{ width: `${result.riskScore}%` }}
                  />
                </div>

                <div className="result-detail">
                  <span>Niveau de risque</span>
                  <strong>{riskLevel}</strong>
                </div>

                <div className="result-detail">
                  <span>Modèle utilisé</span>
                  <strong>{result.model}</strong>
                </div>

                <div className="result-detail">
                  <span>Seuil de décision</span>
                  <strong>{Math.round(result.threshold * 100)} %</strong>
                </div>

                {source && (
                  <div className="result-detail">
                    <span>Classe réelle (jeu de données)</span>
                    <strong style={{
                      color:
                        (source.label === 1) === (result.status === 'fraud')
                          ? '#34d399'
                          : '#fb7185',
                    }}>
                      {source.label === 1 ? 'Fraude' : 'Normale'} —{' '}
                      {(source.label === 1) === (result.status === 'fraud')
                        ? 'prédiction correcte'
                        : source.label === 1
                          ? 'fraude manquée (faux négatif)'
                          : 'fausse alerte (faux positif)'}
                    </strong>
                  </div>
                )}

                <div style={{ marginTop: 18 }}>
                  <button
                    type="button"
                    className="bank-button secondary"
                    disabled={comparing}
                    onClick={() => void compareAll()}
                  >
                    {comparing ? 'Comparaison…' : 'Comparer tous les modèles'}
                  </button>
                </div>

                {compare && (
                  <div style={{ marginTop: 16 }}>
                    <div className="table-wrapper">
                      <table>
                        <thead>
                          <tr>
                            <th>MODÈLE</th>
                            <th>SCORE</th>
                            <th>VERDICT</th>
                          </tr>
                        </thead>
                        <tbody>
                          {compare.results.map((item) => (
                            <tr key={item.model}>
                              <td>{item.model}</td>
                              {item.loaded ? (
                                <>
                                  <td>{item.risk_score} %</td>
                                  <td>
                                    <span className={`risk-badge ${item.is_fraud ? 'high' : 'normal'}`}>
                                      {item.is_fraud ? 'Fraude' : 'Normale'}
                                    </span>
                                  </td>
                                </>
                              ) : (
                                <td colSpan={2} style={{ color: '#93a9c1' }}>
                                  non chargé
                                </td>
                              )}
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                    <p className="field-help" style={{ marginTop: 10 }}>
                      {compare.fraud_votes} modèle(s) sur{' '}
                      {compare.models_scored} signalent une fraude.
                    </p>
                  </div>
                )}

                <div className="analysis-disclaimer">
                  Résultat d'un modèle de recherche (projet de fin
                  d'études) : à utiliser comme aide à la décision,
                  pas comme verdict définitif.
                </div>
              </div>
            ) : (
              <div className="result-empty">
                <div className="result-empty-icon">◎</div>
                <h3>En attente d'analyse</h3>
                <p>
                  Complétez le formulaire ou chargez un exemple fictif,
                  puis cliquez sur « Analyser la transaction ».
                </p>
              </div>
            )}
          </article>

          <article className="panel result-info">
            <h2>Informations sur l'analyse</h2>
            <div className="system-row">
              <span>Source</span>
              <strong>POST /predict</strong>
            </div>
            <div className="system-row">
              <span>Backend</span>
              <strong className={backendDown ? 'text-amber' : ''}>
                {backendDown ? 'Non connecté' : health ? 'Connecté' : '…'}
              </strong>
            </div>
            <div className="system-row">
              <span>Modèle final</span>
              <strong
                className={health?.models_ready ? '' : 'text-amber'}
              >
                {health?.models_ready ? 'Chargé' : 'En attente'}
              </strong>
            </div>
            {health && !health.models_ready && (
              <div className="info-note">
                Fichiers du modèle absents : déposez les .joblib dans
                le dossier models/ puis redémarrez l'API.
              </div>
            )}
          </article>
        </section>
      </div>
    </main>
  )
}
