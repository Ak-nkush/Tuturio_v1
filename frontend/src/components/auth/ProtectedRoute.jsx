import { Navigate, useLocation } from 'react-router-dom'
import { useAuth, dashboardPath } from '../../context/AuthContext'

export function ProtectedRoute({ children, allowedRoles }) {
  const { user, loading } = useAuth()
  const location = useLocation()

  if (loading) {
    return (
      <div className="auth-page">
        <main className="auth-main">
          <p className="auth-sub">Loading…</p>
        </main>
      </div>
    )
  }

  if (!user) {
    return <Navigate to="/auth/login" state={{ from: location.pathname }} replace />
  }

  if (allowedRoles && !allowedRoles.includes(user.role)) {
    return <Navigate to={dashboardPath(user.role)} replace />
  }

  return children
}
