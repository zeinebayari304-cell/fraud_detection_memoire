import { useState, type FormEvent } from 'react'
import './Auth.css'
import './TransactionAnalysis.css'
import {
  ApiError,
  analyzeTransaction,
  createTransaction,
  deleteTransaction,
  fetchHealth,
  fetchRandomRow,
  fetchTransaction,
  fetchTransactions,
  updateTransaction,
  type StoredTransaction,
} from './api'
import { ConfirmDialog, Field, Modal, Pager } from './ui'
import { formatDateTime, relativeTime } from './format'
import { DataState } from './DataState'
import { fmt } from './format'
import { useAsync } from './useAsync'
import {
  parseFeatureLine,
  validateDescription,
  validateFeatureValues,
  validateReference,
} from './validation'

const FEATURE_NAMES = ['Time', ...Array.from({ length: 28 }, (_, i) => `V${i + 1}`), 'Amount']
const EMPTY_FEATURES = Object.fromEntries(FEATURE_NAMES.map((n) => [n, '']))
const selectStyle = {
  padding: '11px 12px', background: '#101c30', color: '#f1f5f9',
  border: '1px solid #35506a', borderRadius: 9,
}

function VerdictBadge({ tx }: { tx: StoredTransaction }) {
  if (tx.last_is_fraud === null) return <span className="badge">Non analysée</span>
  return (
    <span className={`risk-badge ${tx.last_is_fraud ? 'high' : 'normal'}`}>
      {tx.last_is_fraud ? 'Fraude suspectée' : 'Normale'} · {fmt(tx.last_risk_score, 1)} %
    </span>
  )
}

function LabelBadge({ label }: { label: 0 | 1 | null }) {
  if (label === null) return <span className="badge">Inconnue</span>
  return <span className={`badge ${label === 1 ? 'red' : 'green'}`}>{label === 1 ? 'Fraude' : 'Normale'}</span>
}

