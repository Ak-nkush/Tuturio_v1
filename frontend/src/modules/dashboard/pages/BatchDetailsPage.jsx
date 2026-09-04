import { useEffect, useMemo, useState } from 'react'
import { Link, useNavigate, useParams, useSearchParams } from 'react-router-dom'
import { batchApi, inviteApi, sessionApi, announcementApi, resourceApi, attendanceApi, formatSchedule, formatDate, formatDateTime, studentRosterState } from '../../../lib/api'
import { TutorBatchAssignments } from '../components/AssignmentBoards'
import { BatchFormModal } from '../components/BatchFormModal'
import '../../../styles/dashboard.css'

function InviteLinkCard({ label, inviteUrl, email, code, onRevoke, revoked }) {
  const [copied, setCopied] = useState(false)
  const [sendState, setSendState] = useState('idle')
  const [sendError, setSendError] = useState('')

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
    setSendError('')
    try {
      await inviteApi.send(code)
      setSendState('sent')
      window.setTimeout(() => setSendState('idle'), 4000)
    } catch (err) {
      setSendState('error')
      setSendError(err.message ?? 'Could not send the email')
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
      {sendError && <p className="text-muted text-sm mt-4">{sendError}</p>}
    </article>
  )
}

function localDateTimeValue(value = new Date()) {
  const date = new Date(value)
  date.setMinutes(date.getMinutes() - date.getTimezoneOffset())
  return date.toISOString().slice(0, 16)
}

const BATCH_SECTIONS = [
  ['overview', 'Overview'],
  ['students', 'Students'],
  ['attendance', 'Attendance'],
  ['invites', 'Invites'],
  ['classes', 'Classes'],
  ['materials', 'Materials'],
  ['announcements', 'Announcements'],
  ['assignments', 'Assignments'],
]

