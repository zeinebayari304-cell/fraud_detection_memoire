import { Link, Navigate, Route, Routes, useLocation, useNavigate } from 'react-router'
import './App.css'
import './Auth.css'
import TransactionAnalysis from './TransactionAnalysis'
import CsvAnalysis from './CsvAnalysis'
import ModelComparison from './ModelComparison'
import AdversarialRobustness from './AdversarialRobustness'
import AdversarialTraining from './AdversarialTraining'
import FinalModel from './FinalModel'
import Dashboard from './Dashboard'
import LoginPage from './LoginPage'
import RegisterPage from './RegisterPage'
import TransactionsPage from './TransactionsPage'
import HistoryPage from './HistoryPage'
import UsersPage from './UsersPage'
import AuditPage from './AuditPage'
import AccountPage from './AccountPage'
import { fetchHealth } from './api'
import { RequireAccess } from './auth'
import { canAccess } from './access'
import { useAuth } from './authContext'
import { useAsync } from './useAsync'
import {
  LayoutDashboard,
  ScanSearch,
  FileSpreadsheet,
  ListChecks,
  History,
  ChartNoAxesCombined,
  ShieldAlert,
  ShieldCheck,
  Award,
  Users,
  ScrollText,
  Bell,
  Activity,
  ChevronRight,
  LogOut,
} from 'lucide-react'
import type { ReactNode } from 'react'

// Navigation regroupée comme les paquetages du diagramme de cas d'utilisation.
const sections = [
  {
    title: 'ESPACE DE TRAVAIL',
    items: [{ icon: LayoutDashboard, label: 'Tableau de bord', path: '/' }],
  },
  {
    title: 'ANALYSE DES TRANSACTIONS',
    items: [
      { icon: ScanSearch, label: 'Analyse de transaction', path: '/transaction' },
      { icon: FileSpreadsheet, label: 'Analyse CSV', path: '/csv' },
      { icon: ListChecks, label: 'Transactions', path: '/transactions' },
      { icon: History, label: 'Historique', path: '/history' },
    ],
  },
  {
    title: 'RÉSULTATS SCIENTIFIQUES',
    items: [
      { icon: ChartNoAxesCombined, label: 'Comparaison des modèles', path: '/models' },
      { icon: ShieldAlert, label: 'Robustesse adversariale', path: '/robustness' },
      { icon: ShieldCheck, label: 'Adversarial Training', path: '/defense' },
      { icon: Award, label: 'Modèle final', path: '/final-model' },
    ],
  },
  {
    title: 'ADMINISTRATION',
    items: [
      { icon: Users, label: 'Utilisateurs et rôles', path: '/users' },
      { icon: ScrollText, label: "Journal d'audit", path: '/audit' },
    ],
  },
]

const pageLabels: Record<string, string> = {
  ...Object.fromEntries(sections.flatMap((s) => s.items).map((i) => [i.path, i.label])),
  '/account': 'Mon compte',
}

const ROUTES: [string, ReactNode][] = [
  ['/', <Dashboard />],
  ['/transaction', <TransactionAnalysis />],
  ['/csv', <CsvAnalysis />],
  ['/transactions', <TransactionsPage />],
  ['/history', <HistoryPage />],
  ['/models', <ModelComparison />],
  ['/robustness', <AdversarialRobustness />],
  ['/defense', <AdversarialTraining />],
  ['/final-model', <FinalModel />],
  ['/users', <UsersPage />],
  ['/audit', <AuditPage />],
  ['/account', <AccountPage />],
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

function Shell() {
  const location = useLocation()
  const navigate = useNavigate()
  const { user, logout } = useAuth()

  // État réel de l'API, revérifié toutes les 20 secondes.
  const health = useAsync(fetchHealth, [], 20000)
  const apiUp = !!health.data
  const modelReady = !!health.data?.models_ready

  const statusLabel = !apiUp
    ? 'API hors ligne'
    : modelReady
      ? `API connectée · ${health.data?.default_model}`
      : 'API connectée · modèle absent'

  const signOut = async () => {
    await logout()
    navigate('/login', { replace: true })
  }

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

        <nav className="navigation" aria-label="Navigation principale">
          {sections.map((section) => {
            const items = section.items.filter((item) => canAccess(user, item.path))
            if (!items.length) return null
            return (
              <div key={section.title}>
                <div className="navigation-title">{section.title}</div>
                {items.map((item) => (
                  <Link
                    key={item.path}
                    to={item.path}
                    aria-current={location.pathname === item.path ? 'page' : undefined}
                    className={`nav-item ${location.pathname === item.path ? 'active' : ''}`}
                  >
                    <span className="nav-icon">
                      <item.icon size={20} strokeWidth={1.8} />
                    </span>
                    <span>{item.label}</span>
                  </Link>
                ))}
              </div>
            )
          })}
        </nav>

        <div className="sidebar-bottom">
          <div className="system-status">
            <span
              className="status-dot"
              style={{ background: apiUp && modelReady ? undefined : '#fbbf24' }}
            />
            {statusLabel}
          </div>
          <small>FraudShield AI · Version 0.3</small>
        </div>
      </aside>

      <div className="main-area">
        <header className="topbar">
          <div className="topbar-heading">
            <div className="breadcrumb">
              <span>FraudShield AI</span>
              <ChevronRight size={15} />
              <strong>{pageLabels[location.pathname] ?? 'Page introuvable'}</strong>
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

            <Link to="/" className="notification-indicator" title="Voir les alertes sur le tableau de bord">
              <Bell size={19} />
            </Link>

            {user && (
              <div className="user-menu">
                <Link to="/account" className="who" style={{ color: 'inherit', textDecoration: 'none' }} title="Mon compte">
                  <strong>{user.full_name ?? user.username}</strong>
                  <small>{user.role_label}</small>
                </Link>
                <Link to="/account" className="avatar" title="Mon compte" style={{ textDecoration: 'none' }}>
                  {(user.full_name ?? user.username).slice(0, 2).toUpperCase()}
                </Link>
                <button type="button" className="bank-button secondary" onClick={() => void signOut()} title="Se déconnecter">
                  <LogOut size={15} style={{ verticalAlign: 'middle' }} /> Déconnexion
                </button>
              </div>
            )}
          </div>
        </header>

        <Routes>
          {ROUTES.map(([path, element]) => (
            <Route key={path} path={path} element={<RequireAccess path={path}>{element}</RequireAccess>} />
          ))}
          <Route path="*" element={<NotFound />} />
        </Routes>
      </div>
    </div>
  )
}

function App() {
  const { user, checking } = useAuth()
  const location = useLocation()

  return (
    <Routes>
      <Route path="/login" element={<LoginPage />} />
      <Route path="/register" element={<RegisterPage />} />
      <Route
        path="*"
        element={
          !checking && !user ? (
            <Navigate to="/login" replace state={{ from: location.pathname }} />
          ) : (
            <Shell />
          )
        }
      />
    </Routes>
  )
}

export default App
