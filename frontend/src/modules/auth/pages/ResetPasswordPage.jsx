import { useState } from 'react'
import { Link, useNavigate, useParams } from 'react-router-dom'
import { AuthLayout } from '../../../components/auth/AuthLayout'
import { PasswordField } from '../../../components/auth/PasswordField'
import { authApi, validatePassword } from '../../../lib/api'

export function ResetPasswordPage() {
  const { token = '' } = useParams()
  const navigate = useNavigate()
  const [password, setPassword] = useState('')
  const [confirm, setConfirm] = useState('')
  const [error, setError] = useState('')
  const [submitting, setSubmitting] = useState(false)

  async function handleSubmit(e) {
    e.preventDefault()
    setError('')

    const passwordError = validatePassword(password)
    if (passwordError) {
      setError(passwordError)
      return
    }
    if (password !== confirm) {
      setError('Passwords do not match')
      return
    }

    setSubmitting(true)
    try {
      await authApi.resetPassword(token, password)
      navigate('/auth/login', {
        replace: true,
        state: { message: 'Password updated. Log in with your new password.' },
      })
    } catch (err) {
      if (err?.reason === 'expired') {
        setError('This link expired — request a new one below.')
      } else {
        setError(err?.message ?? 'Reset failed')
      }
    } finally {
      setSubmitting(false)
    }
  }

  return (
    <AuthLayout title="Choose a new password" subtitle="Must be at least 8 characters.">
      {error && <div className="auth-error">{error}</div>}

      <form onSubmit={handleSubmit}>
        <PasswordField value={password} onChange={setPassword} />
        <div className="auth-field">
          <label htmlFor="confirm">Confirm password</label>
          <input
            id="confirm"
            type="password"
            value={confirm}
            onChange={(e) => setConfirm(e.target.value)}
            required
          />
        </div>
        <button type="submit" className="auth-btn" disabled={submitting}>
          {submitting ? 'Saving…' : 'Update password'}
        </button>
      </form>

      <div className="auth-links">
        <Link to="/auth/forgot-password">Request a new link</Link>
      </div>
    </AuthLayout>
  )
}
