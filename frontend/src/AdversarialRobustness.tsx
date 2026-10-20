import { useState } from 'react'
import {
  BarChart, Bar, Cell, CartesianGrid, XAxis, YAxis,
  Tooltip, ResponsiveContainer,
} from 'recharts'
import { fetchRobustness } from './api'
import { DataState } from './DataState'
import { colorOf, fmt, fmtInt } from './format'
import { useAsync } from './useAsync'

type Attack = 'ZOO' | 'HSJ'

const panelGap = { marginBottom: 24 }

const card = {
  background: '#142137',
  border: '1px solid #263750',
  borderRadius: 12,
  padding: 22,
}

export default function AdversarialRobustness() {
  const results = useAsync(fetchRobustness)

  const [attack, setAttack] = useState<Attack>('ZOO')
  const [selectedModel, setSelectedModel] = useState('')

  const rows = results.data?.attacks[attack] ?? []
  const selected = rows.find((row) => row.model === selectedModel) ?? rows[0]

  const averageAsr = rows.length
    ? rows.reduce((sum, row) => sum + row.asr, 0) / rows.length
    : 0
  const maxAsr = rows.length ? Math.max(...rows.map((row) => row.asr)) : 0
  const minAsr = rows.length ? Math.min(...rows.map((row) => row.asr)) : 0
  const worstRows = rows.filter((row) => row.asr === maxAsr)
  const bestRows = rows.filter((row) => row.asr === minAsr)
  const attacksPerModel = rows[0]?.attacks ?? 0

  // Plusieurs modèles peuvent être à égalité (ex. ASR ZOO = 0 %).
  const describe = (group: typeof rows) =>
    group.length === 1
      ? { title: group[0].model, color: colorOf(group[0].model), detail: '' }
      : {
          title: `${group.length} modèles`,
          color: undefined,
          detail: group.map((row) => row.model).join(', '),
        }
  const worst = describe(worstRows)
  const bestRow = describe(bestRows)

  return (
    <main className="dashboard">
      <div className="page-heading">
        <div>
          <div className="eyebrow">ADVERSARIAL SECURITY / ROBUSTNESS</div>
          <h1>Robustesse adversariale</h1>
          <p>
            Vulnérabilité des cinq modèles face aux attaques ZOO et
            HopSkipJump, mesurée sur des fraudes initialement détectées.
          </p>
        </div>
        <span className="dataset-label">RÉSULTATS NOTEBOOK 10</span>
      </div>

      <DataState
        loading={results.loading}
        error={results.error}
        hasData={!!results.data?.available}
        onRetry={results.reload}
      >
        <section className="panel" style={panelGap}>
          <div className="panel-header">
            <div>
              <h2>Configuration de l'attaque</h2>
              <p>Sélectionnez l'algorithme adversarial à étudier.</p>
            </div>
            <span className="panel-tag">RESEARCH MODE</span>
          </div>

          <div style={{ display: 'flex', gap: 12, marginTop: 25, flexWrap: 'wrap' }}>
            {(['ZOO', 'HSJ'] as Attack[]).map((item) => (
              <button
                key={item}
                type="button"
                className={`bank-button ${attack === item ? 'primary' : 'secondary'}`}
                onClick={() => setAttack(item)}
                aria-pressed={attack === item}
              >
                {item === 'ZOO'
                  ? 'ZOO — Zeroth Order Optimization'
                  : 'HSJ — HopSkipJump'}
              </button>
            ))}
          </div>

          <div className="info-note">
            Chaque modèle est attaqué sur{' '}
            <strong>{fmtInt(attacksPerModel)}</strong> fraudes détectées
            à l'origine. Une attaque réussit lorsque la perturbation
            transforme la prédiction « fraude » en « normale ».
            Source : <strong>{results.data?.source}</strong>.
          </div>
        </section>

        <section className="stats-grid">
          <article className="stat-card">
            <div className="stat-top">ASR moyen</div>
            <div className="stat-value">{fmt(averageAsr, 1)} %</div>
            <p>Attack Success Rate, tous modèles</p>
          </article>
          <article className="stat-card">
            <div className="stat-top">Plus vulnérable</div>
            <div className="stat-value" style={{ fontSize: 22, color: worst.color }}>
              {rows.length ? worst.title : '—'}
            </div>
            <p>ASR {fmt(maxAsr, 1)} %{worst.detail && ` · ${worst.detail}`}</p>
          </article>
          <article className="stat-card">
            <div className="stat-top">Plus robuste</div>
            <div className="stat-value" style={{ fontSize: 22, color: bestRow.color }}>
              {rows.length ? bestRow.title : '—'}
            </div>
            <p>ASR {fmt(minAsr, 1)} %{bestRow.detail && ` · ${bestRow.detail}`}</p>
          </article>
          <article className="stat-card">
            <div className="stat-top">Attaques réussies</div>
            <div className="stat-value">
              {fmtInt(rows.reduce((sum, row) => sum + row.successes, 0))}
            </div>
            <p>Sur {fmtInt(rows.reduce((sum, row) => sum + row.attacks, 0))} tentatives</p>
          </article>
        </section>

        <section className="panel" style={panelGap}>
          <div className="panel-header">
            <div>
              <h2>Taux de succès de l'attaque (ASR)</h2>
              <p>Plus la barre est haute, plus le modèle est vulnérable.</p>
            </div>
            <span className="panel-tag">{attack}</span>
          </div>

          <div style={{ width: '100%', height: 320, minWidth: 0, marginTop: 20 }}>
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={rows} margin={{ top: 15, right: 10, left: -15, bottom: 35 }}>
                <CartesianGrid stroke="#293b52" vertical={false} />
                <XAxis
                  dataKey="model"
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
                  formatter={(value) => [`${Number(value).toFixed(2)} %`, 'ASR']}
                  contentStyle={{
                    background: '#111c30',
                    border: '1px solid #35506a',
                    borderRadius: 10,
                    color: '#f1f5f9',
                  }}
                />
                <Bar dataKey="asr" radius={[6, 6, 0, 0]}>
                  {rows.map((row) => (
                    <Cell key={row.model} fill={colorOf(row.model)} />
                  ))}
                </Bar>
              </BarChart>
            </ResponsiveContainer>
          </div>
        </section>

        <section className="panel" style={panelGap}>
          <div className="panel-header">
            <div>
              <h2>Résultats détaillés</h2>
              <p>
                Perturbations en distance L2 / L∞ (données normalisées),
                coût de l'attaque et impact sur le recall.
              </p>
            </div>
            <span className="panel-tag">{rows.length} MODÈLES</span>
          </div>

          <div className="table-wrapper">
            <table>
              <thead>
                <tr>
                  <th>MODÈLE</th>
                  <th>ATTAQUES</th>
                  <th>SUCCÈS</th>
                  <th>ASR (IC 95 %)</th>
                  <th>L2 MOYEN</th>
                  <th>L∞ MOYEN</th>
                  <th>REQUÊTES</th>
                  <th>TEMPS (S)</th>
                  <th>RECALL</th>
                  <th>FN</th>
                </tr>
              </thead>
              <tbody>
                {rows.map((row) => (
                  <tr key={row.model}>
                    <td style={{ color: colorOf(row.model), fontWeight: 700, whiteSpace: 'nowrap' }}>
                      {row.model}
                    </td>
                    <td>{fmtInt(row.attacks)}</td>
                    <td>{fmtInt(row.successes)}</td>
                    <td>
                      {fmt(row.asr, 1)} %{' '}
                      <span style={{ color: '#91a5bc', fontSize: 12 }}>
                        [{fmt(row.ci_low, 1)} – {fmt(row.ci_high, 1)}]
                      </span>
                    </td>
                    <td>{fmt(row.mean_l2, 3)}</td>
                    <td>{fmt(row.mean_linf, 3)}</td>
                    <td>{fmtInt(row.mean_queries === null ? null : Math.round(row.mean_queries))}</td>
                    <td>{fmt(row.mean_time_s, 1)}</td>
                    <td>
                      {fmt(row.recall_clean, 1)} % → {fmt(row.recall_after, 1)} %
                    </td>
                    <td>
                      {fmtInt(row.fn_clean)} → {fmtInt(row.fn_after)}
                    </td>
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
                <h2>Explorateur de modèle</h2>
                <p>Impact de l'attaque {attack} sur un modèle.</p>
              </div>
            </div>

            <div style={{ margin: '25px 0' }}>
              <label
                htmlFor="robust-model"
                style={{ display: 'block', marginBottom: 10, color: '#9eafc3', fontSize: 13 }}
              >
                Sélectionner un modèle
              </label>
              <select
                id="robust-model"
                value={selected.model}
                onChange={(event) => setSelectedModel(event.target.value)}
                style={{
                  padding: 12,
                  color: '#f1f5f9',
                  background: '#101c30',
                  border: '1px solid #35506a',
                  borderRadius: 9,
                  width: '100%',
                  maxWidth: 320,
                }}
              >
                {rows.map((row) => (
                  <option key={row.model} value={row.model}>{row.model}</option>
                ))}
              </select>
            </div>

            <h2 style={{ color: colorOf(selected.model), marginBottom: 20 }}>
              {selected.model}
            </h2>

            <div style={{
              display: 'grid',
              gridTemplateColumns: 'repeat(auto-fit, minmax(190px, 1fr))',
              gap: 14,
            }}>
              <div style={card}>
                <div style={{ color: '#91a5bc', fontSize: 12 }}>ASR</div>
                <div style={{ fontSize: 26, fontWeight: 750, marginTop: 12, color: colorOf(selected.model) }}>
                  {fmt(selected.asr, 1)} %
                </div>
                <p style={{ color: '#91a5bc', fontSize: 12 }}>
                  {fmtInt(selected.successes)} / {fmtInt(selected.attacks)} attaques
                </p>
              </div>
              <div style={card}>
                <div style={{ color: '#91a5bc', fontSize: 12 }}>Recall avant → après</div>
                <div style={{ fontSize: 26, fontWeight: 750, marginTop: 12 }}>
                  {fmt(selected.recall_clean, 1)} → {fmt(selected.recall_after, 1)} %
                </div>
                <p style={{ color: '#91a5bc', fontSize: 12 }}>Détection des fraudes</p>
              </div>
              <div style={card}>
                <div style={{ color: '#91a5bc', fontSize: 12 }}>Faux négatifs</div>
                <div style={{ fontSize: 26, fontWeight: 750, marginTop: 12, color: '#fb7185' }}>
                  {fmtInt(selected.fn_clean)} → {fmtInt(selected.fn_after)}
                </div>
                <p style={{ color: '#91a5bc', fontSize: 12 }}>Fraudes non détectées</p>
              </div>
              <div style={card}>
                <div style={{ color: '#91a5bc', fontSize: 12 }}>Perturbation (succès)</div>
                <div style={{ fontSize: 22, fontWeight: 750, marginTop: 12 }}>
                  {selected.mean_l2_success === null
                    ? 'Aucune attaque réussie'
                    : `L2 ${fmt(selected.mean_l2_success, 3)}`}
                </div>
                <p style={{ color: '#91a5bc', fontSize: 12 }}>
                  {selected.mean_linf_success === null
                    ? 'ASR de 0 % : aucune perturbation mesurable'
                    : `L∞ ${fmt(selected.mean_linf_success, 3)}`}
                </p>
              </div>
            </div>

            <div className="info-note" style={{ marginTop: 25 }}>
              Résultats empiriques sur un échantillon de fraudes ; ils
              décrivent une résistance observée, pas une garantie
              certifiée.
            </div>
          </section>
        )}
      </DataState>
    </main>
  )
}
