
import { useRef, useState, type ChangeEvent } from 'react'

const requiredColumns = [
  'Time',
  ...Array.from({ length: 28 }, (_, i) => `V${i + 1}`),
  'Amount',
]

type Transaction = Record<string, string>

type AnalysisRow = {
  index: number
  transaction: Transaction
  prediction: 'Normale' | 'Fraude suspectée'
  risk: number
}

type Filter = 'Toutes' | 'Normale' | 'Fraude suspectée'

const mockScores = [12, 91, 24, 86, 8, 67, 16, 95, 33, 78]

function parseCsv(text: string): string[][] {
  const rows: string[][] = []
  let row: string[] = []
  let value = ''
  let quoted = false

  for (let i = 0; i < text.length; i++) {
    const char = text[i]

    if (char === '"') {
      if (quoted && text[i + 1] === '"') {
        value += '"'
        i++
      } else {
        quoted = !quoted
      }
    } else if (char === ',' && !quoted) {
      row.push(value.trim())
      value = ''
    } else if ((char === '\n' || char === '\r') && !quoted) {
      if (char === '\r' && text[i + 1] === '\n') i++
      row.push(value.trim())

      if (row.some((cell) => cell !== '')) rows.push(row)

      row = []
      value = ''
    } else {
      value += char
    }
  }

  if (quoted) throw new Error('Guillemets CSV non fermés.')

  row.push(value.trim())
  if (row.some((cell) => cell !== '')) rows.push(row)

  return rows
}

