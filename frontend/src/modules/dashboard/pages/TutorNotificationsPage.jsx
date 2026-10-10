import { useEffect, useState } from 'react'
import { useSocket } from '../../../context/SocketContext'
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
  const socket = useSocket()
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

  useEffect(() => {
    if (!socket) return
    const onNew = () => load().catch(() => {})
    socket.on('notification:new', onNew)
    return () => {
      socket.off('notification:new', onNew)
    }
  }, [socket])

  async function markRead(id) {
    try {
      await notificationApi.read(id)
      setItems((current) =>
        current.map((item) => (item._id === id ? { ...item, isRead: true } : item))
      )
    } catch (err) {
      setError(err.message)
    }
  }

  async function deleteNotification(id) {
    try {
      await notificationApi.delete(id)
      setItems((current) => current.filter((item) => item._id !== id))
    } catch (err) {
      setError(err.message)
    }
  }

  async function markAllRead() {
    try {
      await notificationApi.readAll()
      setItems((current) => current.map((item) => ({ ...item, isRead: true })))
    } catch (err) {
      setError(err.message)
    }
  }

  async function clearAll() {
    if (!window.confirm('Delete all notifications?')) return
    try {
      await notificationApi.clearAll()
      setItems([])
    } catch (err) {
      setError(err.message)
    }
  }

  async function togglePref(key) {
    const next = { ...prefs, [key]: !prefs[key] }
    setPrefs(next)
    await notificationApi.updatePreferences({ [key]: next[key] })
  }

  return (
    <div>
      <div className="dashboard-header section-heading">
        <div>
          <span className="eyebrow">Inbox</span>
          <h1>Notifications</h1>
          <p>View message updates and manage your inbox.</p>
        </div>
        <div style={{ display: 'flex', gap: '0.65rem' }}>
          <button type="button" className="btn-outline btn-sm" onClick={markAllRead} disabled={items.length === 0}>
            Mark all read
          </button>
          <button type="button" className="btn-outline btn-sm" onClick={clearAll} disabled={items.length === 0}>
            Clear all
          </button>
        </div>
      </div>

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
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1rem' }}>
          <h2 style={{ margin: 0 }}>Inbox ({items.filter(n => !n.isRead).length} unread)</h2>
        </div>

        {items.length === 0 ? (
          <p className="text-muted mt-4">No notifications in your inbox.</p>
        ) : (
          <ul className="notification-feed mt-4">
            {items.map((n) => (
              <li
                key={n._id}
                className={n.isRead ? 'read' : 'unread'}
                style={{
                  display: 'flex',
                  alignItems: 'flex-start',
                  justifyContent: 'space-between',
                  gap: '1.25rem',
                  padding: '1.15rem 1.25rem',
                  borderRadius: '12px',
                  background: n.isRead ? 'rgba(255, 255, 255, 0.015)' : 'rgba(255, 255, 255, 0.04)',
                  border: n.isRead ? '1px solid rgba(255, 255, 255, 0.05)' : '1px solid rgba(255, 255, 255, 0.12)',
                  marginBottom: '0.75rem',
                }}
              >
                <div style={{ flex: 1, minWidth: 0 }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '0.65rem', marginBottom: '0.35rem' }}>
                    <strong style={{ fontSize: '0.98rem', color: 'var(--chalk, #fff)' }}>{n.title}</strong>
                    {!n.isRead && (
                      <span
                        style={{
                          fontSize: '0.68rem',
                          fontWeight: 700,
                          textTransform: 'uppercase',
                          letterSpacing: '0.05em',
                          color: '#34d399',
                          background: 'rgba(52, 211, 153, 0.12)',
                          padding: '0.15rem 0.5rem',
                          borderRadius: '9999px',
                        }}
                      >
                        New
                      </span>
                    )}
                  </div>
                  <p style={{ margin: '0 0 0.5rem', fontSize: '0.92rem', lineHeight: 1.55, color: 'var(--chalk, #e5e7eb)' }}>
                    {n.message}
                  </p>
                  <small className="text-muted" style={{ fontSize: '0.78rem' }}>
                    🗓️ {formatDateTime(n.createdAt)}
                  </small>
                </div>

                <div style={{ display: 'flex', alignItems: 'center', gap: '0.6rem', flexShrink: 0 }}>
                  {!n.isRead ? (
                    <button
                      type="button"
                      className="btn-outline btn-sm"
                      onClick={() => markRead(n._id)}
                    >
                      Mark read
                    </button>
                  ) : (
                    <span style={{ fontSize: '0.8rem', color: 'var(--chalk-dim, #9ca3af)', marginRight: '0.25rem' }}>
                      ✓ Read
                    </span>
                  )}
                  <button
                    type="button"
                    className="danger-button btn-sm"
                    onClick={() => deleteNotification(n._id)}
                  >
                    Delete
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

