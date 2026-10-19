
import { useState } from 'react'
import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  Cell,
} from 'recharts'

type Metric = 'accuracy' | 'precision' | 'recall' | 'f1' | 'rocAuc' | 'prAuc'

type Model = {
  name: string
  accuracy: number
  precision: number
  recall: number
  f1: number
  rocAuc: number
  prAuc: number
  color: string
}

const models: Model[] = [
  {
    name: 'XGBoost',
    accuracy: 99.94,
    precision: 91.2,
    recall: 85.4,
    f1: 88.2,
    rocAuc: 98.3,
    prAuc: 90.1,
    color: '#2dd4bf',
  },
  {
    name: 'Random Forest',
    accuracy: 99.93,
    precision: 93.1,
    recall: 81.6,
    f1: 87.0,
    rocAuc: 97.9,
    prAuc: 88.5,
    color: '#60a5fa',
  },
  {
    name: 'LightGBM',
    accuracy: 99.92,
    precision: 89.5,
    recall: 86.7,
    f1: 88.1,
    rocAuc: 98.1,
    prAuc: 89.4,
    color: '#a78bfa',
  },
  {
    name: 'SVM linéaire',
    accuracy: 99.87,
    precision: 85.3,
    recall: 78.2,
    f1: 81.6,
    rocAuc: 95.6,
    prAuc: 82.4,
    color: '#fbbf24',
  },
  {
    name: 'Régression logistique',
    accuracy: 99.85,
    precision: 82.8,
    recall: 83.1,
    f1: 82.9,
    rocAuc: 96.4,
    prAuc: 84.2,
    color: '#fb7185',
  },
]

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

export default function ModelComparison() {
  const [metric, setMetric] = useState<Metric>('recall')
  const [selectedName, setSelectedName] = useState('XGBoost')

  const selected = models.find((model) => model.name === selectedName)!

  const highest = Math.max(...models.map((model) => model[metric]))
  const lowest = Math.min(...models.map((model) => model[metric]))

  return (
    <main className="dashboard">
      <div className="page-heading">
        <div>
          <div className="eyebrow">
            MACHINE LEARNING / MODEL BENCHMARK
          </div>
          <h1>Comparaison des modèles</h1>
          <p>
            Évaluation comparative des cinq modèles de détection de fraude bancaire.
          </p>
        </div>
        <span className="dataset-label">DONNÉES FICTIVES</span>
      </div>

      <div className="info-note" style={{ marginBottom: 24 }}>
        <strong>Mode démonstration :</strong> toutes les métriques affichées
        sont des valeurs illustratives. Elles ne proviennent pas de tes notebooks.
        Aucun modèle final n'a encore été sélectionné.
      </div>

      <section className="stats-grid">
        <article className="stat-card">
          <div className="stat-top">Modèles comparés</div>
          <div className="stat-value">5</div>
          <p>Algorithmes de classification</p>
        </article>

        <article className="stat-card">
          <div className="stat-top">Métriques évaluées</div>
          <div className="stat-value">6</div>
          <p>Performance et discrimination</p>
        </article>

        <article className="stat-card">
          <div className="stat-top">Meilleure valeur démo</div>
          <div className="stat-value" style={{ color: '#2dd4bf' }}>
            {highest.toFixed(1)} %
          </div>
          <p>Pour la métrique sélectionnée</p>
        </article>

        <article className="stat-card">
          <div className="stat-top">Écart entre modèles</div>
          <div className="stat-value">
            {(highest - lowest).toFixed(1)}
          </div>
          <p>Points de pourcentage — simulation</p>
        </article>
      </section>

      <section className="panel" style={{ marginBottom: 24 }}>
        <div className="panel-header">
          <div>
            <h2>Comparaison interactive des performances</h2>
            <p>Sélectionne une métrique pour comparer les modèles.</p>
          </div>
          <span className="panel-tag">BENCHMARK DÉMO</span>
        </div>

        <div style={{ marginTop: 25, marginBottom: 18 }}>
          <label
            htmlFor="metric-selector"
            style={{
              display: 'block',
              marginBottom: 10,
              color: '#9eafc3',
              fontSize: 13,
            }}
          >
            Métrique à visualiser
          </label>

          <select
            id="metric-selector"
            value={metric}
            onChange={(event) => setMetric(event.target.value as Metric)}
            style={{
              padding: '12px 16px',
              background: '#101c30',
              color: '#f1f5f9',
              border: '1px solid #35506a',
              borderRadius: 9,
              width: '100%',
              maxWidth: 320,
            }}
          >
            {(Object.keys(metricNames) as Metric[]).map((key) => (
              <option key={key} value={key}>
                {metricNames[key]}
              </option>
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
                  <Cell key={model.name} fill={model.color} />
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
          <span className="panel-tag">5 MODÈLES</span>
        </div>

        <div className="table-wrapper">
          <table>
            <thead>
              <tr>
                <th>MODÈLE</th>
                <th>ACCURACY</th>
                <th>PRECISION</th>
                <th>RECALL</th>
                <th>F1</th>
                <th>ROC-AUC</th>
                <th>PR-AUC</th>
              </tr>
            </thead>
            <tbody>
              {models.map((model) => (
                <tr key={model.name}>
                  <td
                    style={{
                      color: model.color,
                      fontWeight: 700,
                      whiteSpace: 'nowrap',
                    }}
                  >
                    {model.name}
                  </td>
                  <td>{model.accuracy.toFixed(2)}%</td>
                  <td>{model.precision.toFixed(2)}%</td>
                  <td>{model.recall.toFixed(2)}%</td>
                  <td>{model.f1.toFixed(2)}%</td>
                  <td>{model.rocAuc.toFixed(2)}%</td>
                  <td>{model.prAuc.toFixed(2)}%</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </section>

      <section className="panel">
        <div className="panel-header">
          <div>
            <h2>Explorateur de modèles</h2>
            <p>Consulte les indicateurs d'un modèle individuellement.</p>
          </div>
        </div>

        <div style={{ margin: '25px 0' }}>
          <label
            htmlFor="model-selector"
            style={{
              display: 'block',
              marginBottom: 10,
              color: '#9eafc3',
              fontSize: 13,
            }}
          >
            Sélectionner un modèle
          </label>
          <select
            id="model-selector"
            value={selectedName}
            onChange={(event) => setSelectedName(event.target.value)}
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
            {models.map((model) => (
              <option key={model.name} value={model.name}>
                {model.name}
              </option>
            ))}
          </select>
        </div>

        <h2 style={{ color: selected.color, marginBottom: 20 }}>
          {selected.name}
        </h2>

        <div
          style={{
            display: 'grid',
            gridTemplateColumns: 'repeat(auto-fit, minmax(145px, 1fr))',
            gap: 14,
          }}
        >
          {(Object.keys(metricNames) as Metric[]).map((key) => (
            <div key={key} style={cardStyle}>
              <div style={{ color: '#91a5bc', fontSize: 12 }}>
                {metricNames[key]}
              </div>
              <div
                style={{
                  fontSize: 25,
                  fontWeight: 750,
                  marginTop: 12,
                  color: selected.color,
                }}
              >
                {selected[key].toFixed(1)}%
              </div>
            </div>
          ))}
        </div>

        <div className="info-note" style={{ marginTop: 25 }}>
          Ces performances sont fictives. Le modèle sélectionné dans cet
          explorateur n'est pas le modèle final du mémoire.
          Le choix définitif dépendra des résultats expérimentaux,
          de la robustesse adversariale et du coût computationnel.
        </div>
      </section>
    </main>
  )
}
