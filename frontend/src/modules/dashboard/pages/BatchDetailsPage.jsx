import { useEffect, useMemo, useState } from 'react'
import { Link, useNavigate, useParams } from 'react-router-dom'
import { batchApi, inviteApi, sessionApi, announcementApi, resourceApi, formatSchedule, studentRosterState } from '../../../lib/api'
import { BatchFormModal } from '../components/BatchFormModal'
import '../../../styles/dashboard.css'

function InviteLinkCard({ label, inviteUrl, email, code, onRevoke, revoked }) {
  const [copied, setCopied] = useState(false)
  const [sendState, setSendState] = useState('idle')

  async function copyLink() {
    try {
      await navigator.clipboard.writeText(inviteUrl)
      setCopied(true)
      window.setTimeout(() => setCopied(false), 1800)
    } catch {
      setCopied(false)
    }
  }

  async function sendEmail() {
    if (sendState === 'sending') return
    setSendState('sending')
    try {
      await inviteApi.send(code)
      setSendState('sent')
      window.setTimeout(() => setSendState('idle'), 3000)
    } catch {
      setSendState('error')
      window.setTimeout(() => setSendState('idle'), 3000)
    }
  }

  async function revokeInvite() {
    if (!window.confirm(`Revoke this ${label.toLowerCase()}? Its paired invite will also stop working.`)) return
    await onRevoke(code)
  }

  return (
    <article className="invite-link-card">
      <div>
        <strong>{label}</strong>
        {email && <p className="text-muted text-sm">Locked to {email}</p>}
      </div>
      <input value={inviteUrl} readOnly aria-label={`${label} invite link`} />
      <div className="button-row mt-4">
        <button type="button" className="btn-outline btn-sm" onClick={copyLink} disabled={revoked}>
          {copied ? 'Copied' : 'Copy link'}
        </button>
        {email && (
          <button type="button" className="btn-outline btn-sm" onClick={sendEmail} disabled={sendState === 'sending'}>
            {sendState === 'idle' ? 'Send email' : sendState === 'sending' ? 'Sending…' : sendState === 'sent' ? 'Sent' : 'Failed'}
          </button>
        )}
        <button type="button" className="btn-danger-outline btn-sm" onClick={revokeInvite} disabled={revoked}>
          {revoked ? 'Revoked' : 'Revoke'}
        </button>
      </div>
    </article>
  )
}

