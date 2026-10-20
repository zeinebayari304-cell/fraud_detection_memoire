import { useState } from 'react'
import { Link } from 'react-router'
import {
  AreaChart, Area, XAxis, YAxis, CartesianGrid,
  Tooltip, ResponsiveContainer, PieChart, Pie, Cell,
} from 'recharts'
import {
  Activity, ShieldAlert, ShieldCheck, CreditCard,
  TrendingUp, Bell, Database, Server,
} from 'lucide-react'
import {
  fetchDashboard, fetchDataset,
  type DashboardData, type DatasetInfo,
} from './api'
import { DataState } from './DataState'
import { fmt, fmtInt } from './format'
import { useAsync } from './useAsync'

type Period = '7j' | '30j' | '90j'

const tooltipStyle = {
  backgroundColor: '#101d30',
  border: '1px solid #30445c',
  borderRadius: 10,
  color: '#edf4fc',
}

const chartGrid = {
  display: 'grid',
  gridTemplateColumns: 'repeat(auto-fit, minmax(min(100%, 340px), 1fr))',
  gap: 20,
  marginBottom: 24,
}

const formatDate = (iso: string) =>
  new Date(iso).toLocaleString('fr-FR', {
    day: '2-digit',
    month: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
  })

export default function Dashboard() {
  const [period, setPeriod] = useState<Period>('7j')

  // Rafraîchi toutes les 15 s : reflète les analyses faites dans l'application.
  const dashboard = useAsync<DashboardData>(
    () => fetchDashboard(period), [period], 15000
  )
  const dataset = useAsync<DatasetInfo>(fetchDataset)

  const data = dashboard.data
  const totals = data?.totals

  const metrics = totals
    ? [
        {
          label: 'Transactions analysées',
          value: fmtInt(totals.analyzed),
          detail: `Sur ${period} · ${fmtInt(totals.all_time)} au total`,
          icon: CreditCard,
          color: '#2dd4bf',
        },
        {
          label: 'Fraudes suspectées',
          value: fmtInt(totals.fraud),
          detail: 'Transactions signalées par le modèle',
          icon: ShieldAlert,
          color: '#fb7185',
        },
        {
          label: 'Taux de fraude signalée',
          value: `${fmt(totals.fraud_rate, 2)} %`,
          detail: 'Part des transactions signalées',
          icon: TrendingUp,
          color: '#fbbf24',
        },
        {
          label: 'Transactions normales',
          value: fmtInt(totals.normal),
          detail: 'Transactions non signalées',
          icon: ShieldCheck,
          color: '#34d399',
        },
      ]
    : []

  const distribution = totals
    ? [
        { name: 'Normales', value: totals.normal, color: '#2dd4bf' },
        { name: 'Fraudes suspectées', value: totals.fraud, color: '#fb7185' },
      ]
    : []

  return (
    <main className="dashboard">
      <div className="page-heading">
        <div>
          <div className="eyebrow">
            FRAUD INTELLIGENCE / MONITORING CENTER
          </div>
          <h1>Centre de surveillance</h1>
          <p>
            Activité réelle de la plateforme : transactions analysées
            avec le modèle et alertes générées.
          </p>
        </div>
        <span className="dataset-label">DONNÉES EN DIRECT</span>
      </div>

      <DataState
        loading={dashboard.loading}
        error={dashboard.error}
        hasData={!!data}
        onRetry={dashboard.reload}
      >
        {data && totals && (
          <>
            <section className="stats-grid">
              {metrics.map((metric) => {
                const Icon = metric.icon

                return (
                  <article className="stat-card" key={metric.label}>
                    <div className="stat-top">
                      <span>{metric.label}</span>
                      <div
                        style={{
                          color: metric.color,
                          background: '#203347',
                          padding: 9,
                          borderRadius: 10,
                          display: 'flex',
                        }}
                      >
                        <Icon size={19} />
                      </div>
                    </div>
                    <div className="stat-value">{metric.value}</div>
                    <p>{metric.detail}</p>
                  </article>
                )
              })}
            </section>

            {totals.all_time === 0 && (
              <div className="info-note" style={{ marginBottom: 24 }}>
                Aucune transaction analysée pour l'instant. Lancez une
                analyse depuis <Link to="/transaction">Analyse de
                transaction</Link> ou <Link to="/csv">Analyse CSV</Link> :
                ce tableau de bord se met à jour automatiquement.
              </div>
            )}

            <div style={chartGrid}>
              <section className="panel">
                <div className="panel-header">
                  <div>
                    <h2>Activité des transactions</h2>
                    <p>
                      Transactions analysées et alertes sur la période
                      {period === '90j' ? ' (par semaine)' : ' (par jour)'}
                    </p>
                  </div>
                  <Activity size={21} color="#2dd4bf" />
                </div>

                <div style={{
                  display: 'flex', gap: 8, margin: '23px 0', flexWrap: 'wrap',
                }}>
                  {(['7j', '30j', '90j'] as Period[]).map((item) => (
                    <button
                      key={item}
                      type="button"
                      aria-pressed={period === item}
                      className={`bank-button ${
                        period === item ? 'primary' : 'secondary'
                      }`}
                      onClick={() => setPeriod(item)}
                    >
                      {item}
                    </button>
                  ))}
                </div>

                <div style={{ width: '100%', height: 280, minWidth: 0 }}>
                  <ResponsiveContainer width="100%" height="100%">
                    <AreaChart
                      data={data.series}
                      margin={{ top: 10, right: 10, bottom: 0, left: -15 }}
                    >
                      <defs>
                        <linearGradient id="activityFill" x1="0" y1="0" x2="0" y2="1">
                          <stop offset="0%" stopColor="#2dd4bf" stopOpacity={0.35} />
                          <stop offset="100%" stopColor="#2dd4bf" stopOpacity={0} />
                        </linearGradient>
                      </defs>
                      <CartesianGrid stroke="#273c53" vertical={false} strokeDasharray="3 4" />
                      <XAxis dataKey="label" stroke="#8fa5bb" tick={{ fontSize: 12 }} />
                      <YAxis stroke="#8fa5bb" tick={{ fontSize: 11 }} allowDecimals={false} />
                      <Tooltip
                        contentStyle={tooltipStyle}
                        formatter={(value, name) => [
                          fmtInt(Number(value)),
                          name === 'total' ? 'Transactions' : 'Alertes de fraude',
                        ]}
                      />
                      <Area
                        type="monotone"
                        dataKey="total"
                        stroke="#2dd4bf"
                        strokeWidth={3}
                        fill="url(#activityFill)"
                        activeDot={{ r: 6 }}
                      />
                      <Area
                        type="monotone"
                        dataKey="alerts"
                        stroke="#fb7185"
                        strokeWidth={2}
                        fill="none"
                      />
                    </AreaChart>
                  </ResponsiveContainer>
                </div>

                <div className="info-note">
                  <span style={{ color: '#2dd4bf' }}>● Transactions</span>
                  {'  '}
                  <span style={{ color: '#fb7185' }}>● Alertes de fraude</span>
                </div>
              </section>

              <section className="panel">
                <div className="panel-header">
                  <div>
                    <h2>Répartition des transactions</h2>
                    <p>Analyses de la période sélectionnée</p>
                  </div>
                  <Database size={21} color="#2dd4bf" />
                </div>

                {totals.analyzed === 0 ? (
                  <p style={{ color: '#93a9c1', marginTop: 28 }}>
                    Aucune analyse sur cette période.
                  </p>
                ) : (
                  <>
                    <div style={{ height: 270, width: '100%', marginTop: 24 }}>
                      <ResponsiveContainer width="100%" height="100%">
                        <PieChart>
                          <Pie
                            data={distribution}
                            dataKey="value"
                            nameKey="name"
                            cx="50%"
                            cy="50%"
                            innerRadius="57%"
                            outerRadius="79%"
                            paddingAngle={0}
                            stroke="none"
                          >
                            {distribution.map((item) => (
                              <Cell key={item.name} fill={item.color} stroke="none" />
                            ))}
                          </Pie>
                          <Tooltip
                            formatter={(value) => fmtInt(Number(value))}
                            contentStyle={tooltipStyle}
                          />
                        </PieChart>
                      </ResponsiveContainer>
                    </div>

                    <div style={{ display: 'grid', gap: 13, marginTop: 12 }}>
                      {distribution.map((item) => (
                        <div
                          key={item.name}
                          style={{
                            display: 'flex',
                            justifyContent: 'space-between',
                            gap: 12,
                            fontSize: 12,
                          }}
                        >
                          <span style={{ color: item.color }}>● {item.name}</span>
                          <strong>{fmtInt(item.value)}</strong>
                        </div>
                      ))}
                    </div>
                  </>
                )}

                {data.by_model.length > 0 && (
                  <div className="info-note">
                    Par modèle :{' '}
                    {data.by_model
                      .map((m) => `${m.model} (${fmtInt(m.total)})`)
                      .join(' · ')}
                  </div>
                )}
              </section>
            </div>

            <div style={chartGrid}>
              <section className="panel">
                <div className="panel-header">
                  <div>
                    <h2>Dernières alertes</h2>
                    <p>Transactions signalées comme frauduleuses</p>
                  </div>
                  <Bell size={21} color="#fb7185" />
                </div>

                {data.alerts.length === 0 ? (
                  <p style={{ color: '#93a9c1', marginTop: 24 }}>
                    Aucune alerte de fraude enregistrée.
                  </p>
                ) : (
                  <div className="table-wrapper" style={{ marginTop: 22 }}>
                    <table>
                      <thead>
                        <tr>
                          <th>TRANSACTION</th>
                          <th>DATE</th>
                          <th>MONTANT</th>
                          <th>SCORE</th>
                          <th>RISQUE</th>
                        </tr>
                      </thead>
                      <tbody>
                        {data.alerts.map((alert) => (
                          <tr key={alert.id}>
                            <td className="transaction-id">{alert.id}</td>
                            <td>{formatDate(alert.at)}</td>
                            <td>{fmt(alert.amount, 2)}</td>
                            <td>{fmt(alert.score, 1)} %</td>
                            <td>
                              <span className={`risk-badge ${
                                alert.risk === 'Élevé' ? 'high' : 'medium'
                              }`}>
                                {alert.risk}
                              </span>
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                )}
              </section>

              <section className="panel">
                <div className="panel-header">
                  <div>
                    <h2>État de la plateforme</h2>
                    <p>Lu en direct depuis l'API</p>
                  </div>
                  <Server size={21} color="#60a5fa" />
                </div>

                <div className="system-row">
                  <span>Backend FastAPI</span>
                  <strong className="text-green">Connecté</strong>
                </div>
                <div className="system-row">
                  <span>Modèle par défaut</span>
                  <strong>{data.platform.default_model}</strong>
                </div>
                <div className="system-row">
                  <span>Modèle final chargé</span>
                  <strong className={data.platform.models_ready ? 'text-green' : 'text-amber'}>
                    {data.platform.models_ready ? 'Oui' : 'Non'}
                  </strong>
                </div>
                <div className="system-row">
                  <span>Seuil de décision</span>
                  <strong>{fmt(data.platform.threshold, 2)}</strong>
                </div>
                {data.platform.models.map((model) => (
                  <div className="system-row" key={model.name}>
                    <span>{model.name}</span>
                    <strong className={model.loaded ? 'text-green' : 'text-amber'}>
                      {model.loaded ? 'Chargé' : 'Absent'}
                    </strong>
                  </div>
                ))}

                {!data.platform.models_ready && (
                  <div className="info-note">
                    Déposez les fichiers .joblib du modèle dans le dossier
                    models/ puis redémarrez l'API.
                  </div>
                )}
              </section>
            </div>
          </>
        )}
      </DataState>

      {dataset.data?.available && (
        <section className="panel" style={{ marginBottom: 24 }}>
          <div className="panel-header">
            <div>
              <h2>Jeu de données du mémoire</h2>
              <p>
                Audit du Notebook 01 — transactions bancaires utilisées
                pour entraîner et évaluer les modèles.
              </p>
            </div>
            <span className="panel-tag">RÉFÉRENCE</span>
          </div>
          <div className="stats-grid" style={{ marginTop: 22 }}>
            <article className="stat-card">
              <div className="stat-top">Transactions</div>
              <div className="stat-value">{fmtInt(dataset.data.transactions)}</div>
            </article>
            <article className="stat-card">
              <div className="stat-top">Fraudes réelles</div>
              <div className="stat-value" style={{ color: '#fb7185' }}>
                {fmtInt(dataset.data.fraud)}
              </div>
            </article>
            <article className="stat-card">
              <div className="stat-top">Taux de fraude</div>
              <div className="stat-value">{fmt(dataset.data.fraud_rate, 3)} %</div>
            </article>
            <article className="stat-card">
              <div className="stat-top">Doublons exacts</div>
              <div className="stat-value">{fmtInt(dataset.data.duplicates)}</div>
            </article>
          </div>
        </section>
      )}
    </main>
  )
}
