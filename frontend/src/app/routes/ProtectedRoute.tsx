import { Link, Navigate, Outlet, useLocation } from 'react-router-dom'
import type { UserRole } from '../providers/auth-context'
import { useAuth } from '../providers/auth-context'

export function ProtectedRoute({ allowedRoles }: { allowedRoles: UserRole[] }) {
  const { user, loading, authError, refreshSession } = useAuth()
  const location = useLocation()

  if (loading)
    return (
      <p className="container inner-page" role="status">
        Đang kiểm tra phiên đăng nhập…
      </p>
    )

  if (!user && authError)
    return (
      <div className="container inner-page">
        <button className="button" onClick={() => void refreshSession()}>
          Thử lại
        </button>
        <Link
          to="/login"
          state={{ from: `${location.pathname}${location.search}` }}
          className="text-link"
        >
          Đến trang đăng nhập
        </Link>
      </div>
    )

  if (!user) {
    return (
      <Navigate to="/login" replace state={{ from: `${location.pathname}${location.search}` }} />
    )
  }

  if (!allowedRoles.includes(user.role)) {
    const destination =
      user.role === 'COMPANY_ADMIN'
        ? '/admin'
        : user.role === 'CANDIDATE'
          ? '/profile'
          : '/recruiter'
    return <Navigate to={destination} replace />
  }

  return <Outlet />
}
