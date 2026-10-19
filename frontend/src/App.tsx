
import { Link, Routes, Route, useLocation } from 'react-router'
import './App.css'
import TransactionAnalysis from './TransactionAnalysis'
import CsvAnalysis from './CsvAnalysis'
import ModelComparison from './ModelComparison'
import AdversarialRobustness from './AdversarialRobustness'
import AdversarialTraining from './AdversarialTraining'
import FinalModel from './FinalModel'
import {
  LayoutDashboard,
  ScanSearch,
  FileSpreadsheet,
  ChartNoAxesCombined,
  ShieldAlert,
  ShieldCheck,
  Award,
  Bell,
  Activity,
  ChevronRight,
} from 'lucide-react'
import DashboardPremium from './Dashboard'
// Navigation principale

const navigation = [
  { icon: LayoutDashboard, label: 'Tableau de bord', path: '/' },
  { icon: ScanSearch, label: 'Analyse de transaction', path: '/transaction' },
  { icon: FileSpreadsheet, label: 'Analyse CSV', path: '/csv' },
  { icon: ChartNoAxesCombined, label: 'Comparaison des modèles', path: '/models' },
  { icon: ShieldAlert, label: 'Robustesse adversariale', path: '/robustness' },
  { icon: ShieldCheck, label: 'Adversarial Training', path: '/defense' },
  { icon: Award, label: 'Modèle final', path: '/final-model' },
]


// Données fictives de démonstration
const statistics = [
  {
    label: 'Transactions analysées',
    value: '284 807',
    icon: '▤',
    detail: 'Volume total de la démonstration',
    color: 'cyan',
  },
  {
    label: 'Fraudes suspectées',
    value: '492',
    icon: '⚑',
    detail: 'Transactions signalées',
    color: 'red',
  },
  {
    label: 'Taux de fraude',
    value: '0,173 %',
    icon: '%',
    detail: 'Sur l’ensemble des transactions',
    color: 'amber',
  },
  {
    label: 'Transactions normales',
    value: '284 315',
    icon: '✓',
    detail: 'Transactions non signalées',
    color: 'green',
  },
]

const activity = [42, 61, 49, 77, 65, 91, 73]
const days = ['Lun', 'Mar', 'Mer', 'Jeu', 'Ven', 'Sam', 'Dim']

const alerts = [
  { id: 'TX-90241', amount: '2 450,00 €', risk: 96, status: 'Élevé' },
  { id: 'TX-90242', amount: '890,50 €', risk: 88, status: 'Élevé' },
  { id: 'TX-90243', amount: '320,00 €', risk: 67, status: 'Moyen' },
  { id: 'TX-90244', amount: '1 180,00 €', risk: 92, status: 'Élevé' },
]

