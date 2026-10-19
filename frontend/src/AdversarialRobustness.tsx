
import { useState } from 'react'
import {
  BarChart,
  Bar,
  Cell,
  CartesianGrid,
  XAxis,
  YAxis,
  Tooltip,
  Legend,
  ResponsiveContainer,
} from 'recharts'

type Attack = 'ZOO' | 'HSJ'

type RobustnessRow = {
  model: string
  color: string
  initialTP: number
  successful: number
  l2: number
  linf: number
}

const INITIAL_FRAUDS = 100
const ATTACKED_PER_MODEL = 40

// Données entièrement fictives.
// Ces résultats ne proviennent pas des notebooks.
const mockData: Record<Attack, RobustnessRow[]> = {
  ZOO: [
    { model: 'XGBoost', color: '#2dd4bf', initialTP: 90, successful: 22, l2: 1.20, linf: 0.28 },
    { model: 'Random Forest', color: '#60a5fa', initialTP: 88, successful: 18, l2: 1.45, linf: 0.34 },
    { model: 'LightGBM', color: '#a78bfa', initialTP: 86, successful: 26, l2: 1.08, linf: 0.25 },
    { model: 'SVM linéaire', color: '#fbbf24', initialTP: 84, successful: 30, l2: 0.92, linf: 0.22 },
    { model: 'Régression logistique', color: '#fb7185', initialTP: 82, successful: 28, l2: 1.05, linf: 0.26 },
  ],
  HSJ: [
    { model: 'XGBoost', color: '#2dd4bf', initialTP: 90, successful: 28, l2: 0.98, linf: 0.23 },
    { model: 'Random Forest', color: '#60a5fa', initialTP: 88, successful: 24, l2: 1.18, linf: 0.29 },
    { model: 'LightGBM', color: '#a78bfa', initialTP: 86, successful: 31, l2: 0.86, linf: 0.21 },
    { model: 'SVM linéaire', color: '#fbbf24', initialTP: 84, successful: 34, l2: 0.76, linf: 0.19 },
    { model: 'Régression logistique', color: '#fb7185', initialTP: 82, successful: 32, l2: 0.83, linf: 0.20 },
  ],
}

const panelGap = { marginBottom: 24 }

function formatPercent(value: number) {
  return `${value.toFixed(1)} %`
}

