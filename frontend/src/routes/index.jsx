import { BrowserRouter, Route, Routes } from 'react-router-dom'
import { ProtectedRoute } from '../components/auth/ProtectedRoute'
import { AuthProvider } from '../context/AuthContext'
import { ForgotPasswordPage } from '../modules/auth/pages/ForgotPasswordPage'
import { InvitePage } from '../modules/auth/pages/InvitePage'
import { LoginPage } from '../modules/auth/pages/LoginPage'
import { ResetPasswordPage } from '../modules/auth/pages/ResetPasswordPage'
import {
  ParentDashboardPage,
  StudentDashboardPage,
  TutorDashboardPage,
} from '../modules/dashboard/pages/DashboardPages'
import { LandingPage } from '../pages/LandingPage'

export function AppRoutes() {
  return (
    <BrowserRouter>
      <AuthProvider>
        <Routes>
          <Route path="/" element={<LandingPage />} />
          <Route path="/auth/login" element={<LoginPage />} />
          <Route path="/auth/forgot-password" element={<ForgotPasswordPage />} />
          <Route path="/auth/reset-password/:token" element={<ResetPasswordPage />} />
          <Route path="/invite/:code" element={<InvitePage />} />
          <Route
            path="/tutor/dashboard"
            element={
              <ProtectedRoute allowedRoles={['tutor']}>
                <TutorDashboardPage />
              </ProtectedRoute>
            }
          />
          <Route
            path="/student/dashboard"
            element={
              <ProtectedRoute allowedRoles={['student']}>
                <StudentDashboardPage />
              </ProtectedRoute>
            }
          />
          <Route
            path="/parent/dashboard"
            element={
              <ProtectedRoute allowedRoles={['parent']}>
                <ParentDashboardPage />
              </ProtectedRoute>
            }
          />
        </Routes>
      </AuthProvider>
    </BrowserRouter>
  )
}
