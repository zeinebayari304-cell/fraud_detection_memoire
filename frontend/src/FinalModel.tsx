
import { useState } from 'react'

type Criterion = {
  title: string
  description: string
  importance: string
}

const candidates = [
  'XGBoost',
  'Random Forest',
  'LightGBM',
  'SVM linéaire',
  'Régression logistique',
]

const criteria: Criterion[] = [
  {
    title: 'Détection des fraudes',
    description:
      'Recall, Precision, F1-score et PR-AUC sur le jeu de test.',
    importance: 'Performance',
  },
  {
    title: 'Robustesse adversariale',
    description:
      'Résistance aux attaques ZOO et HSJ, ASR et faux négatifs.',
    importance: 'Sécurité',
  },
  {
    title: 'Efficacité de la défense',
    description:
      'Comparaison avant et après Adversarial Training.',
    importance: 'Robustesse',
  },
  {
    title: 'Coût computationnel',
    description:
      'Temps d’entraînement, latence d’inférence et ressources.',
    importance: 'Efficacité',
  },
  {
    title: 'Capacité de généralisation',
    description:
      'Évaluation sur des données non utilisées à l’entraînement.',
    importance: 'Fiabilité',
  },
]

const comparisonFields = [
  ['Recall', 'Détection des fraudes réelles'],
  ['Precision', 'Fiabilité des alertes'],
  ['F1-score', 'Équilibre Precision / Recall'],
  ['ROC-AUC', 'Discrimination entre classes'],
  ['PR-AUC', 'Évaluation adaptée aux classes déséquilibrées'],
  ['ASR ZOO', 'Vulnérabilité face à ZOO'],
  ['ASR HSJ', 'Vulnérabilité face à HSJ'],
  ['Recall après défense', 'Efficacité sur exemples adversariaux'],
  ['Temps d’inférence', 'Coût de la prédiction'],
]

const sectionStyle = { marginBottom: 24 }

