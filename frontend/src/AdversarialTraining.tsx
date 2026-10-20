import { useState } from 'react'
import {
  BarChart, Bar, XAxis, YAxis, CartesianGrid,
  Tooltip, Legend, ResponsiveContainer,
} from 'recharts'
import { fetchDefense, type DefenseRow } from './api'
import { DataState } from './DataState'
import { colorOf, fmt, fmtInt } from './format'
import { useAsync } from './useAsync'

type Attack = 'ZOO' | 'HSJ'

const tooltipStyle = {
  backgroundColor: '#111c30',
  border: '1px solid #35506a',
  borderRadius: 10,
  color: '#f1f5f9',
}

const formatValue = (value: unknown) => `${Number(value).toFixed(1)} %`

const card = {
  background: '#142137',
  border: '1px solid #263750',
  borderRadius: 12,
  padding: 22,
}

const asrOf = (row: DefenseRow, attack: Attack) =>
  attack === 'ZOO'
    ? { before: row.zoo_before, after: row.zoo_after }
    : { before: row.hsj_before, after: row.hsj_after }

export default function AdversarialTraining() {
  const results = useAsync(fetchDefense)

  const [modelName, setModelName] = useState('')
  const [attack, setAttack] = useState<Attack>('HSJ')

  const models = results.data?.models ?? []
  const selected = models.find((m) => m.model === modelName) ?? models[0]
  const asr = selected ? asrOf(selected, attack) : null

  const comparison = models
    .map((m) => ({ name: m.model, ...asrOf(m, attack) }))
    .filter((m) => m.before !== null && m.after !== null)

  const recallData = selected
    ? [
        {
          scenario: 'Recall (transactions originales)',
          before: selected.clean_recall_original,
          after: selected.clean_recall_defended,
        },
      ]
    : []

  return (
    <main className="dashboard">
      <div className="page-heading">
        <div>
          <div className="eyebrow">ADVERSARIAL SECURITY / DEFENSE EVALUATION</div>
          <h1>Adversarial Training</h1>
          <p>
            Résistance des modèles avant et après entraînement
            adversarial.
          </p>
        </div>
        <span className="dataset-label">RÉSULTATS NOTEBOOK 11</span>
      </div>

      <DataState
        loading={results.loading}
        error={results.error}
        hasData={!!results.data?.available && !!selected}
        onRetry={results.reload}
      >
        {selected && asr && (
          <>
            <section className="panel" style={{ marginBottom: 24 }}>
              <div className="panel-header">
                <div>
                  <h2>Paramètres d'analyse</h2>
                  <p>Choisissez un modèle et une attaque.</p>
                </div>
                <span className="panel-tag">DÉFENSE {selected.version}</span>
              </div>

              <div style={{ display: 'flex', gap: 16, flexWrap: 'wrap', marginTop: 24 }}>
                <select
                  aria-label="Modèle"
                  value={selected.model}
                  onChange={(event) => setModelName(event.target.value)}
                  style={{
                    padding: 12,
                    color: '#f1f5f9',
                    background: '#101c30',
                    border: '1px solid #35506a',
                    borderRadius: 9,
                    minWidth: 240,
                  }}
                >
                  {models.map((m) => (
                    <option key={m.model} value={m.model}>{m.model}</option>
                  ))}
                </select>

                {(['HSJ', 'ZOO'] as Attack[]).map((item) => (
                  <button
                    key={item}
                    type="button"
                    className={`bank-button ${attack === item ? 'primary' : 'secondary'}`}
                    onClick={() => setAttack(item)}
                    aria-pressed={attack === item}
                  >
                    {item}
                  </button>
                ))}
              </div>

              <div className="info-note">
                Source : <strong>{results.data?.source}</strong>. HSJ :
                ASR « local » sur le panel de test ; ZOO : ASR brut,
                disponible seulement pour les modèles linéaires (les
                modèles à base d'arbres n'ont subi aucun succès ZOO).
              </div>
            </section>

            <section className="stats-grid">
              <article className="stat-card">
                <div className="stat-top">Version de défense</div>
                <div className="stat-value">{selected.version}</div>
                <p>{selected.passed ? 'Validation passée' : 'Critères non tous satisfaits'}</p>
              </article>
              <article className="stat-card">
                <div className="stat-top">ASR avant → après ({attack})</div>
                <div className="stat-value" style={{ fontSize: 24 }}>
                  {asr.before === null
                    ? 'N/A'
                    : `${fmt(asr.before, 1)} → ${fmt(asr.after, 1)} %`}
                </div>
                <p>
                  {attack === 'HSJ' && selected.hsj_gain_points !== null
                    ? `${fmt(selected.hsj_gain_points, 1)} points de gain`
                    : asr.before === null
                      ? 'Aucune attaque ZOO réussie'
                      : 'Attack Success Rate'}
                </p>
              </article>
              <article className="stat-card">
                <div className="stat-top">Réduction relative (HSJ)</div>
                <div className="stat-value" style={{ color: '#2dd4bf' }}>
                  {fmt(selected.hsj_relative_reduction, 1)} %
                </div>
                <p>Baisse de l'ASR HSJ</p>
              </article>
              <article className="stat-card">
                <div className="stat-top">Recall validation (original → défendu)</div>
                <div className="stat-value" style={{ fontSize: 24 }}>
                  {fmt(selected.clean_recall_original, 1)} → {fmt(selected.clean_recall_defended, 1)} %
                </div>
                <p>Faux négatifs : {fmtInt(selected.fn_original)} → {fmtInt(selected.fn_defended)}</p>
              </article>
            </section>

            <div style={{
              display: 'grid',
              gridTemplateColumns: 'repeat(auto-fit, minmax(min(100%, 380px), 1fr))',
              gap: 20,
              marginBottom: 24,
            }}>
              <section className="panel">
                <div className="panel-header">
                  <div>
                    <h2>ASR de tous les modèles ({attack})</h2>
                    <p>Avant et après la défense</p>
                  </div>
                </div>
                {comparison.length === 0 ? (
                  <p style={{ color: '#93a9c1', marginTop: 24 }}>
                    Aucune donnée ASR disponible pour cette attaque.
                  </p>
                ) : (
                  <div style={{ width: '100%', height: 300, minWidth: 0, marginTop: 20 }}>
                    <ResponsiveContainer width="100%" height="100%">
                      <BarChart data={comparison} margin={{ top: 10, right: 10, left: -15, bottom: 30 }}>
                        <CartesianGrid stroke="#293b52" vertical={false} />
                        <XAxis dataKey="name" stroke="#91a5bc" tick={{ fontSize: 11 }} interval={0} angle={-12} textAnchor="end" height={55} />
                        <YAxis stroke="#91a5bc" domain={[0, 100]} tickFormatter={(value: number) => `${value}%`} />
                        <Tooltip formatter={formatValue} contentStyle={tooltipStyle} />
                        <Legend />
                        <Bar dataKey="before" name="Avant défense" fill="#fb7185" radius={[5, 5, 0, 0]} />
                        <Bar dataKey="after" name="Après défense" fill="#2dd4bf" radius={[5, 5, 0, 0]} />
                      </BarChart>
                    </ResponsiveContainer>
                  </div>
                )}
              </section>

              <section className="panel">
                <div className="panel-header">
                  <div>
                    <h2>Performance sur transactions originales</h2>
                    <p>
                      {selected.model} — la défense préserve-t-elle le
                      recall ? (jeu de validation)
                    </p>
                  </div>
                </div>
                <div style={{ width: '100%', height: 300, minWidth: 0, marginTop: 20 }}>
                  <ResponsiveContainer width="100%" height="100%">
                    <BarChart data={recallData} margin={{ top: 10, right: 10, left: -15, bottom: 10 }}>
                      <CartesianGrid stroke="#293b52" vertical={false} />
                      <XAxis dataKey="scenario" stroke="#91a5bc" tick={{ fontSize: 11 }} />
                      <YAxis stroke="#91a5bc" domain={[0, 100]} tickFormatter={(value: number) => `${value}%`} />
                      <Tooltip formatter={formatValue} contentStyle={tooltipStyle} />
                      <Legend />
                      <Bar dataKey="before" name="Avant défense" fill="#fb7185" radius={[5, 5, 0, 0]} />
                      <Bar dataKey="after" name="Après défense" fill="#2dd4bf" radius={[5, 5, 0, 0]} />
                    </BarChart>
                  </ResponsiveContainer>
                </div>
              </section>
            </div>

            <section className="panel">
              <div className="panel-header">
                <div>
                  <h2>Synthèse de la défense par modèle</h2>
                  <p>Entraînement adversarial et portes de validation.</p>
                </div>
                <span className="panel-tag">{models.length} MODÈLES</span>
              </div>

              <div className="table-wrapper">
                <table>
                  <thead>
                    <tr>
                      <th>MODÈLE</th>
                      <th>VERSION</th>
                      <th>ASR HSJ</th>
                      <th>ASR ZOO</th>
                      <th>RECALL VALIDATION ORIG. → DÉF.</th>
                      <th>EXEMPLES ADV.</th>
                      <th>TEMPS (S)</th>
                      <th>VALIDATION</th>
                    </tr>
                  </thead>
                  <tbody>
                    {models.map((m) => (
                      <tr key={m.model}>
                        <td style={{ color: colorOf(m.model), fontWeight: 700, whiteSpace: 'nowrap' }}>
                          {m.model}
                        </td>
                        <td>{m.version}</td>
                        <td>{fmt(m.hsj_before, 1)} → {fmt(m.hsj_after, 1)} %</td>
                        <td>
                          {m.zoo_before === null
                            ? 'N/A'
                            : `${fmt(m.zoo_before, 1)} → ${fmt(m.zoo_after, 1)} %`}
                        </td>
                        <td>
                          {fmt(m.clean_recall_original, 1)} → {fmt(m.clean_recall_defended, 1)} %
                        </td>
                        <td>{fmtInt(m.adversarial_examples)}</td>
                        <td>{fmt(m.training_time_s, 1)}</td>
                        <td>
                          <span className={`risk-badge ${m.passed ? 'normal' : 'medium'}`}>
                            {m.passed ? 'Validée' : 'Réserves'}
                          </span>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>

              <div style={{ ...card, marginTop: 24 }}>
                <strong>Lecture :</strong>{' '}
                <span style={{ color: '#a4b9cd' }}>
                  « Validée » signifie que le modèle franchit les portes du
                  Notebook 11 (ASR HSJ non dégradé, recall propre
                  préservé) ; l'ASR ZOO brut peut rester élevé, comme pour
                  le SVM linéaire. Les résultats portent sur un petit
                  panel d'attaques : ce sont des observations empiriques.
                </span>
              </div>
            </section>
          </>
        )}
      </DataState>
    </main>
  )
}