export default function AdversarialRobustness() {
  const [attack, setAttack] = useState<Attack>('ZOO')
  const [selectedModel, setSelectedModel] = useState('XGBoost')

  const rows = mockData[attack]

  const data = rows.map((row) => ({
    ...row,
    asr: (row.successful / ATTACKED_PER_MODEL) * 100,
    recallBefore: (row.initialTP / INITIAL_FRAUDS) * 100,
    recallAfter:
      ((row.initialTP - row.successful) / INITIAL_FRAUDS) * 100,
    fnBefore: INITIAL_FRAUDS - row.initialTP,
    fnAfter: INITIAL_FRAUDS - row.initialTP + row.successful,
  }))

  const selected = data.find((row) => row.model === selectedModel)!
  const averageAsr =
    data.reduce((sum, row) => sum + row.asr, 0) / data.length
  const totalSuccesses = data.reduce(
    (sum, row) => sum + row.successful, 0
  )

  const card = {
    background: '#142137',
    border: '1px solid #263750',
    borderRadius: 12,
    padding: 22,
  }

  return (
    <main className="dashboard">
      <div className="page-heading">
        <div>
          <div className="eyebrow">
            ADVERSARIAL SECURITY / ROBUSTNESS
          </div>
          <h1>Robustesse adversariale</h1>
          <p>
            Analyse de la vulnérabilité des cinq modèles
            face aux attaques ZOO et HopSkipJump.
          </p>
        </div>
        <span className="dataset-label">DONNÉES FICTIVES</span>
      </div>

      <div className="info-note" style={panelGap}>
        <strong>Simulation scientifique :</strong> les valeurs de cette
        page sont inventées pour illustrer les graphiques.
        Chaque exemple considère 100 fraudes, dont 40 fraudes
        initialement détectées soumises à une attaque.
        Elles ne représentent pas les résultats du Notebook 10 ou 11.
      </div>

      <section className="panel" style={panelGap}>
        <div className="panel-header">
          <div>
            <h2>Configuration de l'attaque</h2>
            <p>Sélectionne l'algorithme adversarial à étudier.</p>
          </div>
          <span className="panel-tag">RESEARCH MODE</span>
        </div>

        <div style={{
          display: 'flex',
          gap: 12,
          marginTop: 25,
          flexWrap: 'wrap',
        }}>
          {(['ZOO', 'HSJ'] as Attack[]).map((item) => (
            <button
              key={item}
              type="button"
              className={`bank-button ${
                attack === item ? 'primary' : 'secondary'
              }`}
              onClick={() => setAttack(item)}
              aria-pressed={attack === item}
            >
              {item === 'ZOO'
                ? 'ZOO — Zeroth Order Optimization'
                : 'HSJ — HopSkipJump'}
            </button>
          ))}
        </div>
      </section>

      <section className="stats-grid">
        <article className="stat-card">
          <div className="stat-top">Attaque sélectionnée</div>
          <div className="stat-value" style={{ color: '#2dd4bf' }}>
            {attack}
          </div>
          <p>Attaque adversariale simulée</p>
        </article>

        <article className="stat-card">
          <div className="stat-top">ASR moyen simulé</div>
          <div className="stat-value" style={{ color: '#fb7185' }}>
            {formatPercent(averageAsr)}
          </div>
          <p>Moyenne des cinq modèles</p>
        </article>

        <article className="stat-card">
          <div className="stat-top">Attaques réussies</div>
          <div className="stat-value">{totalSuccesses}</div>
          <p>Sur 200 tentatives simulées</p>
        </article>

        <article className="stat-card">
          <div className="stat-top">Modèles évalués</div>
          <div className="stat-value">5</div>
          <p>XGBoost, RF, LightGBM, SVM, LR</p>
        </article>
      </section>

      <section className="panel" style={panelGap}>
        <div className="panel-header">
          <div>
            <h2>Attack Success Rate — {attack}</h2>
            <p>
              Pourcentage des fraudes attaquées devenues
              non détectées.
            </p>
          </div>
          <span className="panel-tag">ASR (%)</span>
        </div>

        <div style={{ width: '100%', height: 340, marginTop: 24 }}>
          <ResponsiveContainer width="100%" height="100%">
            <BarChart
              data={data}
              margin={{ top: 10, right: 12, left: -12, bottom: 36 }}
            >
              <CartesianGrid vertical={false} stroke="#293b52" />
              <XAxis
                dataKey="model"
                stroke="#91a5bc"
                tick={{ fontSize: 10 }}
                angle={-15}
                interval={0}
                textAnchor="end"
                height={65}
              />
              <YAxis
                domain={[0, 100]}
                stroke="#91a5bc"
                tickFormatter={(v: number) => `${v}%`}
              />
              <Tooltip
                formatter={(value) => [
                  formatPercent(Number(value)),
                  'ASR simulé',
                ]}
                contentStyle={{
                  background: '#111c30',
                  border: '1px solid #35506a',
                  borderRadius: 9,
                }}
              />
              <Bar dataKey="asr" radius={[6, 6, 0, 0]}>
                {data.map((item) => (
                  <Cell key={item.model} fill={item.color} />
                ))}
              </Bar>
            </BarChart>
          </ResponsiveContainer>
        </div>

        <div className="info-note">
          Plus l'ASR est élevé, plus l'attaque réussit souvent
          sur les exemples éligibles dans ce scénario.
          ASR = attaques réussies / attaques tentées × 100.
        </div>
      </section>

      <section className="panel" style={panelGap}>
        <div className="panel-header">
          <div>
            <h2>Recall avant et après attaque</h2>
            <p>
              Impact fictif de {attack} sur la détection des fraudes.
            </p>
          </div>
          <span className="panel-tag">BEFORE / AFTER</span>
        </div>

        <div style={{ width: '100%', height: 360, marginTop: 24 }}>
          <ResponsiveContainer width="100%" height="100%">
            <BarChart
              data={data}
              margin={{ top: 10, right: 12, left: -12, bottom: 35 }}
            >
              <CartesianGrid vertical={false} stroke="#293b52" />
              <XAxis
                dataKey="model"
                stroke="#91a5bc"
                tick={{ fontSize: 10 }}
                angle={-15}
                interval={0}
                textAnchor="end"
                height={65}
              />
              <YAxis
                domain={[0, 100]}
                stroke="#91a5bc"
                tickFormatter={(v: number) => `${v}%`}
              />
              <Tooltip
                formatter={(value) => formatPercent(Number(value))}
                contentStyle={{
                  background: '#111c30',
                  border: '1px solid #35506a',
                  borderRadius: 9,
                }}
              />
              <Legend
                formatter={(value) =>
                  value === 'recallBefore'
                    ? 'Avant attaque'
                    : 'Après attaque'
                }
              />
              <Bar
                dataKey="recallBefore"
                name="recallBefore"
                fill="#2dd4bf"
                radius={[4, 4, 0, 0]}
              />
              <Bar
                dataKey="recallAfter"
                name="recallAfter"
                fill="#fb7185"
                radius={[4, 4, 0, 0]}
              />
            </BarChart>
          </ResponsiveContainer>
        </div>

        <div className="info-note">
          Les deux valeurs utilisent ici le même ensemble fictif
          de 100 fraudes par modèle. Les attaques réussies
          augmentent les faux négatifs et réduisent le Recall.
        </div>
      </section>

      <section className="panel" style={panelGap}>
        <div className="panel-header">
          <div>
            <h2>Résultats expérimentaux simulés</h2>
            <p>
              Comparaison des faux négatifs et des perturbations.
            </p>
          </div>
          <span className="panel-tag">{attack}</span>
        </div>

        <div className="table-wrapper">
          <table>
            <thead>
              <tr>
                <th>MODÈLE</th>
                <th>ASR</th>
                <th>FN AVANT</th>
                <th>FN APRÈS</th>
                <th>L2</th>
                <th>L∞</th>
              </tr>
            </thead>
            <tbody>
              {data.map((item) => (
                <tr key={item.model}>
                  <td style={{
                    color: item.color,
                    fontWeight: 700,
                    whiteSpace: 'nowrap',
                  }}>
                    {item.model}
                  </td>
                  <td>{formatPercent(item.asr)}</td>
                  <td>{item.fnBefore}</td>
                  <td style={{ color: '#fb7185' }}>
                    {item.fnAfter}
                  </td>
                  <td>{item.l2.toFixed(2)}</td>
                  <td>{item.linf.toFixed(2)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>

        <div className="info-note">
          FN = faux négatifs. L2 et L∞ indiquent ici des normes
          fictives de perturbations dans l'espace numérique
          des caractéristiques. Elles ne sont pas
          directement comparables sans un prétraitement
          et un protocole identiques.
        </div>
      </section>

      <section className="panel" style={panelGap}>
        <div className="panel-header">
          <div>
            <h2>Explorateur de vulnérabilité</h2>
            <p>
              Examiner individuellement un modèle face à {attack}.
            </p>
          </div>
        </div>

        <label
          htmlFor="robustness-model"
          style={{
            display: 'block',
            margin: '24px 0 10px',
            fontSize: 13,
            color: '#9eafc3',
          }}
        >
          Modèle à examiner
        </label>

        <select
          id="robustness-model"
          value={selectedModel}
          onChange={(event) => setSelectedModel(event.target.value)}
          className="bank-input"
          style={{ maxWidth: 360 }}
        >
          {data.map((item) => (
            <option key={item.model} value={item.model}>
              {item.model}
            </option>
          ))}
        </select>

        <h2 style={{
          margin: '28px 0 18px',
          color: selected.color,
        }}>
          {selected.model} — {attack}
        </h2>

        <div style={{
          display: 'grid',
          gridTemplateColumns:
            'repeat(auto-fit, minmax(155px, 1fr))',
          gap: 14,
        }}>
          {[
            ['ASR', formatPercent(selected.asr)],
            ['Recall initial', formatPercent(selected.recallBefore)],
            ['Recall attaqué', formatPercent(selected.recallAfter)],
            ['Faux négatifs après', String(selected.fnAfter)],
            ['Perturbation L2', selected.l2.toFixed(2)],
            ['Perturbation L∞', selected.linf.toFixed(2)],
          ].map(([label, value]) => (
            <div key={label} style={card}>
              <div style={{
                color: '#91a5bc',
                fontSize: 12,
              }}>
                {label}
              </div>
              <div style={{
                color: selected.color,
                fontSize: 25,
                fontWeight: 750,
                marginTop: 12,
              }}>
                {value}
              </div>
            </div>
          ))}
        </div>

        <div className="info-note" style={{ marginTop: 24 }}>
          Dans cet exemple fictif, {selected.successful} attaques
          sur {ATTACKED_PER_MODEL} sont réussies contre
          {selected.model}. Ces résultats seront remplacés
          par les mesures réelles des notebooks.
        </div>
      </section>

      <section className="panel">
        <h2>Interprétation scientifique</h2>
        <p style={{
          color: '#a3b7ca',
          lineHeight: 1.9,
          fontSize: 13,
        }}>
          Une attaque adversariale cherche à modifier certaines
          caractéristiques d'une transaction de manière à provoquer
          une erreur de classification. Une fraude précédemment
          détectée peut alors être classée comme normale.
        </p>

        <div className="info-note">
          <strong>Prochaine étape :</strong> comparer la robustesse
          des modèles avant et après Adversarial Training.
          Les résultats effectifs seront importés ultérieurement.
        </div>
      </section>
    </main>
  )
}
