
import { useState } from 'react'
import {
  AreaChart, Area, XAxis, YAxis, CartesianGrid,
  Tooltip, ResponsiveContainer, PieChart, Pie, Cell,
} from 'recharts'
import {
  Activity, ShieldAlert, ShieldCheck, CreditCard,
  TrendingUp, Bell, Database, Server, Clock3,
} from 'lucide-react'

type Period = '7j' | '30j' | '90j'

const summary = {
  total: 284807,
  fraud: 492,
  normal: 284315,
}

const activityData: Record<Period, {
  label: string
  total: number
  alerts: number
}[]> = {
  '7j': [
    { label: 'Lun', total: 2800, alerts: 5 },
    { label: 'Mar', total: 3500, alerts: 8 },
    { label: 'Mer', total: 3100, alerts: 6 },
    { label: 'Jeu', total: 4700, alerts: 12 },
    { label: 'Ven', total: 4200, alerts: 9 },
    { label: 'Sam', total: 5600, alerts: 16 },
    { label: 'Dim', total: 4900, alerts: 11 },
  ],
  '30j': [
    { label: 'S1', total: 18500, alerts: 31 },
    { label: 'S2', total: 22100, alerts: 42 },
    { label: 'S3', total: 20800, alerts: 38 },
    { label: 'S4', total: 26300, alerts: 56 },
  ],
  '90j': [
    { label: 'M1', total: 61000, alerts: 104 },
    { label: 'M2', total: 70300, alerts: 123 },
    { label: 'M3', total: 76500, alerts: 147 },
  ],
}

// Jeux de démonstration indépendants des métriques globales.
const alerts = [
  { id: 'TX-90241', amount: '2 450,00', score: 96, risk: 'Élevé' },
  { id: 'TX-90242', amount: '890,50', score: 88, risk: 'Élevé' },
  { id: 'TX-90243', amount: '320,00', score: 67, risk: 'Moyen' },
  { id: 'TX-90244', amount: '1 180,00', score: 92, risk: 'Élevé' },
]

const formatNumber = (value: number) =>
  value.toLocaleString('fr-FR')

const tooltipStyle = {
  backgroundColor: '#101d30',
  border: '1px solid #30445c',
  borderRadius: 10,
  color: '#edf4fc',
}

const smallCard = {
  background: '#142137',
  border: '1px solid #263750',
  borderRadius: 12,
  padding: 20,
  minWidth: 0,
}

const gridStyle = {
  display: 'grid',
  gridTemplateColumns: 'repeat(auto-fit, minmax(210px, 1fr))',
  gap: 18,
}

const chartGrid = {
  display: 'grid',
  gridTemplateColumns: 'repeat(auto-fit, minmax(min(100%, 340px), 1fr))',
  gap: 20,
  marginBottom: 24,
}

