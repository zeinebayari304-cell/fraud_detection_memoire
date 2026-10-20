import { useState, type ReactNode } from 'react'
import { passwordStrength } from './validation'

type FieldProps = {
  id: string
  label: string
  value: string
  onChange: (value: string) => void
  error?: string
  hint?: string
  type?: string
  autoComplete?: string
  placeholder?: string
  required?: boolean
  disabled?: boolean
}

/** Champ de formulaire avec message d'erreur lié (accessible). */
export function Field({
  id, label, value, onChange, error, hint, type = 'text',
  autoComplete, placeholder, required, disabled,
}: FieldProps) {
  const [visible, setVisible] = useState(false)
  const isPassword = type === 'password'
  const describedBy = error ? `${id}-error` : hint ? `${id}-hint` : undefined

  const input = (
    <input
      id={id}
      className="bank-input"
      type={isPassword && visible ? 'text' : type}
      value={value}
      onChange={(event) => onChange(event.target.value)}
      autoComplete={autoComplete}
      placeholder={placeholder}
      required={required}
      disabled={disabled}
      aria-invalid={error ? 'true' : 'false'}
      aria-describedby={describedBy}
    />
  )

  return (
    <div className="form-field">
      <label htmlFor={id}>
        {label}
        {required && <span aria-hidden="true" style={{ color: '#fb7185' }}> *</span>}
      </label>
      {isPassword ? (
        <div className="password-wrap">
          {input}
          <button
            type="button"
            className="password-toggle"
            onClick={() => setVisible((v) => !v)}
            aria-label={visible ? 'Masquer le mot de passe' : 'Afficher le mot de passe'}
          >
            {visible ? 'Masquer' : 'Afficher'}
          </button>
        </div>
      ) : (
        input
      )}
      {error ? (
        <div id={`${id}-error`} className="field-error" role="alert">{error}</div>
      ) : hint ? (
        <div id={`${id}-hint`} className="field-hint">{hint}</div>
      ) : null}
    </div>
  )
}

export function StrengthMeter({ password }: { password: string }) {
  const level = passwordStrength(password)
  const labels = ['', 'Faible', 'Moyen', 'Bon', 'Fort']
  return (
    <div aria-live="polite">
      <div className="strength" data-level={level} aria-hidden="true">
        <span /><span /><span /><span />
      </div>
      {password && <div className="field-hint">Force : {labels[level]}</div>}
    </div>
  )
}

export function Modal({
  title, children, onClose, wide = false,
}: { title: string; children: ReactNode; onClose: () => void; wide?: boolean }) {
  return (
    <div
      className="modal-backdrop"
      role="presentation"
      onMouseDown={(event) => { if (event.target === event.currentTarget) onClose() }}
      onKeyDown={(event) => { if (event.key === 'Escape') onClose() }}
    >
      <div className={`modal${wide ? ' wide' : ''}`} role="dialog" aria-modal="true" aria-label={title}>
        <h2>{title}</h2>
        {children}
      </div>
    </div>
  )
}

/** Confirmation obligatoire avant une action destructrice. */
export function ConfirmDialog({
  title, message, confirmLabel = 'Supprimer', busy = false, onConfirm, onCancel,
}: {
  title: string
  message: ReactNode
  confirmLabel?: string
  busy?: boolean
  onConfirm: () => void
  onCancel: () => void
}) {
  return (
    <Modal title={title} onClose={onCancel}>
      <p style={{ color: '#c3d2e2', lineHeight: 1.6 }}>{message}</p>
      <div className="modal-actions">
        <button type="button" className="bank-button secondary" onClick={onCancel} disabled={busy}>
          Annuler
        </button>
        <button type="button" className="bank-button danger" onClick={onConfirm} disabled={busy}>
          {busy ? 'Suppression…' : confirmLabel}
        </button>
      </div>
    </Modal>
  )
}

export function Pager({
  page, total, pageSize, onPage,
}: { page: number; total: number; pageSize: number; onPage: (page: number) => void }) {
  const last = Math.max(1, Math.ceil(total / pageSize))
  return (
    <div className="pager">
      <button type="button" className="bank-button secondary" disabled={page <= 1} onClick={() => onPage(page - 1)}>
        ← Précédent
      </button>
      <span>
        Page {page} / {last} · {total.toLocaleString('fr-FR')} élément(s)
      </span>
      <button type="button" className="bank-button secondary" disabled={page >= last} onClick={() => onPage(page + 1)}>
        Suivant →
      </button>
    </div>
  )
}
