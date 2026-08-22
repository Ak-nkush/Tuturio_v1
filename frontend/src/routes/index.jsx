import { BrowserRouter, Route, Routes } from 'react-router-dom'
import { ProtectedRoute } from '../components/auth/ProtectedRoute'
import { AuthProvider } from '../context/AuthContext'
import { SocketProvider } from '../context/SocketContext'
import { ForgotPasswordPage } from '../modules/auth/pages/ForgotPasswordPage'
import { InvitePage } from '../modules/auth/pages/InvitePage'
import { LoginPage } from '../modules/auth/pages/LoginPage'
import { ResetPasswordPage } from '../modules/auth/pages/ResetPasswordPage'
import { RegisterPage } from '../modules/auth/pages/RegisterPage'
import { AccountSettingsPage } from '../modules/auth/pages/AccountSettingsPage'
import { BatchDetailsPage } from '../modules/dashboard/pages/BatchDetailsPage'
import { SessionWorkspacePage } from '../modules/dashboard/pages/SessionWorkspacePage'
import { TutorChatPage } from '../modules/dashboard/pages/TutorChatPage'
import { TutorNotificationsPage } from '../modules/dashboard/pages/TutorNotificationsPage'
import { TutorSubjectsPage } from '../modules/dashboard/pages/TutorSubjectsPage'
import {
  ParentDashboardPage,
  StudentDashboardPage,
  TutorAnalyticsPage,
  TutorBatchesPage,
  TutorDashboardShell,
  TutorOverviewPage,
  TutorStudentsPage,
} from '../modules/dashboard/pages/DashboardAppPages'
import { LandingPage } from '../pages/LandingPage'

export function AppRoutes() {
  return (
    <BrowserRouter>
      <AuthProvider>
        <SocketProvider>
          <Routes>
          <Route path="/" element={<LandingPage />} />
          <Route path="/auth/login" element={<LoginPage />} />
          <Route path="/auth/register" element={<RegisterPage />} />
          <Route path="/auth/forgot-password" element={<ForgotPasswordPage />} />
          <Route path="/auth/reset-password/:token" element={<ResetPasswordPage />} />
          <Route path="/invite/:code" element={<InvitePage />} />
          <Route
            path="/account/settings"
            element={
              <ProtectedRoute>
                <AccountSettingsPage />
              </ProtectedRoute>
            }
          />
          <Route
            path="/tutor/dashboard"
            element={
              <ProtectedRoute allowedRoles={['tutor']}>
                <TutorDashboardShell />
              </ProtectedRoute>
            }>
            <Route index element={<TutorOverviewPage />} />
            <Route path="batches" element={<TutorBatchesPage />} />
            <Route path="batches/:batchId" element={<BatchDetailsPage />} />
            <Route path="subjects" element={<TutorSubjectsPage />} />
            <Route path="students" element={<TutorStudentsPage />} />
            <Route path="chat" element={<TutorChatPage />} />
            <Route path="notifications" element={<TutorNotificationsPage />} />
            <Route path="analytics" element={<TutorAnalyticsPage />} />
            <Route path="sessions/:sessionId" element={<SessionWorkspacePage />} />
          </Route>
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
        </SocketProvider>
      </AuthProvider>
    </BrowserRouter>
  )
}
