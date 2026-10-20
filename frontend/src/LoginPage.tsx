import { useState, type FormEvent } from 'react'
import { Link, Navigate, useLocation, useNavigate } from 'react-router'
import './Auth.css'
import './TransactionAnalysis.css'
import { ApiError } from './api'
import { canAccess } from './access'
import { useAuth } from './authContext'
import { Field } from './ui'

export default function LoginPage() {
  const { user, login, notice } = useAuth()
  const navigate = useNavigate()
  const location = useLocation()
  const from = (location.state as { from?: string } | null)?.from ?? '/'

  const [identifier, setIdentifier] = useState('')
  const [password, setPassword] = useState('')
  const [errors, setErrors] = useState<Record<string, string>>({})
  const [message, setMessage] = useState('')
  const [busy, setBusy] = useState(false)

  // Retour à la page demandée seulement si le rôle y donne accès.
  const target = (signedIn: typeof user) => (canAccess(signedIn, from) ? from : '/')

  if (user) return <Navigate to={target(user)} replace />


  const submit = async (event: FormEvent) => {
    event.preventDefault()
    const found: Record<string, string> = {}
    if (identifier.trim().length < 3) found.identifier = "Saisissez votre nom d'utilisateur ou votre e-mail."
    if (!password) found.password = 'Saisissez votre mot de passe.'
    setErrors(found)
    setMessage('')
    if (Object.keys(found).length) return

    setBusy(true)
    try {
      const signedIn = await login(identifier.trim(), password)
      navigate(target(signedIn), { replace: true })
    } catch (err) {
      setMessage(err instanceof Error ? err.message : 'Connexion impossible.')
      if (err instanceof ApiError && err.status === 401) setPassword('')
    } finally {
      setBusy(false)
    }
  }

  return (
    <div className="auth-page">
      <form className="auth-card" onSubmit={submit} noValidate>
        <div className="auth-brand">
          <div className="brand-icon">⬡</div>
          <strong>FraudShield <span style={{ color: '#2dd4bf' }}>AI</span></strong>
        </div>
        <h1>Connexion</h1>
        <p>Accédez à la plateforme de détection de fraude.</p>

        {notice && !message && <div className="notice-ok" role="status">{notice}</div>}
        {message && <div className="analysis-error" role="alert" style={{ marginBottom: 16 }}>{message}</div>}

        <Field
          id="identifier"
          label="Nom d'utilisateur ou e-mail"
          value={identifier}
          onChange={(v) => { setIdentifier(v); setErrors((e) => ({ ...e, identifier: '' })) }}
          error={errors.identifier}
          autoComplete="username"
          required
        />
        <Field
          id="password"
          label="Mot de passe"
          type="password"
          value={password}
          onChange={(v) => { setPassword(v); setErrors((e) => ({ ...e, password: '' })) }}
          error={errors.password}
          autoComplete="current-password"
          required
        />

        <div className="auth-actions">
          <button type="submit" className="bank-button primary" disabled={busy}>
            {busy ? 'Connexion…' : 'Se connecter'}
          </button>
        </div>
        <div className="auth-switch">
          Pas encore de compte ? <Link to="/register">Créer un compte</Link>
        </div>
        <p className="field-hint" style={{ textAlign: 'center', marginTop: 14 }}>
          Après 5 échecs, le compte est verrouillé 15 minutes.
        </p>
      </form>
    </div>
  )
}
