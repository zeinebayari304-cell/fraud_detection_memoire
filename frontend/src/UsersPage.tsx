import { useState, type FormEvent } from 'react'
import './Auth.css'
import {
  ApiError,
  createUser,
  deleteUser,
  fetchUsers,
  updateUser,
  type Role,
  type User,
} from './api'
import { useAuth } from './authContext'
import { ConfirmDialog, Field, Modal, Pager, StrengthMeter } from './ui'
import { formatDateTime, relativeTime } from './format'
import { DataState } from './DataState'
import { useAsync } from './useAsync'
import {
  validateConfirmation,
  validateEmail,
  validateFullName,
  validatePassword,
  validateUsername,
} from './validation'

const ROLE_OPTIONS: [Role, string][] = [
  ['analyste', 'Analyste antifraude'],
  ['expert', 'Expert cybersécurité / Data Scientist'],
  ['admin', 'Administrateur'],
]
const ROLE_BADGE: Record<Role, string> = { analyste: 'blue', expert: 'amber', admin: 'red' }

const selectStyle = {
  padding: '11px 12px', background: '#101c30', color: '#f1f5f9',
  border: '1px solid #35506a', borderRadius: 9,
}

type FormState = {
  username: string
  email: string
  full_name: string
  role: Role
  is_active: boolean
  password: string
  password_confirm: string
  unlock: boolean
}

