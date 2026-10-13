import { createContext, useContext } from 'react'
import type { User } from '../../types/domain'
export type { UserRole } from '../../types/domain'

export type AuthUser = User & {
  name: string
}

type SignInResult = { ok: true; user: AuthUser } | { ok: false; message: string }

type AuthState = {
  user: AuthUser | null
  loading: boolean
  authError: string
  isSigningOut: boolean
  refreshSession: () => Promise<void>
  updateProfileUser: (profile: Pick<User, 'fullName' | 'onboardingStatus'>) => void
  signIn: (email: string, password: string) => Promise<SignInResult>
  signUp: (email: string, password: string, fullName: string) => Promise<SignInResult>
  signOut: () => Promise<void>
}

export const AuthContext = createContext<AuthState | null>(null)

export function useAuth() {
  const context = useContext(AuthContext)

  if (!context) {
    throw new Error('AuthProvider is required')
  }

  return context
}
