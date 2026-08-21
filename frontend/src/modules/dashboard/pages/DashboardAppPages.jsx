import { useEffect, useState } from 'react'
import { Link, Outlet } from 'react-router-dom'
import { useAuth } from '../../../context/AuthContext'
import {
  analyticsApi,
  attendanceApi,
  batchApi,
  messageApi,
  notificationApi,
  progressApi,
  sessionApi,
  userApi,
} from '../../../lib/api'
import { BatchFormModal, ScheduleClassModal } from '../components/BatchFormModal'
import { TutorDashboardLayout } from '../components/TutorDashboardLayout'
import '../../../styles/dashboard.css'

function isTestRecord(item) {
  return /integration test|mt2[a-z0-9]+/i.test(`${item.name ?? ''} ${item.batchId ?? ''}`)
}

function usableBatches(items) {
  return (items ?? []).filter((batch) => !isTestRecord(batch))
}

function usableStudents(items) {
  return (items ?? []).filter((student) => !isTestRecord(student))
}

function LoadingState() {
  return <div className="empty-state">Loading...</div>
}

function ErrorState({ message }) {
  return <div className="alert error">{message}</div>
}

function greetingFor(date) {
  const hour = date.getHours()
  if (hour < 12) return 'Good morning'
  if (hour < 17) return 'Good afternoon'
  return 'Good evening'
}

export function TutorDashboardShell() {
  return (
    <TutorDashboardLayout>
      <Outlet />
    </TutorDashboardLayout>
  )
}