function UserForm({
  editing, onClose, onSaved,
}: { editing: User | null; onClose: () => void; onSaved: (message: string) => void }) {
  const { user: me } = useAuth()
  const [form, setForm] = useState<FormState>({
    username: editing?.username ?? '',
    email: editing?.email ?? '',
    full_name: editing?.full_name ?? '',
    role: editing?.role ?? 'analyste',
    is_active: editing?.is_active ?? true,
    password: '',
    password_confirm: '',
    unlock: false,
  })
  const [submitted, setSubmitted] = useState(false)
  const [serverErrors, setServerErrors] = useState<Record<string, string>>({})
  const [message, setMessage] = useState('')
  const [busy, setBusy] = useState(false)

  const changingPassword = !editing || form.password !== ''
  const errors: Record<string, string> = Object.fromEntries(
    Object.entries({
      username: editing ? '' : validateUsername(form.username),
      email: validateEmail(form.email),
      full_name: validateFullName(form.full_name),
      password: changingPassword ? validatePassword(form.password, form.username) : '',
      password_confirm: changingPassword ? validateConfirmation(form.password, form.password_confirm) : '',
    }).filter(([, v]) => v)
  )
  const errorFor = (field: string) => (submitted && errors[field]) || serverErrors[field] || ''
  const set = <K extends keyof FormState>(field: K) => (value: FormState[K]) => {
    setForm((p) => ({ ...p, [field]: value }))
    setServerErrors((p) => ({ ...p, [field]: '' }))
  }
  const isSelf = editing?.id === me?.id

  const submit = async (event: FormEvent) => {
    event.preventDefault()
    setSubmitted(true)
    setMessage('')
    if (Object.keys(errors).length) return
    setBusy(true)
    try {
      if (editing) {
        await updateUser(editing.id, {
          email: form.email.trim(),
          full_name: form.full_name.trim() || null,
          role: form.role,
          is_active: form.is_active,
          ...(form.password ? { password: form.password } : {}),
          unlock: form.unlock,
        })
        onSaved(`Utilisateur « ${editing.username} » modifié.`)
      } else {
        await createUser({
          username: form.username.trim(),
          email: form.email.trim(),
          full_name: form.full_name.trim() || null,
          role: form.role,
          is_active: form.is_active,
          password: form.password,
        })
        onSaved(`Utilisateur « ${form.username.trim().toLowerCase()} » créé.`)
      }
    } catch (err) {
      if (err instanceof ApiError && err.status === 409 && /e-mail/.test(err.message)) {
        setServerErrors({ email: err.message })
      } else if (err instanceof ApiError && err.status === 409 && /nom d'utilisateur/.test(err.message)) {
        setServerErrors({ username: err.message })
      } else if (err instanceof ApiError && Object.keys(err.fieldErrors).length) {
        setServerErrors(err.fieldErrors)
      } else {
        setMessage(err instanceof Error ? err.message : 'Enregistrement impossible.')
      }
    } finally {
      setBusy(false)
    }
  }

  return (
    <Modal title={editing ? `Modifier « ${editing.username} »` : 'Nouvel utilisateur'} onClose={onClose}>
      <form onSubmit={submit} noValidate style={{ marginTop: 16 }}>
        {message && <div className="analysis-error" role="alert" style={{ marginBottom: 14 }}>{message}</div>}
        <div className="form-grid">
          <Field id="u-username" label="Nom d'utilisateur" value={form.username} onChange={set('username')}
            error={errorFor('username')} disabled={!!editing} required={!editing}
            hint={editing ? 'Le nom d\'utilisateur ne peut pas être modifié.' : undefined} />
          <Field id="u-email" label="E-mail" type="email" value={form.email} onChange={set('email')}
            error={errorFor('email')} required />
        </div>
        <Field id="u-full-name" label="Nom complet" value={form.full_name} onChange={set('full_name')}
          error={errorFor('full_name')} />

        <div className="form-grid">
          <div className="form-field">
            <label htmlFor="u-role">Rôle</label>
            <select id="u-role" value={form.role} style={{ ...selectStyle, width: '100%' }}
              onChange={(e) => set('role')(e.target.value as Role)}>
              {ROLE_OPTIONS.map(([value, label]) => <option key={value} value={value}>{label}</option>)}
            </select>
          </div>
          <div className="form-field">
            <label htmlFor="u-active">Statut</label>
            <select id="u-active" value={form.is_active ? 'active' : 'inactive'} disabled={isSelf}
              style={{ ...selectStyle, width: '100%' }}
              onChange={(e) => set('is_active')(e.target.value === 'active')}>
              <option value="active">Actif</option>
              <option value="inactive">Désactivé</option>
            </select>
            {isSelf && <div className="field-hint">Vous ne pouvez pas désactiver votre propre compte.</div>}
          </div>
        </div>

        <div className="form-grid">
          <div>
            <Field id="u-password" label={editing ? 'Nouveau mot de passe (facultatif)' : 'Mot de passe'}
              type="password" value={form.password} onChange={set('password')} error={errorFor('password')}
              autoComplete="new-password" required={!editing} />
            <StrengthMeter password={form.password} />
          </div>
          <Field id="u-password-confirm" label="Confirmer le mot de passe" type="password"
            value={form.password_confirm} onChange={set('password_confirm')}
            error={errorFor('password_confirm')} autoComplete="new-password" required={changingPassword} />
        </div>

        {editing?.locked && (
          <label style={{ display: 'flex', gap: 8, alignItems: 'center', fontSize: 13, color: '#c3d2e2' }}>
            <input type="checkbox" checked={form.unlock} onChange={(e) => set('unlock')(e.target.checked)} />
            Déverrouiller le compte (verrouillé après des échecs de connexion)
          </label>
        )}
        {editing && (
          <p className="field-hint">
            Changer le rôle, désactiver le compte ou réinitialiser le mot de passe ferme les sessions ouvertes de cet utilisateur.
          </p>
        )}

        <div className="modal-actions">
          <button type="button" className="bank-button secondary" onClick={onClose} disabled={busy}>Annuler</button>
          <button type="submit" className="bank-button primary" disabled={busy}>
            {busy ? 'Enregistrement…' : editing ? 'Enregistrer' : 'Créer'}
          </button>
        </div>
      </form>
    </Modal>
  )
}