// Page Dashboard : conserve les éléments existants
function Dashboard() {
  return (
    <main className="dashboard">
      <div className="page-heading">
        <div>
          <div className="eyebrow">FRAUD MONITORING / OVERVIEW</div>
          <h1>Tableau de bord</h1>
          <p>
            Vue globale des transactions et de la surveillance antifraude.
          </p>
        </div>
        <span className="dataset-label">Données fictives</span>
      </div>

      <section className="stats-grid">
        {statistics.map((stat) => (
          <article className="stat-card" key={stat.label}>
            <div className="stat-top">
              <span>{stat.label}</span>
              <div className={`stat-icon ${stat.color}`}>
                {stat.icon}
              </div>
            </div>
            <div className="stat-value">{stat.value}</div>
            <p>{stat.detail}</p>
          </article>
        ))}
      </section>

      <section className="content-grid">
        <article className="panel">
          <div className="panel-header">
            <div>
              <h2>Activité des transactions</h2>
              <p>Évolution simulée sur les 7 derniers jours</p>
            </div>
            <span className="panel-tag">7 jours</span>
          </div>

          <div className="chart">
            {activity.map((value, index) => (
              <div className="chart-column" key={days[index]}>
                <div className="bar-track">
                  <div
                    className="bar"
                    style={{ height: `${value}%` }}
                  />
                </div>
                <span>{days[index]}</span>
              </div>
            ))}
          </div>

          <div className="chart-legend">
            <span className="legend-dot" />
            Volume relatif des transactions
          </div>
        </article>

        <article className="panel">
          <div className="panel-header">
            <div>
              <h2>État du système</h2>
              <p>Configuration actuelle</p>
            </div>
          </div>

          <div className="system-row">
            <span>Interface frontend</span>
            <strong className="text-green">Opérationnelle</strong>
          </div>
          <div className="system-row">
            <span>Source des données</span>
            <strong>Simulation</strong>
          </div>
          <div className="system-row">
            <span>Backend FastAPI</span>
            <strong className="text-amber">Non connecté</strong>
          </div>
          <div className="system-row">
            <span>Modèle final</span>
            <strong className="text-amber">En attente</strong>
          </div>

          <div className="info-note">
            Les modèles ML et leurs résultats réels seront intégrés
            après validation des expérimentations.
          </div>
        </article>
      </section>

      <section className="panel alerts-panel">
        <div className="panel-header">
          <div>
            <h2>Dernières alertes de fraude</h2>
            <p>Transactions fictives signalées comme suspectes</p>
          </div>
          <span className="panel-tag">4 alertes</span>
        </div>

        <div className="table-wrapper">
          <table>
            <thead>
              <tr>
                <th>TRANSACTION</th>
                <th>MONTANT</th>
                <th>SCORE DE RISQUE</th>
                <th>NIVEAU</th>
              </tr>
            </thead>
            <tbody>
              {alerts.map((alert) => (
                <tr key={alert.id}>
                  <td className="transaction-id">{alert.id}</td>
                  <td>{alert.amount}</td>
                  <td>
                    <div className="risk-cell">
                      <div className="risk-track">
                        <div
                          className="risk-fill"
                          style={{ width: `${alert.risk}%` }}
                        />
                      </div>
                      <span>{alert.risk}%</span>
                    </div>
                  </td>
                  <td>
                    <span className={`risk-badge ${
                      alert.status === 'Élevé' ? 'high' : 'medium'
                    }`}>
                      {alert.status}
                    </span>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </section>

      <footer className="footer">
        FraudShield AI · Plateforme de démonstration académique
        <span>Les indicateurs affichés sont fictifs.</span>
      </footer>
    </main>
  )
}

// Pages provisoires avant leur développement détaillé
type PlaceholderPageProps = {
  title: string
  subtitle: string
  code: string
}

function PlaceholderPage({ title, subtitle, code }: PlaceholderPageProps) {
  return (
    <main className="dashboard">
      <div className="page-heading">
        <div>
          <div className="eyebrow">{code}</div>
          <h1>{title}</h1>
          <p>{subtitle}</p>
        </div>
        <span className="dataset-label">Mode démonstration</span>
      </div>

      <section className="panel placeholder-panel">
        <div className="placeholder-symbol">⬡</div>
        <h2>{title}</h2>
        <p>
          Cet espace accueillera les fonctionnalités interactives,
          les graphiques et les résultats propres à cette section.
        </p>
        <span className="placeholder-badge">
          Interface en préparation
        </span>
      </section>
    </main>
  )
}

// Layout principal : sidebar et topbar partagées
function App() {
  const location = useLocation()

  const currentPage = navigation.find(
    (item) => item.path === location.pathname
  )

  return (
    <div className="app-shell">
      <aside className="sidebar">
        <div className="brand">
          <div className="brand-icon">⬡</div>
          <div>
            <strong>
              FraudShield <span>AI</span>
            </strong>
            <small>FRAUD INTELLIGENCE</small>
          </div>
        </div>

        <div className="navigation-title">
          ESPACE DE TRAVAIL
        </div>

        <nav className="navigation" aria-label="Navigation principale">
          {navigation.map((item) => (
            <Link
              key={item.path}
              to={item.path}
              aria-current={
                location.pathname === item.path ? 'page' : undefined
              }
              className={`nav-item ${
                location.pathname === item.path ? 'active' : ''
              }`}
            >
              <span className="nav-icon">
  <item.icon size={20} strokeWidth={1.8} />
</span>
              <span>{item.label}</span>
            </Link>
          ))}
        </nav>

        <div className="sidebar-bottom">
          <div className="system-status">
            <span className="status-dot" />
            Interface de démonstration
          </div>
          <small>FraudShield AI · Version 0.1</small>
        </div>
      </aside>

      <div className="main-area">
        
<header className="topbar">
  <div className="topbar-heading">
    <div className="breadcrumb">
      <span>FraudShield AI</span>
      <ChevronRight size={15} />
      <strong>
        {currentPage?.label ?? 'Page introuvable'}
      </strong>
    </div>
    <div className="topbar-subtitle">
      Plateforme de surveillance et de recherche antifraude
    </div>
  </div>

  <div className="topbar-right">
    <div className="topbar-demo-status">
      <Activity size={15} />
      <span>ENVIRONNEMENT DÉMO</span>
    </div>

    <div className="notification-indicator" title="Notifications non activées">
      <Bell size={19} />
      <span className="notification-dot" />
    </div>

    <div className="avatar" title="Profil de démonstration">
      FS
    </div>
  </div>
</header>

        <Routes>
          <Route path="/" element={<DashboardPremium />} />

          <Route
            path="/transaction"
             element={<TransactionAnalysis />}
              
            
          />

          <Route
            path="/csv"
            element={<CsvAnalysis />}
          />

          <Route
            path="/models"
            element={<ModelComparison />}
          />

          <Route
            path="/robustness"
            element={<AdversarialRobustness />}
          />

          <Route
            path="/defense"
             element={<AdversarialTraining />}
          />

          <Route
            path="/final-model"
             element={<FinalModel />}
          />

          <Route
            path="*"
            element={
              <PlaceholderPage
                title="Page introuvable"
                subtitle="Cette adresse ne correspond à aucune page."
                code="FRAUDSHIELD AI / 404"
              />
            }
          />
        </Routes>
      </div>
    </div>
  )
}

export default App