export function TutorOverviewPage() {
  const { user } = useAuth()
  const [batches, setBatches] = useState([])
  const [sessions, setSessions] = useState([])
  const [analytics, setAnalytics] = useState(null)
  const [unreadNotes, setUnreadNotes] = useState(0)
  const [unreadChats, setUnreadChats] = useState(0)
  const [error, setError] = useState('')
  const todayLabel = new Date().toLocaleDateString([], {
    weekday: 'long',
    day: 'numeric',
    month: 'long',
    year: 'numeric',
  })

  useEffect(() => {
    Promise.all([
      batchApi.list(),
      sessionApi.today(),
      analyticsApi.overview(),
      notificationApi.list().catch(() => ({ notifications: [] })),
      messageApi.conversations().catch(() => ({ conversations: [] })),
    ])
      .then(([batchRes, sessionRes, overview, notes, chats]) => {
        setBatches(usableBatches(batchRes.batches))
        setSessions((sessionRes.sessions ?? []).filter((session) => !isTestRecord(session)))
        setAnalytics(overview)
        setUnreadNotes((notes.notifications ?? []).filter((n) => !n.isRead).length)
        setUnreadChats((chats.conversations ?? []).reduce((sum, c) => sum + (c.unread ?? 0), 0))
      })
      .catch((err) => setError(err.message))
  }, [])

  const firstName = user?.name?.split(' ')[0] ?? 'there'
  const attention = []
  if (sessions.length) {
    attention.push({
      to: '/tutor/dashboard',
      title: `${sessions.length} class${sessions.length === 1 ? '' : 'es'} today`,
      detail: 'Open a session to take attendance',
      tone: 'amber',
    })
  }
  if (unreadNotes) {
    attention.push({
      to: '/tutor/dashboard/notifications',
      title: `${unreadNotes} unread notification${unreadNotes === 1 ? '' : 's'}`,
      detail: 'Review your inbox',
      tone: 'blue',
    })
  }
  if (unreadChats) {
    attention.push({
      to: '/tutor/dashboard/chat',
      title: `${unreadChats} unread message${unreadChats === 1 ? '' : 's'}`,
      detail: 'Private chat with students or parents',
      tone: 'pink',
    })
  }

  return (
    <div>
      <div className="dashboard-header dashboard-hero">
        <div>
          <span className="eyebrow">{todayLabel}</span>
          <h1>
            {greetingFor(new Date())}, {firstName}
          </h1>
          <p>Here&apos;s what&apos;s happening across your batches today.</p>
        </div>
        <Link className="btn-primary" to="/tutor/dashboard/batches">
          + Schedule a class
        </Link>
      </div>
      {error && <ErrorState message={error} />}
      <div className="stats-grid">
        <div className="stat-card premium-card">
          <span className="stat-icon blue">◈</span>
          <strong className="stat-number">{batches.length}</strong>
          <span className="text-muted">Active batches</span>
        </div>
        <div className="stat-card premium-card">
          <span className="stat-icon amber">◷</span>
          <strong className="stat-number">{sessions.length}</strong>
          <span className="text-muted">Classes today</span>
        </div>
        <div className="stat-card premium-card">
          <span className="stat-icon green">♙</span>
          <strong className="stat-number">
            {batches.reduce((total, batch) => total + (batch.enrollment?.filter((e) => e.status === 'active').length ?? 0), 0)}
          </strong>
          <span className="text-muted">Active students</span>
        </div>
        <div className="stat-card premium-card">
          <span className="stat-icon pink">↗</span>
          <strong className="stat-number">
            {analytics?.attendancePercentage != null ? `${analytics.attendancePercentage}%` : '—'}
          </strong>
          <span className="text-muted">Average attendance</span>
        </div>
      </div>
      <div className="dashboard-columns mt-6">
        <section className="premium-card">
          <div className="section-heading">
            <div>
              <span className="eyebrow">Your schedule</span>
              <h2>Today&apos;s classes</h2>
            </div>
            <Link to="/tutor/dashboard/batches">View batches →</Link>
          </div>
          {sessions.length === 0 ? (
            <div className="empty-state">No classes scheduled today.</div>
          ) : (
            <div className="session-list">
              {sessions.map((session) => (
                <Link className="session-list-item" key={session._id} to={`/tutor/dashboard/sessions/${session._id}`}>
                  <span className="session-date">
                    {new Date(session.date).toLocaleDateString([], { weekday: 'short', day: 'numeric' })}
                  </span>
                  <span className="session-time">
                    {new Date(session.date).toLocaleTimeString([], { hour: 'numeric', minute: '2-digit' })}
                  </span>
                  <span className="session-info">
                    <strong>{session.topic}</strong>
                    <small>{batches.find((b) => b.batchId === session.batchId)?.name ?? 'Class session'}</small>
                  </span>
                  <span className={`status-badge ${session.status}`}>Open →</span>
                </Link>
              ))}
            </div>
          )}
        </section>
        <section className="premium-card attention-card">
          <div className="section-heading">
            <div>
              <span className="eyebrow">Keep an eye on</span>
              <h2>Needs your attention</h2>
            </div>
          </div>
          {attention.length === 0 ? (
            <p className="text-muted mt-4">You&apos;re caught up.</p>
          ) : (
            attention.map((item) => (
              <Link className="attention-item" to={item.to} key={item.title}>
                <span className={`attention-dot ${item.tone}`} />
                <div>
                  <strong>{item.title}</strong>
                  <p>{item.detail}</p>
                </div>
                <span>→</span>
              </Link>
            ))
          )}
        </section>
      </div>
      <section className="premium-card mt-6">
        <div className="section-heading">
          <div>
            <span className="eyebrow">At a glance</span>
            <h2>Your batches</h2>
          </div>
          <Link to="/tutor/dashboard/batches">Manage batches →</Link>
        </div>
        {batches.length === 0 ? (
          <div className="empty-state mt-4">No batches yet. Create one to get started.</div>
        ) : (
          <div className="mini-batch-grid">
            {batches.map((batch) => (
              <Link to={`/tutor/dashboard/batches/${batch.batchId}`} className="mini-batch" key={batch.batchId}>
                <span className="batch-color" />
                <div>
                  <strong>{batch.name}</strong>
                  <p>
                    {batch.enrollment?.filter((e) => e.status === 'active').length ?? 0} students ·{' '}
                    {(batch.subjects ?? []).join(' · ') || 'No subjects'}
                  </p>
                </div>
                <span>→</span>
              </Link>
            ))}
          </div>
        )}
      </section>
    </div>
  )
}