export function BatchDetailsPage() {
  const { batchId } = useParams()
  const navigate = useNavigate()
  const [batch, setBatch] = useState(null)
  const [students, setStudents] = useState([])
  const [sessions, setSessions] = useState([])
  const [error, setError] = useState('')
  const [holidayDate, setHolidayDate] = useState('')
  const [inviteForm, setInviteForm] = useState({ studentEmail: '', parentEmail: '', expiryDays: '7' })
  const [invitePair, setInvitePair] = useState(null)
  const [invitesRevoked, setInvitesRevoked] = useState(false)
  const [saving, setSaving] = useState(false)
  const [announcements, setAnnouncements] = useState([])
  const [announcementText, setAnnouncementText] = useState('')
  const [resources, setResources] = useState([])
  const [uploadFile, setUploadFile] = useState(null)
  const [linkTitle, setLinkTitle] = useState('')
  const [linkUrl, setLinkUrl] = useState('')
  const [editing, setEditing] = useState(false)
  const [studentTab, setStudentTab] = useState('active')
  const [holidayConfirm, setHolidayConfirm] = useState(null)

  const studentGroups = useMemo(() => {
    const groups = { active: [], pending: [], removed: [], archived: [] }
    for (const student of students) {
      const state = studentRosterState(student)
      groups[state.key].push(student)
    }
    return groups
  }, [students])

  const holidayRows = useMemo(() => {
    const today = new Date()
    today.setHours(0, 0, 0, 0)
    return (batch?.holidays ?? [])
      .map((date) => {
        const day = new Date(date)
        day.setHours(0, 0, 0, 0)
        const affected = sessions.filter((session) => {
          const sessionDay = new Date(session.date)
          sessionDay.setHours(0, 0, 0, 0)
          return sessionDay.getTime() === day.getTime()
        })
        return { date, day, upcoming: day >= today, affected }
      })
      .sort((a, b) => a.day - b.day)
  }, [batch, sessions])

  async function load() {
    const [detail, sessionRes, annRes, resRes] = await Promise.all([
      batchApi.get(batchId),
      sessionApi.byBatch(batchId),
      announcementApi.getByBatch(batchId),
      resourceApi.getByBatch(batchId),
    ])
    setBatch(detail.batch)
    setStudents(detail.students ?? [])
    setSessions(sessionRes.sessions ?? [])
    setAnnouncements(annRes.announcements ?? [])
    setResources(resRes.resources ?? [])
  }

  useEffect(() => {
    load().catch((err) => setError(err.message))
  }, [batchId])

  async function addHoliday(e) {
    e.preventDefault()
    if (!holidayDate) return
    const day = new Date(`${holidayDate}T00:00:00`)
    const affected = sessions.filter((session) => {
      const sessionDay = new Date(session.date)
      return sessionDay.toDateString() === day.toDateString() && session.status !== 'cancelled'
    })
    if (affected.length && !holidayConfirm) {
      setHolidayConfirm({ date: holidayDate, sessions: affected })
      return
    }
    try {
      setSaving(true)
      await batchApi.addHoliday(batchId, holidayDate)
      setHolidayDate('')
      setHolidayConfirm(null)
      await load()
    } catch (err) {
      setError(err.message)
    } finally {
      setSaving(false)
    }
  }

  async function saveBatch(payload) {
    await batchApi.update(batchId, payload)
    await load()
  }

  async function removeHoliday(date) {
    try {
      await batchApi.removeHoliday(batchId, date)
      await load()
    } catch (err) {
      setError(err.message)
    }
  }

  async function createInvites(e) {
    e.preventDefault()
    setError('')
    setInvitePair(null)
    setInvitesRevoked(false)
    try {
      setSaving(true)
      const res = await inviteApi.createPaired({
        batchId,
        studentEmail: inviteForm.studentEmail.trim(),
        parentEmail: inviteForm.parentEmail.trim(),
        expiryDays: Number(inviteForm.expiryDays),
      })
      setInvitePair(res)
      await load()
    } catch (err) {
      setError(err.message)
    } finally {
      setSaving(false)
    }
  }

  async function revokeInvite(code) {
    try {
      setSaving(true)
      await inviteApi.revoke(code)
      setInvitesRevoked(true)
    } catch (err) {
      setError(err.message)
    } finally {
      setSaving(false)
    }
  }

  async function changeStudentStatus(student, status) {
    if (status === student.status) return
    if (status === 'removed' && !window.confirm(`Remove ${student.name} from this batch? Attendance and scores stay archived.`)) return
    if (status === 'archived' && !window.confirm(`Archive ${student.name} in this batch? They will no longer appear as active.`)) return
    try {
      await batchApi.updateStudentStatus(batchId, student.studentId, status)
      await load()
    } catch (err) {
      setError(err.message)
    }
  }

  async function setSessionNoClass(session, cancelled) {
    try {
      await sessionApi.updateStatus(session._id, cancelled ? 'cancelled' : 'scheduled')
      await load()
    } catch (err) {
      setError(err.message)
    }
  }

  async function postAnnouncement(e) {
    e.preventDefault()
    if (!announcementText.trim()) return
    try {
      setSaving(true)
      await announcementApi.create({ batchId, text: announcementText.trim() })
      setAnnouncementText('')
      await load()
    } catch (err) {
      setError(err.message)
    } finally {
      setSaving(false)
    }
  }

  async function deleteAnnouncement(id) {
    try {
      await announcementApi.remove(id)
      await load()
    } catch (err) {
      setError(err.message)
    }
  }

  async function uploadResource() {
    if (!uploadFile) return
    try {
      setSaving(true)
      await resourceApi.upload(batchId, uploadFile)
      setUploadFile(null)
      await load()
    } catch (err) {
      setError(err.message)
    } finally {
      setSaving(false)
    }
  }

  async function addLink(e) {
    e.preventDefault()
    if (!linkTitle.trim() || !linkUrl.trim()) return
    try {
      setSaving(true)
      await resourceApi.addLink({ batchId, title: linkTitle.trim(), url: linkUrl.trim() })
      setLinkTitle('')
      setLinkUrl('')
      await load()
    } catch (err) {
      setError(err.message)
    } finally {
      setSaving(false)
    }
  }

  async function deleteResource(id) {
    try {
      await resourceApi.remove(id)
      await load()
    } catch (err) {
      setError(err.message)
    }
  }

  if (!batch && !error) return <div className="empty-state">Loading batch…</div>

  return (
    <div>
      <button type="button" className="back-btn" onClick={() => navigate('/tutor/dashboard/batches')}>
        ← Back to batches
      </button>
      <div className="dashboard-header section-heading">
        <div>
          <span className="eyebrow">Batch workspace</span>
          <h1>{batch?.name ?? 'Batch'}</h1>
          <p>{(batch?.subjects ?? []).join(' · ') || 'No subjects set'} · {formatSchedule(batch?.schedule)}</p>
        </div>
        <button type="button" className="btn-primary" onClick={() => setEditing(true)}>
          Edit batch
        </button>
      </div>
      {error && <div className="alert error">{error}</div>}

      <section className="premium-card mb-6">
        <h2>Notice board</h2>
        <p className="text-muted">One-way announcements for students and parents in this batch.</p>
        <form className="mt-4" onSubmit={postAnnouncement}>
          <textarea
            className="form-input"
            rows="3"
            value={announcementText}
            onChange={(e) => setAnnouncementText(e.target.value)}
            placeholder="Type a notice…"
          />
          <div className="mt-4">
            <button type="submit" className="btn-primary" disabled={saving}>
              Post announcement
            </button>
          </div>
        </form>
        {announcements.length === 0 ? (
          <p className="text-muted mt-4">No announcements yet.</p>
        ) : (
          <ul className="session-list-mini mt-4">
            {announcements.map((a) => (
              <li key={a._id}>
                <p>{a.text}</p>
                <small className="text-muted">{new Date(a.createdAt).toLocaleString()}</small>
                <button type="button" className="danger-button" onClick={() => deleteAnnouncement(a._id)}>
                  Delete
                </button>
              </li>
            ))}
          </ul>
        )}
      </section>

      <section className="premium-card mb-6">
        <h2>Notes & materials</h2>
        <p className="text-muted">Share PDFs, images, Word files, text, or links with the batch.</p>
        <div className="holiday-row mt-4">
          <input type="file" accept=".pdf,.png,.jpg,.jpeg,.webp,.txt,.doc,.docx" onChange={(e) => setUploadFile(e.target.files?.[0] ?? null)} />
          <button type="button" className="btn-outline" onClick={uploadResource} disabled={!uploadFile || saving}>
            Upload file
          </button>
        </div>
        <form className="invite-grid mt-4" onSubmit={addLink}>
          <input value={linkTitle} onChange={(e) => setLinkTitle(e.target.value)} placeholder="Link title" />
          <input value={linkUrl} onChange={(e) => setLinkUrl(e.target.value)} placeholder="https://" />
          <button type="submit" className="btn-outline" disabled={saving}>
            Add link
          </button>
        </form>
        {resources.length === 0 ? (
          <p className="text-muted mt-4">No materials shared yet.</p>
        ) : (
          <ul className="session-list-mini mt-4">
            {resources.map((r) => (
              <li key={r._id}>
                <a href={r.type === 'file' ? r.downloadUrl : r.url} target="_blank" rel="noreferrer">
                  {r.title}
                </a>
                <button type="button" className="danger-button" onClick={() => deleteResource(r._id)}>
                  Delete
                </button>
              </li>
            ))}
          </ul>
        )}
      </section>

      <section className="premium-card mb-6">
        <h2>Upcoming sessions</h2>
        {sessions.length === 0 ? (
          <p className="text-muted mt-4">No sessions yet.</p>
        ) : (
          <ul className="session-list-mini mt-4">
            {sessions.slice(0, 12).map((session) => (
              <li key={session._id}>
                <Link to={`/tutor/dashboard/sessions/${session._id}`}>
                  {new Date(session.date).toLocaleString()} · {session.topic} · {session.status}
                  {session.isHoliday ? ' (holiday)' : ''}
                </Link>
                {session.status === 'scheduled' && (
                  <button type="button" className="btn-outline btn-sm" onClick={() => setSessionNoClass(session, true)}>
                    Mark no-class
                  </button>
                )}
                {session.status === 'cancelled' && !session.isHoliday && (
                  <button type="button" className="btn-outline btn-sm" onClick={() => setSessionNoClass(session, false)}>
                    Restore class
                  </button>
                )}
              </li>
            ))}
          </ul>
        )}
      </section>

      <section className="premium-card mb-6">
        <h2>Students</h2>
        <div className="button-row mt-4">
          {[
            ['active', 'Active'],
            ['pending', 'Pending'],
            ['removed', 'Removed'],
            ['archived', 'Archived'],
          ].map(([key, label]) => (
            <button
              key={key}
              type="button"
              className={`btn-outline btn-sm ${studentTab === key ? 'btn-primary' : ''}`}
              onClick={() => setStudentTab(key)}
            >
              {label} ({studentGroups[key].length})
            </button>
          ))}
        </div>
        {studentGroups[studentTab].length === 0 ? (
          <p className="text-muted mt-4">
            {studentTab === 'pending'
              ? 'No pending invites in this batch.'
              : studentTab === 'removed'
                ? 'No removed students.'
                : studentTab === 'archived'
                  ? 'No archived students.'
                  : 'No active students yet. Generate invite links below.'}
          </p>
        ) : (
          <div className="premium-table-container mt-4">
            <table className="premium-table">
              <thead>
                <tr>
                  <th>Name</th>
                  <th>Email</th>
                  <th>Parent</th>
                  <th>Status</th>
                  <th></th>
                </tr>
              </thead>
              <tbody>
                {studentGroups[studentTab].map((student) => {
                  const state = studentRosterState(student)
                  return (
                    <tr key={student.studentId}>
                      <td>{student.name}</td>
                      <td>{student.email ?? '—'}</td>
                      <td>{student.parentName ?? 'Not linked'}</td>
                      <td>
                        <span className={`roster-badge ${state.key}`}>{state.label}</span>
                        {state.key === 'pending' && student.inviteExpiresAt && (
                          <small className="text-muted block">Expires {new Date(student.inviteExpiresAt).toLocaleDateString()}</small>
                        )}
                      </td>
                      <td>
                        <select
                          className="form-input"
                          value={['pending', 'active', 'removed', 'archived'].includes(student.status) ? student.status : 'active'}
                          onChange={(e) => changeStudentStatus(student, e.target.value)}
                          aria-label={`Enrollment status for ${student.name}`}
                        >
                          <option value="active">Active</option>
                          <option value="pending">Pending</option>
                          <option value="removed">Removed</option>
                          <option value="archived">Archived</option>
                        </select>
                      </td>
                    </tr>
                  )
                })}
              </tbody>
            </table>
          </div>
        )}
      </section>

      <section className="premium-card mb-6">
        <h2>Invite student + parent</h2>
        <p className="text-muted">Single-use links that expire. Optional emails lock each link to one person.</p>
        <form className="mt-4" onSubmit={createInvites}>
          <div className="invite-grid">
            <div className="auth-field">
              <label htmlFor="student-email">Student email</label>
              <input
                id="student-email"
                type="email"
                value={inviteForm.studentEmail}
                onChange={(e) => setInviteForm({ ...inviteForm, studentEmail: e.target.value })}
                placeholder="student@example.com"
              />
            </div>
            <div className="auth-field">
              <label htmlFor="parent-email">Parent email</label>
              <input
                id="parent-email"
                type="email"
                value={inviteForm.parentEmail}
                onChange={(e) => setInviteForm({ ...inviteForm, parentEmail: e.target.value })}
                placeholder="parent@example.com"
              />
            </div>
          </div>
          <div className="auth-field">
            <label htmlFor="expiry">Link expiry</label>
            <select
              id="expiry"
              value={inviteForm.expiryDays}
              onChange={(e) => setInviteForm({ ...inviteForm, expiryDays: e.target.value })}
            >
              <option value="1">1 day</option>
              <option value="3">3 days</option>
              <option value="7">7 days</option>
              <option value="14">14 days</option>
              <option value="30">30 days</option>
            </select>
          </div>
          <button type="submit" className="btn-primary" disabled={saving}>
            {saving ? 'Creating…' : 'Create invite links'}
          </button>
        </form>
        {invitePair && (
          <div className="invite-result-grid mt-6">
            <InviteLinkCard
              label="Student invite"
              inviteUrl={invitePair.student.inviteUrl}
              email={invitePair.student.invite.email}
              code={invitePair.student.invite.code}
              onRevoke={revokeInvite}
              revoked={invitesRevoked}
            />
            <InviteLinkCard
              label="Parent invite"
              inviteUrl={invitePair.parent.inviteUrl}
              email={invitePair.parent.invite.email}
              code={invitePair.parent.invite.code}
              onRevoke={revokeInvite}
              revoked={invitesRevoked}
            />
          </div>
        )}
      </section>

      <section className="premium-card mb-6">
        <h2>Holidays / no-class days</h2>
        <p className="text-muted">Mark a date to cancel that day’s class. Removing a holiday restores a cancelled session on that date.</p>
        <form className="holiday-row mt-4" onSubmit={addHoliday}>
          <input type="date" value={holidayDate} onChange={(e) => { setHolidayDate(e.target.value); setHolidayConfirm(null) }} required />
          <button type="submit" className="btn-outline" disabled={saving}>
            {holidayConfirm ? 'Confirm no-class day' : 'Mark holiday'}
          </button>
          {holidayConfirm && (
            <button type="button" className="btn-outline" onClick={() => setHolidayConfirm(null)}>
              Cancel
            </button>
          )}
        </form>
        {holidayConfirm && (
          <div className="alert warning">
            This will cancel {holidayConfirm.sessions.length} class{holidayConfirm.sessions.length === 1 ? '' : 'es'} on{' '}
            {new Date(`${holidayConfirm.date}T00:00:00`).toLocaleDateString()}. Submit again to confirm.
            <ul className="session-list-mini mt-4">
              {holidayConfirm.sessions.map((session) => (
                <li key={session._id}>
                  {new Date(session.date).toLocaleString()} · {session.topic}
                </li>
              ))}
            </ul>
          </div>
        )}
        {holidayRows.length === 0 ? (
          <p className="text-muted">No holidays marked.</p>
        ) : (
          <>
            <h3 className="mt-6">Upcoming</h3>
            {holidayRows.filter((row) => row.upcoming).length === 0 ? (
              <p className="text-muted">No upcoming no-class days.</p>
            ) : (
              <ul className="session-list-mini">
                {holidayRows.filter((row) => row.upcoming).map((row) => (
                  <li key={row.date}>
                    <div>
                      <strong>{row.day.toLocaleDateString()}</strong>
                      <p className="text-muted text-sm">
                        {row.affected.length
                          ? row.affected.map((session) => `${session.topic} · ${session.status}`).join(', ')
                          : 'No class was scheduled on this date'}
                      </p>
                    </div>
                    <button type="button" className="danger-button" onClick={() => removeHoliday(row.date)}>
                      Restore class
                    </button>
                  </li>
                ))}
              </ul>
            )}
            <h3 className="mt-6">Past</h3>
            {holidayRows.filter((row) => !row.upcoming).length === 0 ? (
              <p className="text-muted">No past holidays.</p>
            ) : (
              <ul className="session-list-mini">
                {holidayRows.filter((row) => !row.upcoming).map((row) => (
                  <li key={row.date}>
                    <div>
                      <strong>{row.day.toLocaleDateString()}</strong>
                      <p className="text-muted text-sm">
                        {row.affected.length ? `${row.affected.length} cancelled class(es)` : 'No class was scheduled'}
                      </p>
                    </div>
                    <button type="button" className="danger-button" onClick={() => removeHoliday(row.date)}>
                      Remove
                    </button>
                  </li>
                ))}
              </ul>
            )}
          </>
        )}
      </section>
      {editing && (
        <BatchFormModal
          batch={batch}
          onClose={() => setEditing(false)}
          onSave={saveBatch}
        />
      )}
    </div>
  )
}
