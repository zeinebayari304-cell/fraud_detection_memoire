import { useState } from 'react'
import {
  BarChart, Bar, XAxis, YAxis, CartesianGrid,
  Tooltip, ResponsiveContainer, Cell,
} from 'recharts'
import { fetchModelsResults, type ModelMetrics } from './api'
import { DataState } from './DataState'
import { colorOf, fmt } from './format'
import { useAsync } from './useAsync'

type Metric = 'accuracy' | 'precision' | 'recall' | 'f1' | 'rocAuc' | 'prAuc'

const metricNames: Record<Metric, string> = {
  accuracy: 'Accuracy',
  precision: 'Precision',
  recall: 'Recall',
  f1: 'F1-score',
  rocAuc: 'ROC-AUC',
  prAuc: 'PR-AUC',
}

const metricDescriptions: Record<Metric, string> = {
  accuracy: 'Proportion totale de classifications correctes.',
  precision: 'Parmi les fraudes prédites, proportion réellement frauduleuse.',
  recall: 'Proportion des fraudes réelles correctement détectées.',
  f1: 'Moyenne harmonique de la précision et du recall.',
  rocAuc: 'Capacité du modèle à distinguer les deux classes sur différents seuils.',
  prAuc: 'Aire sous la courbe Precision-Recall, importante avec des classes déséquilibrées.',
}

const cardStyle = {
  background: '#142137',
  border: '1px solid #263750',
  borderRadius: 12,
  padding: 20,
}

const selectStyle = {
  padding: '12px 16px',
  background: '#101c30',
  color: '#f1f5f9',
  border: '1px solid #35506a',
  borderRadius: 9,
  width: '100%',
  maxWidth: 360,
}

const labelStyle = {
  display: 'block',
  marginBottom: 10,
  color: '#9eafc3',
  fontSize: 13,
}

