import { useEffect, useState } from 'react'
import { Link, Navigate } from 'react-router-dom'
import { useAuth, dashboardPath } from '../../../context/AuthContext'
import { notificationApi, userApi } from '../../../lib/api'
import '../../../styles/dashboard.css'
import '../../../styles/auth.css'

const preferenceLabels = {
  messages: 'Private messages',
  attendance: 'Attendance updates',
  progress: 'Progress updates',
  announcements: 'Announcements',
  batch: 'Batch changes',
}

const examples = {
  tutor: {
    name: 'Ananya Sharma',
    bio: 'Physics for grades 9–12. Board exams and JEE foundation, weekday evenings.',
  },
  student: {
    name: 'Aarav Mehta',
    bio: 'Grade 10. Algebra and geometry with the evening batch.',
  },
  parent: {
    name: 'Priya Mehta',
    bio: 'Parent of Aarav. I follow attendance, notes, and weekly scores here.',
  },
}

export function AccountSettingsRedirect() {
  const { user } = useAuth()
  if (user?.role === 'tutor') return <Navigate to="/tutor/dashboard/settings" replace />
  return <AccountSettingsPage />
}

export function AccountSettingsPage() {
  const { user, refreshUser } = useAuth()
  const sample = examples[user?.role] ?? examples.student
  const [name, setName] = useState(user?.name ?? '')
  const [bio, setBio] = useState(user?.bio ?? '')
  const [photo, setPhoto] = useState(null)
  const [preferences, setPreferences] = useState(user?.notificationPreferences ?? {})
  const [notice, setNotice] = useState('')
  const [error, setError] = useState('')
  const [saving, setSaving] = useState(false)

  useEffect(() => {
    setName(user?.name ?? '')
    setBio(user?.bio ?? '')
    setPreferences(user?.notificationPreferences ?? {})
  }, [user])

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

  const form = (
    <div className="settings-page">
      <div className="dashboard-header dashboard-hero">
        <div>
          <span className="eyebrow">Your profile</span>
          <h1>Account settings</h1>
          <p>This name and photo are shown to people in your batches. Notification choices only apply inside Tuturio.</p>
        </div>
      </div>
      {error && <div className="alert error">{error}</div>}
      {notice && <div className="alert success">{notice}</div>}
      <form className="premium-card settings-form" onSubmit={saveProfile}>
        <div className="auth-field">
          <label htmlFor="settings-name">Display name</label>
          <input
            id="settings-name"
            value={name}
            onChange={(event) => setName(event.target.value)}
            placeholder={sample.name}
            maxLength="80"
            required
          />
        </div>
        <div className="auth-field">
          <label htmlFor="settings-bio">Short bio (optional)</label>
          <textarea
            id="settings-bio"
            value={bio}
            onChange={(event) => setBio(event.target.value)}
            placeholder={sample.bio}
            maxLength="500"
            rows="3"
          />
        </div>
        <div className="auth-field">
          <label htmlFor="profile-picture">Profile picture (optional)</label>
          {user?.profilePictureUrl && (
            <img className="settings-avatar" src={user.profilePictureUrl} alt="Current profile" />
          )}
          <input
            id="profile-picture"
            type="file"
            accept="image/jpeg,image/png,image/webp"
            onChange={(event) => setPhoto(event.target.files?.[0] ?? null)}
          />
          <span className="auth-hint">JPEG, PNG, or WEBP; maximum 5 MB. A clear face photo works best.</span>
        </div>
        <fieldset className="settings-prefs">
          <legend>In-app notifications</legend>
          <div className="pref-list">
            {Object.entries(preferenceLabels).map(([key, label]) => (
              <label className="pref-row" key={key}>
                <input
                  type="checkbox"
                  checked={preferences[key] !== false}
                  onChange={(event) =>
                    setPreferences((current) => ({ ...current, [key]: event.target.checked }))
                  }
                />
                <span>{label}</span>
              </label>
            ))}
          </div>
        </fieldset>
        <button type="submit" className="btn-primary" disabled={saving}>
          {saving ? 'Saving…' : 'Save settings'}
        </button>
      </form>
      <div className="settings-links">
        <Link to="/auth/forgot-password">Change password</Link>
        {user?.role !== 'tutor' && (
          <Link to={dashboardPath(user?.role)}>← Back to dashboard</Link>
        )}
      </div>
    </div>
  )

  if (user?.role === 'tutor') return form

  return (
    <div className="dashboard-layout">
      <main className="dashboard-main">
        <div className="dashboard-content-wrap">{form}</div>
      </main>
    </div>
  )
}
