import { useEffect, useState } from 'react'
import { Link, Outlet, useNavigate } from 'react-router-dom'
import { analyticsApi, batchApi, sessionApi, userApi } from '../../../lib/api'
import { BatchFormModal, ScheduleClassModal } from '../components/BatchFormModal'
import { TutorDashboardLayout } from '../components/TutorDashboardLayout'
import '../../../styles/dashboard.css'

const DEMO_BATCHES = [
  {
    batchId: 'demo-algebra',
    name: 'Grade 10 Mathematics',
    subjects: ['Algebra', 'Geometry'],
    schedule: { days: [1, 3, 5], time: '18:00' },
    enrollment: [{ status: 'active' }, { status: 'active' }, { status: 'active' }, { status: 'active' }, { status: 'active' }, { status: 'active' }, { status: 'active' }, { status: 'active' }],
  },
  {
    batchId: 'demo-science',
    name: 'Grade 9 Science',
    subjects: ['Physics', 'Chemistry'],
    schedule: { days: [2, 4], time: '17:00' },
    enrollment: [{ status: 'active' }, { status: 'active' }, { status: 'active' }, { status: 'active' }, { status: 'active' }],
  },
  {
    batchId: 'demo-foundation',
    name: 'Foundation Programme',
    subjects: ['English', 'Mathematics'],
    schedule: { days: [6], time: '10:00' },
    enrollment: [{ status: 'active' }, { status: 'active' }, { status: 'active' }, { status: 'active' }],
  },
]

const DEMO_SESSIONS = [
  { _id: 'demo-session-1', topic: 'Quadratic equations', batchId: 'demo-algebra', date: '2026-08-22T18:00:00', status: 'scheduled' },
  { _id: 'demo-session-2', topic: 'Newton’s laws of motion', batchId: 'demo-science', date: '2026-08-22T19:30:00', status: 'scheduled' },
  { _id: 'demo-session-3', topic: 'Geometry: circles', batchId: 'demo-algebra', date: '2026-08-24T18:00:00', status: 'scheduled' },
]

const DEMO_STUDENTS = [
  { studentId: 's1', name: 'Aarav Mehta', email: 'aarav@example.com', batchName: 'Grade 10 Mathematics', parentName: 'Priya Mehta', batchId: 'demo-algebra' },
  { studentId: 's2', name: 'Ishita Shah', email: 'ishita@example.com', batchName: 'Grade 10 Mathematics', parentName: 'Rahul Shah', batchId: 'demo-algebra' },
  { studentId: 's3', name: 'Vihaan Joshi', email: 'vihaan@example.com', batchName: 'Grade 9 Science', parentName: 'Neha Joshi', batchId: 'demo-science' },
  { studentId: 's4', name: 'Anaya Kulkarni', email: 'anaya@example.com', batchName: 'Foundation Programme', parentName: 'Sonal Kulkarni', batchId: 'demo-foundation' },
]

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

export function TutorDashboardShell() {
  return (
    <TutorDashboardLayout>
      <Outlet />
    </TutorDashboardLayout>
  )
}

