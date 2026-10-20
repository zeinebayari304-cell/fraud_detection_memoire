import { useRef, useState } from 'react'
import {
  fetchDatasetPage,
  fetchDatasetRow,
  fetchDatasetStatus,
  fetchRandomRow,
  uploadDataset,
  type DatasetRow,
  type DatasetStatus,
} from './api'
import { fmt, fmtInt } from './format'
import { useAsync } from './useAsync'

const PAGE_SIZE = 8

const SPLITS: [string, string][] = [
  ['all', 'Tout le jeu'],
  ['test', 'Test'],
  ['validation', 'Validation'],
  ['train', 'Entraînement'],
]

const LABELS: [string, string][] = [
  ['all', 'Toutes les classes'],
  ['fraud', 'Fraudes'],
  ['normal', 'Normales'],
]

const SPLIT_NAMES: Record<string, string> = {
  train: 'Entraînement',
  validation: 'Validation',
  test: 'Test',
  doublon: 'Doublon',
}

const selectStyle = {
  padding: '10px 12px',
  background: '#101c30',
  color: '#f1f5f9',
  border: '1px solid #35506a',
  borderRadius: 9,
}

type Props = {
  selectedId: number | null
  onUse: (row: DatasetRow) => void
}

export default function DatasetPanel({ selectedId, onUse }: Props) {
  const status = useAsync<DatasetStatus>(fetchDatasetStatus)
  const fileInput = useRef<HTMLInputElement>(null)

  const [split, setSplit] = useState('all')
  const [label, setLabel] = useState('all')
  const [page, setPage] = useState(1)
  const [lineNumber, setLineNumber] = useState('')

  const [uploading, setUploading] = useState(false)
  const [progress, setProgress] = useState(0)
  const [message, setMessage] = useState('')
  const [busy, setBusy] = useState(false)

  const available = !!status.data?.available

  const list = useAsync(
    () =>
      available
        ? fetchDatasetPage({ split, label, page, pageSize: PAGE_SIZE })
        : Promise.resolve(null),
    [available, split, label, page]
  )

  const importFile = async (file?: File) => {
    if (!file) return
    setMessage('')

    if (!file.name.toLowerCase().endsWith('.csv')) {
      setMessage('Veuillez sélectionner un fichier CSV (creditcard.csv).')
      return
    }

    setUploading(true)
    setProgress(0)
    try {
      await uploadDataset(file, setProgress)
      setPage(1)
      status.reload()
    } catch (err) {
      setMessage(err instanceof Error ? err.message : "Échec de l'import.")
    } finally {
      setUploading(false)
    }
  }

  const loadRow = async (id: number) => {
    setBusy(true)
    setMessage('')
    try {
      onUse(await fetchDatasetRow(id))
    } catch (err) {
      setMessage(err instanceof Error ? err.message : 'Ligne introuvable.')
    } finally {
      setBusy(false)
    }
  }

  const random = async (wanted: string) => {
    setBusy(true)
    setMessage('')
    try {
      onUse(await fetchRandomRow(wanted, split))
    } catch (err) {
      setMessage(
        err instanceof Error ? err.message : 'Aucune transaction trouvée.'
      )
    } finally {
      setBusy(false)
    }
  }

  const goToLine = () => {
    const id = Number(lineNumber)
    if (!Number.isInteger(id) || id < 1) {
      setMessage('Saisissez un numéro de ligne valide (1 ou plus).')
      return
    }
    void loadRow(id)
  }

  const picker = (
    <>
      <input
        ref={fileInput}
        type="file"
        accept=".csv,text/csv"
        style={{ display: 'none' }}
        onChange={(event) => {
          void importFile(event.target.files?.[0])
          event.target.value = ''
        }}
      />
    </>
  )

  const total = list.data?.total ?? 0
  const lastPage = Math.max(1, Math.ceil(total / PAGE_SIZE))

  return (
    <section className="panel" style={{ marginBottom: 24 }}>
      <div className="panel-header">
        <div>
          <h2>Jeu de données</h2>
          <p>
            Chargez une vraie transaction de <code>creditcard.csv</code>{' '}
            dans le formulaire ci-dessous.
          </p>
        </div>
        <span className="panel-tag">
          {available ? 'DISPONIBLE' : 'À IMPORTER'}
        </span>
      </div>

      {picker}

      {status.loading && !status.data && (
        <p style={{ color: '#93a9c1' }}>Vérification du jeu de données…</p>
      )}

      {status.error && !status.data && (
        <div className="analysis-error" role="alert">{status.error}</div>
      )}

      {message && (
        <div className="analysis-error" role="alert" style={{ marginTop: 14 }}>
          {message}
        </div>
      )}

      {status.data && !available && (
        <div style={{ marginTop: 22 }}>
          <div className="info-note" style={{ marginTop: 0 }}>
            Le fichier n'est pas encore dans le projet. Importez
            <strong> creditcard.csv</strong> (Kaggle : mlg-ulb /
            creditcardfraud, environ 150 Mo) ou copiez-le dans{' '}
            <code>{status.data.expected_path ?? 'data/raw/creditcard.csv'}</code>.
            {status.data.error && ` Détail : ${status.data.error}`}
          </div>

          <div style={{ marginTop: 18 }}>
            <button
              type="button"
              className="bank-button primary"
              disabled={uploading}
              onClick={() => fileInput.current?.click()}
            >
              {uploading
                ? `Import en cours… ${Math.round(progress * 100)} %`
                : 'Importer creditcard.csv'}
            </button>
          </div>

          {uploading && (
            <div className="result-track" style={{ marginTop: 14 }}>
              <div
                className="result-progress normal"
                style={{ width: `${progress * 100}%` }}
              />
            </div>
          )}
        </div>
      )}

      {available && status.data && (
        <>
          <div style={{
            display: 'flex', gap: 22, flexWrap: 'wrap',
            margin: '20px 0', color: '#a4b9cd', fontSize: 13,
          }}>
            <span><strong>{fmtInt(status.data.rows)}</strong> transactions</span>
            <span>
              <strong style={{ color: '#fb7185' }}>{fmtInt(status.data.frauds)}</strong>{' '}
              fraudes ({fmt(((status.data.frauds ?? 0) / (status.data.rows ?? 1)) * 100, 3)} %)
            </span>
            <span>
              Test : <strong>{fmtInt(status.data.splits?.test.rows)}</strong> lignes,{' '}
              {fmtInt(status.data.splits?.test.frauds)} fraudes
            </span>
          </div>

          <div style={{ display: 'flex', gap: 10, flexWrap: 'wrap', alignItems: 'center' }}>
            <select
              aria-label="Sous-ensemble"
              value={split}
              onChange={(event) => { setSplit(event.target.value); setPage(1) }}
              style={selectStyle}
            >
              {SPLITS.map(([value, text]) => (
                <option key={value} value={value}>{text}</option>
              ))}
            </select>

            <button type="button" className="bank-button secondary" disabled={busy}
              onClick={() => void random('fraud')}>
              Fraude aléatoire
            </button>
            <button type="button" className="bank-button secondary" disabled={busy}
              onClick={() => void random('normal')}>
              Normale aléatoire
            </button>

            <input
              aria-label="Numéro de ligne"
              className="bank-input"
              type="number"
              min="1"
              placeholder="Ligne n°"
              value={lineNumber}
              onChange={(event) => setLineNumber(event.target.value)}
              onKeyDown={(event) => { if (event.key === 'Enter') goToLine() }}
              style={{ width: 130, padding: '10px 12px' }}
            />
            <button type="button" className="bank-button secondary" disabled={busy}
              onClick={goToLine}>
              Charger
            </button>
          </div>

          <div style={{ display: 'flex', gap: 10, flexWrap: 'wrap', margin: '22px 0 10px' }}>
            {LABELS.map(([value, text]) => (
              <button
                key={value}
                type="button"
                aria-pressed={label === value}
                className={`bank-button ${label === value ? 'primary' : 'secondary'}`}
                onClick={() => { setLabel(value); setPage(1) }}
              >
                {text}
              </button>
            ))}
          </div>

          <div className="table-wrapper">
            <table>
              <thead>
                <tr>
                  <th>LIGNE</th>
                  <th>SOUS-ENSEMBLE</th>
                  <th>TIME</th>
                  <th>AMOUNT</th>
                  <th>CLASSE RÉELLE</th>
                  <th />
                </tr>
              </thead>
              <tbody>
                {(list.data?.rows ?? []).map((row) => (
                  <tr key={row.id} style={row.id === selectedId ? { outline: '1px solid #2dd4bf' } : undefined}>
                    <td className="transaction-id">{row.id}</td>
                    <td>{SPLIT_NAMES[row.split] ?? row.split}</td>
                    <td>{fmtInt(row.time)}</td>
                    <td>{fmt(row.amount, 2)}</td>
                    <td>
                      <span className={`risk-badge ${row.label === 1 ? 'high' : 'normal'}`}>
                        {row.label === 1 ? 'Fraude' : 'Normale'}
                      </span>
                    </td>
                    <td>
                      <button
                        type="button"
                        className="bank-button secondary"
                        disabled={busy}
                        onClick={() => void loadRow(row.id)}
                      >
                        Utiliser
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          <div style={{
            display: 'flex', gap: 12, alignItems: 'center',
            flexWrap: 'wrap', marginTop: 14, fontSize: 13, color: '#a4b9cd',
          }}>
            <button type="button" className="bank-button secondary"
              disabled={page <= 1} onClick={() => setPage((p) => p - 1)}>
              ← Précédent
            </button>
            <span>
              Page {fmtInt(page)} / {fmtInt(lastPage)} · {fmtInt(total)} transaction(s)
            </span>
            <button type="button" className="bank-button secondary"
              disabled={page >= lastPage} onClick={() => setPage((p) => p + 1)}>
              Suivant →
            </button>

            <span style={{ marginLeft: 'auto' }}>
              <button type="button" className="bank-button secondary"
                disabled={uploading} onClick={() => fileInput.current?.click()}>
                {uploading ? `Import… ${Math.round(progress * 100)} %` : 'Remplacer le fichier'}
              </button>
            </span>
          </div>
        </>
      )}
    </section>
  )
}
