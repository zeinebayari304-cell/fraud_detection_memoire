import { createContext, useContext } from 'react'
import type { TokenResponse, User, registerRequest } from './api'

export type AuthState = {
  user: User | null
  /** true tant que la session existante est en cours de vérification. */
  checking: boolean
  /** Message affiché sur la page de connexion après une expiration. */
  notice: string
  login: (identifier: string, password: string) => Promise<User>
  register: (data: Parameters<typeof registerRequest>[0]) => Promise<User>
  logout: () => Promise<void>
  applySession: (response: TokenResponse) => void
}

export const AuthContext = createContext<AuthState | null>(null)

export function useAuth(): AuthState {
  const context = useContext(AuthContext)
  if (!context) throw new Error('useAuth doit être utilisé dans <AuthProvider>.')
  return context
}
