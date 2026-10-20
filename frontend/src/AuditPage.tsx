import { useState } from 'react'
import './Auth.css'
import { fetchAudit } from './api'
import { Pager } from './ui'
import { formatDateTime, relativeTime } from './format'
import { DataState } from './DataState'
import { useAsync } from './useAsync'

const selectStyle = {
  padding: '11px 12px', background: '#101c30', color: '#f1f5f9',
  border: '1px solid #35506a', borderRadius: 9,
}

const formatDetails = (details: Record<string, unknown> | null) =>
  details
    ? Object.entries(details)
        .map(([k, v]) => `${k} : ${typeof v === 'object' ? JSON.stringify(v) : String(v)}`)
        .join(' · ')
    : ''

export default function AuditPage() {
  const [action, setAction] = useState('all')
  const [username, setUsername] = useState('')
  const [outcome, setOutcome] = useState('all')
  const [dateFrom, setDateFrom] = useState('')
  const [dateTo, setDateTo] = useState('')
  const [page, setPage] = useState(1)

  const log = useAsync(
    () => fetchAudit({ action, username, outcome, date_from: dateFrom, date_to: dateTo, page }),
    [action, username, outcome, dateFrom, dateTo, page],
    30000
  )
  const data = log.data
  const reset = (setter: (v: string) => void) => (value: string) => { setter(value); setPage(1) }

  return (
    <main className="dashboard">
      <div className="page-heading">
        <div>
          <div className="eyebrow">ADMINISTRATION / JOURNAL D'AUDIT</div>
          <h1>Journal d'audit</h1>
          <p>Connexions, modifications de comptes, analyses et exports : qui, quoi, quand, depuis où.</p>
        </div>
        <span className="dataset-label">ACTUALISÉ TOUTES LES 30 S</span>
      </div>

      <section className="panel">
        <div className="toolbar">
          <select aria-label="Action" value={action} style={selectStyle} onChange={(e) => reset(setAction)(e.target.value)}>
            <option value="all">Toutes les actions</option>
            {Object.entries(data?.actions ?? {}).map(([value, label]) => <option key={value} value={value}>{label}</option>)}
          </select>
          <input className="bank-input" placeholder="Utilisateur" aria-label="Filtrer par utilisateur" value={username}
            onChange={(e) => reset(setUsername)(e.target.value)} />
          <select aria-label="Résultat" value={outcome} style={selectStyle} onChange={(e) => reset(setOutcome)(e.target.value)}>
            <option value="all">Succès et échecs</option>
            <option value="success">Succès</option>
            <option value="failure">Échecs</option>
          </select>
          <label className="field-hint" htmlFor="a-from">Du</label>
          <input id="a-from" type="date" className="bank-input" value={dateFrom} onChange={(e) => reset(setDateFrom)(e.target.value)} />
          <label className="field-hint" htmlFor="a-to">au</label>
          <input id="a-to" type="date" className="bank-input" value={dateTo} onChange={(e) => reset(setDateTo)(e.target.value)} />
        </div>

        <DataState loading={log.loading} error={log.error} hasData={!!data} onRetry={log.reload}>
          {data && (data.rows.length === 0 ? (
            <p className="empty-state">Aucune entrée pour ces filtres.</p>
          ) : (
            <>
              <div className="table-wrapper">
                <table>
                  <thead>
                    <tr><th>DATE</th><th>UTILISATEUR</th><th>ACTION</th><th>CIBLE</th><th>RÉSULTAT</th><th>IP</th><th>DÉTAILS</th></tr>
                  </thead>
                  <tbody>
                    {data.rows.map((row) => (
                      <tr key={row.id}>
                        <td title={formatDateTime(row.created_at)}>{relativeTime(row.created_at)}</td>
                        <td>{row.username ?? '—'}</td>
                        <td>{row.action_label}</td>
                        <td className="transaction-id">{row.target ?? '—'}</td>
                        <td><span className={`badge ${row.success ? 'green' : 'red'}`}>{row.success ? 'Succès' : 'Échec'}</span></td>
                        <td>{row.ip ?? '—'}</td>
                        <td style={{ maxWidth: 360, fontSize: 12, color: '#a4b9cd' }}>{formatDetails(row.details)}</td>
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
    </main>
  )
}
