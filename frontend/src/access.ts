import type { Role, User } from './api'

/**
 * Pages accessibles par rôle (diagramme de cas d'utilisation).
 * L'administrateur a accès à toutes les pages ; l'analyste et l'expert
 * sont limités à leurs cas d'utilisation.
 * Le serveur applique les mêmes règles : ceci ne sert qu'à l'affichage.
 */
export const PAGE_ROLES: Record<string, Role[]> = {
  '/': ['analyste', 'expert', 'admin'],
  '/transaction': ['analyste', 'admin'],
  '/csv': ['analyste', 'admin'],
  '/transactions': ['analyste', 'admin'],
  '/history': ['analyste', 'expert', 'admin'],
  '/models': ['expert', 'admin'],
  '/robustness': ['expert', 'admin'],
  '/defense': ['expert', 'admin'],
  '/final-model': ['expert', 'admin'],
  '/users': ['admin'],
  '/audit': ['admin'],
  '/account': ['analyste', 'expert', 'admin'],
}

export const canAccess = (user: User | null, path: string) =>
  !!user && (PAGE_ROLES[path] ?? []).includes(user.role)
