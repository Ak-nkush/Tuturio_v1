import { useState } from 'react'
import { Link } from 'react-router-dom'
import { AuthLayout } from '../../../components/auth/AuthLayout'
import { authApi } from '../../../lib/api'

export function ForgotPasswordPage() {
  const [email, setEmail] = useState('')
  const [message, setMessage] = useState('')
  const [submitting, setSubmitting] = useState(false)

  async function handleSubmit(e) {
    e.preventDefault()
    setSubmitting(true)
    try {
      const res = await authApi.forgotPassword(email.trim())
      setMessage(res.message)
    } catch (err) {
      setMessage(err?.message ?? 'Something went wrong')
    } finally {
      setSubmitting(false)
    }
  }

  return (
    <AuthLayout title="Reset password" subtitle="We'll email a link if that address is registered.">
      {message && <div className="auth-info">{message}</div>}

      <form onSubmit={handleSubmit}>
        <div className="auth-field">
          <label htmlFor="email">Email</label>
          <input
            id="email"
            type="email"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            required
          />
        </div>
        <button type="submit" className="auth-btn" disabled={submitting}>
          {submitting ? 'Sending…' : 'Send reset link'}
        </button>
      </form>

      <div className="auth-links">
        <Link to="/auth/login">← Back to login</Link>
      </div>
    </AuthLayout>
  )
}
