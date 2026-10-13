import type { ReactNode } from 'react'
import { Navigate, useLocation } from 'react-router-dom'
import { useAuth } from '../providers/auth-context'

export function OnboardingGate({ children }: { children: ReactNode }) {
  const { user, loading } = useAuth()
  const { pathname } = useLocation()
  if (
    !loading &&
    user?.role === 'CANDIDATE' &&
    pathname !== '/onboarding' &&
    (user.onboardingStatus === 'NOT_STARTED' || user.onboardingStatus === 'IN_PROGRESS')
  ) {
    return <Navigate to="/onboarding" replace />
  }
  return children
}