export default function CsvAnalysis() {
  const fileInput = useRef<HTMLInputElement>(null)

  const [filename, setFilename] = useState('')
  const [transactions, setTransactions] = useState<Transaction[]>([])
  const [results, setResults] = useState<AnalysisRow[]>([])
  const [filter, setFilter] = useState<Filter>('Toutes')
  const [error, setError] = useState('')
  const [loading, setLoading] = useState(false)
  const [dragging, setDragging] = useState(false)

  const importFile = async (file?: File) => {
    if (!file) return

    setError('')
    setFilename('')
    setTransactions([])
    setResults([])
    setFilter('Toutes')

    if (!file.name.toLowerCase().endsWith('.csv')) {
      setError('Veuillez sélectionner un fichier CSV.')
      return
    }

    if (file.size > 5 * 1024 * 1024) {
      setError('Fichier trop volumineux : maximum 5 Mo.')
      return
    }

    setLoading(true)

    try {
      const text = (await file.text()).replace(/^\uFEFF/, '')
      const parsed = parseCsv(text)

      if (parsed.length < 2) {
        throw new Error('Le fichier ne contient aucune transaction.')
      }

      const columns = parsed[0].map((column) => column.trim())

      const missing = requiredColumns.filter(
        (column) => !columns.includes(column)
      )

      if (missing.length > 0) {
        throw new Error(`Colonnes manquantes : ${missing.join(', ')}`)
      }

      if (new Set(columns).size !== columns.length) {
        throw new Error('Certaines colonnes sont dupliquées.')
      }

      const rows = parsed.slice(1)

      const invalidRow = rows.some(
        (row) =>
          row.length !== columns.length ||
          requiredColumns.some((column) => {
            const value = row[columns.indexOf(column)]
            return value.trim() === '' ||
              !Number.isFinite(Number(value))
          })
      )

      if (invalidRow) {
        throw new Error(
          'Certaines transactions comportent des valeurs manquantes ou invalides.'
        )
      }

      const timeIndex = columns.indexOf('Time')
      const amountIndex = columns.indexOf('Amount')

      if (
        rows.some(
          (row) =>
            Number(row[timeIndex]) < 0 ||
            Number(row[amountIndex]) < 0
        )
      ) {
        throw new Error('Time et Amount doivent être positifs ou nuls.')
      }

      const parsedTransactions = rows.map((row) =>
        Object.fromEntries(
          columns.map((column, index) => [column, row[index]])
        )
      )

      setTransactions(parsedTransactions)
      setFilename(file.name)
    } catch (err) {
      setError(
        err instanceof Error ? err.message : 'Erreur de lecture CSV.'
      )
    } finally {
      setLoading(false)
    }
  }

  const handleChange = (event: ChangeEvent<HTMLInputElement>) => {
    void importFile(event.target.files?.[0])
    event.target.value = ''
  }

  const analyzeBatch = () => {
    // Scores prédéfinis : ils ne proviennent pas des données du fichier.
    // Aucun modèle Machine Learning n'est exécuté ici.
    const simulated = transactions.map((transaction, index) => {
      const risk = mockScores[index % mockScores.length]

      return {
        index: index + 1,
        transaction,
        risk,
        prediction: risk >= 50
          ? 'Fraude suspectée'
          : 'Normale',
      } as AnalysisRow
    })

    setResults(simulated)
    setFilter('Toutes')
  }

  const exportResults = () => {
    if (!results.length) return

    const columns = [
      'Transaction_ID',
      ...requiredColumns,
      'Prediction_demo',
      'Risk_score_demo',
    ]

    const escapeCsv = (value: string | number) => {
      const text = String(value)
      return `"${text.replace(/"/g, '""')}"`
    }

    const lines = [
      columns.map(escapeCsv).join(','),
      ...results.map((row) =>
        [
          row.index,
          ...requiredColumns.map(
            (column) => row.transaction[column]
          ),
          row.prediction,
          row.risk,
        ].map(escapeCsv).join(',')
      ),
    ]

    const blob = new Blob(
      ['\uFEFF', lines.join('\r\n')],
      { type: 'text/csv;charset=utf-8;' }
    )

    const url = URL.createObjectURL(blob)
    const link = document.createElement('a')
    link.href = url
    link.download = 'fraudshield_demo_results.csv'
    document.body.appendChild(link)
    link.click()
    link.remove()
    URL.revokeObjectURL(url)
  }

  const fraudCount = results.filter(
    (row) => row.prediction === 'Fraude suspectée'
  ).length

  const normalCount = results.length - fraudCount

  const visibleResults = results.filter(
    (row) => filter === 'Toutes' || row.prediction === filter
  )

  const sectionStyle = { marginTop: 22 }

  return (
    <main className="dashboard">
      <div className="page-heading">
        <div>
          <div className="eyebrow">
            FRAUD DETECTION / BATCH ANALYSIS
          </div>
          <h1>Analyse CSV</h1>
          <p>
            Analyse par lots de transactions bancaires.
          </p>
        </div>
        <span className="dataset-label">MODE DÉMO</span>
      </div>

      <section className="panel">
        <div className="panel-header">
          <div>
            <h2>Importer des transactions</h2>
            <p>CSV avec Time, V1 à V28 et Amount.</p>
          </div>
          <span className="panel-tag">5 Mo max.</span>
        </div>

        <input
          ref={fileInput}
          type="file"
          accept=".csv,text/csv"
          style={{ display: 'none' }}
          onChange={handleChange}
        />

        <div
          onDragOver={(event) => {
            event.preventDefault()
            setDragging(true)
          }}
          onDragLeave={() => setDragging(false)}
          onDrop={(event) => {
            event.preventDefault()
            setDragging(false)
            void importFile(event.dataTransfer.files[0])
          }}
          style={{
            textAlign: 'center',
            marginTop: 25,
            padding: 35,
            background: dragging ? '#173b43' : '#101c30',
            border: `2px dashed ${dragging ? '#2dd4bf' : '#35506a'}`,
            borderRadius: 14,
          }}
        >
          <div style={{ fontSize: 36, color: '#2dd4bf' }}>⇧</div>
          <h2>Glissez votre fichier CSV ici</h2>
          <p style={{ color: '#94a3b8' }}>
            Ou sélectionnez un fichier depuis votre ordinateur.
          </p>
          <button
            type="button"
            className="bank-button primary"
            disabled={loading}
            onClick={() => fileInput.current?.click()}
          >
            {loading ? 'Lecture en cours...' : 'Choisir un fichier CSV'}
          </button>
        </div>

        {error && (
          <div className="analysis-error" role="alert">{error}</div>
        )}
      </section>

      {transactions.length > 0 && (
        <section className="panel" style={sectionStyle}>
          <div className="panel-header">
            <div>
              <h2>Fichier importé avec succès</h2>
              <p>{filename}</p>
            </div>
            <span className="panel-tag">Fichier valide</span>
          </div>

          <div className="stats-grid" style={{ marginTop: 25 }}>
            <article className="stat-card">
              <div className="stat-top">Transactions importées</div>
              <div className="stat-value">
                {transactions.length.toLocaleString('fr-FR')}
              </div>
            </article>
            <article className="stat-card">
              <div className="stat-top">Variables d'entrée</div>
              <div className="stat-value">30</div>
            </article>
          </div>

          <button
            type="button"
            className="bank-button primary"
            onClick={analyzeBatch}
          >
            Lancer l'analyse simulée →
          </button>

          <div className="info-note">
            Les scores utilisés pour cette démonstration sont
            prédéfinis et indépendants des transactions importées.
            Il ne s'agit pas de prédictions réelles.
          </div>

          <h2 style={{ marginTop: 30 }}>
            Aperçu des transactions importées
          </h2>
          <div className="table-wrapper">
            <table>
              <thead>
                <tr>
                  <th>LIGNE</th>
                  <th>TIME</th>
                  <th>AMOUNT</th>
                  <th>V1</th>
                  <th>V2</th>
                  <th>V3</th>
                </tr>
              </thead>
              <tbody>
                {transactions.slice(0, 5).map((row, index) => (
                  <tr key={index}>
                    <td>{index + 1}</td>
                    <td>{row.Time}</td>
                    <td>{row.Amount}</td>
                    <td>{row.V1}</td>
                    <td>{row.V2}</td>
                    <td>{row.V3}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </section>
      )}

      {results.length > 0 && (
        <section className="panel" style={sectionStyle}>
          <div className="panel-header">
            <div>
              <h2>Résultats de l'analyse simulée</h2>
              <p>Classification fictive des transactions importées.</p>
            </div>
            <span className="panel-tag">SIMULATION</span>
          </div>

          <div className="stats-grid" style={{ marginTop: 25 }}>
            <article className="stat-card">
              <div className="stat-top">Transactions analysées</div>
              <div className="stat-value">{results.length}</div>
            </article>
            <article className="stat-card">
              <div className="stat-top">Fraudes suspectées</div>
              <div className="stat-value" style={{ color: '#fb7185' }}>
                {fraudCount}
              </div>
            </article>
            <article className="stat-card">
              <div className="stat-top">Transactions normales</div>
              <div className="stat-value" style={{ color: '#34d399' }}>
                {normalCount}
              </div>
            </article>
            <article className="stat-card">
              <div className="stat-top">Taux signalé</div>
              <div className="stat-value">
                {(fraudCount / results.length * 100).toFixed(1)} %
              </div>
            </article>
          </div>

          <div style={{
            display: 'flex',
            gap: 12,
            flexWrap: 'wrap',
            margin: '25px 0',
          }}>
            {(['Toutes', 'Normale', 'Fraude suspectée'] as Filter[])
              .map((item) => (
                <button
                  key={item}
                  type="button"
                  className={`bank-button ${
                    filter === item ? 'primary' : 'secondary'
                  }`}
                  onClick={() => setFilter(item)}
                >
                  {item}
                </button>
              ))}

            <button
              type="button"
              className="bank-button secondary"
              onClick={exportResults}
            >
              ↓ Exporter les résultats CSV
            </button>
          </div>

          <p style={{ color: '#94a3b8', fontSize: 12 }}>
            {visibleResults.length} transaction(s) affichée(s).
            Maximum 100 lignes visibles.
          </p>

          <div className="table-wrapper">
            <table>
              <thead>
                <tr>
                  <th>ID</th>
                  <th>MONTANT</th>
                  <th>PRÉDICTION DÉMO</th>
                  <th>SCORE DÉMO</th>
                  <th>RISQUE</th>
                </tr>
              </thead>
              <tbody>
                {visibleResults.slice(0, 100).map((row) => (
                  <tr key={row.index}>
                    <td className="transaction-id">
                      TX-{String(row.index).padStart(5, '0')}
                    </td>
                    <td>{row.transaction.Amount}</td>
                    <td>
                      <span className={`risk-badge ${
                        row.prediction === 'Fraude suspectée'
                          ? 'high'
                          : 'normal'
                      }`}>
                        {row.prediction}
                      </span>
                    </td>
                    <td>{row.risk}%</td>
                    <td>
                      {row.risk >= 75
                        ? 'Élevé'
                        : row.risk >= 40
                          ? 'Moyen'
                          : 'Faible'}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          <div className="info-note">
            Résultats fictifs. La classification réelle sera
            effectuée ultérieurement par FastAPI via POST /predict-file.
          </div>
        </section>
      )}
    </main>
  )
}
