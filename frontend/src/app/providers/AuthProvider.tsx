import { useCallback, useEffect, useState } from 'react'
import type { ReactNode } from 'react'
import { AuthContext } from './auth-context'
import type { AuthUser } from './auth-context'
import { ApiError } from '../../services/api'
import * as authService from '../../services/auth.service'
import type { User } from '../../types/domain'

const toAuthUser = (user: User): AuthUser => ({ ...user, name: user.fullName })

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<AuthUser | null>(null)
  const [loading, setLoading] = useState(true)
  const [authError, setAuthError] = useState('')
  const [isSigningOut, setIsSigningOut] = useState(false)

  const refreshSession = useCallback(async () => {
    setLoading(true)
    setAuthError('')
    try {
      setUser(toAuthUser(await authService.getMe()))
    } catch (error) {
      if (error instanceof ApiError && error.status === 401) setUser(null)
      else setAuthError('Không thể kiểm tra phiên đăng nhập. Vui lòng thử lại.')
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => {
    let active = true
    authService
      .getMe()
      .then((account) => {
        if (active) setUser(toAuthUser(account))
      })
      .catch((error: unknown) => {
        if (active && !(error instanceof ApiError && error.status === 401)) {
          setAuthError('Không thể kiểm tra phiên đăng nhập. Vui lòng thử lại.')
        }
      })
      .finally(() => {
        if (active) setLoading(false)
      })
    const expire = () => {
      setUser(null)
      setAuthError('Phiên đăng nhập đã hết hạn. Vui lòng đăng nhập lại.')
    }
    window.addEventListener('lumi-session-expired', expire)
    return () => {
      active = false
      window.removeEventListener('lumi-session-expired', expire)
    }
  }, [])

  const signIn = async (email: string, password: string) => {
    setAuthError('')
    try {
      const response = await authService.login({ email: email.trim(), password })
      const nextUser = toAuthUser(response.user)
      setUser(nextUser)
      return { ok: true as const, user: nextUser }
    } catch (error) {
      if (error instanceof ApiError && error.status === 401) setUser(null)
      return {
        ok: false as const,
        message:
          error instanceof ApiError
            ? error.errors?.map((item) => item.message).join(' ') || error.message
            : 'Không thể đăng nhập. Vui lòng thử lại.',
      }
    }
  }

  const signUp = async (email: string, password: string, fullName: string) => {
    setAuthError('')
    try {
      const response = await authService.register(email.trim(), password, fullName.trim())
      const nextUser = toAuthUser(response.user)
      setUser(nextUser)
      return { ok: true as const, user: nextUser }
    } catch (error) {
      return {
        ok: false as const,
        message:
          error instanceof ApiError
            ? error.errors?.map((item) => item.message).join(' ') || error.message
            : 'Không thể đăng ký. Vui lòng thử lại.',
      }
    }
  }

  const signOut = async () => {
    if (isSigningOut) return
    setIsSigningOut(true)
    setAuthError('')
    try {
      await authService.logout()
      setUser(null)
    } catch (error) {
      if (error instanceof ApiError && error.status === 401) setUser(null)
      else setAuthError('Chưa thể đăng xuất. Vui lòng kiểm tra kết nối và thử lại.')
    } finally {
      setIsSigningOut(false)
    }
  }

  const updateProfileUser = (profile: Pick<User, 'fullName' | 'onboardingStatus'>) => {
    setUser((current) => (current ? { ...current, ...profile, name: profile.fullName } : current))
  }

  return (
    <AuthContext.Provider
      value={{
        user,
        loading,
        authError,
        isSigningOut,
        refreshSession,
        updateProfileUser,
        signIn,
        signUp,
        signOut,
      }}
    >
      {authError && (
        <div className="container auth-session-error" role="alert">
          {authError}
        </div>
      )}
      {children}
    </AuthContext.Provider>
  )
}