export default function UsersPage() {
  const { user: me } = useAuth()
  const [q, setQ] = useState('')
  const [role, setRole] = useState('all')
  const [status, setStatus] = useState('all')
  const [page, setPage] = useState(1)
  const [editing, setEditing] = useState<User | null | 'new'>(null)
  const [deleting, setDeleting] = useState<User | null>(null)
  const [busy, setBusy] = useState(false)
  const [notice, setNotice] = useState('')
  const [error, setError] = useState('')

  const list = useAsync(() => fetchUsers({ q, role, status, page }), [q, role, status, page])

  const saved = (message: string) => {
    setEditing(null)
    setNotice(message)
    setError('')
    list.reload()
  }

  const confirmDelete = async () => {
    if (!deleting) return
    setBusy(true)
    try {
      const result = await deleteUser(deleting.id)
      setNotice(result.detail)
      setError('')
      setDeleting(null)
      list.reload()
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Suppression impossible.')
      setDeleting(null)
    } finally {
      setBusy(false)
    }
  }

  const data = list.data

  return (
    <main className="dashboard">
      <div className="page-heading">
        <div>
          <div className="eyebrow">ADMINISTRATION / UTILISATEURS</div>
          <h1>Utilisateurs et rôles</h1>
          <p>Créer, modifier, désactiver ou supprimer les comptes de la plateforme.</p>
        </div>
        <button type="button" className="bank-button primary" onClick={() => { setNotice(''); setEditing('new') }}>
          + Nouvel utilisateur
        </button>
      </div>

      {notice && <div className="notice-ok" role="status">{notice}</div>}
      {error && <div className="analysis-error" role="alert" style={{ marginBottom: 16 }}>{error}</div>}

      <section className="panel">
        <div className="toolbar">
          <input className="bank-input grow" placeholder="Rechercher (nom, e-mail…)" value={q}
            aria-label="Rechercher un utilisateur" onChange={(e) => { setQ(e.target.value); setPage(1) }} />
          <select aria-label="Filtrer par rôle" value={role} style={selectStyle}
            onChange={(e) => { setRole(e.target.value); setPage(1) }}>
            <option value="all">Tous les rôles</option>
            {ROLE_OPTIONS.map(([value, label]) => <option key={value} value={value}>{label}</option>)}
          </select>
          <select aria-label="Filtrer par statut" value={status} style={selectStyle}
            onChange={(e) => { setStatus(e.target.value); setPage(1) }}>
            <option value="all">Tous les statuts</option>
            <option value="active">Actifs</option>
            <option value="inactive">Désactivés</option>
          </select>
        </div>

        <DataState loading={list.loading} error={list.error} hasData={!!data} onRetry={list.reload}>
          {data && (data.rows.length === 0 ? (
            <p className="empty-state">Aucun utilisateur ne correspond à ces critères.</p>
          ) : (
            <>
              <div className="table-wrapper">
                <table>
                  <thead>
                    <tr>
                      <th>UTILISATEUR</th><th>E-MAIL</th><th>RÔLE</th><th>STATUT</th>
                      <th>DERNIÈRE CONNEXION</th><th>CRÉÉ LE</th><th />
                    </tr>
                  </thead>
                  <tbody>
                    {data.rows.map((u) => (
                      <tr key={u.id}>
                        <td>
                          <strong>{u.username}</strong>{u.id === me?.id && <span className="badge" style={{ marginLeft: 6 }}>vous</span>}
                          {u.full_name && <div className="field-hint" style={{ marginTop: 2 }}>{u.full_name}</div>}
                        </td>
                        <td>{u.email}</td>
                        <td><span className={`badge ${ROLE_BADGE[u.role]}`}>{u.role_label}</span></td>
                        <td>
                          <span className={`badge ${u.is_active ? 'green' : ''}`}>{u.is_active ? 'Actif' : 'Désactivé'}</span>
                          {u.locked && <span className="badge red" style={{ marginLeft: 6 }}>Verrouillé</span>}
                        </td>
                        <td title={formatDateTime(u.last_login_at)}>{relativeTime(u.last_login_at)}</td>
                        <td>{formatDateTime(u.created_at)}</td>
                        <td>
                          <div className="row-actions">
                            <button type="button" className="bank-button secondary" onClick={() => { setNotice(''); setEditing(u) }}>
                              Modifier
                            </button>
                            <button type="button" className="bank-button danger" disabled={u.id === me?.id}
                              title={u.id === me?.id ? 'Vous ne pouvez pas supprimer votre propre compte' : undefined}
                              onClick={() => setDeleting(u)}>
                              Supprimer
                            </button>
                          </div>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
              <Pager page={page} total={data.total} pageSize={data.page_size} onPage={setPage} />
            </>
          ))}
        </DataState>
      </section>

      {editing && (
        <UserForm editing={editing === 'new' ? null : editing} onClose={() => setEditing(null)} onSaved={saved} />
      )}
      {deleting && (
        <ConfirmDialog
          title="Supprimer l'utilisateur"
          message={<>Supprimer définitivement <strong>{deleting.username}</strong> ? Ses transactions enregistrées sont supprimées ; ses analyses restent comptées dans le tableau de bord, sans nom.</>}
          busy={busy}
          onConfirm={() => void confirmDelete()}
          onCancel={() => setDeleting(null)}
        />
      )}
    </main>
  )
}
