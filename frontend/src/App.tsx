import { Link, Routes, Route, useLocation } from 'react-router'
import './App.css'
import TransactionAnalysis from './TransactionAnalysis'
import CsvAnalysis from './CsvAnalysis'
import ModelComparison from './ModelComparison'
import AdversarialRobustness from './AdversarialRobustness'
import AdversarialTraining from './AdversarialTraining'
import FinalModel from './FinalModel'
import Dashboard from './Dashboard'
import { fetchHealth } from './api'
import { useAsync } from './useAsync'
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

function NotFound() {
  return (
    <main className="dashboard">
      <div className="page-heading">
        <div>
          <div className="eyebrow">FRAUDSHIELD AI / 404</div>
          <h1>Page introuvable</h1>
          <p>Cette adresse ne correspond à aucune page.</p>
        </div>
      </div>
    </main>
  )
}

// Layout principal : sidebar et topbar partagées
function App() {
  const location = useLocation()

  // État réel de l'API, revérifié toutes les 20 secondes.
  const health = useAsync(fetchHealth, [], 20000)
  const apiUp = !!health.data
  const modelReady = !!health.data?.models_ready

  const statusLabel = !apiUp
    ? 'API hors ligne'
    : modelReady
      ? `API connectée · ${health.data?.default_model}`
      : 'API connectée · modèle absent'

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

        <div className="navigation-title">ESPACE DE TRAVAIL</div>

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
            <span
              className="status-dot"
              style={{ background: apiUp && modelReady ? undefined : '#fbbf24' }}
            />
            {statusLabel}
          </div>
          <small>FraudShield AI · Version 0.2</small>
        </div>
      </aside>

      <div className="main-area">
        <header className="topbar">
          <div className="topbar-heading">
            <div className="breadcrumb">
              <span>FraudShield AI</span>
              <ChevronRight size={15} />
              <strong>{currentPage?.label ?? 'Page introuvable'}</strong>
            </div>
            <div className="topbar-subtitle">
              Plateforme de surveillance et de recherche antifraude
            </div>
          </div>

          <div className="topbar-right">
            <div className="topbar-demo-status">
              <Activity size={15} />
              <span>{apiUp ? 'API EN LIGNE' : 'API HORS LIGNE'}</span>
            </div>

            <Link
              to="/"
              className="notification-indicator"
              title="Voir les alertes sur le tableau de bord"
            >
              <Bell size={19} />
            </Link>

            <div className="avatar" title="FraudShield AI">FS</div>
          </div>
        </header>

        <Routes>
          <Route path="/" element={<Dashboard />} />
          <Route path="/transaction" element={<TransactionAnalysis />} />
          <Route path="/csv" element={<CsvAnalysis />} />
          <Route path="/models" element={<ModelComparison />} />
          <Route path="/robustness" element={<AdversarialRobustness />} />
          <Route path="/defense" element={<AdversarialTraining />} />
          <Route path="/final-model" element={<FinalModel />} />
          <Route path="*" element={<NotFound />} />
        </Routes>
      </div>
    </div>
  )
}

export default App
