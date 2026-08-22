import { useState } from 'react'
import { Link } from 'react-router-dom'
import { AuthLayout } from '../../../components/auth/AuthLayout'
import { useAuth, dashboardPath } from '../../../context/AuthContext'
import { notificationApi, userApi } from '../../../lib/api'

const preferenceLabels = {
  messages: 'Private messages',
  attendance: 'Attendance updates',
  progress: 'Progress updates',
  announcements: 'Announcements',
  batch: 'Batch changes',
}

export function AccountSettingsPage() {
  const { user, refreshUser } = useAuth()
  const [name, setName] = useState(user?.name ?? '')
  const [bio, setBio] = useState(user?.bio ?? '')
  const [photo, setPhoto] = useState(null)
  const [preferences, setPreferences] = useState(user?.notificationPreferences ?? {})
  const [notice, setNotice] = useState('')
  const [error, setError] = useState('')
  const [saving, setSaving] = useState(false)

  async function saveProfile(event) {
    event.preventDefault()
    setError('')
    setNotice('')
    setSaving(true)
    try {
      if (photo) await userApi.uploadProfilePicture(photo)
      await userApi.updateProfile({ name: name.trim(), bio: bio.trim() })
      await notificationApi.updatePreferences(preferences)
      await refreshUser()
      setPhoto(null)
      setNotice('Your account settings have been updated.')
    } catch (err) {
      setError(err.message ?? 'Could not update your account')
    } finally {
      setSaving(false)
    }
  }

  return (
    <AuthLayout title="Account settings" subtitle="Manage the name and profile information shown inside Tuturio.">
      {error && <div className="auth-error">{error}</div>}
      {notice && <div className="auth-info">{notice}</div>}
      <form onSubmit={saveProfile}>
        <div className="auth-field">
          <label htmlFor="settings-name">Display name</label>
          <input id="settings-name" value={name} onChange={(event) => setName(event.target.value)} maxLength="80" required />
        </div>
        <div className="auth-field">
          <label htmlFor="settings-bio">Short bio (optional)</label>
          <input id="settings-bio" value={bio} onChange={(event) => setBio(event.target.value)} maxLength="500" />
        </div>
        <div className="auth-field">
          <label htmlFor="profile-picture">Profile picture (optional)</label>
          {user?.profilePictureUrl && <img className="settings-avatar" src={user.profilePictureUrl} alt="Current profile" />}
          <input id="profile-picture" type="file" accept="image/jpeg,image/png,image/webp" onChange={(event) => setPhoto(event.target.files?.[0] ?? null)} />
          <span className="auth-hint">JPEG, PNG, or WEBP; maximum 5 MB.</span>
        </div>
        <div className="auth-field">
          <label>In-app notifications</label>
          <div className="pref-list">
            {Object.entries(preferenceLabels).map(([key, label]) => (
              <label className="pref-row" key={key}>
                <input
                  type="checkbox"
                  checked={preferences[key] !== false}
                  onChange={(event) => setPreferences((current) => ({ ...current, [key]: event.target.checked }))}
                />
                {label}
              </label>
            ))}
          </div>
        </div>
        <button type="submit" className="auth-btn" disabled={saving}>
          {saving ? 'Saving…' : 'Save settings'}
        </button>
      </form>
      <div className="auth-links">
        <Link to="/auth/forgot-password">Change password</Link>
        <br />
        <Link to={dashboardPath(user?.role)}>← Back to dashboard</Link>
      </div>
    </AuthLayout>
  )
}
