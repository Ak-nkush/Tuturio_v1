import { useState } from 'react'
import { Link, Navigate, useLocation, useNavigate } from 'react-router-dom'
import { AuthLayout } from '../../../components/auth/AuthLayout'
import { PasswordField } from '../../../components/auth/PasswordField'
import { useAuth, dashboardPath } from '../../../context/AuthContext'

export function LoginPage() {
  const { user, login } = useAuth()
  const navigate = useNavigate()
  const location = useLocation()
  const from = location.state?.from

  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [error, setError] = useState('')
  const [submitting, setSubmitting] = useState(false)

  if (user) {
    return <Navigate to={from ?? dashboardPath(user.role)} replace />
  }

  async function handleSubmit(e) {
    e.preventDefault()
    setError('')
    setSubmitting(true)
    try {
      const loggedIn = await login(email.trim(), password)
      navigate(from ?? dashboardPath(loggedIn.role), { replace: true })
    } catch (err) {
      if (err?.reason === 'account_archived') {
        setError('Your access has been paused by your tutor.')
      } else {
        setError(err?.message || 'Login failed')
      }
    } finally {
      setSubmitting(false)
    }
  }

  return (
    <AuthLayout
      title="Tuturio"
      subtitle="Unleash your academic success with Tuturio's focused learning space."
      variant="login"
    >
      {error && <div className="auth-error">{error}</div>}

      <form className="login-form" onSubmit={handleSubmit}>
        <div className="auth-field">
          <label htmlFor="email">Username or email</label>
          <input
            id="email"
            type="email"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            autoComplete="email"
            required
          />
        </div>

        <PasswordField
          id="login-password"
          value={password}
          onChange={setPassword}
          showStrength={false}
        />

        <div className="login-forgot">
          <Link to="/auth/forgot-password">Forgot password?</Link>
        </div>

        <button type="submit" className="auth-btn" disabled={submitting}>
          {submitting ? 'Signing in…' : 'Sign in'}
        </button>
      </form>

      <div className="auth-links login-create">
        Are you new? <span>Ask your tutor for an invite</span>
        <br />
        New tutor? <Link to="/auth/register">Create your tutor account</Link>
        <br />
        <Link to="/">Back to home</Link>
      </div>
    </AuthLayout>
  )
}
