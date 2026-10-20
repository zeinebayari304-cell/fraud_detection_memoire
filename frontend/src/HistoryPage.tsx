import { useState } from 'react'
import './Auth.css'
import {
  deleteHistoryEntry,
  exportHistoryEntry,
  fetchHistory,
  fetchHistoryEntry,
  type HistoryDetail,
  type HistoryEntry,
} from './api'
import { ConfirmDialog, Modal, Pager } from './ui'
import { formatDateTime, relativeTime } from './format'
import { DataState } from './DataState'
import { fmt, fmtInt } from './format'
import { useAsync } from './useAsync'

const KIND_BADGE: Record<string, string> = {
  single: 'blue', file: 'amber', transaction: 'green', comparison: '', evaluation: 'red',
}
const selectStyle = {
  padding: '11px 12px', background: '#101c30', color: '#f1f5f9',
  border: '1px solid #35506a', borderRadius: 9,
}

type Metrics = Record<string, number>

function describe(entry: HistoryEntry): string {
  const s = entry.summary ?? {}
  if (entry.kind === 'file') return entry.filename ?? 'Fichier CSV'
  if (entry.kind === 'transaction') return `Transaction n° ${entry.transaction_id ?? '—'}${s.reference ? ` (${s.reference})` : ''}`
  if (entry.kind === 'comparison') return `${s.fraud_votes ?? 0} modèle(s) sur ${s.models_scored ?? 0} signalent une fraude`
  if (entry.kind === 'evaluation') {
    const m = (s.metrics ?? {}) as Metrics
    return `${entry.filename ?? ''} · TP ${m.tp ?? '—'} / FP ${m.fp ?? '—'} / FN ${m.fn ?? '—'}`
  }
  return s.dataset_row ? `Ligne n° ${s.dataset_row} du jeu de données` : 'Saisie manuelle'
}