export function TutorOverviewPage() {
  const [batches, setBatches] = useState([])
  const [sessions, setSessions] = useState([])
  const [isDemo, setIsDemo] = useState(false)

  const [analytics, setAnalytics] = useState(null)

  useEffect(() => {
    Promise.all([batchApi.list(), sessionApi.today(), analyticsApi.overview()])
      .then(([batchRes, sessionRes, overview]) => {
        const liveBatches = usableBatches(batchRes.batches)
        setBatches(liveBatches.length ? liveBatches : DEMO_BATCHES)
        const liveSessions = (sessionRes.sessions ?? []).filter((session) => !isTestRecord(session))
        setSessions(liveBatches.length ? liveSessions : DEMO_SESSIONS)
        setIsDemo(!liveBatches.length)
        setAnalytics(overview)
      })
      .catch(() => {
        setBatches(DEMO_BATCHES)
        setSessions(DEMO_SESSIONS)
        setIsDemo(true)
      })
  }, [])

  return (
    <div>
      <div className="dashboard-header dashboard-hero">
        <div>
          <span className="eyebrow">Friday, 21 August 2026</span>
          <h1>Good morning, Ankush</h1>
          <p>Here&apos;s what&apos;s happening across your learning studio today.</p>
        </div>
        <Link className="btn-primary" to="/tutor/dashboard/batches">+ Schedule a class</Link>
      </div>
      {isDemo && <div className="demo-notice"><span>✦</span><div><strong>Preview workspace</strong><p>You&apos;re viewing a realistic demo of your tutor dashboard. Connect the backend to see live data.</p></div></div>}
      <div className="stats-grid">
        <div className="stat-card premium-card"><span className="stat-icon blue">◈</span><strong className="stat-number">{batches.length}</strong><span className="text-muted">Active batches</span><small className="stat-trend">↑ 2 this month</small></div>
        <div className="stat-card premium-card"><span className="stat-icon amber">◷</span><strong className="stat-number">{sessions.length}</strong><span className="text-muted">Upcoming classes</span><small className="stat-trend">Next 7 days</small></div>
        <div className="stat-card premium-card"><span className="stat-icon green">♙</span><strong className="stat-number">{batches.reduce((total, batch) => total + (batch.enrollment?.filter((e) => e.status === 'active').length ?? 0), 0)}</strong><span className="text-muted">Active students</span><small className="stat-trend">↑ 8% this month</small></div>
        <div className="stat-card premium-card"><span className="stat-icon pink">↗</span><strong className="stat-number">{analytics?.attendancePercentage != null ? `${analytics.attendancePercentage}%` : '—'}</strong><span className="text-muted">Average attendance</span><small className="stat-trend">Across recorded sessions</small></div>
      </div>
      <div className="dashboard-columns mt-6">
      <section className="premium-card">
        <div className="section-heading"><div><span className="eyebrow">Your schedule</span><h2>Upcoming classes</h2></div><Link to="/tutor/dashboard/batches">View calendar →</Link></div>
        {sessions.length === 0 ? <div className="empty-state">No classes scheduled today.</div> : (
          <div className="session-list">
            {sessions.map((session) => (
              <Link className="session-list-item" key={session._id} to={`/tutor/dashboard/sessions/${session._id}`}>
                <span className="session-date">{new Date(session.date).toLocaleDateString([], { weekday: 'short', day: 'numeric' })}</span>
                <span className="session-time">{new Date(session.date).toLocaleTimeString([], { hour: 'numeric', minute: '2-digit' })}</span>
                <span className="session-info"><strong>{session.topic}</strong><small>{batches.find((b) => b.batchId === session.batchId)?.name ?? 'Class session'}</small></span>
                <span className={`status-badge ${session.status}`}>Open →</span>
              </Link>
            ))}
          </div>
        )}
      </section>
      <section className="premium-card attention-card"><div className="section-heading"><div><span className="eyebrow">Keep an eye on</span><h2>Needs your attention</h2></div></div><div className="attention-item"><span className="attention-dot amber" /><div><strong>3 assignments to review</strong><p>Grade 10 Mathematics · Due today</p></div><span>→</span></div><div className="attention-item"><span className="attention-dot blue" /><div><strong>2 students absent</strong><p>Across your last 3 sessions</p></div><span>→</span></div><div className="attention-item"><span className="attention-dot pink" /><div><strong>1 new message</strong><p>From Priya Mehta</p></div><span>→</span></div></section>
      </div>
      <section className="premium-card mt-6"><div className="section-heading"><div><span className="eyebrow">At a glance</span><h2>Your batches</h2></div><Link to="/tutor/dashboard/batches">Manage batches →</Link></div><div className="mini-batch-grid">{batches.map((batch) => <Link to={`/tutor/dashboard/batches/${batch.batchId}`} className="mini-batch" key={batch.batchId}><span className="batch-color" /><div><strong>{batch.name}</strong><p>{batch.enrollment?.filter((e) => e.status === 'active').length ?? 0} students · {(batch.subjects ?? []).join(' · ')}</p></div><span>→</span></Link>)}</div></section>
    </div>
  )
}