export default function Dashboard() {
  const [period, setPeriod] = useState<Period>('7j')
  const [showAlerts, setShowAlerts] = useState(true)

  const fraudRate = (summary.fraud / summary.total) * 100

  const distribution = [
    { name: 'Normales', value: summary.normal, color: '#2dd4bf' },
    { name: 'Fraudes suspectées', value: summary.fraud, color: '#fb7185' },
  ]

  const metrics = [
    {
      label: 'Transactions analysées',
      value: formatNumber(summary.total),
      detail: 'Total fictif du Dashboard',
      icon: CreditCard,
      color: '#2dd4bf',
    },
    {
      label: 'Fraudes suspectées',
      value: formatNumber(summary.fraud),
      detail: 'Transactions signalées',
      icon: ShieldAlert,
      color: '#fb7185',
    },
    {
      label: 'Taux de fraude signalée',
      value: `${fraudRate.toFixed(3).replace('.', ',')} %`,
      detail: 'Part des transactions signalées',
      icon: TrendingUp,
      color: '#fbbf24',
    },
    {
      label: 'Transactions normales',
      value: formatNumber(summary.normal),
      detail: 'Transactions non signalées',
      icon: ShieldCheck,
      color: '#34d399',
    },
  ]

  return (
    <main className="dashboard">
      <div className="page-heading">
        <div>
          <div className="eyebrow">
            FRAUD INTELLIGENCE / MONITORING CENTER
          </div>
          <h1>Centre de surveillance</h1>
          <p>
            Vue globale des transactions et du risque antifraude.
          </p>
        </div>
        <span className="dataset-label">
          DONNÉES FICTIVES
        </span>
      </div>

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

              <div className="stat-value">
                {metric.value}
              </div>
              <p>{metric.detail}</p>
            </article>
          )
        })}
      </section>

      <div style={chartGrid}>
        <section className="panel">
          <div className="panel-header">
            <div>
              <h2>Activité des transactions</h2>
              <p>Évolution fictive sur la période sélectionnée</p>
            </div>
            <Activity size={21} color="#2dd4bf" />
          </div>

          <div
            style={{
              display: 'flex',
              gap: 8,
              margin: '23px 0',
              flexWrap: 'wrap',
            }}
          >
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
                data={activityData[period]}
                margin={{ top: 10, right: 10, bottom: 0, left: -15 }}
              >
                <defs>
                  <linearGradient id="fraudActivityFill" x1="0" y1="0" x2="0" y2="1">
                    <stop
                      offset="0%"
                      stopColor="#2dd4bf"
                      stopOpacity={0.35}
                    />
                    <stop
                      offset="100%"
                      stopColor="#2dd4bf"
                      stopOpacity={0}
                    />
                  </linearGradient>
                </defs>

                <CartesianGrid
                  stroke="#273c53"
                  vertical={false}
                  strokeDasharray="3 4"
                />
                <XAxis
                  dataKey="label"
                  stroke="#8fa5bb"
                  tick={{ fontSize: 12 }}
                />
                <YAxis
                  stroke="#8fa5bb"
                  tick={{ fontSize: 11 }}
                />
                <Tooltip
                  contentStyle={tooltipStyle}
                  formatter={(value) => [
                    formatNumber(Number(value)),
                    'Transactions (démo)',
                  ]}
                />
                <Area
                  type="monotone"
                  dataKey="total"
                  stroke="#2dd4bf"
                  strokeWidth={3}
                  fill="url(#fraudActivityFill)"
                  activeDot={{ r: 6 }}
                />
              </AreaChart>
            </ResponsiveContainer>
          </div>

          <div className="info-note">
            Les données de ce graphique sont des séries de démonstration,
            indépendantes du total affiché dans les cartes.
          </div>
        </section>

        <section className="panel">
          <div className="panel-header">
            <div>
              <h2>Répartition des transactions</h2>
              <p>Distribution globale simulée</p>
            </div>
            <Database size={21} color="#2dd4bf" />
          </div>

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
                    <Cell
                      key={item.name}
                      fill={item.color}
                      stroke="none"
                    />
                  ))}
                </Pie>
                <Tooltip
                  formatter={(value) => formatNumber(Number(value))}
                  contentStyle={tooltipStyle}
                />
              </PieChart>
            </ResponsiveContainer>
          </div>

          <div style={{
            display: 'grid',
            gap: 13,
            marginTop: 12,
          }}>
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
                <span style={{ color: item.color }}>
                  ● {item.name}
                </span>
                <strong>{formatNumber(item.value)}</strong>
              </div>
            ))}
          </div>

          <div className="info-note">
            La forte proportion de transactions normales
            illustre le déséquilibre des classes.
          </div>
        </section>
      </div>

      <div style={chartGrid}>
        <section className="panel">
          <div className="panel-header">
            <div>
              <h2>Dernières alertes</h2>
              <p>Transactions suspectes de démonstration</p>
            </div>
            <Bell size={21} color="#fb7185" />
          </div>

          <div style={{ marginTop: 22, marginBottom: 20 }}>
            <button
              type="button"
              className="bank-button secondary"
              aria-expanded={showAlerts}
              onClick={() => setShowAlerts((previous) => !previous)}
            >
              {showAlerts ? 'Masquer les alertes' : 'Afficher les alertes'}
            </button>
          </div>

          {showAlerts ? (
            <div className="table-wrapper">
              <table>
                <thead>
                  <tr>
                    <th>TRANSACTION</th>
                    <th>MONTANT DÉMO</th>
                    <th>SCORE</th>
                    <th>RISQUE</th>
                  </tr>
                </thead>
                <tbody>
                  {alerts.map((alert) => (
                    <tr key={alert.id}>
                      <td className="transaction-id">
                        {alert.id}
                      </td>
                      <td>{alert.amount}</td>
                      <td>{alert.score} %</td>
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
          ) : (
            <p style={{ color: '#93a9c1', fontSize: 13 }}>
              Le tableau des alertes est masqué.
            </p>
          )}
        </section>

        <section className="panel">
          <div className="panel-header">
            <div>
              <h2>État de la plateforme</h2>
              <p>Configuration de l'environnement</p>
            </div>
            <Server size={21} color="#60a5fa" />
          </div>

          <div className="system-row">
            <span>Interface React</span>
            <strong className="text-green">
              Opérationnelle
            </strong>
          </div>
          <div className="system-row">
            <span>Mode de données</span>
            <strong>Simulation</strong>
          </div>
          <div className="system-row">
            <span>Backend FastAPI</span>
            <strong className="text-amber">
              Non connecté
            </strong>
          </div>
          <div className="system-row">
            <span>Modèle ML final</span>
            <strong className="text-amber">
              En attente
            </strong>
          </div>
          <div className="system-row">
            <span>Prédictions réelles</span>
            <strong className="text-amber">
              Indisponibles
            </strong>
          </div>

          <div className="info-note">
            <Clock3 size={15} style={{ verticalAlign: 'middle', marginRight: 8 }} />
            Intégration FastAPI prévue après la sélection
            et la validation du modèle final.
          </div>
        </section>
      </div>

      <div style={{
        ...smallCard,
        display: 'flex',
        alignItems: 'center',
        gap: 15,
        marginBottom: 24,
      }}>
        <ShieldCheck size={28} color="#2dd4bf" />
        <div>
          <strong>FraudShield AI · Environnement de démonstration</strong>
          <p style={{
            color: '#91a5bc',
            fontSize: 12,
            lineHeight: 1.7,
            marginBottom: 0,
          }}>
            Les alertes, scores et graphiques affichés ne sont pas
            des prédictions bancaires réelles. Cette plateforme
            sera connectée au modèle Python par FastAPI.
          </p>
        </div>
      </div>
    </main>
  )
}
