import { useCallback, useEffect, useMemo, useState, type ReactNode } from 'react'
import { Navigate, useLocation } from 'react-router'
import {
  SESSION_EXPIRED_EVENT,
  fetchMe,
  getToken,
  loginRequest,
  logoutRequest,
  registerRequest,
  setToken,
  type TokenResponse,
  type User,
} from './api'
import { canAccess } from './access'
import { AuthContext, useAuth } from './authContext'

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<User | null>(null)
  const [checking, setChecking] = useState(() => !!getToken())
  const [notice, setNotice] = useState('')

  // Session déjà ouverte dans cet onglet : on vérifie le jeton auprès du serveur.
  useEffect(() => {
    if (!getToken()) return
    fetchMe()
      .then(setUser)
      .catch(() => setToken(null))
      .finally(() => setChecking(false))
  }, [])

  useEffect(() => {
    const onExpired = () => {
      setUser(null)
      setNotice('Votre session a expiré ou a été fermée : reconnectez-vous.')
    }
    window.addEventListener(SESSION_EXPIRED_EVENT, onExpired)
    return () => window.removeEventListener(SESSION_EXPIRED_EVENT, onExpired)
  }, [])

  const applySession = useCallback((response: TokenResponse) => {
    setToken(response.access_token)
    setUser(response.user)
    setNotice('')
  }, [])

  const login = useCallback(async (identifier: string, password: string) => {
    const response = await loginRequest(identifier, password)
    applySession(response)
    return response.user
  }, [applySession])

  const register = useCallback(async (data: Parameters<typeof registerRequest>[0]) => {
    const response = await registerRequest(data)
    applySession(response)
    return response.user
  }, [applySession])

  const logout = useCallback(async () => {
    try {
      await logoutRequest()
    } catch {
      // déjà déconnecté côté serveur : on ferme la session locale quand même
    }
    setToken(null)
    setUser(null)
    setNotice('Vous êtes déconnecté.')
  }, [])

  const value = useMemo(
    () => ({ user, checking, notice, login, register, logout, applySession }),
    [user, checking, notice, login, register, logout, applySession]
  )

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>
}

/** Redirige vers la connexion si besoin, puis vérifie le rôle de la page. */
export function RequireAccess({ path, children }: { path: string; children: ReactNode }) {
  const { user, checking } = useAuth()
  const location = useLocation()

  if (checking) {
    return (
      <main className="dashboard">
        <p style={{ color: '#93a9c1' }}>Vérification de la session…</p>
      </main>
    )
  }
  if (!user) {
    return <Navigate to="/login" replace state={{ from: location.pathname }} />
  }
  if (!canAccess(user, path)) {
    return (
      <main className="dashboard">
        <div className="page-heading">
          <div>
            <div className="eyebrow">FRAUDSHIELD AI / 403</div>
            <h1>Accès refusé</h1>
            <p>
              Votre rôle ({user.role_label}) ne donne pas accès à cette page.
              Contactez l'administrateur si vous en avez besoin.
            </p>
          </div>
        </div>
      </main>
    )
  }
  return <>{children}</>
}
