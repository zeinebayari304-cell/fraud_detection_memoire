import { useState, type FormEvent } from 'react'
import './Auth.css'
import { ApiError, changePassword } from './api'
import { useAuth } from './authContext'
import { Field, StrengthMeter } from './ui'
import { formatDateTime } from './format'
import { validateConfirmation, validatePassword } from './validation'

export default function AccountPage() {
  const { user, applySession } = useAuth()
  const [current, setCurrent] = useState('')
  const [next, setNext] = useState('')
  const [confirm, setConfirm] = useState('')
  const [submitted, setSubmitted] = useState(false)
  const [message, setMessage] = useState('')
  const [notice, setNotice] = useState('')
  const [busy, setBusy] = useState(false)

  if (!user) return null

  const errors: Record<string, string> = Object.fromEntries(
    Object.entries({
      current: current ? '' : 'Saisissez votre mot de passe actuel.',
      next: validatePassword(next, user.username) || (next && next === current ? 'Choisissez un mot de passe différent de l\'actuel.' : ''),
      confirm: validateConfirmation(next, confirm),
    }).filter(([, v]) => v)
  )
  const show = (field: string) => (submitted ? errors[field] ?? '' : '')

  const submit = async (event: FormEvent) => {
    event.preventDefault()
    setSubmitted(true)
    setMessage('')
    setNotice('')
    if (Object.keys(errors).length) return
    setBusy(true)
    try {
      applySession(await changePassword({ current_password: current, new_password: next, new_password_confirm: confirm }))
      setNotice('Mot de passe modifié. Vos autres sessions ont été fermées.')
      setCurrent(''); setNext(''); setConfirm(''); setSubmitted(false)
    } catch (err) {
      setMessage(err instanceof ApiError ? err.message : 'Modification impossible.')
    } finally {
      setBusy(false)
    }
  }

  return (
    <main className="dashboard">
      <div className="page-heading">
        <div>
          <div className="eyebrow">MON COMPTE</div>
          <h1>{user.full_name ?? user.username}</h1>
          <p>{user.role_label}</p>
        </div>
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(min(100%, 380px), 1fr))', gap: 20 }}>
        <section className="panel">
          <div className="panel-header"><div><h2>Profil</h2><p>Modifiable par l'administrateur.</p></div></div>
          <div className="system-row"><span>Nom d'utilisateur</span><strong>{user.username}</strong></div>
          <div className="system-row"><span>E-mail</span><strong>{user.email}</strong></div>
          <div className="system-row"><span>Rôle</span><strong>{user.role_label}</strong></div>
          <div className="system-row"><span>Compte créé le</span><strong>{formatDateTime(user.created_at)}</strong></div>
          <div className="system-row"><span>Dernière connexion</span><strong>{formatDateTime(user.last_login_at)}</strong></div>
        </section>

        <section className="panel">
          <div className="panel-header"><div><h2>Changer le mot de passe</h2><p>Les autres sessions seront fermées.</p></div></div>
          <form onSubmit={submit} noValidate style={{ marginTop: 16 }}>
            {notice && <div className="notice-ok" role="status">{notice}</div>}
            {message && <div className="analysis-error" role="alert" style={{ marginBottom: 14 }}>{message}</div>}
            <Field id="p-current" label="Mot de passe actuel" type="password" value={current} onChange={setCurrent}
              error={show('current')} autoComplete="current-password" required />
            <Field id="p-next" label="Nouveau mot de passe" type="password" value={next} onChange={setNext}
              error={show('next')} autoComplete="new-password" required
              hint="8 caractères min., une majuscule, une minuscule, un chiffre" />
            <StrengthMeter password={next} />
            <Field id="p-confirm" label="Confirmer" type="password" value={confirm} onChange={setConfirm}
              error={show('confirm')} autoComplete="new-password" required />
            <button type="submit" className="bank-button primary" disabled={busy}>
              {busy ? 'Modification…' : 'Modifier le mot de passe'}
            </button>
          </form>
        </section>
      </div>
    </main>
  )
}
