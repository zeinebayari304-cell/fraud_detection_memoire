import { useCallback, useEffect, useState } from 'react'

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
