/** Mise en forme partagée : couleurs des modèles, nombres, dates. */

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

/** Date absolue (détails) : 20/10/2026 14:05. */
export const formatDateTime = (iso: string | null | undefined) =>
  iso
    ? new Date(iso).toLocaleString('fr-FR', {
        day: '2-digit', month: '2-digit', year: 'numeric', hour: '2-digit', minute: '2-digit',
      })
    : '—'

/** Date relative (listes) : « il y a 5 min ». */
export function relativeTime(iso: string | null | undefined): string {
  if (!iso) return '—'
  const seconds = Math.round((Date.now() - new Date(iso).getTime()) / 1000)
  if (seconds < 60) return `il y a ${Math.max(seconds, 0)} s`
  const minutes = Math.round(seconds / 60)
  if (minutes < 60) return `il y a ${minutes} min`
  const hours = Math.round(minutes / 60)
  if (hours < 24) return `il y a ${hours} h`
  const days = Math.round(hours / 24)
  return days < 30 ? `il y a ${days} j` : formatDateTime(iso)
}
