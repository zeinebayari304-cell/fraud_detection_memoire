
import { useState, type FormEvent } from 'react'
import './TransactionAnalysis.css'

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
}

const features = Array.from(
  { length: 28 },
  (_, index) => `V${index + 1}`
)

const models: ModelName[] = [
  'XGBoost',
  'Random Forest',
  'LightGBM',
  'SVM linéaire',
  'Régression logistique',
]

const initialValues: Record<string, string> = {
  Time: '',
  Amount: '',
  ...Object.fromEntries(features.map((feature) => [feature, ''])),
}

// Réponses fictives uniquement.
// Aucun algorithme ML n'est exécuté dans React.
const demoResponses: AnalysisResult[] = [
  { status: 'normal', riskScore: 12, model: 'XGBoost' },
  { status: 'fraud', riskScore: 92, model: 'XGBoost' },
  { status: 'normal', riskScore: 24, model: 'XGBoost' },
  { status: 'fraud', riskScore: 86, model: 'XGBoost' },
]

export default function TransactionAnalysis() {
  const [values, setValues] = useState<Record<string, string>>(
    initialValues
  )
  const [model, setModel] = useState<ModelName>('XGBoost')
  const [result, setResult] = useState<AnalysisResult | null>(null)
  const [error, setError] = useState('')
  const [loading, setLoading] = useState(false)
  const [demoIndex, setDemoIndex] = useState(0)

  const updateField = (field: string, value: string) => {
    setValues((previous) => ({
      ...previous,
      [field]: value,
    }))
    setResult(null)
    setError('')
  }

  const fillExample = () => {
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

  const analyze = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault()

    const invalid = Object.entries(values).some(
      ([, value]) => value.trim() === '' ||
        !Number.isFinite(Number(value))
    )

    if (invalid) {
      setError('Veuillez remplir les 30 caractéristiques numériques.')
      setResult(null)
      return
    }

    if (Number(values.Amount) < 0 || Number(values.Time) < 0) {
      setError('Time et Amount doivent être positifs ou nuls.')
      setResult(null)
      return
    }

    // Séquence de réponses de démonstration.
    // Les champs saisis ne déterminent pas ce résultat.
    setLoading(true)
    setError('')
    setResult(null)

    const response = demoResponses[
      demoIndex % demoResponses.length
    ]

    setResult({ ...response, model })
    setDemoIndex((previous) => previous + 1)
    setLoading(false)
  }

  const reset = () => {
    setValues({ ...initialValues })
    setResult(null)
    setError('')
  }

  const riskLevel = result
    ? result.riskScore >= 75
      ? 'Élevé'
      : result.riskScore >= 40
        ? 'Moyen'
        : 'Faible'
    : ''

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
          Données et résultats fictifs
        </span>
      </div>

      <div className="transaction-grid">
        <form className="panel transaction-form" onSubmit={analyze}>
          <div className="panel-header">
            <div>
              <h2>Nouvelle analyse</h2>
              <p>Renseignez les caractéristiques de la transaction.</p>
            </div>
            <span className="panel-tag">30 variables</span>
          </div>

          <div className="form-section">
            <h3>01 / Modèle de classification</h3>
            <label className="field-label" htmlFor="model">
              Modèle à simuler
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
                </option>
              ))}
            </select>
            <p className="field-help">
              Aucun modèle réel n'est encore connecté.
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
              <span className="panel-tag">Simulation</span>
            </div>

            {result ? (
              <div className="result-content">
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
                  Indicateur de risque simulé, non calibré
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
                  <span>Modèle affiché</span>
                  <strong>{result.model}</strong>
                </div>

                <div className="analysis-disclaimer">
                  Démonstration uniquement : résultat issu d'une
                  séquence prédéfinie, indépendant des valeurs saisies.
                  Aucune prédiction bancaire réelle.
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
              <strong>Mock data</strong>
            </div>
            <div className="system-row">
              <span>Backend</span>
              <strong className="text-amber">Non connecté</strong>
            </div>
            <div className="system-row">
              <span>Modèle final</span>
              <strong className="text-amber">En attente</strong>
            </div>
            <div className="info-note">
              Cette interface sera connectée à POST /predict
              lorsque le backend FastAPI sera disponible.
            </div>
          </article>
        </section>
      </div>
    </main>
  )
}