function Detail({ entry, onClose }: { entry: HistoryEntry; onClose: () => void }) {
  const [page, setPage] = useState(1)
  const detail = useAsync<HistoryDetail>(() => fetchHistoryEntry(entry.id, page), [entry.id, page])
  const [error, setError] = useState('')
  const data = detail.data
  const summary = (data?.summary ?? {}) as Record<string, unknown>
  const metrics = (summary.metrics ?? null) as Metrics | null
  const comparison = (summary.results ?? null) as { model: string; probability: number; is_fraud: boolean }[] | null

  const exportCsv = async () => {
    try {
      await exportHistoryEntry(entry.id)
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Export impossible.')
    }
  }

  return (
    <Modal title={`${entry.kind_label} n° ${entry.id}`} onClose={onClose} wide>
      {error && <div className="analysis-error" role="alert">{error}</div>}
      <DataState loading={detail.loading} error={detail.error} hasData={!!data} onRetry={detail.reload}>
        {data && (
          <>
            <div className="system-row"><span>Date</span><strong>{formatDateTime(data.created_at)}</strong></div>
            <div className="system-row"><span>Modèle</span><strong>{data.model ?? 'Tous les modèles chargés'}</strong></div>
            <div className="system-row"><span>Seuil</span><strong>{data.threshold === null ? '—' : fmt(data.threshold, 2)}</strong></div>
            {data.kind !== 'comparison' && (
              <div className="system-row">
                <span>{data.kind === 'evaluation' ? 'Transactions évaluées' : 'Transactions analysées'}</span>
                <strong>{fmtInt(data.total)} · {fmtInt(data.fraud_count)} signalée(s) comme fraude</strong>
              </div>
            )}
            {data.labelled > 0 && (
              <div className="system-row">
                <span>Comparaison avec la classe réelle</span>
                <strong>{fmtInt(data.correct)} / {fmtInt(data.labelled)} correctes ({fmt((data.correct / data.labelled) * 100, 1)} %)</strong>
              </div>
            )}

            {metrics && (
              <>
                <h3 style={{ marginTop: 20 }}>Résultat du test</h3>
                <div className="stats-grid" style={{ marginTop: 12 }}>
                  <article className="stat-card"><div className="stat-top">TP / FN</div><div className="stat-value">{metrics.tp} / {metrics.fn}</div></article>
                  <article className="stat-card"><div className="stat-top">FP / TN</div><div className="stat-value">{metrics.fp} / {fmtInt(metrics.tn)}</div></article>
                  <article className="stat-card"><div className="stat-top">Recall / Precision</div><div className="stat-value" style={{ fontSize: 22 }}>{fmt(metrics.recall * 100, 2)} / {fmt(metrics.precision * 100, 2)} %</div></article>
                  <article className="stat-card"><div className="stat-top">PR-AUC / MCC</div><div className="stat-value" style={{ fontSize: 22 }}>{fmt(metrics.ap * 100, 2)} % / {fmt(metrics.mcc, 3)}</div></article>
                </div>
                {summary.matches_thesis !== null && summary.matches_thesis !== undefined && (
                  <div className={summary.matches_thesis ? 'info-note' : 'analysis-error'}>
                    {summary.matches_thesis ? '✓ Identique au résultat du mémoire.' : '✗ Différent du résultat du mémoire.'}
                  </div>
                )}
              </>
            )}

            {comparison && (
              <div className="table-wrapper" style={{ marginTop: 18 }}>
                <table>
                  <thead><tr><th>MODÈLE</th><th>SCORE</th><th>VERDICT</th></tr></thead>
                  <tbody>
                    {comparison.map((r) => (
                      <tr key={r.model}>
                        <td>{r.model}</td>
                        <td>{fmt(r.probability * 100, 1)} %</td>
                        <td><span className={`risk-badge ${r.is_fraud ? 'high' : 'normal'}`}>{r.is_fraud ? 'Fraude' : 'Normale'}</span></td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}

            {data.results.length > 0 && (
              <>
                <div className="table-wrapper" style={{ marginTop: 18 }}>
                  <table>
                    <thead>
                      <tr><th>LIGNE</th><th>MONTANT</th><th>SCORE</th><th>PRÉDICTION</th><th>CLASSE RÉELLE</th></tr>
                    </thead>
                    <tbody>
                      {data.results.map((r) => (
                        <tr key={r.row_index}>
                          <td className="transaction-id">{r.row_index}</td>
                          <td>{fmt(r.amount, 2)}</td>
                          <td>{fmt(r.risk_score, 1)} %</td>
                          <td><span className={`risk-badge ${r.is_fraud ? 'high' : 'normal'}`}>{r.is_fraud ? 'Fraude suspectée' : 'Normale'}</span></td>
                          <td>{r.true_label === null ? '—' : r.true_label === 1 ? 'Fraude' : 'Normale'}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
                {data.total > data.page_size && (
                  <Pager page={page} total={data.total} pageSize={data.page_size} onPage={setPage} />
                )}
              </>
            )}
          </>
        )}
      </DataState>
      <div className="modal-actions">
        <button type="button" className="bank-button secondary" onClick={onClose}>Fermer</button>
        <button type="button" className="bank-button primary" onClick={() => void exportCsv()}>↓ Exporter en CSV</button>
      </div>
    </Modal>
  )
}

export default function HistoryPage() {
  const [kind, setKind] = useState('all')
  const [model, setModel] = useState('all')
  const [dateFrom, setDateFrom] = useState('')
  const [dateTo, setDateTo] = useState('')
  const [page, setPage] = useState(1)
  const [viewing, setViewing] = useState<HistoryEntry | null>(null)
  const [deleting, setDeleting] = useState<HistoryEntry | null>(null)
  const [busy, setBusy] = useState(false)
  const [notice, setNotice] = useState('')
  const [error, setError] = useState('')

  const dateError = dateFrom && dateTo && dateFrom > dateTo ? 'La date de début doit précéder la date de fin.' : ''
  const list = useAsync(
    () => dateError ? Promise.resolve(null) : fetchHistory({ kind, model, date_from: dateFrom, date_to: dateTo, page }),
    [kind, model, dateFrom, dateTo, page, dateError]
  )
  const data = list.data

  const confirmDelete = async () => {
    if (!deleting) return
    setBusy(true)
    try {
      await deleteHistoryEntry(deleting.id)
      setNotice(`Entrée n° ${deleting.id} supprimée de l'historique.`)
      setError('')
      setDeleting(null)
      list.reload()
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Suppression impossible.')
    } finally {
      setBusy(false)
    }
  }

  const exportCsv = async (entry: HistoryEntry) => {
    try {
      await exportHistoryEntry(entry.id)
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Export impossible.')
    }
  }

  const reset = (setter: (v: string) => void) => (value: string) => { setter(value); setPage(1) }

  return (
    <main className="dashboard">
      <div className="page-heading">
        <div>
          <div className="eyebrow">FRAUD DETECTION / HISTORIQUE</div>
          <h1>Historique des analyses</h1>
          <p>Vos analyses de transactions, fichiers CSV, comparaisons et tests de modèles.</p>
        </div>
      </div>

      {notice && <div className="notice-ok" role="status">{notice}</div>}
      {error && <div className="analysis-error" role="alert" style={{ marginBottom: 16 }}>{error}</div>}

      <section className="panel">
        <div className="toolbar">
          <select aria-label="Type d'analyse" value={kind} style={selectStyle} onChange={(e) => reset(setKind)(e.target.value)}>
            <option value="all">Tous les types</option>
            {Object.entries(data?.kinds ?? {}).map(([value, label]) => <option key={value} value={value}>{label}</option>)}
          </select>
          <select aria-label="Modèle" value={model} style={selectStyle} onChange={(e) => reset(setModel)(e.target.value)}>
            <option value="all">Tous les modèles</option>
            {(data?.models ?? []).map((m) => <option key={m} value={m}>{m}</option>)}
          </select>
          <label className="field-hint" htmlFor="h-from">Du</label>
          <input id="h-from" type="date" className="bank-input" value={dateFrom} onChange={(e) => reset(setDateFrom)(e.target.value)} />
          <label className="field-hint" htmlFor="h-to">au</label>
          <input id="h-to" type="date" className="bank-input" value={dateTo} onChange={(e) => reset(setDateTo)(e.target.value)} />
        </div>
        {dateError && <div className="analysis-error" role="alert">{dateError}</div>}

        <DataState loading={list.loading} error={list.error} hasData={!!data} onRetry={list.reload}>
          {data && (data.rows.length === 0 ? (
            <p className="empty-state">
              Aucune entrée{kind !== 'all' || model !== 'all' || dateFrom || dateTo ? ' pour ces filtres' : ' pour l\'instant : vos analyses apparaîtront ici'}.
            </p>
          ) : (
            <>
              <div className="table-wrapper">
                <table>
                  <thead>
                    <tr><th>DATE</th><th>TYPE</th><th>MODÈLE</th><th>DÉTAIL</th><th>TRANSACTIONS</th><th>FRAUDES</th><th /></tr>
                  </thead>
                  <tbody>
                    {data.rows.map((entry) => (
                      <tr key={entry.id}>
                        <td title={formatDateTime(entry.created_at)}>{relativeTime(entry.created_at)}</td>
                        <td><span className={`badge ${KIND_BADGE[entry.kind] ?? ''}`}>{entry.kind_label}</span></td>
                        <td>{entry.model ?? 'Tous'}</td>
                        <td>{describe(entry)}</td>
                        <td>{entry.kind === 'comparison' ? '1' : fmtInt(entry.total)}</td>
                        <td style={{ color: entry.fraud_count ? '#fb7185' : undefined }}>{fmtInt(entry.fraud_count)}</td>
                        <td>
                          <div className="row-actions">
                            <button type="button" className="bank-button secondary" onClick={() => setViewing(entry)}>Détail</button>
                            <button type="button" className="bank-button secondary" onClick={() => void exportCsv(entry)}>Exporter</button>
                            <button type="button" className="bank-button danger" onClick={() => setDeleting(entry)}>Supprimer</button>
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

      {viewing && <Detail entry={viewing} onClose={() => setViewing(null)} />}
      {deleting && (
        <ConfirmDialog
          title="Supprimer de l'historique"
          message={<>Supprimer l'entrée n° <strong>{deleting.id}</strong> ({deleting.kind_label}) et ses résultats ? Le tableau de bord ne la comptera plus.</>}
          busy={busy}
          onConfirm={() => void confirmDelete()}
          onCancel={() => setDeleting(null)}
        />
      )}
    </main>
  )
}