export function TutorBatchesPage() {
  const [batches, setBatches] = useState([])
  const [modal, setModal] = useState(null)
  const [scheduleOpen, setScheduleOpen] = useState(false)
  const [error, setError] = useState('')

  async function load() {
    const res = await batchApi.list()
    setBatches(usableBatches(res.batches))
  }

  useEffect(() => {
    load().catch((err) => setError(err.message))
  }, [])

  async function saveBatch(payload, isEdit) {
    if (isEdit) await batchApi.update(modal.batchId, payload)
    else await batchApi.create(payload)
    await load()
  }

  async function archive(batchId) {
    if (!window.confirm('Archive this batch?')) return
    try {
      await batchApi.archive(batchId)
      await load()
    } catch (err) {
      setError(err.message)
    }
  }

  async function schedule(payload) {
    await sessionApi.create(payload)
    await load()
  }

  return (
    <div>
      <div className="dashboard-header section-heading">
        <div>
          <span className="eyebrow">Learning studio</span>
          <h1>Batches</h1>
          <p>Create classes and manage their weekly schedule.</p>
        </div>
        <div className="button-row">
          <button className="btn-outline" onClick={() => setScheduleOpen(true)}>
            Schedule class
          </button>
          <button className="btn-primary" onClick={() => setModal({})}>
            Create batch
          </button>
        </div>
      </div>
      {error && <ErrorState message={error} />}
      {batches.length === 0 ? (
        <div className="empty-state">No active batches yet. Create your first batch.</div>
      ) : (
        <div className="batches-grid">
          {batches.map((batch) => (
            <article className="premium-card batch-card" key={batch.batchId}>
              <div className="batch-card-top">
                <span className="batch-color" />
                <span className="batch-status">Active</span>
              </div>
              <h3>{batch.name}</h3>
              <div className="batch-details">
                <p>
                  <strong>Subjects:</strong> {(batch.subjects ?? []).join(', ') || 'Not set'}
                </p>
                <p>
                  <strong>Students:</strong> {batch.enrollment?.filter((e) => e.status === 'active').length ?? 0}
                </p>
                <p>
                  <strong>Schedule:</strong> {batch.schedule?.time ?? 'Not set'}
                </p>
              </div>
              <div className="button-row mt-4">
                <Link className="btn-outline" to={`/tutor/dashboard/batches/${batch.batchId}`}>
                  Open
                </Link>
                <button className="btn-outline" onClick={() => setModal(batch)}>
                  Edit
                </button>
                <button className="danger-button" onClick={() => archive(batch.batchId)}>
                  Archive
                </button>
              </div>
            </article>
          ))}
        </div>
      )}
      {modal && <BatchFormModal batch={modal.batchId ? modal : null} onClose={() => setModal(null)} onSave={saveBatch} />}
      {scheduleOpen && <ScheduleClassModal batches={batches} onClose={() => setScheduleOpen(false)} onSave={schedule} />}
    </div>
  )
}