export default function ModelComparison() {
  const results = useAsync(fetchModelsResults)

  const [stageId, setStageId] = useState('')
  const [metric, setMetric] = useState<Metric>('recall')
  const [selectedName, setSelectedName] = useState('Random Forest')

  const stages = results.data?.stages ?? []
  const stage = stages.find((s) => s.id === stageId) ?? stages[0]
  const models: ModelMetrics[] = stage?.models ?? []

  const values = models
    .map((model) => model[metric])
    .filter((value): value is number => value !== null)
  const highest = values.length ? Math.max(...values) : null
  const lowest = values.length ? Math.min(...values) : null
  const best = models.find((model) => model[metric] === highest)

  const selected = models.find((m) => m.name === selectedName) ?? models[0]

  return (
    <main className="dashboard">
      <div className="page-heading">
        <div>
          <div className="eyebrow">MACHINE LEARNING / MODEL BENCHMARK</div>
          <h1>Comparaison des modèles</h1>
          <p>
            Évaluation comparative des cinq modèles de détection de
            fraude bancaire sur le jeu de test.
          </p>
        </div>
        <span className="dataset-label">RÉSULTATS DES NOTEBOOKS</span>
      </div>

      <DataState
        loading={results.loading}
        error={results.error}
        hasData={!!results.data?.available && !!stage}
        onRetry={results.reload}
      >
        {stage && (
          <>
            <section className="panel" style={{ marginBottom: 24 }}>
              <label htmlFor="stage-selector" style={labelStyle}>
                Phase d'évaluation
              </label>
              <select
                id="stage-selector"
                value={stage.id}
                onChange={(event) => setStageId(event.target.value)}
                style={selectStyle}
              >
                {stages.map((item) => (
                  <option key={item.id} value={item.id}>{item.label}</option>
                ))}
              </select>
              <div className="info-note">
                Source : <strong>{stage.source}</strong>. Valeurs lues
                directement dans les sorties exécutées du notebook.
                {stage.id === 'defended' &&
                  " La PR-AUC de test n'est publiée que pour le modèle final."}
              </div>
            </section>

            <section className="stats-grid">
              <article className="stat-card">
                <div className="stat-top">Modèles comparés</div>
                <div className="stat-value">{models.length}</div>
                <p>Algorithmes de classification</p>
              </article>
              <article className="stat-card">
                <div className="stat-top">Meilleur modèle</div>
                <div className="stat-value" style={{ color: best ? colorOf(best.name) : undefined, fontSize: 22 }}>
                  {best?.name ?? '—'}
                </div>
                <p>Pour {metricNames[metric]}</p>
              </article>
              <article className="stat-card">
                <div className="stat-top">Meilleure valeur</div>
                <div className="stat-value" style={{ color: '#2dd4bf' }}>
                  {highest === null ? '—' : `${fmt(highest, 1)} %`}
                </div>
                <p>{metricNames[metric]}</p>
              </article>
              <article className="stat-card">
                <div className="stat-top">Écart entre modèles</div>
                <div className="stat-value">
                  {highest === null || lowest === null
                    ? '—'
                    : fmt(highest - lowest, 1)}
                </div>
                <p>Points de pourcentage</p>
              </article>
            </section>

            <section className="panel" style={{ marginBottom: 24 }}>
              <div className="panel-header">
                <div>
                  <h2>Comparaison interactive des performances</h2>
                  <p>Sélectionnez une métrique pour comparer les modèles.</p>
                </div>
                <span className="panel-tag">{stage.label.toUpperCase()}</span>
              </div>

              <div style={{ marginTop: 25, marginBottom: 18 }}>
                <label htmlFor="metric-selector" style={labelStyle}>
                  Métrique à visualiser
                </label>
                <select
                  id="metric-selector"
                  value={metric}
                  onChange={(event) => setMetric(event.target.value as Metric)}
                  style={{ ...selectStyle, maxWidth: 320 }}
                >
                  {(Object.keys(metricNames) as Metric[]).map((key) => (
                    <option key={key} value={key}>{metricNames[key]}</option>
                  ))}
                </select>
              </div>

              <div style={{ width: '100%', height: 340, minWidth: 0 }}>
                <ResponsiveContainer width="100%" height="100%">
                  <BarChart
                    data={models}
                    margin={{ top: 15, right: 10, left: -15, bottom: 35 }}
                  >
                    <CartesianGrid stroke="#293b52" vertical={false} />
                    <XAxis
                      dataKey="name"
                      stroke="#91a5bc"
                      tick={{ fontSize: 11 }}
                      interval={0}
                      angle={-15}
                      textAnchor="end"
                      height={65}
                    />
                    <YAxis
                      stroke="#91a5bc"
                      domain={[0, 100]}
                      tick={{ fontSize: 12 }}
                      tickFormatter={(value: number) => `${value}%`}
                    />
                    <Tooltip
                      formatter={(value) => [
                        `${Number(value).toFixed(2)} %`,
                        metricNames[metric],
                      ]}
                      contentStyle={{
                        background: '#111c30',
                        border: '1px solid #35506a',
                        borderRadius: 10,
                        color: '#f1f5f9',
                      }}
                    />
                    <Bar dataKey={metric} radius={[6, 6, 0, 0]}>
                      {models.map((model) => (
                        <Cell key={model.name} fill={colorOf(model.name)} />
                      ))}
                    </Bar>
                  </BarChart>
                </ResponsiveContainer>
              </div>

              <div className="info-note">
                <strong>{metricNames[metric]} :</strong>{' '}
                {metricDescriptions[metric]}
              </div>
            </section>

            <section className="panel" style={{ marginBottom: 24 }}>
              <div className="panel-header">
                <div>
                  <h2>Tableau comparatif détaillé</h2>
                  <p>Toutes les métriques sont exprimées en pourcentage.</p>
                </div>
                <span className="panel-tag">{models.length} MODÈLES</span>
              </div>

              <div className="table-wrapper">
                <table>
                  <thead>
                    <tr>
                      <th>MODÈLE</th>
                      {(Object.keys(metricNames) as Metric[]).map((key) => (
                        <th key={key}>{metricNames[key].toUpperCase()}</th>
                      ))}
                    </tr>
                  </thead>
                  <tbody>
                    {models.map((model) => (
                      <tr key={model.name}>
                        <td style={{ color: colorOf(model.name), fontWeight: 700, whiteSpace: 'nowrap' }}>
                          {model.name}
                        </td>
                        {(Object.keys(metricNames) as Metric[]).map((key) => (
                          <td key={key}>
                            {model[key] === null ? '—' : `${fmt(model[key], 2)}%`}
                          </td>
                        ))}
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </section>

            {selected && (
              <section className="panel">
                <div className="panel-header">
                  <div>
                    <h2>Explorateur de modèles</h2>
                    <p>Consultez les indicateurs d'un modèle individuellement.</p>
                  </div>
                </div>

                <div style={{ margin: '25px 0' }}>
                  <label htmlFor="model-selector" style={labelStyle}>
                    Sélectionner un modèle
                  </label>
                  <select
                    id="model-selector"
                    value={selected.name}
                    onChange={(event) => setSelectedName(event.target.value)}
                    style={{ ...selectStyle, maxWidth: 320 }}
                  >
                    {models.map((model) => (
                      <option key={model.name} value={model.name}>{model.name}</option>
                    ))}
                  </select>
                </div>

                <h2 style={{ color: colorOf(selected.name), marginBottom: 20 }}>
                  {selected.name}
                </h2>

                <div style={{
                  display: 'grid',
                  gridTemplateColumns: 'repeat(auto-fit, minmax(145px, 1fr))',
                  gap: 14,
                }}>
                  {(Object.keys(metricNames) as Metric[]).map((key) => (
                    <div key={key} style={cardStyle}>
                      <div style={{ color: '#91a5bc', fontSize: 12 }}>
                        {metricNames[key]}
                      </div>
                      <div style={{
                        fontSize: 25, fontWeight: 750, marginTop: 12,
                        color: colorOf(selected.name),
                      }}>
                        {selected[key] === null ? '—' : `${fmt(selected[key], 2)}%`}
                      </div>
                    </div>
                  ))}
                </div>
              </section>
            )}
          </>
        )}
      </DataState>
    </main>
  )
}
