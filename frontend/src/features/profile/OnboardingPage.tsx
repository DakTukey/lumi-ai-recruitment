import { Navigate } from 'react-router-dom'
import { useAuth } from '../../app/providers/auth-context'
import { ProfileEditor } from './ProfileEditor'

export function OnboardingPage() {
  const { user } = useAuth()
  if (user?.onboardingStatus === 'COMPLETED' || user?.onboardingStatus === 'SKIPPED')
    return <Navigate to="/" replace />
  return <ProfileEditor onboarding />
}