export function TutorStudentsPage() {
  const [students, setStudents] = useState([])
  const [tab, setTab] = useState('active')
  const [error, setError] = useState('')
  const [archiveView, setArchiveView] = useState(null)

  async function load() {
    const res = await batchApi.students()
    setStudents(usableStudents(res.students))
  }

  useEffect(() => {
    load().catch((err) => setError(err.message))
  }, [])

  async function removeFromBatch(student) {
    if (!window.confirm(`Remove ${student.name} from ${student.batchName}? Attendance and scores stay archived.`)) return
    try {
      await batchApi.removeStudent(student.batchId, student.studentId)
      await load()
    } catch (err) {
      setError(err.message)
    }
  }

  async function toggleAccess(student) {
    const pausing = student.accountStatus !== 'archived'
    const ok = window.confirm(
      pausing
        ? `Pause login access for ${student.name}? Their records stay archived.`
        : `Restore login access for ${student.name}?`,
    )
    if (!ok) return
    try {
      if (pausing) await userApi.archive(student.studentId)
      else await userApi.unarchive(student.studentId)
      await load()
    } catch (err) {
      setError(err.message)
    }
  }

  async function openArchive(student) {
    try {
      const [progress, attendance] = await Promise.all([
        progressApi.tutorStudent(student.studentId),
        attendanceApi.tutorStudent(student.studentId),
      ])
      setArchiveView({
        student,
        progress: progress.progress ?? [],
        attendance: attendance.attendance ?? [],
      })
    } catch (err) {
      setError(err.message)
    }
  }

  const filtered = students.filter((student) => {
    const archived = student.status === 'removed' || student.accountStatus === 'archived'
    return tab === 'archived' ? archived : !archived
  })

  return (
    <div>
      <div className="dashboard-header">
        <span className="eyebrow">Your community</span>
        <h1>Students</h1>
        <p>Remove a student from a batch or pause their login. Historical data is kept.</p>
      </div>
      <div className="button-row mb-6">
        <button type="button" className={`btn-outline ${tab === 'active' ? 'btn-primary' : ''}`} onClick={() => setTab('active')}>
          Active
        </button>
        <button type="button" className={`btn-outline ${tab === 'archived' ? 'btn-primary' : ''}`} onClick={() => setTab('archived')}>
          Archived
        </button>
      </div>
      {error && <ErrorState message={error} />}
      {filtered.length === 0 ? (
        <div className="empty-state">{tab === 'archived' ? 'No archived students.' : 'No students enrolled yet.'}</div>
      ) : (
        <div className="premium-table-container">
          <table className="premium-table">
            <thead>
              <tr>
                <th>Name</th>
                <th>Email</th>
                <th>Batch</th>
                <th>Parent</th>
                <th>Status</th>
                <th></th>
              </tr>
            </thead>
            <tbody>
              {filtered.map((student) => (
                <tr key={`${student.batchId}-${student.studentId}`}>
                  <td>{student.name}</td>
                  <td>{student.email ?? '—'}</td>
                  <td>{student.batchName}</td>
                  <td>{student.parentName ?? 'Not linked'}</td>
                  <td>
                    {student.status === 'removed'
                      ? 'Removed from batch'
                      : student.accountStatus === 'archived'
                        ? 'Access paused'
                        : 'Active'}
                  </td>
                  <td>
                    <div className="button-row">
                      <button type="button" className="btn-outline btn-sm" onClick={() => openArchive(student)}>
                        Records
                      </button>
                      {student.status !== 'removed' && (
                        <>
                          <button type="button" className="btn-outline btn-sm" onClick={() => toggleAccess(student)}>
                            {student.accountStatus === 'archived' ? 'Restore access' : 'Pause access'}
                          </button>
                          <button type="button" className="danger-button" onClick={() => removeFromBatch(student)}>
                            Remove
                          </button>
                        </>
                      )}
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {archiveView && (
        <div className="modal-overlay" onClick={() => setArchiveView(null)}>
          <div className="modal-card" onClick={(e) => e.stopPropagation()} style={{ maxWidth: 640 }}>
            <h2>{archiveView.student.name} — archived records</h2>
            <p className="modal-sub">
              {archiveView.student.batchName}. Attendance and scores stay after removal or pause.
            </p>
            <h3>Progress</h3>
            {archiveView.progress.length === 0 ? (
              <p className="text-muted">No progress entries.</p>
            ) : (
              <ul className="progress-feed">
                {archiveView.progress.slice(0, 12).map((p) => (
                  <li key={p._id}>
                    <strong>{p.subject ? `${p.subject} · ${p.topic}` : p.topic}</strong> — {p.score}/{p.maxScore}
                    {p.remark && <p className="text-muted">{p.remark}</p>}
                  </li>
                ))}
              </ul>
            )}
            <h3 className="mt-6">Attendance</h3>
            {archiveView.attendance.length === 0 ? (
              <p className="text-muted">No attendance records.</p>
            ) : (
              <ul className="session-list-mini">
                {archiveView.attendance.slice(0, 12).map((row) => (
                  <li key={row._id}>
                    {row.sessionDate ? new Date(row.sessionDate).toLocaleDateString() : 'Session'} · {row.status}
                    {row.sessionTopic ? ` · ${row.sessionTopic}` : ''}
                  </li>
                ))}
              </ul>
            )}
            <div className="modal-actions">
              <button type="button" className="btn-outline" onClick={() => setArchiveView(null)}>
                Close
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}

export function TutorAnalyticsPage() {
  const [overview, setOverview] = useState(null)
  const [batchStats, setBatchStats] = useState([])
  const [error, setError] = useState('')

  useEffect(() => {
    async function load() {
      try {
        const overviewRes = await analyticsApi.overview()
        setOverview(overviewRes)
        const list = await batchApi.list()
        const live = usableBatches(list.batches)
        const perBatch = await Promise.all(
          live.map(async (b) => {
            const stats = await analyticsApi.batch(b.batchId).catch(() => null)
            return stats ? { ...stats, batchId: stats.batchId ?? b.batchId } : null
          }),
        )
        setBatchStats(perBatch.filter(Boolean))
      } catch (err) {
        setError(err.message)
      }
    }
    load()
  }, [])

  const trends = overview?.scoreTrends ?? []
  const maxTrend = Math.max(100, ...trends.map((t) => t.averagePercent || 0))

  return (
    <div>
      <div className="dashboard-header">
        <span className="eyebrow">Performance</span>
        <h1>Analytics</h1>
        <p>Attendance percentage, score trends, and recent remarks.</p>
      </div>
      {error && <ErrorState message={error} />}
      {!overview && !error ? (
        <LoadingState />
      ) : (
        overview && (
          <>
            <div className="stats-grid">
              <div className="stat-card premium-card">
                <strong className="stat-number">
                  {overview.attendancePercentage != null ? `${overview.attendancePercentage}%` : '—'}
                </strong>
                <span className="text-muted">Attendance</span>
              </div>
              <div className="stat-card premium-card">
                <strong className="stat-number">{overview.batchCount}</strong>
                <span className="text-muted">Batches</span>
              </div>
              <div className="stat-card premium-card">
                <strong className="stat-number">{overview.totalStudents}</strong>
                <span className="text-muted">Students</span>
              </div>
              <div className="stat-card premium-card">
                <strong className="stat-number">{overview.completedSessions}</strong>
                <span className="text-muted">Completed classes</span>
              </div>
            </div>
            <section className="premium-card mt-6">
              <h2>Score trends</h2>
              {trends.length === 0 ? (
                <p className="text-muted mt-4">No scores recorded yet.</p>
              ) : (
                <div className="trend-chart mt-4">
                  {trends.map((point) => (
                    <div className="trend-bar" key={point.date} title={`${point.date}: ${point.averagePercent}%`}>
                      <div className="trend-fill" style={{ height: `${Math.max(6, (point.averagePercent / maxTrend) * 100)}%` }} />
                      <span>{point.averagePercent}%</span>
                      <small>{point.date.slice(5)}</small>
                    </div>
                  ))}
                </div>
              )}
            </section>
            <section className="premium-card mt-6">
              <h2>Recent progress remarks</h2>
              {(overview.recentRemarks ?? []).length === 0 ? (
                <p className="text-muted mt-4">No remarks yet.</p>
              ) : (
                <ul className="progress-feed mt-4">
                  {(overview.recentRemarks ?? []).map((row, i) => (
                    <li key={`${row.studentId}-${i}`} className="progress-item">
                      <strong>{row.subject ? `${row.subject} · ${row.topic}` : row.topic}</strong> — {row.score}/{row.maxScore}
                      <p className="text-muted">{row.remark}</p>
                    </li>
                  ))}
                </ul>
              )}
            </section>
            {batchStats.map((batch) => (
              <section className="premium-card mt-6" key={batch.batchId ?? batch.batchName}>
                <div className="section-heading">
                  <div>
                    <h2>{batch.batchName}</h2>
                    <p className="text-muted">{batch.totalSessions} sessions</p>
                  </div>
                  {batch.batchId && (
                    <div className="button-row">
                      <button type="button" className="btn-outline btn-sm" onClick={() => analyticsApi.exportAttendance(batch.batchId)}>
                        Export attendance
                      </button>
                      <button type="button" className="btn-outline btn-sm" onClick={() => analyticsApi.exportProgress(batch.batchId)}>
                        Export scores
                      </button>
                    </div>
                  )}
                </div>
                <div className="premium-table-container mt-4">
                  <table className="premium-table">
                    <thead>
                      <tr>
                        <th>Student</th>
                        <th>Attendance</th>
                      </tr>
                    </thead>
                    <tbody>
                      {(batch.studentStats ?? []).map((s) => (
                        <tr key={s.studentId}>
                          <td>{s.name}</td>
                          <td>{s.attendancePercentage != null ? `${s.attendancePercentage}%` : '—'}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </section>
            ))}
          </>
        )
      )}
    </div>
  )
}

function LearnerDashboard({ role }) {
  const [batches, setBatches] = useState([])
  const [sessions, setSessions] = useState([])
  const [error, setError] = useState('')
  useEffect(() => {
    const batchesRequest = role === 'parent' ? batchApi.getParentEnrolled() : batchApi.getStudentEnrolled()
    const sessionsRequest = role === 'parent' ? sessionApi.upcomingForParent() : sessionApi.upcomingForStudent()
    Promise.all([batchesRequest, sessionsRequest])
      .then(([batchRes, sessionRes]) => {
        setBatches(batchRes.batches ?? [])
        setSessions(sessionRes.sessions ?? [])
      })
      .catch((err) => setError(err.message))
  }, [role])
  const title = role === 'parent' ? 'Parent dashboard' : 'My learning'
  return (
    <div>
      <div className="dashboard-header">
        <h1>{title}</h1>
        <p>Keep track of classes, schedules, and learning progress.</p>
      </div>
      {error && <ErrorState message={error} />}
      <section className="premium-card mb-6">
        <h2>My batches</h2>
        {batches.length === 0 ? (
          <div className="empty-state">No active batches found.</div>
        ) : (
          <div className="batches-grid mt-4">
            {batches.map((batch) => (
              <article className="batch-card" key={batch.batchId}>
                <h3>{batch.name}</h3>
                <p className="text-muted">{(batch.subjects ?? []).join(', ') || 'No subjects'}</p>
              </article>
            ))}
          </div>
        )}
      </section>
      <section className="premium-card">
        <h2>Upcoming sessions</h2>
        {sessions.length === 0 ? (
          <div className="empty-state">No upcoming sessions.</div>
        ) : (
          <div className="session-list mt-4">
            {sessions.map((session) => (
              <div className="session-list-item" key={session._id}>
                <span>{new Date(session.date).toLocaleString()}</span>
                <strong>{session.topic}</strong>
                <span className={`status-badge ${session.status}`}>{session.status}</span>
              </div>
            ))}
          </div>
        )}
      </section>
    </div>
  )
}

export function StudentDashboardPage() {
  return <LearnerDashboard role="student" />
}

export function ParentDashboardPage() {
  return <LearnerDashboard role="parent" />
}
