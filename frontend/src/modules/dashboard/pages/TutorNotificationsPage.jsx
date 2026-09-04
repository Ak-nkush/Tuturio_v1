import { useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import { notificationApi, formatDateTime } from '../../../lib/api'
import '../../../styles/dashboard.css'

const PREF_LABELS = {
  messages: 'Private messages',
  attendance: 'Attendance updates',
  progress: 'Progress scores',
  announcements: 'Batch announcements',
  batch: 'Other batch events',
}

export function TutorNotificationsPage({ embedded = false }) {
  const [items, setItems] = useState([])
  const [prefs, setPrefs] = useState(null)
  const [error, setError] = useState('')

  async function load() {
    const [list, prefRes] = await Promise.all([notificationApi.list(), notificationApi.preferences()])
    setItems(list.notifications ?? [])
    setPrefs(prefRes.preferences)
  }

  useEffect(() => {
    load().catch((err) => setError(err.message))
  }, [])

  async function openNotification(note) {
    await notificationApi.read(note._id)
    setItems((current) => current.filter((item) => item._id !== note._id))
  }

  async function markAll() {
    await notificationApi.readAll()
    setItems([])
  }

  async function togglePref(key) {
    const next = { ...prefs, [key]: !prefs[key] }
    setPrefs(next)
    await notificationApi.updatePreferences({ [key]: next[key] })
  }

  return (
    <div>
      {!embedded && (
        <div className="dashboard-header section-heading">
          <div>
            <span className="eyebrow">Alerts</span>
            <h1>Notifications</h1>
            <p>View events and choose what you want to receive.</p>
          </div>
          <button type="button" className="btn-outline" onClick={markAll}>
            Clear all
          </button>
        </div>
      )}
      {embedded && (
        <div className="dashboard-header section-heading">
          <div>
            <span className="eyebrow">Alerts</span>
            <h1>Notifications</h1>
            <p>View events and choose what you want to receive.</p>
          </div>
          <button type="button" className="btn-outline" onClick={markAll}>
            Clear all
          </button>
        </div>
      )}
      {error && <div className="alert error">{error}</div>}

      <section className="premium-card mb-6">
        <h2>Preferences</h2>
        {prefs && (
          <div className="pref-list mt-4">
            {Object.keys(PREF_LABELS).map((key) => (
              <label key={key} className="pref-row">
                <input type="checkbox" checked={Boolean(prefs[key])} onChange={() => togglePref(key)} />
                {PREF_LABELS[key]}
              </label>
            ))}
          </div>
        )}
      </section>

      <section className="premium-card">
        <h2>Inbox</h2>
        {items.length === 0 ? (
          <p className="text-muted mt-4">No new notifications.</p>
        ) : (
          <ul className="notification-feed mt-4">
            {items.map((n) => (
              <li key={n._id} className="unread">
                <div>
                  <strong>{n.title}</strong>
                  <p>{n.message}</p>
                  <small className="text-muted">{formatDateTime(n.createdAt)}</small>
                </div>
                <div className="table-actions">
                  {n.link && (
                    <Link
                      className="btn-outline btn-sm"
                      to={n.link}
                      onClick={() => openNotification(n)}
                    >
                      Open
                    </Link>
                  )}
                  <button type="button" className="btn-outline btn-sm" onClick={() => openNotification(n)}>
                    Dismiss
                  </button>
                </div>
              </li>
            ))}
          </ul>
        )}
      </section>
    </div>
  )
}
