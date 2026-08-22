import { useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import { notificationApi } from '../../../lib/api'
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

  async function markAll() {
    await notificationApi.readAll()
    await load()
  }

  async function markOne(id) {
    await notificationApi.read(id)
    await load()
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
            Mark all read
          </button>
        </div>
      )}
      {embedded && (
        <div className="button-row mb-6">
          <button type="button" className="btn-outline" onClick={markAll}>
            Mark all read
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
          <p className="text-muted mt-4">No notifications yet.</p>
        ) : (
          <ul className="notification-feed mt-4">
            {items.map((n) => (
              <li key={n._id} className={n.isRead ? 'read' : 'unread'}>
                <div>
                  <strong>{n.title}</strong>
                  <p>{n.message}</p>
                  <small className="text-muted">{new Date(n.createdAt).toLocaleString()}</small>
                  {n.link && (
                    <p>
                      <Link to={n.link}>Open</Link>
                    </p>
                  )}
                </div>
                {!n.isRead && (
                  <button type="button" className="btn-outline btn-sm" onClick={() => markOne(n._id)}>
                    Mark read
                  </button>
                )}
              </li>
            ))}
          </ul>
        )}
      </section>
    </div>
  )
}