export function TutorBatchesPage() {
  const [batches, setBatches] = useState([])
  const [modal, setModal] = useState(null)
  const [scheduleOpen, setScheduleOpen] = useState(false)
  const [error, setError] = useState('')
  const [isDemo, setIsDemo] = useState(false)

  async function load() {
    const res = await batchApi.list()
    const liveBatches = usableBatches(res.batches)
    const nextBatches = liveBatches.length ? liveBatches : DEMO_BATCHES
    setBatches(nextBatches)
    setIsDemo(!liveBatches.length)
  }

  useEffect(() => { load().catch(() => { setBatches(DEMO_BATCHES); setIsDemo(true) }) }, [])

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
        <div><span className="eyebrow">Learning studio</span><h1>Batches</h1><p>Create classes and manage their weekly schedule.</p></div>
        <div className="button-row"><button className="btn-outline" onClick={() => setScheduleOpen(true)}>Schedule class</button><button className="btn-primary" onClick={() => setModal({})}>Create batch</button></div>
      </div>
      {isDemo && <div className="demo-notice"><span>✦</span><div><strong>Preview workspace</strong><p>These sample batches show how your classes will look once connected.</p></div></div>}
      {error && <ErrorState message={error} />}
      {batches.length === 0 ? <div className="empty-state">No active batches yet. Create your first batch.</div> : (
        <div className="batches-grid">
          {batches.map((batch) => (
            <article className="premium-card batch-card" key={batch.batchId}>
              <div className="batch-card-top"><span className="batch-color" /><span className="batch-status">Active</span></div><h3>{batch.name}</h3>
              <div className="batch-details">
                <p><strong>Subjects:</strong> {(batch.subjects ?? []).join(', ') || 'Not set'}</p>
                <p><strong>Students:</strong> {batch.enrollment?.filter((e) => e.status === 'active').length ?? 0}</p>
                <p><strong>Schedule:</strong> {batch.schedule?.time ?? 'Not set'}</p>
              </div>
              <div className="button-row mt-4">
                <Link className="btn-outline" to={`/tutor/dashboard/batches/${batch.batchId}`}>Open</Link>
                <button className="btn-outline" onClick={() => setModal(batch)}>Edit</button>
                <button className="danger-button" onClick={() => archive(batch.batchId)}>Archive</button>
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
  const [isDemo, setIsDemo] = useState(false)
  useEffect(() => {
    batchApi.students()
      .then((res) => {
        const liveStudents = usableStudents(res.students)
        setStudents(liveStudents.length ? liveStudents : DEMO_STUDENTS)
        setIsDemo(!liveStudents.length)
      })
      .catch(() => {
        setStudents(DEMO_STUDENTS)
        setIsDemo(true)
      })
  }, [])
  return (
    <div>
      <div className="dashboard-header"><span className="eyebrow">Your community</span><h1>Students</h1><p>All students enrolled in your active batches.</p></div>
      {isDemo && <div className="demo-notice"><span>✦</span><div><strong>Preview workspace</strong><p>Sample student records are displayed until the backend is connected.</p></div></div>}
      {students.length === 0 ? <div className="empty-state">No students enrolled yet.</div> : (
        <div className="premium-table-container"><table className="premium-table"><thead><tr><th>Name</th><th>Email</th><th>Batch</th><th>Parent</th></tr></thead><tbody>
          {students.map((student) => <tr key={`${student.batchId}-${student.studentId}`}><td>{student.name}</td><td>{student.email ?? '—'}</td><td>{student.batchName}</td><td>{student.parentName ?? 'Not linked'}</td></tr>)}
        </tbody></table></div>
      )}
    </div>
  )
}

export function TutorAnalyticsPage() {
  const [data, setData] = useState(null)
  const [error, setError] = useState('')
  useEffect(() => { analyticsApi.overview().then(setData).catch((err) => setError(err.message)) }, [])
  return <div><div className="dashboard-header"><span className="eyebrow">Performance</span><h1>Analytics</h1><p>Monitor attendance and progress across your batches.</p></div>{error && <ErrorState message={error} />}{!data && !error ? <LoadingState /> : data && <pre className="premium-card analytics-json">{JSON.stringify(data, null, 2)}</pre>}</div>
}

export function BatchDetailsPage() {
  const navigate = useNavigate()
  return <div><button className="back-btn" onClick={() => navigate('/tutor/dashboard/batches')}>← Back to batches</button><div className="dashboard-header"><h1>Batch workspace</h1><p>Choose a session to take attendance, share resources, and record progress.</p></div><div className="empty-state">Select a scheduled session from the overview to open its workspace.</div></div>
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
      <div className="dashboard-header"><h1>{title}</h1><p>Keep track of classes, schedules, and learning progress.</p></div>
      {error && <ErrorState message={error} />}
      <section className="premium-card mb-6"><h2>My batches</h2>{batches.length === 0 ? <div className="empty-state">No active batches found.</div> : <div className="batches-grid mt-4">{batches.map((batch) => <article className="batch-card" key={batch.batchId}><h3>{batch.name}</h3><p className="text-muted">{(batch.subjects ?? []).join(', ') || 'Subjects coming soon'}</p></article>)}</div>}</section>
      <section className="premium-card"><h2>Upcoming sessions</h2>{sessions.length === 0 ? <div className="empty-state">No upcoming sessions.</div> : <div className="session-list mt-4">{sessions.map((session) => <div className="session-list-item" key={session._id}><span>{new Date(session.date).toLocaleString()}</span><strong>{session.topic}</strong><span className={`status-badge ${session.status}`}>{session.status}</span></div>)}</div>}</section>
    </div>
  )
}

export function StudentDashboardPage() {
  return <LearnerDashboard role="student" />
}

export function ParentDashboardPage() {
  return <LearnerDashboard role="parent" />
}