export function BatchDetailsPage() {
  const { batchId } = useParams()
  const navigate = useNavigate()
  const [searchParams, setSearchParams] = useSearchParams()
  const [batch, setBatch] = useState(null)
  const [students, setStudents] = useState([])
  const [sessions, setSessions] = useState([])
  const [error, setError] = useState('')
  const [holidayDate, setHolidayDate] = useState('')
  const [holidayConfirm, setHolidayConfirm] = useState(null)
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
  const [attendance, setAttendance] = useState({ students: [], classes: [] })
  const [extraClass, setExtraClass] = useState({ topic: '', date: localDateTimeValue() })

  const sectionParam = searchParams.get('section') === 'notices'
    ? 'announcements'
    : (searchParams.get('section') || 'overview')
  const section = BATCH_SECTIONS.some(([key]) => key === sectionParam) ? sectionParam : 'overview'

  function setSection(next) {
    setSearchParams((prev) => {
      const params = new URLSearchParams(prev)
      params.set('section', next)
      return params
    }, { replace: true })
  }

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
    const [detail, sessionRes, annRes, resRes, attRes] = await Promise.all([
      batchApi.get(batchId),
      sessionApi.byBatch(batchId),
      announcementApi.getByBatch(batchId),
      resourceApi.getByBatch(batchId),
      attendanceApi.byBatch(batchId),
    ])
    setBatch(detail.batch)
    setStudents(detail.students ?? [])
    setSessions(sessionRes.sessions ?? [])
    setAnnouncements(annRes.announcements ?? [])
    setResources(resRes.resources ?? [])
    setAttendance({
      students: attRes.students ?? [],
      classes: attRes.classes ?? [],
    })
    setError('')
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

  async function addExtraClass(e) {
    e.preventDefault()
    const topic = extraClass.topic.trim()
    if (!topic || !extraClass.date) return
    try {
      setSaving(true)
      await sessionApi.create({
        batchId,
        topic,
        date: new Date(extraClass.date).toISOString(),
      })
      setExtraClass({ topic: '', date: localDateTimeValue() })
      await load()
    } catch (err) {
      setError(err.message)
    } finally {
      setSaving(false)
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
      <div className="page-toolbar">
        <button type="button" className="back-btn" onClick={() => navigate('/tutor/dashboard/batches')}>
          ← Back to batches
        </button>
        <button type="button" className="btn-outline" onClick={() => setEditing(true)}>
          Edit batch
        </button>
      </div>
      <div className="dashboard-header">
        <div>
          <span className="eyebrow">Batch workspace</span>
          <h1>{batch?.name ?? 'Batch'}</h1>
          <p>{(batch?.subjects ?? []).join(' · ') || 'No subjects set'} · {formatSchedule(batch?.schedule)}</p>
        </div>
      </div>
      {error && <div className="alert error">{error}</div>}

      <nav className="batch-top-nav" aria-label="Batch sections">
        {BATCH_SECTIONS.map(([key, label]) => (
          <button
            key={key}
            type="button"
            className={`batch-tab ${section === key ? 'active' : ''}`}
            onClick={() => setSection(key)}
          >
            {label}
          </button>
        ))}
      </nav>

      {section === 'overview' && (
        <section className="premium-card mb-6">
          <h2>At a glance</h2>
          <div className="stats-grid mt-4">
            <div>
              <strong>{studentGroups.active.length}</strong>
              <p className="text-muted">Active students</p>
            </div>
            <div>
              <strong>{sessions.filter((s) => s.status === 'scheduled').length}</strong>
              <p className="text-muted">Scheduled classes</p>
            </div>
            <div>
              <strong>{announcements.length}</strong>
              <p className="text-muted">Announcements</p>
            </div>
            <div>
              <strong>{resources.length}</strong>
              <p className="text-muted">Materials</p>
            </div>
          </div>
          <p className="text-muted mt-4">Use the tabs above to manage students, attendance, invites, classes, materials, announcements, and assignments for this batch.</p>
        </section>
      )}

      {section === 'announcements' && (
      <section className="premium-card mb-6">
        <h2>Announcements</h2>
        <p className="text-muted">One-way announcements for students and parents in this batch.</p>
        <form className="mt-4" onSubmit={postAnnouncement}>
          <textarea
            className="form-input"
            rows="3"
            value={announcementText}
            onChange={(e) => setAnnouncementText(e.target.value)}
            placeholder="Type a notice…"
          />
          <div className="form-actions">
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
                <small className="text-muted">{formatDateTime(a.createdAt)}</small>
                <button type="button" className="danger-button" onClick={() => deleteAnnouncement(a._id)}>
                  Delete
                </button>
              </li>
            ))}
          </ul>
        )}
      </section>
      )}

      {section === 'assignments' && (
        <TutorBatchAssignments batchId={batchId} students={students} />
      )}

      {section === 'materials' && (
      <section className="premium-card mb-6">
        <h2>Notes & materials</h2>
        <p className="text-muted">Share PDFs, images, Word files, text, or links with the batch.</p>
        <div className="holiday-row mt-4">
          <input type="file" accept=".pdf,.png,.jpg,.jpeg,.webp,.txt,.doc,.docx" onChange={(e) => setUploadFile(e.target.files?.[0] ?? null)} />
          <button type="button" className="btn-outline" onClick={uploadResource} disabled={!uploadFile || saving}>
            Upload file
          </button>
        </div>
        <form className="batch-action-form mt-4" onSubmit={addLink}>
          <div className="batch-field">
            <label htmlFor="material-link-title">Link title</label>
            <input id="material-link-title" className="form-input" value={linkTitle} onChange={(e) => setLinkTitle(e.target.value)} placeholder="Link title" />
          </div>
          <div className="batch-field">
            <label htmlFor="material-link-url">URL</label>
            <input id="material-link-url" className="form-input" value={linkUrl} onChange={(e) => setLinkUrl(e.target.value)} placeholder="https://" />
          </div>
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
      )}

      {section === 'classes' && (
      <section className="premium-card mb-6">
        <h2>Upcoming sessions</h2>
        <p className="text-muted">Weekly classes are created with the batch. Add a one-off extra class for this batch here.</p>
        <form className="batch-action-form mt-4" onSubmit={addExtraClass}>
          <div className="batch-field">
            <label htmlFor="extra-class-topic">Topic</label>
            <input
              id="extra-class-topic"
              className="form-input"
              value={extraClass.topic}
              onChange={(e) => setExtraClass({ ...extraClass, topic: e.target.value })}
              placeholder="Topic"
              required
            />
          </div>
          <div className="batch-field">
            <label htmlFor="extra-class-date">Date and time</label>
            <input
              id="extra-class-date"
              className="form-input"
              type="datetime-local"
              value={extraClass.date}
              onChange={(e) => setExtraClass({ ...extraClass, date: e.target.value })}
              required
            />
          </div>
          <button type="submit" className="btn-primary" disabled={saving}>
            Add extra class
          </button>
        </form>
        {sessions.length === 0 ? (
          <p className="text-muted mt-4">No classes yet. Create the batch with weekly days, or add an extra class above.</p>
        ) : (
          <ul className="session-list-mini mt-4">
            {sessions.slice(0, 12).map((session) => (
              <li key={session._id}>
                <span>
                  {formatDateTime(session.date)} · {session.topic} · {session.status}
                  {session.isHoliday ? ' (holiday)' : ''}
                </span>
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
      )}

      {section === 'attendance' && (
      <section className="premium-card mb-6">
        <h2>Attendance</h2>
        <p className="text-muted">Present and late count as attended. Click a class to mark present, absent, late, or excused. You can change a saved present mark to absent and save again.</p>
        {attendance.students.length === 0 ? (
          <p className="text-muted mt-4">No active students in this batch yet.</p>
        ) : (
          <div className="premium-table-container mt-4">
            <table className="premium-table">
              <thead>
                <tr>
                  <th>Student</th>
                  <th>Present</th>
                  <th>Late</th>
                  <th>Absent</th>
                  <th>Excused</th>
                  <th>Attendance</th>
                </tr>
              </thead>
              <tbody>
                {attendance.students.map((row) => (
                  <tr key={row.studentId}>
                    <td>{row.name}</td>
                    <td>{row.present}</td>
                    <td>{row.late}</td>
                    <td>{row.absent}</td>
                    <td>{row.excused}</td>
                    <td>{row.attendancePercentage != null ? `${row.attendancePercentage}%` : '—'}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
        <h3 className="mt-6">Classes</h3>
        {attendance.classes.length === 0 ? (
          <p className="text-muted mt-4">No classes yet. Add them when you create or edit the batch, or from the Classes tab.</p>
        ) : (
          <ul className="session-list-mini mt-4">
            {attendance.classes.map((row) => (
              <li key={row.sessionId}>
                <Link to={`/tutor/dashboard/sessions/${row.sessionId}`}>
                  {formatDateTime(row.date)} · {row.topic}
                </Link>
                <span className="text-muted text-sm">
                  {row.markedCount}/{row.expectedCount} marked
                </span>
              </li>
            ))}
          </ul>
        )}
      </section>
      )}

      {section === 'students' && (
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
                          <small className="text-muted block">Expires {formatDate(student.inviteExpiresAt)}</small>
                        )}
                      </td>
                      <td>
                        <select
                          className="form-input roster-status-select"
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
      )}

      {section === 'invites' && (
      <section className="premium-card mb-6">
        <h2>Invite student + parent</h2>
        <p className="text-muted">Single-use links that expire. Optional emails lock each link to one person.</p>
        <form className="batch-invite-form mt-4" onSubmit={createInvites}>
          <div className="invite-grid">
            <div className="batch-field">
              <label htmlFor="student-email">Student email</label>
              <input
                id="student-email"
                className="form-input"
                type="email"
                value={inviteForm.studentEmail}
                onChange={(e) => setInviteForm({ ...inviteForm, studentEmail: e.target.value })}
                placeholder="student@example.com"
              />
            </div>
            <div className="batch-field">
              <label htmlFor="parent-email">Parent email</label>
              <input
                id="parent-email"
                className="form-input"
                type="email"
                value={inviteForm.parentEmail}
                onChange={(e) => setInviteForm({ ...inviteForm, parentEmail: e.target.value })}
                placeholder="parent@example.com"
              />
            </div>
          </div>
          <div className="batch-action-form mt-4">
            <div className="batch-field">
              <label htmlFor="expiry">Link expiry</label>
              <select
                id="expiry"
                className="form-input"
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
            <div className="form-actions">
              <button type="submit" className="btn-primary" disabled={saving}>
                {saving ? 'Creating…' : 'Create invite links'}
              </button>
            </div>
          </div>
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
      )}

      {section === 'classes' && (
      <section className="premium-card mb-6">
        <h2>Holidays / no-class days</h2>
        <p className="text-muted">Mark a date to cancel that day’s class. Removing a holiday restores a cancelled session on that date.</p>
        <form className="batch-action-form mt-4" onSubmit={addHoliday}>
          <div className="batch-field">
            <label htmlFor="holiday-date">Date</label>
            <input
              id="holiday-date"
              className="form-input"
              type="date"
              value={holidayDate}
              onChange={(e) => { setHolidayDate(e.target.value); setHolidayConfirm(null) }}
              required
            />
          </div>
          <div className="form-actions">
            <button type="submit" className="btn-primary" disabled={saving}>
              {holidayConfirm ? 'Confirm no-class day' : 'Mark holiday'}
            </button>
            {holidayConfirm && (
              <button type="button" className="btn-outline" onClick={() => setHolidayConfirm(null)}>
                Cancel
              </button>
            )}
          </div>
        </form>
        {holidayConfirm && (
          <div className="alert warning">
            This will cancel {holidayConfirm.sessions.length} class{holidayConfirm.sessions.length === 1 ? '' : 'es'} on{' '}
            {formatDate(new Date(`${holidayConfirm.date}T00:00:00`))}. Submit again to confirm.
            <ul className="session-list-mini mt-4">
              {holidayConfirm.sessions.map((session) => (
                <li key={session._id}>
                  {formatDateTime(session.date)} · {session.topic}
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
                      <strong>{formatDate(row.day)}</strong>
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
                      <strong>{formatDate(row.day)}</strong>
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
      )}
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
