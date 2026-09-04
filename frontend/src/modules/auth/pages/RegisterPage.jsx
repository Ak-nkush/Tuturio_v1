import { Navigate } from 'react-router-dom'

export function RegisterPage() {
  return <Navigate to="/auth/login" replace />
}
