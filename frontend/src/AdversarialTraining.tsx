
import { useState } from 'react'
import {
  BarChart, Bar, XAxis, YAxis, CartesianGrid,
  Tooltip, Legend, ResponsiveContainer,
} from 'recharts'

type Attack = 'ZOO' | 'HSJ'
type ModelData = {
  name: string
  cleanBefore: number
  cleanAfter: number
  attackedBefore: number
  attackedAfter: number
  zooBefore: number
  zooAfter: number
  hsjBefore: number
  hsjAfter: number
}

// Valeurs fictives pour démonstration uniquement.
// Aucune donnée de notebook ou prédiction ML réelle.
const models: ModelData[] = [
  {
    name: 'XGBoost',
    cleanBefore: 91, cleanAfter: 89,
    attackedBefore: 44, attackedAfter: 76,
    zooBefore: 65, zooAfter: 24,
    hsjBefore: 78, hsjAfter: 35,
  },
  {
    name: 'Random Forest',
    cleanBefore: 89, cleanAfter: 87,
    attackedBefore: 48, attackedAfter: 73,
    zooBefore: 55, zooAfter: 27,
    hsjBefore: 69, hsjAfter: 39,
  },
  {
    name: 'LightGBM',
    cleanBefore: 90, cleanAfter: 88,
    attackedBefore: 40, attackedAfter: 74,
    zooBefore: 68, zooAfter: 29,
    hsjBefore: 80, hsjAfter: 38,
  },
  {
    name: 'SVM linéaire',
    cleanBefore: 85, cleanAfter: 84,
    attackedBefore: 32, attackedAfter: 65,
    zooBefore: 75, zooAfter: 37,
    hsjBefore: 86, hsjAfter: 48,
  },
  {
    name: 'Régression logistique',
    cleanBefore: 84, cleanAfter: 82,
    attackedBefore: 35, attackedAfter: 66,
    zooBefore: 72, zooAfter: 34,
    hsjBefore: 82, hsjAfter: 44,
  },
]

const tooltipStyle = {
  backgroundColor: '#111c30',
  border: '1px solid #35506a',
  borderRadius: 10,
  color: '#f1f5f9',
}

const formatValue = (value: unknown) =>
  `${Number(value).toFixed(1)} %`

