import { Link } from 'react-router'
import { fetchFinalModel } from './api'
import EvaluationPanel from './EvaluationPanel'
import { DataState, colorOf, fmt, fmtInt, useAsync } from './useAsync'

const sectionStyle = { marginBottom: 24 }

const pct = (value: number | undefined | null, digits = 1) =>
  value === undefined || value === null ? '—' : `${fmt(value * 100, digits)} %`

// Codes courts utilisés dans les notebooks 12 et 13.
const MODEL_CODES: Record<string, string> = {
  RF: 'Random Forest',
  XGB: 'XGBoost',
  LGBM: 'LightGBM',
  SoftWeighted: 'Hybride pondéré (soft)',
  SoftEqual: 'Hybride à poids égaux (soft)',
}
const REASONS: Record<string, string> = {
  parsimony: 'Parcimonie (gain insuffisant)',
}
const modelLabel = (code: string) => MODEL_CODES[code] ?? code
const reasonLabel = (code: string) => REASONS[code] ?? code

export default function FinalModel() {
  const results = useAsync(fetchFinalModel)
  const data = results.data

  return (
    <main className="dashboard">
      <div className="page-heading">
        <div>
          <div className="eyebrow">MODEL GOVERNANCE / FINAL SELECTION</div>
          <h1>Modèle final</h1>
          <p>
            Sélection scientifique du modèle antifraude et état de son
            déploiement dans l'application.
          </p>
        </div>
        <span className="dataset-label">RÉSULTATS NOTEBOOKS 12 & 13</span>
      </div>

      <DataState
        loading={results.loading}
        error={results.error}
        hasData={!!data?.available}
        onRetry={results.reload}
      >
        {data && (
          <>
            <section
              className="panel"
              style={{
                ...sectionStyle,
                borderColor: '#28595b',
                background: 'linear-gradient(135deg, #14283a 0%, #142137 80%)',
              }}
            >
              <div className="eyebrow">FINAL MODEL / DECISION</div>

              <div style={{
                display: 'flex', alignItems: 'center', gap: 20,
                flexWrap: 'wrap', marginTop: 24,
              }}>
                <div style={{
                  width: 72, height: 72, borderRadius: 18,
                  background: '#174148', color: '#2dd4bf',
                  display: 'grid', placeItems: 'center', fontSize: 37,
                }}>
                  ◈
                </div>

                <div style={{ flex: 1, minWidth: 200 }}>
                  <h2 style={{ fontSize: 26, margin: '0 0 10px', color: colorOf(data.selected_model) }}>
                    {data.selected_model} — défense {data.defense_version}
                  </h2>
                  <p style={{ color: '#a4b9cd', lineHeight: 1.8, margin: 0 }}>
                    Sélectionné sur le jeu de {data.selection.dataset.toLowerCase()}{' '}
                    parmi les candidats Pareto-efficaces, avec le score
                    primaire le plus élevé ({fmt(data.selection.primary_score, 3)}).
                  </p>
                </div>

                <Link to="/transaction" className="bank-button primary" style={{ textDecoration: 'none' }}>
                  Tester le modèle →
                </Link>
              </div>

              <div className="info-note" style={{ marginTop: 28 }}>
                <strong>Règle :</strong> {data.selection.rule}.
                {data.selection.near_tie &&
                  ` Écart de ${fmt(data.selection.relative_gap_to_second * 100, 2)} % avec le deuxième : quasi-égalité.`}{' '}
                Stabilité : {data.selection.stability.replaceAll('_', ' ')}.
              </div>
            </section>

            <section className="stats-grid">
              <article className="stat-card">
                <div className="stat-top">Recall (test)</div>
                <div className="stat-value">{pct(data.test_clean.Recall)}</div>
                <p>{fmtInt(data.test_clean.TP)} fraudes détectées, {fmtInt(data.test_clean.FN)} manquées</p>
              </article>
              <article className="stat-card">
                <div className="stat-top">Precision (test)</div>
                <div className="stat-value">{pct(data.test_clean.Precision)}</div>
                <p>{fmtInt(data.test_clean.FP)} fausses alertes</p>
              </article>
              <article className="stat-card">
                <div className="stat-top">F1 / PR-AUC (test)</div>
                <div className="stat-value" style={{ fontSize: 24 }}>
                  {pct(data.test_clean.F1)} / {pct(data.test_clean.AP)}
                </div>
                <p>MCC {fmt(data.test_clean.MCC, 3)}</p>
              </article>
              <article className="stat-card">
                <div className="stat-top">Résistance HSJ (test)</div>
                <div className="stat-value" style={{ color: '#2dd4bf' }}>
                  {pct(data.test_hsj.Robustness)}
                </div>
                <p>ASR {pct(data.test_hsj.ASR)}</p>
              </article>
            </section>

            <EvaluationPanel selectedModel={data.selected_model} />

            <section className="panel" style={sectionStyle}>
              <div className="panel-header">
                <div>
                  <h2>Classement des candidats</h2>
                  <p>
                    Score primaire = moyenne pondérée de{' '}
                    {data.selection.criteria.join(', ')}.
                  </p>
                </div>
                <span className="panel-tag">VALIDATION</span>
              </div>

              <div className="table-wrapper">
                <table>
                  <thead>
                    <tr>
                      <th>RANG</th>
                      <th>MODÈLE</th>
                      <th>DÉFENSE</th>
                      <th>AP</th>
                      <th>F1</th>
                      <th>RECALL</th>
                      <th>ROBUSTESSE HSJ</th>
                      <th>SCORE</th>
                    </tr>
                  </thead>
                  <tbody>
                    {data.ranking.map((row) => (
                      <tr key={row.model}>
                        <td>{row.rank}</td>
                        <td style={{ color: colorOf(row.model), fontWeight: 700, whiteSpace: 'nowrap' }}>
                          {row.model}
                          {row.model === data.selected_model && ' ★'}
                        </td>
                        <td>{row.version}</td>
                        <td>{pct(row.ap)}</td>
                        <td>{pct(row.f1)}</td>
                        <td>{pct(row.recall)}</td>
                        <td>{pct(row.hsj_robustness, 0)}</td>
                        <td>{fmt(row.score, 3)}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </section>

            <section className="panel" style={sectionStyle}>
              <div className="panel-header">
                <div>
                  <h2>Métriques détaillées des candidats</h2>
                  <p>Jeu de validation, modèles défendus.</p>
                </div>
              </div>

              <div className="table-wrapper">
                <table>
                  <thead>
                    <tr>
                      <th>MODÈLE</th>
                      <th>PRECISION</th>
                      <th>RECALL</th>
                      <th>F1</th>
                      <th>MCC</th>
                      <th>ROC-AUC</th>
                      <th>FP</th>
                      <th>FN</th>
                      <th>TP</th>
                    </tr>
                  </thead>
                  <tbody>
                    {data.candidates_validation.map((row) => (
                      <tr key={row.model}>
                        <td style={{ color: colorOf(row.model), fontWeight: 700, whiteSpace: 'nowrap' }}>
                          {row.model}
                        </td>
                        <td>{pct(row.precision)}</td>
                        <td>{pct(row.recall)}</td>
                        <td>{pct(row.f1)}</td>
                        <td>{fmt(row.mcc, 3)}</td>
                        <td>{pct(row.roc_auc)}</td>
                        <td>{fmtInt(row.fp)}</td>
                        <td>{fmtInt(row.fn)}</td>
                        <td>{fmtInt(row.tp)}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </section>

            <div style={{
              display: 'grid',
              gridTemplateColumns: 'repeat(auto-fit, minmax(min(100%, 340px), 1fr))',
              gap: 20,
              marginBottom: 24,
            }}>
              <section className="panel">
                <div className="panel-header">
                  <div>
                    <h2>Déploiement dans l'application</h2>
                    <p>État réel côté serveur</p>
                  </div>
                </div>
                <div className="system-row">
                  <span>Fichier du modèle chargé</span>
                  <strong className={data.deployment.model_file_loaded ? 'text-green' : 'text-amber'}>
                    {data.deployment.model_file_loaded ? 'Oui' : 'Non'}
                  </strong>
                </div>
                <div className="system-row">
                  <span>Seuil de décision</span>
                  <strong>{fmt(data.deployment.threshold, 2)}</strong>
                </div>
                <div className="system-row">
                  <span>Seuil optimisé (NB12)</span>
                  <strong>{data.selection.threshold_optimized ? 'Oui' : 'Non, règle native'}</strong>
                </div>
                <div className="system-row">
                  <span>Test utilisé pour classer</span>
                  <strong>{data.selection.test_used_for_ranking ? 'Oui' : 'Non'}</strong>
                </div>
                {!data.deployment.model_file_loaded && (
                  <div className="info-note">
                    {data.deployment.detail ??
                      'Déposez les fichiers du modèle dans le dossier models/.'}
                  </div>
                )}
              </section>

              {data.hybrid_check && (
                <section className="panel">
                  <div className="panel-header">
                    <div>
                      <h2>Vérification : modèle hybride</h2>
                      <p>Notebook 13 — extension exploratoire</p>
                    </div>
                  </div>
                  <div className="system-row">
                    <span>Modèle retenu</span>
                    <strong>{modelLabel(data.hybrid_check.decision.selected)}</strong>
                  </div>
                  <div className="system-row">
                    <span>Meilleur hybride</span>
                    <strong>{modelLabel(data.hybrid_check.decision.best_hybrid)}</strong>
                  </div>
                  <div className="system-row">
                    <span>Gain relatif de l'hybride</span>
                    <strong>{fmt(data.hybrid_check.decision.relative_gain * 100, 2)} %</strong>
                  </div>
                  <div className="system-row">
                    <span>Motif</span>
                    <strong>{reasonLabel(data.hybrid_check.decision.reason)}</strong>
                  </div>
                </section>
              )}
            </div>

            {data.hybrid_check && data.hybrid_check.limitations.length > 0 && (
              <section className="panel">
                <div className="panel-header">
                  <div>
                    <h2>Limites méthodologiques</h2>
                    <p>Déclarées dans les notebooks.</p>
                  </div>
                </div>
                <ul style={{ color: '#a4b9cd', lineHeight: 1.9, paddingLeft: 20 }}>
                  {data.hybrid_check.limitations.map((limit) => (
                    <li key={limit}>{limit}</li>
                  ))}
                </ul>
              </section>
            )}
          </>
        )}
      </DataState>
    </main>
  )
}
