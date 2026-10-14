import { ArrowLeft } from 'lucide-react'
import { useEffect } from 'react'
import { BrowserRouter, Link, Route, Routes, useLocation } from 'react-router-dom'
import { AdminPage } from '../features/admin/AdminPage'
import { ApplicationsPage } from '../features/applications/pages/ApplicationsPage'
import { AuthPage } from '../features/auth/AuthPage'
import { AboutPage } from '../features/company/pages/AboutPage'
import { HiringProcessPage } from '../features/company/pages/HiringProcessPage'
import { ExplorePage } from '../features/jobs/pages/ExplorePage'
import { JobDetailPage } from '../features/jobs/pages/JobDetailPage'
import { RecruiterPage } from '../features/jobs/pages/RecruiterPage'
import { OnboardingPage } from '../features/profile/OnboardingPage'
import { ProfilePage } from '../features/profile/pages/ProfilePage'
import { CvBuilderPage } from '../features/resumes/CvBuilderPage'
import { SettingsPage } from '../features/settings/SettingsPage'
import { PublicLayout } from '../layouts/PublicLayout'
import { AuthProvider } from './providers/AuthProvider'
import { SavedJobsProvider } from './providers/SavedJobsProvider'
import { OnboardingGate } from './routes/OnboardingGate'
import { ProtectedRoute } from './routes/ProtectedRoute'
function ScrollToTop() {
  const { pathname } = useLocation()
  useEffect(() => {
    window.scrollTo(0, 0)
  }, [pathname])
  return null
}
export default function App() {
  return (
    <BrowserRouter>
      <AuthProvider>
        <SavedJobsProvider>
          <ScrollToTop />
          <Routes>
            <Route element={<ProtectedRoute allowedRoles={['CANDIDATE']} />}>
              <Route path="onboarding" element={<OnboardingPage />} />
            </Route>
            <Route
              element={
                <OnboardingGate>
                  <PublicLayout />
                </OnboardingGate>
              }
            >
              <Route index element={<ExplorePage key="explore" />} />
              <Route path="jobs/:jobId" element={<JobDetailPage />} />
              <Route path="about" element={<AboutPage />} />
              <Route path="hiring-process" element={<HiringProcessPage />} />
              <Route path="login" element={<AuthPage />} />
              <Route element={<ProtectedRoute allowedRoles={['CANDIDATE']} />}>
                <Route path="saved" element={<ExplorePage key="saved" savedOnly />} />
                <Route path="profile" element={<ProfilePage />} />
                <Route path="settings" element={<SettingsPage />} />
                <Route path="cv-builder" element={<CvBuilderPage />} />
                <Route path="applications" element={<ApplicationsPage />} />
              </Route>
              <Route
                path="*"
                element={
                  <div className="container empty-state inner-page">
                    <h1>Trang này đang ở một nơi khác.</h1>
                    <Link className="button" to="/">
                      <ArrowLeft size={17} />
                      Về trang tìm việc
                    </Link>
                  </div>
                }
              />
            </Route>
            <Route element={<ProtectedRoute allowedRoles={['RECRUITER', 'COMPANY_ADMIN']} />}>
              <Route path="recruiter/*" element={<RecruiterPage />} />
            </Route>
            <Route element={<ProtectedRoute allowedRoles={['COMPANY_ADMIN']} />}>
              <Route path="admin/*" element={<AdminPage />} />
            </Route>
          </Routes>
        </SavedJobsProvider>
      </AuthProvider>
    </BrowserRouter>
  )
}
