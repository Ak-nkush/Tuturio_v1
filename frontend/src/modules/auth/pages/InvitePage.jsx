import { useEffect, useState } from 'react'
import { Link, useNavigate, useParams } from 'react-router-dom'
import { AuthLayout } from '../../../components/auth/AuthLayout'
import { PasswordField } from '../../../components/auth/PasswordField'
import { useAuth, dashboardPath } from '../../../context/AuthContext'
import { inviteApi, validatePassword } from '../../../lib/api'

const reasonMessages = {
  expired: 'This invite has expired — ask your tutor for a new one.',
  used: 'This invite has already been used.',
  batch_unavailable: 'This batch is no longer available.',
  not_found: 'Invite not found. Check the link and try again.',
}

export function InvitePage() {
  const { code = '' } = useParams()
  const navigate = useNavigate()
  const { user, logout, refreshUser } = useAuth()

  const [inviteState, setInviteState] = useState({ status: 'loading' })
  const [wrongRole, setWrongRole] = useState(null)

  const [name, setName] = useState('')
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [confirmPassword, setConfirmPassword] = useState('')
  const [error, setError] = useState('')
  const [submitting, setSubmitting] = useState(false)

  useEffect(() => {
    inviteApi
      .get(code)
      .then((res) => setInviteState({ status: 'valid', invite: res.invite }))
      .catch((err) => {
        setInviteState({
          status: 'error',
          reason: err.reason ?? 'unknown',
          message: reasonMessages[err.reason ?? ''] ?? err.message,
        })
      })
  }, [code])

  useEffect(() => {
    if (inviteState.status !== 'valid' || !user) return
    if (user.role !== inviteState.invite.role) {
      setWrongRole({ current: user.role, expected: inviteState.invite.role })
    } else {
      setWrongRole(null)
    }
  }, [inviteState, user])

  async function handleRedeem(e, asExistingUser = false) {
    e.preventDefault()
    setError('')
    if (!asExistingUser) {
      if (name.trim().length < 2) {
        setError('Choose a username of at least 2 characters')
        return
      }
      if (password !== confirmPassword) {
        setError('Passwords do not match')
        return
      }
      const passwordError = validatePassword(password)
      if (passwordError) {
        setError(passwordError)
        return
      }
    }
    setSubmitting(true)

    try {
      const lockedEmail = inviteState.invite?.email
      const username = name.trim()
      const body = asExistingUser
        ? {}
        : lockedEmail
          ? { name: username, password }
          : { name: username, email: email.trim(), password }

      if (asExistingUser && user) {
        const res = await inviteApi.redeem(code, {})
        await refreshUser()
        navigate(dashboardPath(res.user.role), { replace: true })
        return
      }

      const res = await inviteApi.redeem(code, body)
      await refreshUser()
      navigate(dashboardPath(res.user.role), { replace: true })
    } catch (err) {
      if (err?.reason === 'wrong_role') {
        setWrongRole({
          current: err.currentRole ?? user?.role ?? '',
          expected: err.inviteRole ?? '',
        })
      } else {
        setError(err?.message ?? 'Could not redeem invite')
      }
    } finally {
      setSubmitting(false)
    }
  }

  async function handleLogoutAndContinue() {
    await logout()
    setWrongRole(null)
  }

  if (inviteState.status === 'loading') {
    return (
      <AuthLayout title="Checking invite…" subtitle="One moment.">
        <p className="auth-sub">Validating your link.</p>
      </AuthLayout>
    )
  }

  if (inviteState.status === 'error') {
    return (
      <AuthLayout title="Invite unavailable" subtitle={inviteState.message}>
        <div className="auth-links">
          <Link to="/auth/login">Log in instead</Link>
          <br />
          <Link to="/">← Back to home</Link>
        </div>
      </AuthLayout>
    )
  }

  const { invite } = inviteState
  const roleLabel = invite.role === 'student' ? 'Student' : 'Parent'

  if (wrongRole) {
    return (
      <AuthLayout
        title="Wrong account"
        subtitle={`You're logged in as ${wrongRole.current}. Log out to join as ${wrongRole.expected}.`}
      >
        <button type="button" className="auth-btn secondary" onClick={handleLogoutAndContinue}>
          Log out and continue
        </button>
        <div className="auth-links">
          <Link to={dashboardPath(wrongRole.current)}>Go to my dashboard</Link>
        </div>
      </AuthLayout>
    )
  }

  if (user && user.role === invite.role) {
    return (
      <AuthLayout
        title={`Join ${invite.batchName ?? 'batch'}`}
        subtitle={`You're logged in — tap below to join this batch as ${roleLabel.toLowerCase()}.`}
      >
        <span className={`role-badge ${invite.role}`}>Joining as {roleLabel}</span>
        {error && <div className="auth-error">{error}</div>}
        <button
          type="button"
          className="auth-btn"
          disabled={submitting}
          onClick={(e) => handleRedeem(e, true)}
        >
          {submitting ? 'Joining…' : 'Join this batch'}
        </button>
      </AuthLayout>
    )
  }

  const lockedEmail = invite.email

  return (
    <AuthLayout
      title={`Join ${invite.batchName ?? 'your batch'}`}
      subtitle={
        lockedEmail
          ? 'Choose a username and password. Your email is already set.'
          : 'Create your account to get started. No phone numbers shared.'
      }
    >
      <span className={`role-badge ${invite.role}`}>Joining as {roleLabel}</span>
      {error && <div className="auth-error">{error}</div>}

      <form onSubmit={(e) => handleRedeem(e, false)}>
        <div className="auth-field">
          <label htmlFor="username">Username</label>
          <input
            id="username"
            value={name}
            onChange={(e) => setName(e.target.value)}
            autoComplete="username"
            minLength={2}
            maxLength={80}
            required
          />
        </div>
        {lockedEmail ? (
          <div className="auth-field">
            <label>Email</label>
            <p className="auth-locked-value">{lockedEmail}</p>
          </div>
        ) : (
          <div className="auth-field">
            <label htmlFor="email">Email</label>
            <input id="email" type="email" value={email} onChange={(e) => setEmail(e.target.value)} required />
          </div>
        )}
        <PasswordField value={password} onChange={setPassword} />
        <PasswordField
          id="confirm-password"
          label="Confirm password"
          value={confirmPassword}
          onChange={setConfirmPassword}
          showStrength={false}
        />
        <button type="submit" className="auth-btn" disabled={submitting}>
          {submitting ? 'Creating account…' : 'Create account & join'}
        </button>
      </form>

      <div className="auth-links">
        Already have an account? <Link to="/auth/login">Log in</Link>
      </div>
    </AuthLayout>
  )
}