function TransactionForm({
  editing, onClose, onSaved,
}: { editing: StoredTransaction | null; onClose: () => void; onSaved: (m: string) => void }) {
  const [reference, setReference] = useState(editing?.reference ?? '')
  const [description, setDescription] = useState(editing?.description ?? '')
  const [label, setLabel] = useState<string>(editing?.true_label === null || !editing ? '' : String(editing.true_label))
  const [values, setValues] = useState<Record<string, string>>(
    editing?.features
      ? Object.fromEntries(FEATURE_NAMES.map((n) => [n, String(editing.features?.[n] ?? '')]))
      : { ...EMPTY_FEATURES }
  )
  const [source, setSource] = useState<{ source: string; dataset_row: number | null }>({
    source: editing?.source ?? 'manuel', dataset_row: editing?.dataset_row ?? null,
  })
  const [paste, setPaste] = useState('')
  const [submitted, setSubmitted] = useState(false)
  const [message, setMessage] = useState('')
  const [busy, setBusy] = useState(false)

  const featureErrors = validateFeatureValues(values)
  const errors: Record<string, string> = Object.fromEntries(
    Object.entries({ reference: validateReference(reference), description: validateDescription(description) })
      .filter(([, v]) => v)
  )
  const show = (field: string) => (submitted ? errors[field] ?? '' : '')

  const fillFromLine = () => {
    const parsed = parseFeatureLine(paste, FEATURE_NAMES)
    if (typeof parsed === 'string') { setMessage(parsed); return }
    setValues(parsed)
    setSource({ source: 'csv', dataset_row: null })
    setMessage('')
  }

  const fillFromDataset = async (wanted: 'fraud' | 'normal') => {
    try {
      const row = await fetchRandomRow(wanted, 'all')
      if (!row.features) return
      setValues(Object.fromEntries(FEATURE_NAMES.map((n) => [n, String(row.features?.[n])])))
      setLabel(String(row.label))
      setSource({ source: 'jeu de données', dataset_row: row.id })
      if (!reference) setReference(`dataset-${row.id}`)
      setMessage('')
    } catch (err) {
      setMessage(err instanceof Error ? err.message : 'Jeu de données indisponible.')
    }
  }

  const submit = async (event: FormEvent) => {
    event.preventDefault()
    setSubmitted(true)
    setMessage('')
    if (Object.keys(errors).length || Object.keys(featureErrors).length) {
      setMessage('Corrigez les champs signalés avant d\'enregistrer.')
      return
    }
    const features = Object.fromEntries(FEATURE_NAMES.map((n) => [n, Number(values[n])]))
    const true_label = label === '' ? null : (Number(label) as 0 | 1)
    setBusy(true)
    try {
      if (editing) {
        await updateTransaction(editing.id, {
          features, reference: reference.trim() || null, description: description.trim() || null,
          ...(true_label === null ? { clear_label: true } : { true_label }),
        })
        onSaved('Transaction modifiée.')
      } else {
        await createTransaction({
          features, reference: reference.trim() || null, description: description.trim() || null,
          true_label, ...source,
        })
        onSaved('Transaction enregistrée.')
      }
    } catch (err) {
      setMessage(err instanceof ApiError ? err.message : 'Enregistrement impossible.')
    } finally {
      setBusy(false)
    }
  }

  return (
    <Modal title={editing ? `Modifier la transaction n° ${editing.id}` : 'Nouvelle transaction'} onClose={onClose} wide>
      <form onSubmit={submit} noValidate style={{ marginTop: 16 }}>
        {message && <div className="analysis-error" role="alert" style={{ marginBottom: 14 }}>{message}</div>}

        <div className="form-grid">
          <Field id="t-ref" label="Référence" value={reference} onChange={setReference} error={show('reference')}
            hint="Facultatif, 64 caractères max." />
          <div className="form-field">
            <label htmlFor="t-label">Classe réelle</label>
            <select id="t-label" value={label} onChange={(e) => setLabel(e.target.value)} style={{ ...selectStyle, width: '100%' }}>
              <option value="">Inconnue</option>
              <option value="0">Normale</option>
              <option value="1">Fraude</option>
            </select>
          </div>
        </div>
        <Field id="t-desc" label="Description" value={description} onChange={setDescription} error={show('description')}
          hint="Facultatif, 500 caractères max." />

        <div className="info-note" style={{ marginTop: 6 }}>
          <strong>Remplir les 30 variables :</strong> saisissez-les ci-dessous, collez une ligne CSV
          (Time, V1…V28, Amount), ou prenez une vraie transaction du jeu de données.
        </div>
        <div className="toolbar" style={{ marginTop: 12 }}>
          <input className="bank-input grow" placeholder="Coller une ligne : 406,-2.31,1.95,…,0.00" value={paste}
            aria-label="Ligne CSV à coller" onChange={(e) => setPaste(e.target.value)} />
          <button type="button" className="bank-button secondary" onClick={fillFromLine} disabled={!paste.trim()}>Remplir</button>
          <button type="button" className="bank-button secondary" onClick={() => void fillFromDataset('fraud')}>Fraude du jeu de données</button>
          <button type="button" className="bank-button secondary" onClick={() => void fillFromDataset('normal')}>Normale du jeu de données</button>
        </div>
        {source.dataset_row && (
          <p className="field-hint">Ligne n° {source.dataset_row} du jeu de données.</p>
        )}

        <div className="feature-grid" style={{ marginTop: 10 }}>
          {FEATURE_NAMES.map((name) => (
            <div key={name}>
              <label htmlFor={`f-${name}`} className="field-label">{name}</label>
              <input
                id={`f-${name}`}
                className="bank-input"
                type="number"
                step="any"
                value={values[name]}
                aria-invalid={submitted && featureErrors[name] ? 'true' : 'false'}
                onChange={(e) => setValues((p) => ({ ...p, [name]: e.target.value }))}
              />
              {submitted && featureErrors[name] && <div className="field-error">{featureErrors[name]}</div>}
            </div>
          ))}
        </div>

        <div className="modal-actions">
          <button type="button" className="bank-button secondary" onClick={onClose} disabled={busy}>Annuler</button>
          <button type="submit" className="bank-button primary" disabled={busy}>
            {busy ? 'Enregistrement…' : editing ? 'Enregistrer les modifications' : 'Enregistrer'}
          </button>
        </div>
      </form>
    </Modal>
  )
}

