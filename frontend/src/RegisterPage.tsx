import { useState, type FormEvent } from 'react'
import { Link, Navigate, useNavigate } from 'react-router'
import './Auth.css'
import './TransactionAnalysis.css'
import { ApiError } from './api'
import { useAuth } from './authContext'
import { Field, StrengthMeter } from './ui'
import {
  validateConfirmation,
  validateEmail,
  validateFullName,
  validatePassword,
  validateUsername,
} from './validation'

type Form = {
  username: string
  email: string
  full_name: string
  password: string
  password_confirm: string
}

const EMPTY: Form = { username: '', email: '', full_name: '', password: '', password_confirm: '' }

function validate(form: Form): Partial<Record<keyof Form, string>> {
  const errors: Partial<Record<keyof Form, string>> = {
    username: validateUsername(form.username),
    email: validateEmail(form.email),
    full_name: validateFullName(form.full_name),
    password: validatePassword(form.password, form.username),
    password_confirm: validateConfirmation(form.password, form.password_confirm),
  }
  return Object.fromEntries(Object.entries(errors).filter(([, v]) => v))
}

export default function RegisterPage() {
  const { user, register } = useAuth()
  const navigate = useNavigate()
  const [form, setForm] = useState<Form>(EMPTY)
  const [touched, setTouched] = useState<Partial<Record<keyof Form, boolean>>>({})
  const [serverErrors, setServerErrors] = useState<Record<string, string>>({})
  const [message, setMessage] = useState('')
  const [busy, setBusy] = useState(false)

  if (user) return <Navigate to="/" replace />

  const clientErrors = validate(form)
  const errorFor = (field: keyof Form) =>
    (touched[field] && clientErrors[field]) || serverErrors[field] || ''

  const set = (field: keyof Form) => (value: string) => {
    setForm((previous) => ({ ...previous, [field]: value }))
    setTouched((previous) => ({ ...previous, [field]: true }))
    setServerErrors((previous) => ({ ...previous, [field]: '' }))
  }

  const submit = async (event: FormEvent) => {
    event.preventDefault()
    setTouched({ username: true, email: true, full_name: true, password: true, password_confirm: true })
    setMessage('')
    if (Object.keys(clientErrors).length) return

    setBusy(true)
    try {
      await register({
        username: form.username.trim(),
        email: form.email.trim(),
        full_name: form.full_name.trim() || undefined,
        password: form.password,
        password_confirm: form.password_confirm,
      })
      navigate('/', { replace: true })
    } catch (err) {
      if (err instanceof ApiError) {
        setServerErrors(err.fieldErrors)
        // 409 : doublon (nom ou e-mail) – rattaché au bon champ.
        if (err.status === 409) {
          setServerErrors({ [err.message.includes('e-mail') ? 'email' : 'username']: err.message })
        } else if (!Object.keys(err.fieldErrors).length) {
          setMessage(err.message)
        }
      } else {
        setMessage('Inscription impossible.')
      }
    } finally {
      setBusy(false)
    }
  }

  return (
    <div className="auth-page">
      <form className="auth-card wide" onSubmit={submit} noValidate>
        <div className="auth-brand">
          <div className="brand-icon">⬡</div>
          <strong>FraudShield <span style={{ color: '#2dd4bf' }}>AI</span></strong>
        </div>
        <h1>Créer un compte</h1>
        <p>
          Le compte est créé avec le rôle <strong>Analyste antifraude</strong>.
          L'administrateur peut ensuite attribuer un autre rôle.
        </p>

        {message && <div className="analysis-error" role="alert" style={{ marginBottom: 16 }}>{message}</div>}

        <div className="form-grid">
          <Field id="username" label="Nom d'utilisateur" value={form.username} onChange={set('username')}
            error={errorFor('username')} hint="3 à 30 caractères : lettres, chiffres, . _ -"
            autoComplete="username" required />
          <Field id="email" label="Adresse e-mail" type="email" value={form.email} onChange={set('email')}
            error={errorFor('email')} autoComplete="email" required />
        </div>
        <Field id="full_name" label="Nom complet (facultatif)" value={form.full_name} onChange={set('full_name')}
          error={errorFor('full_name')} autoComplete="name" />
        <div className="form-grid">
          <div>
            <Field id="password" label="Mot de passe" type="password" value={form.password} onChange={set('password')}
              error={errorFor('password')} hint="8 caractères min., une majuscule, une minuscule, un chiffre"
              autoComplete="new-password" required />
            <StrengthMeter password={form.password} />
          </div>
          <Field id="password_confirm" label="Confirmer le mot de passe" type="password"
            value={form.password_confirm} onChange={set('password_confirm')}
            error={errorFor('password_confirm')} autoComplete="new-password" required />
        </div>

        <div className="auth-actions" style={{ marginTop: 18 }}>
          <button type="submit" className="bank-button primary" disabled={busy}>
            {busy ? 'Création…' : 'Créer mon compte'}
          </button>
        </div>
        <div className="auth-switch">
          Déjà inscrit ? <Link to="/login">Se connecter</Link>
        </div>
      </form>
    </div>
  )
}
