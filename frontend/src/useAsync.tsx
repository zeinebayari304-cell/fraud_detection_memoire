import { useCallback, useEffect, useState, type ReactNode } from 'react'

type AsyncState<T> = {
  data: T | null
  error: string
  loading: boolean
  reload: () => void
}

/** Charge des données depuis l'API ; `refreshMs` active un rafraîchissement. */
export function useAsync<T>(
  fetcher: () => Promise<T>,
  deps: unknown[] = [],
  refreshMs = 0
): AsyncState<T> {
  const [data, setData] = useState<T | null>(null)
  const [error, setError] = useState('')
  const [loading, setLoading] = useState(true)
  const [tick, setTick] = useState(0)

  const reload = useCallback(() => setTick((value) => value + 1), [])

  useEffect(() => {
    let cancelled = false

    fetcher()
      .then((result) => {
        if (cancelled) return
        setData(result)
        setError('')
      })
      .catch((err: unknown) => {
        if (cancelled) return
        setError(err instanceof Error ? err.message : 'Erreur de chargement.')
      })
      .finally(() => {
        if (!cancelled) setLoading(false)
      })

    return () => {
      cancelled = true
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [...deps, tick])

  useEffect(() => {
    if (!refreshMs) return
    const timer = window.setInterval(reload, refreshMs)
    return () => window.clearInterval(timer)
  }, [refreshMs, reload])

  return { data, error, loading, reload }
}

type StateProps = {
  loading: boolean
  error: string
  hasData: boolean
  onRetry: () => void
  children: ReactNode
}

/** Affiche chargement / erreur / contenu pour une page alimentée par l'API. */
export function DataState({
  loading,
  error,
  hasData,
  onRetry,
  children,
}: StateProps) {
  if (!hasData && loading) {
    return (
      <section className="panel">
        <p style={{ color: '#93a9c1' }}>Chargement des données…</p>
      </section>
    )
  }

  if (!hasData) {
    return (
      <section className="panel">
        <div className="analysis-error" role="alert">
          {error || 'Aucune donnée disponible.'}
        </div>
        <div style={{ marginTop: 18 }}>
          <button
            type="button"
            className="bank-button secondary"
            onClick={onRetry}
          >
            Réessayer
          </button>
        </div>
      </section>
    )
  }

  return <>{children}</>
}

export const MODEL_COLORS: Record<string, string> = {
  'Random Forest': '#60a5fa',
  XGBoost: '#2dd4bf',
  LightGBM: '#a78bfa',
  'SVM linéaire': '#fbbf24',
  'Régression logistique': '#fb7185',
}

export const colorOf = (model: string) => MODEL_COLORS[model] ?? '#94a3b8'

export const fmt = (value: number | null | undefined, digits = 1) =>
  value === null || value === undefined
    ? '—'
    : value.toLocaleString('fr-FR', {
        minimumFractionDigits: digits,
        maximumFractionDigits: digits,
      })

export const fmtInt = (value: number | null | undefined) =>
  value === null || value === undefined ? '—' : value.toLocaleString('fr-FR')
