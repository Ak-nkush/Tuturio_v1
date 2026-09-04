import { useEffect, useState } from 'react'
import { Link, Navigate } from 'react-router-dom'
import { useAuth } from '../../../context/AuthContext'
import { userApi } from '../../../lib/api'
import '../../../styles/dashboard.css'
import '../../../styles/auth.css'

export function AccountSettingsRedirect() {
  const { user } = useAuth()
  if (user?.role === 'tutor') return <Navigate to="/tutor/dashboard/settings" replace />
  if (user?.role === 'parent') return <Navigate to="/parent/dashboard/settings" replace />
  if (user?.role === 'student') return <Navigate to="/student/dashboard/settings" replace />
  return <AccountSettingsPage />
}

export function AccountSettingsPage() {
  const { user, refreshUser } = useAuth()
  const [name, setName] = useState(user?.name ?? '')
  const [bio, setBio] = useState(user?.bio ?? '')
  const [notice, setNotice] = useState('')
  const [error, setError] = useState('')
  const [saving, setSaving] = useState(false)

  useEffect(() => {
    setName(user?.name ?? '')
    setBio(user?.bio ?? '')
  }, [user])

  async function saveProfile(event) {
    event.preventDefault()
    setError('')
    setNotice('')
    setSaving(true)
    try {
      await userApi.updateProfile({ name: name.trim(), bio: bio.trim() })
      await refreshUser()
      setNotice('Your account settings have been updated.')
    } catch (err) {
      setError(err.message ?? 'Could not update your account')
    } finally {
      setSaving(false)
    }
  }

  return (
    <div className="settings-page">
      <div className="dashboard-header dashboard-hero">
        <div>
          <span className="eyebrow">Your profile</span>
          <h1>Account settings</h1>
          <p>This name is shown to people in your batches.</p>
        </div>
      </div>
      {error && <div className="alert error">{error}</div>}
      {notice && <div className="alert success">{notice}</div>}
      <form className="premium-card settings-form" onSubmit={saveProfile}>
        <div className="auth-field">
          <label htmlFor="settings-name">Username</label>
          <input
            id="settings-name"
            className="form-input"
            value={name}
            onChange={(event) => setName(event.target.value)}
            placeholder="Your name"
            maxLength="80"
            required
          />
        </div>
        <div className="auth-field">
          <label htmlFor="settings-bio">Short bio (optional)</label>
          <textarea
            id="settings-bio"
            className="form-input"
            value={bio}
            onChange={(event) => setBio(event.target.value)}
            placeholder="A short note about you (optional)"
            maxLength="500"
            rows="3"
          />
        </div>
        <div className="settings-actions">
          <button type="submit" className="btn-primary" disabled={saving}>
            {saving ? 'Saving…' : 'Save settings'}
          </button>
          <Link className="btn-outline" to="/auth/forgot-password">
            Change password
          </Link>
        </div>
      </form>
    </div>
  )
}
