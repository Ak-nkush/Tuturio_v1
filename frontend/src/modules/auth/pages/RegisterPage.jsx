import { useState } from 'react'
import { Link, Navigate, useNavigate } from 'react-router-dom'
import { AuthLayout } from '../../../components/auth/AuthLayout'
import { PasswordField } from '../../../components/auth/PasswordField'
import { useAuth, dashboardPath } from '../../../context/AuthContext'
import { validatePassword } from '../../../lib/api'

export function RegisterPage() {
  const { user, register } = useAuth()
  const navigate = useNavigate()

  const [name, setName] = useState('')
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [error, setError] = useState('')
  const [submitting, setSubmitting] = useState(false)

  if (user) {
    return <Navigate to={dashboardPath(user.role)} replace />
  }

  async function handleSubmit(e) {
    e.preventDefault()
    setError('')

    const passwordError = validatePassword(password)
    if (passwordError) {
      setError(passwordError)
      return
    }

    setSubmitting(true)
    try {
      const created = await register({ name: name.trim(), email: email.trim(), password })
      navigate(dashboardPath(created.role), { replace: true })
    } catch (err) {
      setError(err?.message || 'Could not create account')
    } finally {
      setSubmitting(false)
    }
  }

  return (
    <AuthLayout
      title="Tuturio"
      subtitle="Create a tutor account to run batches, attendance, and progress."
      variant="login"
    >
      {error && <div className="auth-error">{error}</div>}

      <form className="login-form" onSubmit={handleSubmit}>
        <div className="auth-field">
          <label htmlFor="name">Full name</label>
          <input
            id="name"
            value={name}
            onChange={(e) => setName(e.target.value)}
            autoComplete="name"
            required
          />
        </div>
        <div className="auth-field">
          <label htmlFor="email">Email</label>
          <input
            id="email"
            type="email"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            autoComplete="email"
            required
          />
        </div>
        <PasswordField id="register-password" value={password} onChange={setPassword} />
        <button type="submit" className="auth-btn" disabled={submitting}>
          {submitting ? 'Creating account…' : 'Create tutor account'}
        </button>
      </form>

      <div className="auth-links login-create">
        Already have an account? <Link to="/auth/login">Log in</Link>
        <br />
        Student or parent? Ask your tutor for an invite
        <br />
        <Link to="/">Back to home</Link>
      </div>
    </AuthLayout>
  )
}