export default function FinalModel() {
  const [activeCriterion, setActiveCriterion] = useState(0)
  const [candidate, setCandidate] = useState(candidates[0])

  return (
    <main className="dashboard">
      <div className="page-heading">
        <div>
          <div className="eyebrow">
            MODEL GOVERNANCE / FINAL SELECTION
          </div>
          <h1>Modèle final</h1>
          <p>
            Synthèse scientifique, sélection et préparation
            du déploiement du modèle antifraude.
          </p>
        </div>
        <span className="dataset-label">
          SÉLECTION EN ATTENTE
        </span>
      </div>

      <section
        className="panel"
        style={{
          ...sectionStyle,
          borderColor: '#28595b',
          background:
            'linear-gradient(135deg, #14283a 0%, #142137 80%)',
        }}
      >
        <div className="eyebrow">FINAL MODEL / DECISION STATUS</div>

        <div style={{
          display: 'flex',
          alignItems: 'center',
          gap: 20,
          flexWrap: 'wrap',
          marginTop: 24,
        }}>
          <div style={{
            width: 72,
            height: 72,
            borderRadius: 18,
            background: '#174148',
            color: '#2dd4bf',
            display: 'grid',
            placeItems: 'center',
            fontSize: 37,
          }}>
            ◈
          </div>

          <div style={{ flex: 1, minWidth: 200 }}>
            <h2 style={{ fontSize: 26, margin: '0 0 10px' }}>
              Sélection en cours
            </h2>
            <p style={{
              color: '#a4b9cd',
              lineHeight: 1.8,
              margin: 0,
            }}>
              Le modèle final sera choisi après validation
              des résultats expérimentaux du Notebook 12.
              Aucun modèle n'est actuellement désigné gagnant.
            </p>
          </div>
        </div>

        <div className="info-note" style={{ marginTop: 28 }}>
          <strong>Décision scientifique :</strong> la sélection
          devra prendre en compte les performances sur les
          transactions originales, la robustesse adversariale,
          l'efficacité de la défense et le coût computationnel.
        </div>
      </section>

      <section className="stats-grid">
        <article className="stat-card">
          <div className="stat-top">Modèles candidats</div>
          <div className="stat-value">5</div>
          <p>Algorithmes Machine Learning</p>
        </article>

        <article className="stat-card">
          <div className="stat-top">Attaques étudiées</div>
          <div className="stat-value">2</div>
          <p>ZOO et HopSkipJump</p>
        </article>

        <article className="stat-card">
          <div className="stat-top">Modèle sélectionné</div>
          <div className="stat-value" style={{
            fontSize: 24,
            color: '#fbbf24',
          }}>
            En attente
          </div>
          <p>Résultats du Notebook 12</p>
        </article>

        <article className="stat-card">
          <div className="stat-top">Statut API</div>
          <div className="stat-value" style={{
            fontSize: 24,
            color: '#fbbf24',
          }}>
            Hors ligne
          </div>
          <p>FastAPI non connecté</p>
        </article>
      </section>

      <section className="panel" style={sectionStyle}>
        <div className="panel-header">
          <div>
            <h2>Modèles candidats</h2>
            <p>
              Les cinq modèles évalués dans les expérimentations.
            </p>
          </div>
          <span className="panel-tag">5 CANDIDATS</span>
        </div>

        <div style={{
          display: 'grid',
          gridTemplateColumns:
            'repeat(auto-fit, minmax(180px, 1fr))',
          gap: 12,
          marginTop: 25,
        }}>
          {candidates.map((name, index) => (
            <div
              key={name}
              style={{
                padding: 18,
                background: '#0f1b2f',
                border: '1px solid #2b4059',
                borderRadius: 10,
              }}
            >
              <div style={{
                color: '#2dd4bf',
                fontSize: 12,
                marginBottom: 12,
              }}>
                MODÈLE 0{index + 1}
              </div>
              <strong style={{ fontSize: 15 }}>{name}</strong>
              <div style={{
                color: '#91a5bc',
                fontSize: 11,
                marginTop: 12,
              }}>
                Candidat — non sélectionné
              </div>
            </div>
          ))}
        </div>
      </section>

      <section className="panel" style={sectionStyle}>
        <div className="panel-header">
          <div>
            <h2>Critères de sélection scientifique</h2>
            <p>
              Explore les dimensions qui guideront la décision.
            </p>
          </div>
          <span className="panel-tag">DECISION FRAMEWORK</span>
        </div>

        <div style={{
          display: 'grid',
          gridTemplateColumns:
            'repeat(auto-fit, minmax(220px, 1fr))',
          gap: 12,
          marginTop: 25,
        }}>
          {criteria.map((item, index) => (
            <button
              key={item.title}
              type="button"
              onClick={() => setActiveCriterion(index)}
              aria-pressed={activeCriterion === index}
              style={{
                textAlign: 'left',
                background: activeCriterion === index
                  ? '#173e45' : '#101c30',
                color: activeCriterion === index
                  ? '#52dfca' : '#c4d1df',
                border: `1px solid ${
                  activeCriterion === index
                    ? '#2dd4bf' : '#30435a'
                }`,
                borderRadius: 10,
                padding: 18,
                cursor: 'pointer',
                font: 'inherit',
              }}
            >
              <div style={{
                fontSize: 11,
                opacity: 0.7,
                marginBottom: 10,
              }}>
                CRITÈRE 0{index + 1}
              </div>
              <strong>{item.title}</strong>
            </button>
          ))}
        </div>

        <div className="info-note" style={{
          marginTop: 22,
          padding: 22,
        }}>
          <strong>{criteria[activeCriterion].title}</strong>
          <p style={{ marginBottom: 0, lineHeight: 1.8 }}>
            {criteria[activeCriterion].description}
          </p>
          <p style={{
            marginBottom: 0,
            fontSize: 12,
            color: '#2dd4bf',
          }}>
            Catégorie : {criteria[activeCriterion].importance}
          </p>
        </div>
      </section>

      <section className="panel" style={sectionStyle}>
        <div className="panel-header">
          <div>
            <h2>Fiche d'évaluation d'un candidat</h2>
            <p>
              Structure prête à recevoir les métriques réelles.
            </p>
          </div>
          <span className="panel-tag">NOTEBOOK 12</span>
        </div>

        <div style={{ marginTop: 24, marginBottom: 24 }}>
          <label className="field-label" htmlFor="final-candidate">
            Examiner un modèle candidat
          </label>
          <select
            id="final-candidate"
            className="bank-input"
            style={{ maxWidth: 360 }}
            value={candidate}
            onChange={(event) => setCandidate(event.target.value)}
          >
            {candidates.map((name) => (
              <option key={name} value={name}>
                {name}
              </option>
            ))}
          </select>
          <p style={{
            color: '#91a5bc',
            fontSize: 12,
          }}>
            Cette sélection sert uniquement à explorer la fiche,
            sans désigner le modèle final.
          </p>
        </div>

        <h2 style={{ color: '#2dd4bf' }}>{candidate}</h2>

        <div className="table-wrapper">
          <table>
            <thead>
              <tr>
                <th>INDICATEUR</th>
                <th>DESCRIPTION</th>
                <th>VALEUR</th>
              </tr>
            </thead>
            <tbody>
              {comparisonFields.map(([label, description]) => (
                <tr key={label}>
                  <td style={{
                    color: '#e3edf6',
                    fontWeight: 600,
                  }}>
                    {label}
                  </td>
                  <td>{description}</td>
                  <td style={{
                    color: '#fbbf24',
                    whiteSpace: 'nowrap',
                  }}>
                    À intégrer
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>

        <div className="info-note">
          Aucune métrique réelle n'est encore importée.
          Les valeurs devront provenir de résultats expérimentaux
          vérifiés et d'un protocole documenté.
        </div>
      </section>

      <section className="panel" style={sectionStyle}>
        <div className="panel-header">
          <div>
            <h2>Décision et justification</h2>
            <p>
              Documentation de la sélection du modèle final.
            </p>
          </div>
          <span className="panel-tag">PENDING REVIEW</span>
        </div>

        <div style={{
          background: '#101c30',
          border: '1px dashed #38516b',
          borderRadius: 12,
          padding: 28,
          marginTop: 24,
          lineHeight: 1.9,
          color: '#a9bdcf',
        }}>
          <strong style={{ color: '#edf4fc' }}>
            Justification scientifique à compléter
          </strong>
          <p>
            La décision devra expliquer pourquoi le modèle retenu
            présente le meilleur compromis entre capacité de
            détection des fraudes, robustesse aux attaques
            adversariales, efficacité de la défense
            et coût computationnel.
          </p>
          <p style={{ marginBottom: 0 }}>
            Cette section sera remplie uniquement après
            l'analyse finale des expériences.
          </p>
        </div>
      </section>

      <section className="panel">
        <div className="panel-header">
          <div>
            <h2>État du déploiement</h2>
            <p>
              Préparation de l'intégration du modèle dans FastAPI.
            </p>
          </div>
          <span className="panel-tag">DEPLOYMENT STATUS</span>
        </div>

        <div className="system-row">
          <span>Interface React</span>
          <strong className="text-green">Disponible</strong>
        </div>
        <div className="system-row">
          <span>Modèle final sélectionné</span>
          <strong className="text-amber">En attente</strong>
        </div>
        <div className="system-row">
          <span>API FastAPI</span>
          <strong className="text-amber">Non connectée</strong>
        </div>
        <div className="system-row">
          <span>Service de prédiction réel</span>
          <strong className="text-amber">Non disponible</strong>
        </div>
        <div className="system-row">
          <span>Validation de bout en bout</span>
          <strong className="text-amber">À effectuer</strong>
        </div>

        <div className="info-note" style={{ marginTop: 24 }}>
          Cette version est une interface de démonstration.
          Aucune décision bancaire réelle ne doit être fondée
          sur les résultats simulés.
        </div>
      </section>
    </main>
  )
}