export default function AdversarialTraining() {
  const [modelName, setModelName] = useState('XGBoost')
  const [attack, setAttack] = useState<Attack>('ZOO')

  const selected = models.find((m) => m.name === modelName)!

  const asrBefore = attack === 'ZOO'
    ? selected.zooBefore : selected.hsjBefore
  const asrAfter = attack === 'ZOO'
    ? selected.zooAfter : selected.hsjAfter

  const asrReduction = asrBefore - asrAfter
  const attackedRecallGain =
    selected.attackedAfter - selected.attackedBefore
  const cleanRecallChange =
    selected.cleanAfter - selected.cleanBefore

  const asrData = [
    { stage: 'Avant défense', value: asrBefore },
    { stage: 'Après défense', value: asrAfter },
  ]

  const recallData = [
    {
      scenario: 'Transactions originales',
      before: selected.cleanBefore,
      after: selected.cleanAfter,
    },
    {
      scenario: 'Transactions adversariales',
      before: selected.attackedBefore,
      after: selected.attackedAfter,
    },
  ]

  const comparisonData = models.map((m) => ({
    name: m.name,
    before: attack === 'ZOO' ? m.zooBefore : m.hsjBefore,
    after: attack === 'ZOO' ? m.zooAfter : m.hsjAfter,
  }))

  return (
    <main className="dashboard">
      <div className="page-heading">
        <div>
          <div className="eyebrow">
            ADVERSARIAL SECURITY / DEFENSE EVALUATION
          </div>
          <h1>Adversarial Training</h1>
          <p>
            Évaluation de la résistance des modèles avant et après
            entraînement adversarial.
          </p>
        </div>
        <span className="dataset-label">DONNÉES FICTIVES</span>
      </div>

      <div className="info-note" style={{ marginBottom: 24 }}>
        <strong>Mode démonstration :</strong> toutes les valeurs
        sont illustratives. Les graphiques ne constituent pas
        une preuve de l'efficacité réelle de la défense.
        Les résultats définitifs proviendront des notebooks.
      </div>

      <section className="panel" style={{ marginBottom: 24 }}>
        <div className="panel-header">
          <div>
            <h2>Configuration de l'évaluation</h2>
            <p>
              Sélectionne le modèle et l'attaque à examiner.
            </p>
          </div>
          <span className="panel-tag">DEFENSE LAB</span>
        </div>

        <div style={{
          display: 'grid',
          gridTemplateColumns:
            'repeat(auto-fit, minmax(220px, 1fr))',
          gap: 20,
          marginTop: 24,
        }}>
          <div>
            <label className="field-label" htmlFor="defense-model">
              Modèle de classification
            </label>
            <select
              id="defense-model"
              className="bank-input"
              value={modelName}
              onChange={(e) => setModelName(e.target.value)}
            >
              {models.map((m) => (
                <option key={m.name} value={m.name}>
                  {m.name}
                </option>
              ))}
            </select>
          </div>

          <div>
            <label className="field-label" htmlFor="defense-attack">
              Attaque adversariale
            </label>
            <select
              id="defense-attack"
              className="bank-input"
              value={attack}
              onChange={(e) => setAttack(e.target.value as Attack)}
            >
              <option value="ZOO">ZOO</option>
              <option value="HSJ">HopSkipJump (HSJ)</option>
            </select>
          </div>
        </div>
      </section>

      <section className="stats-grid">
        <article className="stat-card">
          <div className="stat-top">ASR avant défense</div>
          <div className="stat-value" style={{ color: '#fb7185' }}>
            {formatValue(asrBefore)}
          </div>
          <p>{modelName} · {attack}</p>
        </article>

        <article className="stat-card">
          <div className="stat-top">ASR après défense</div>
          <div className="stat-value" style={{ color: '#34d399' }}>
            {formatValue(asrAfter)}
          </div>
          <p>Scénario fictif de défense</p>
        </article>

        <article className="stat-card">
          <div className="stat-top">Réduction de l'ASR</div>
          <div className="stat-value" style={{ color: '#2dd4bf' }}>
            {asrReduction.toFixed(1)}
          </div>
          <p>Points de pourcentage</p>
        </article>

        <article className="stat-card">
          <div className="stat-top">Gain de Recall adversarial</div>
          <div className="stat-value">
            +{attackedRecallGain.toFixed(1)}
          </div>
          <p>Points de pourcentage · scénario fictif</p>
        </article>
      </section>

      <section className="panel" style={{ marginBottom: 24 }}>
        <div className="panel-header">
          <div>
            <h2>Impact de la défense sur l'ASR</h2>
            <p>{modelName} — attaque {attack}</p>
          </div>
          <span className="panel-tag">BEFORE / AFTER</span>
        </div>

        <div style={{ width: '100%', height: 315, marginTop: 24 }}>
          <ResponsiveContainer width="100%" height="100%">
            <BarChart data={asrData}>
              <CartesianGrid stroke="#293b52" vertical={false} />
              <XAxis
                dataKey="stage"
                stroke="#91a5bc"
                tick={{ fontSize: 12 }}
              />
              <YAxis
                domain={[0, 100]}
                stroke="#91a5bc"
                tickFormatter={(v: number) => `${v}%`}
              />
              <Tooltip
                formatter={formatValue}
                contentStyle={tooltipStyle}
              />
              <Bar
                dataKey="value"
                name="ASR simulé"
                fill="#fb7185"
                radius={[7, 7, 0, 0]}
              />
            </BarChart>
          </ResponsiveContainer>
        </div>

        <div className="info-note">
          Une diminution de l'ASR signifie que l'attaque
          réussit moins souvent dans les conditions évaluées.
          Il faut toutefois vérifier les mêmes contraintes,
          les mêmes budgets d'attaque et des exemples comparables.
        </div>
      </section>

      <section className="panel" style={{ marginBottom: 24 }}>
        <div className="panel-header">
          <div>
            <h2>Recall avant / après défense</h2>
            <p>
              Comparaison sur transactions originales et adversariales.
            </p>
          </div>
          <span className="panel-tag">RECALL (%)</span>
        </div>

        <div style={{ width: '100%', height: 350, marginTop: 25 }}>
          <ResponsiveContainer width="100%" height="100%">
            <BarChart
              data={recallData}
              margin={{ left: 0, right: 10, bottom: 28 }}
            >
              <CartesianGrid stroke="#293b52" vertical={false} />
              <XAxis
                dataKey="scenario"
                stroke="#91a5bc"
                tick={{ fontSize: 11 }}
                height={65}
                interval={0}
              />
              <YAxis
                domain={[0, 100]}
                stroke="#91a5bc"
                tickFormatter={(v: number) => `${v}%`}
              />
              <Tooltip
                formatter={formatValue}
                contentStyle={tooltipStyle}
              />
              <Legend />
              <Bar
                dataKey="before"
                name="Avant défense"
                fill="#fb7185"
                radius={[5, 5, 0, 0]}
              />
              <Bar
                dataKey="after"
                name="Après défense"
                fill="#2dd4bf"
                radius={[5, 5, 0, 0]}
              />
            </BarChart>
          </ResponsiveContainer>
        </div>

        <div className="info-note">
          Dans ce scénario fictif, le Recall adversarial gagne
          {` ${attackedRecallGain.toFixed(1)} `}
          points, tandis que le Recall sur transactions
          originales varie de {` ${cleanRecallChange.toFixed(1)} `}
          points. Ces métriques devront être évaluées sur
          des ensembles clairement définis.
        </div>
      </section>

      <section className="panel" style={{ marginBottom: 24 }}>
        <div className="panel-header">
          <div>
            <h2>Comparaison des cinq modèles</h2>
            <p>
              ASR de {attack} avant et après défense simulée.
            </p>
          </div>
          <span className="panel-tag">5 MODÈLES</span>
        </div>

        <div style={{ width: '100%', height: 350, marginTop: 24 }}>
          <ResponsiveContainer width="100%" height="100%">
            <BarChart
              data={comparisonData}
              margin={{ left: -15, right: 5, bottom: 35 }}
            >
              <CartesianGrid stroke="#293b52" vertical={false} />
              <XAxis
                dataKey="name"
                stroke="#91a5bc"
                tick={{ fontSize: 10 }}
                angle={-15}
                textAnchor="end"
                interval={0}
                height={70}
              />
              <YAxis
                domain={[0, 100]}
                stroke="#91a5bc"
                tickFormatter={(v: number) => `${v}%`}
              />
              <Tooltip
                formatter={formatValue}
                contentStyle={tooltipStyle}
              />
              <Legend />
              <Bar
                dataKey="before"
                name="Avant défense"
                fill="#fb7185"
                radius={[4, 4, 0, 0]}
              />
              <Bar
                dataKey="after"
                name="Après défense"
                fill="#2dd4bf"
                radius={[4, 4, 0, 0]}
              />
            </BarChart>
          </ResponsiveContainer>
        </div>

        <div className="table-wrapper">
          <table>
            <thead>
              <tr>
                <th>MODÈLE</th>
                <th>ASR AVANT</th>
                <th>ASR APRÈS</th>
                <th>RÉDUCTION (POINTS)</th>
              </tr>
            </thead>
            <tbody>
              {comparisonData.map((row) => (
                <tr key={row.name}>
                  <td className="transaction-id">{row.name}</td>
                  <td>{formatValue(row.before)}</td>
                  <td style={{ color: '#34d399' }}>
                    {formatValue(row.after)}
                  </td>
                  <td>
                    {(row.before - row.after).toFixed(1)}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </section>

      <section className="panel">
        <div className="panel-header">
          <div>
            <h2>Interprétation scientifique</h2>
            <p>Comprendre l'intérêt de l'Adversarial Training.</p>
          </div>
          <span className="panel-tag">RESEARCH INSIGHTS</span>
        </div>

        <div className="info-note" style={{ marginTop: 24 }}>
          <strong>Principe :</strong> l'Adversarial Training
          enrichit le processus d'entraînement avec des
          exemples adversariaux afin d'améliorer la résistance
          du modèle à certaines perturbations.
        </div>

        <div className="info-note" style={{ marginTop: 15 }}>
          <strong>Point de vigilance :</strong> l'efficacité
          doit être mesurée avec des attaques réévaluées sur
          le modèle défendu. Une robustesse améliorée contre
          ZOO ne garantit pas une robustesse contre HSJ,
          ni contre toutes les autres attaques.
        </div>

        <div className="info-note" style={{ marginTop: 15 }}>
          <strong>Pour ton mémoire :</strong> nous remplacerons
          les chiffres fictifs par les résultats expérimentaux,
          en précisant le jeu de test, les paramètres des attaques,
          les dénominateurs de l'ASR, et les éventuels compromis
          entre performance normale et robustesse.
        </div>
      </section>
    </main>
  )
}
