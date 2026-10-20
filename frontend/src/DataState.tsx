import type { ReactNode } from 'react'

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
