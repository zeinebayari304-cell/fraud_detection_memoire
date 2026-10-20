import { useState } from 'react'
import {
  fetchDatasetStatus,
  fetchEvaluation,
  fetchHealth,
  type EvaluationResult,
} from './api'
import { colorOf, fmt, fmtInt } from './format'
import { useAsync } from './useAsync'

const pct = (value: number) => `${fmt(value * 100, 2)} %`

type Props = { selectedModel: string }

/** Rejoue le modèle sur le jeu de test reconstruit (même découpage que le notebook 02). */
export default function EvaluationPanel({ selectedModel }: Props) {
  const dataset = useAsync(fetchDatasetStatus)
  const health = useAsync(fetchHealth)

  const [model, setModel] = useState(selectedModel)
  const [split, setSplit] = useState('test')
  const [running, setRunning] = useState(false)
  const [error, setError] = useState('')
  const [result, setResult] = useState<EvaluationResult | null>(null)

  const loaded = (health.data?.models ?? []).filter((m) => m.loaded)
  const available = !!dataset.data?.available

  const run = async () => {
    setRunning(true)
    setError('')
    setResult(null)
    try {
      setResult(await fetchEvaluation(model, split))
    } catch (err) {
      setError(err instanceof Error ? err.message : "Échec de l'évaluation.")
    } finally {
      setRunning(false)
    }
  }

  const m = result?.metrics
  const ref = result?.reference

  return (
    <section className="panel" style={{ marginBottom: 24 }}>
      <div className="panel-header">
        <div>
          <h2>Vérification en direct sur le jeu de données</h2>
          <p>
            Le modèle est rejoué sur le jeu de test reconstruit avec le
            même découpage que le notebook 02 (70 / 15 / 15,
            random_state = 42).
          </p>
        </div>
        <span className="panel-tag">EN DIRECT</span>
      </div>

      {dataset.data && !available && (
        <div className="info-note">
          Jeu de données absent : importez <strong>creditcard.csv</strong>{' '}
          depuis la page « Analyse de transaction » (ou copiez-le dans{' '}
          <code>data/raw/</code>) pour activer cette vérification.
        </div>
      )}

      {available && (
        <>
          <div style={{ display: 'flex', gap: 12, flexWrap: 'wrap', margin: '22px 0' }}>
            <select
              aria-label="Modèle"
              value={model}
              onChange={(event) => { setModel(event.target.value); setResult(null) }}
              style={{
                padding: 12, color: '#f1f5f9', background: '#101c30',
                border: '1px solid #35506a', borderRadius: 9, minWidth: 220,
              }}
            >
              {loaded.map((item) => (
                <option key={item.name} value={item.name}>{item.name}</option>
              ))}
            </select>
            <select
              aria-label="Sous-ensemble"
              value={split}
              onChange={(event) => { setSplit(event.target.value); setResult(null) }}
              style={{
                padding: 12, color: '#f1f5f9', background: '#101c30',
                border: '1px solid #35506a', borderRadius: 9,
              }}
            >
              <option value="test">Jeu de test</option>
              <option value="validation">Jeu de validation</option>
            </select>
            <button
              type="button"
              className="bank-button primary"
              disabled={running || loaded.length === 0}
              onClick={() => void run()}
            >
              {running ? 'Évaluation en cours…' : "Lancer l'évaluation"}
            </button>
          </div>

          {error && <div className="analysis-error" role="alert">{error}</div>}

          {result && m && (
            <>
              <p style={{ color: '#a4b9cd' }}>
                <strong style={{ color: colorOf(result.model) }}>{result.model}</strong>{' '}
                sur {fmtInt(result.rows)} transactions ({fmtInt(result.frauds)}{' '}
                fraudes), seuil {fmt(result.threshold, 2)}.
              </p>

              <div className="stats-grid" style={{ marginTop: 16 }}>
                <article className="stat-card">
                  <div className="stat-top">Fraudes détectées (TP)</div>
                  <div className="stat-value" style={{ color: '#34d399' }}>{fmtInt(m.tp)}</div>
                  <p>Fraudes manquées (FN) : {fmtInt(m.fn)}</p>
                </article>
                <article className="stat-card">
                  <div className="stat-top">Fausses alertes (FP)</div>
                  <div className="stat-value" style={{ color: '#fbbf24' }}>{fmtInt(m.fp)}</div>
                  <p>Normales correctes (TN) : {fmtInt(m.tn)}</p>
                </article>
                <article className="stat-card">
                  <div className="stat-top">Recall / Precision</div>
                  <div className="stat-value" style={{ fontSize: 22 }}>
                    {pct(m.recall)} / {pct(m.precision)}
                  </div>
                  <p>F1 {pct(m.f1)} · MCC {fmt(m.mcc, 3)}</p>
                </article>
                <article className="stat-card">
                  <div className="stat-top">PR-AUC / ROC-AUC</div>
                  <div className="stat-value" style={{ fontSize: 22 }}>
                    {pct(m.ap)} / {pct(m.roc_auc)}
                  </div>
                  <p>Accuracy {pct(m.accuracy)}</p>
                </article>
              </div>

              {ref ? (
                <div className={ref.matches ? 'info-note' : 'analysis-error'} style={{ marginTop: 20 }}>
                  <strong>
                    {ref.matches
                      ? '✓ Résultat identique à celui du mémoire.'
                      : '✗ Écart avec le mémoire.'}
                  </strong>{' '}
                  Application : TP {m.tp} / FP {m.fp} / FN {m.fn}. Mémoire :
                  TP {ref.tp} / FP {ref.fp} / FN {ref.fn} (source : {ref.source}).
                </div>
              ) : (
                <div className="info-note" style={{ marginTop: 20 }}>
                  Aucune valeur de référence du mémoire pour ce modèle
                  sur ce sous-ensemble : seul le modèle final est
                  comparé sur le jeu de test.
                </div>
              )}
            </>
          )}
        </>
      )}
    </section>
  )
}