export default function TransactionsPage() {
  const [q, setQ] = useState('')
  const [label, setLabel] = useState('all')
  const [verdict, setVerdict] = useState('all')
  const [page, setPage] = useState(1)
  const [model, setModel] = useState('Random Forest')
  const [editing, setEditing] = useState<StoredTransaction | null | 'new'>(null)
  const [viewing, setViewing] = useState<StoredTransaction | null>(null)
  const [deleting, setDeleting] = useState<StoredTransaction | null>(null)
  const [busyId, setBusyId] = useState<number | null>(null)
  const [notice, setNotice] = useState('')
  const [error, setError] = useState('')

  const health = useAsync(fetchHealth)
  const loadedModels = (health.data?.models ?? []).filter((m) => m.loaded).map((m) => m.name)
  const list = useAsync(() => fetchTransactions({ q, label, verdict, page }), [q, label, verdict, page])

  const flash = (message: string) => { setNotice(message); setError('') }

  const analyze = async (tx: StoredTransaction) => {
    setBusyId(tx.id)
    try {
      const result = await analyzeTransaction(tx.id, model)
      flash(`Transaction n° ${tx.id} analysée avec ${result.model} : ${result.is_fraud ? '⚠ fraude suspectée' : 'normale'} (${result.risk_score} %).`)
      list.reload()
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Analyse impossible.')
    } finally {
      setBusyId(null)
    }
  }

  const openEdit = async (tx: StoredTransaction) => {
    try {
      setEditing(await fetchTransaction(tx.id))
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Transaction introuvable.')
    }
  }

  const openView = async (tx: StoredTransaction) => {
    try {
      setViewing(await fetchTransaction(tx.id))
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Transaction introuvable.')
    }
  }

  const confirmDelete = async () => {
    if (!deleting) return
    setBusyId(deleting.id)
    try {
      await deleteTransaction(deleting.id)
      flash(`Transaction n° ${deleting.id} supprimée.`)
      setDeleting(null)
      list.reload()
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Suppression impossible.')
    } finally {
      setBusyId(null)
    }
  }

  const data = list.data

  return (
    <main className="dashboard">
      <div className="page-heading">
        <div>
          <div className="eyebrow">FRAUD DETECTION / TRANSACTIONS</div>
          <h1>Transactions enregistrées</h1>
          <p>Ajouter, consulter, modifier, supprimer et analyser vos transactions.</p>
        </div>
        <button type="button" className="bank-button primary" onClick={() => { setNotice(''); setEditing('new') }}>
          + Nouvelle transaction
        </button>
      </div>

      {notice && <div className="notice-ok" role="status">{notice}</div>}
      {error && <div className="analysis-error" role="alert" style={{ marginBottom: 16 }}>{error}</div>}

      <section className="panel">
        <div className="toolbar">
          <input className="bank-input grow" placeholder="Rechercher (référence, description)" value={q}
            aria-label="Rechercher une transaction" onChange={(e) => { setQ(e.target.value); setPage(1) }} />
          <select aria-label="Classe réelle" value={label} style={selectStyle}
            onChange={(e) => { setLabel(e.target.value); setPage(1) }}>
            <option value="all">Toutes les classes</option>
            <option value="fraud">Fraudes réelles</option>
            <option value="normal">Normales réelles</option>
            <option value="unknown">Classe inconnue</option>
          </select>
          <select aria-label="Verdict du modèle" value={verdict} style={selectStyle}
            onChange={(e) => { setVerdict(e.target.value); setPage(1) }}>
            <option value="all">Tous les verdicts</option>
            <option value="fraud">Fraudes suspectées</option>
            <option value="normal">Normales</option>
            <option value="pending">Non analysées</option>
          </select>
          <select aria-label="Modèle pour l'analyse" value={model} style={selectStyle} onChange={(e) => setModel(e.target.value)}>
            {(loadedModels.length ? loadedModels : ['Random Forest']).map((m) => <option key={m} value={m}>Analyser avec {m}</option>)}
          </select>
        </div>

        <DataState loading={list.loading} error={list.error} hasData={!!data} onRetry={list.reload}>
          {data && (data.rows.length === 0 ? (
            <p className="empty-state">
              Aucune transaction{q || label !== 'all' || verdict !== 'all' ? ' ne correspond à ces critères' : ' enregistrée pour l\'instant'}.
            </p>
          ) : (
            <>
              <div className="table-wrapper">
                <table>
                  <thead>
                    <tr>
                      <th>N°</th><th>RÉFÉRENCE</th><th>MONTANT</th><th>CLASSE RÉELLE</th>
                      <th>DERNIER VERDICT</th><th>AJOUTÉE</th><th />
                    </tr>
                  </thead>
                  <tbody>
                    {data.rows.map((tx) => (
                      <tr key={tx.id}>
                        <td className="transaction-id">{tx.id}</td>
                        <td>
                          {tx.reference ?? <span style={{ color: '#8fa5bb' }}>—</span>}
                          {tx.description && <div className="field-hint" style={{ marginTop: 2 }}>{tx.description.slice(0, 60)}</div>}
                        </td>
                        <td>{fmt(tx.amount, 2)}</td>
                        <td><LabelBadge label={tx.true_label} /></td>
                        <td>
                          <VerdictBadge tx={tx} />
                          {tx.last_model && <div className="field-hint" style={{ marginTop: 3 }}>{tx.last_model} · {relativeTime(tx.last_analyzed_at)}</div>}
                        </td>
                        <td title={formatDateTime(tx.created_at)}>{relativeTime(tx.created_at)}</td>
                        <td>
                          <div className="row-actions">
                            <button type="button" className="bank-button primary" disabled={busyId === tx.id} onClick={() => void analyze(tx)}>
                              {busyId === tx.id ? '…' : 'Analyser'}
                            </button>
                            <button type="button" className="bank-button secondary" onClick={() => void openView(tx)}>Voir</button>
                            <button type="button" className="bank-button secondary" onClick={() => void openEdit(tx)}>Modifier</button>
                            <button type="button" className="bank-button danger" onClick={() => setDeleting(tx)}>Supprimer</button>
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
        <TransactionForm
          editing={editing === 'new' ? null : editing}
          onClose={() => setEditing(null)}
          onSaved={(m) => { setEditing(null); flash(m); list.reload() }}
        />
      )}

      {viewing && (
        <Modal title={`Transaction n° ${viewing.id}`} onClose={() => setViewing(null)} wide>
          <div className="system-row"><span>Référence</span><strong>{viewing.reference ?? '—'}</strong></div>
          <div className="system-row"><span>Description</span><strong>{viewing.description ?? '—'}</strong></div>
          <div className="system-row"><span>Source</span><strong>{viewing.source}{viewing.dataset_row ? ` (ligne ${viewing.dataset_row})` : ''}</strong></div>
          <div className="system-row"><span>Classe réelle</span><strong><LabelBadge label={viewing.true_label} /></strong></div>
          <div className="system-row"><span>Dernier verdict</span><strong><VerdictBadge tx={viewing} /></strong></div>
          <div className="system-row"><span>Analysée le</span><strong>{formatDateTime(viewing.last_analyzed_at)}</strong></div>
          <div className="system-row"><span>Créée le</span><strong>{formatDateTime(viewing.created_at)}</strong></div>
          <div className="system-row"><span>Modifiée le</span><strong>{formatDateTime(viewing.updated_at)}</strong></div>
          <h3 style={{ marginTop: 20 }}>Variables</h3>
          <div className="table-wrapper">
            <table>
              <tbody>
                {Array.from({ length: 6 }, (_, r) => (
                  <tr key={r}>
                    {FEATURE_NAMES.slice(r * 5, r * 5 + 5).map((n) => (
                      <td key={n}><span className="field-hint">{n}</span><br />{fmt(viewing.features?.[n], 4)}</td>
                    ))}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          <div className="modal-actions">
            <button type="button" className="bank-button secondary" onClick={() => setViewing(null)}>Fermer</button>
          </div>
        </Modal>
      )}

      {deleting && (
        <ConfirmDialog
          title="Supprimer la transaction"
          message={<>Supprimer la transaction n° <strong>{deleting.id}</strong>{deleting.reference ? ` (${deleting.reference})` : ''} ? Ses analyses restent dans l'historique.</>}
          busy={busyId === deleting.id}
          onConfirm={() => void confirmDelete()}
          onCancel={() => setDeleting(null)}
        />
      )}
    </main>
  )
}
