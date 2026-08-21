import { useState, useEffect } from 'react'
import { useParams, useNavigate } from 'react-router-dom'
import {
  sessionApi,
  attendanceApi,
  announcementApi,
  resourceApi,
  progressApi,
  batchApi,
} from '../../../lib/api'
import '../../../styles/session.css'
import '../../../styles/dashboard.css'

export function SessionWorkspacePage() {
  const { sessionId } = useParams()
  const navigate = useNavigate()

  const [session, setSession] = useState(null)
  const [students, setStudents] = useState([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState(null)

  const [attendance, setAttendance] = useState({})
  const [activeTab, setActiveTab] = useState('attendance')
  const [saving, setSaving] = useState(false)
  const [successMsg, setSuccessMsg] = useState(null)

  const [announcementText, setAnnouncementText] = useState('')
  const [announcements, setAnnouncements] = useState([])

  const [resources, setResources] = useState([])
  const [linkTitle, setLinkTitle] = useState('')
  const [linkUrl, setLinkUrl] = useState('')
  const [uploadFile, setUploadFile] = useState(null)

  const [progressEntries, setProgressEntries] = useState([])
  const [progressForm, setProgressForm] = useState({
    studentId: '',
    subject: '',
    topic: '',
    score: '',
    maxScore: '100',
    remark: '',
  })

  useEffect(() => {
    loadSession()
  }, [sessionId])

  async function loadSession() {
    try {
      setLoading(true)
      setError(null)

      const res = await sessionApi.getById(sessionId)
      const batchRes = await batchApi.get(res.session.batchId).catch(() => null)
      setSession({ ...res.session, subjects: batchRes?.batch?.subjects ?? [] })

      const [studentsRes, attRes] = await Promise.all([
        sessionApi.getStudents(sessionId),
        attendanceApi.getBySession(sessionId),
      ])

      setStudents(studentsRes.students)
      if (studentsRes.students[0] && !progressForm.studentId) {
        setProgressForm((prev) => ({ ...prev, studentId: studentsRes.students[0].studentId }))
      }

      const attMap = {}
      attRes.attendance.forEach((record) => {
        attMap[record.studentId] = record.status
      })
      setAttendance(attMap)

      const [annRes, resRes, progRes] = await Promise.all([
        announcementApi.getByBatch(res.session.batchId),
        resourceApi.getByBatch(res.session.batchId),
        progressApi.getBySession(sessionId),
      ])
      setAnnouncements(annRes.announcements)
      setResources(resRes.resources)
      setProgressEntries(progRes.progress)
    } catch (err) {
      setError(err.message)
    } finally {
      setLoading(false)
    }
  }

  const markAttendance = (studentId, status) => {
    setAttendance((prev) => ({ ...prev, [studentId]: status }))
  }

  const handleSaveAttendance = async () => {
    try {
      setSaving(true)
      setSuccessMsg(null)
      setError(null)

      const records = Object.keys(attendance).map((studentId) => ({
        studentId,
        status: attendance[studentId],
      }))

      await attendanceApi.save(sessionId, {
        batchId: session.batchId,
        records,
      })

      if (session.status === 'scheduled') {
        await sessionApi.updateStatus(sessionId, 'active')
        setSession((prev) => ({ ...prev, status: 'active' }))
      }

      setSuccessMsg('Attendance saved successfully')
      setTimeout(() => setSuccessMsg(null), 3000)
    } catch (err) {
      setError(err.message || 'Failed to save attendance')
    } finally {
      setSaving(false)
    }
  }

  const handleClearAttendance = async (studentId) => {
    try {
      setSaving(true)
      await attendanceApi.remove(sessionId, studentId)
      setAttendance((prev) => {
        const next = { ...prev }
        delete next[studentId]
        return next
      })
      setSuccessMsg('Attendance record deleted')
      setTimeout(() => setSuccessMsg(null), 3000)
    } catch (err) {
      setError(err.message)
    } finally {
      setSaving(false)
    }
  }

  const handleFinishSession = async () => {
    try {
      setSaving(true)
      await sessionApi.updateStatus(sessionId, 'completed')
      navigate('/tutor/dashboard')
    } catch (err) {
      setError(err.message)
      setSaving(false)
    }
  }

  const handlePostAnnouncement = async () => {
    if (!announcementText.trim()) return
    try {
      setSaving(true)
      const res = await announcementApi.create({
        batchId: session.batchId,
        text: announcementText.trim(),
      })
      setAnnouncements((prev) => [res.announcement, ...prev])
      setAnnouncementText('')
      setSuccessMsg('Announcement posted')
      setTimeout(() => setSuccessMsg(null), 3000)
    } catch (err) {
      setError(err.message)
    } finally {
      setSaving(false)
    }
  }

  const handleUploadResource = async () => {
    if (!uploadFile) return
    try {
      setSaving(true)
      const res = await resourceApi.upload(session.batchId, uploadFile)
      setResources((prev) => [res.resource, ...prev])
      setUploadFile(null)
      setSuccessMsg('File uploaded')
      setTimeout(() => setSuccessMsg(null), 3000)
    } catch (err) {
      setError(err.message)
    } finally {
      setSaving(false)
    }
  }

  const handleAddLink = async () => {
    if (!linkTitle.trim() || !linkUrl.trim()) return
    try {
      setSaving(true)
      const res = await resourceApi.addLink({
        batchId: session.batchId,
        title: linkTitle.trim(),
        url: linkUrl.trim(),
      })
      setResources((prev) => [res.resource, ...prev])
      setLinkTitle('')
      setLinkUrl('')
      setSuccessMsg('Link added')
      setTimeout(() => setSuccessMsg(null), 3000)
    } catch (err) {
      setError(err.message)
    } finally {
      setSaving(false)
    }
  }

  const handleAddProgress = async (e) => {
    e.preventDefault()
    try {
      setSaving(true)
      const res = await progressApi.create({
        batchId: session.batchId,
        sessionId,
        studentId: progressForm.studentId,
        subject: progressForm.subject.trim(),
        topic: progressForm.topic.trim(),
        score: Number(progressForm.score),
        maxScore: Number(progressForm.maxScore),
        remark: progressForm.remark.trim(),
      })
      setProgressEntries((prev) => [res.progress, ...prev])
      setProgressForm((prev) => ({ ...prev, subject: '', topic: '', score: '', remark: '' }))
      setSuccessMsg('Progress saved')
      setTimeout(() => setSuccessMsg(null), 3000)
    } catch (err) {
      setError(err.message)
    } finally {
      setSaving(false)
    }
  }

  if (loading) return <div className="dashboard-content-wrap">Loading session...</div>
  if (error && !session) {
    return (
      <div className="dashboard-content-wrap">
        <div className="alert error">{error}</div>
      </div>
    )
  }

  return (
    <div className="dashboard-content-wrap session-workspace">
      <div className="workspace-header">
        <button type="button" onClick={() => navigate(-1)} className="back-btn">
          ← Back
        </button>
        <div className="session-meta">
          <span className={`status-badge ${session?.status}`}>{session?.status}</span>
          <h1>{session?.topic}</h1>
          <p>
            {new Date(session?.date).toLocaleDateString()} • Batch: {session?.batchId}
          </p>
        </div>
        <div className="workspace-actions">
          {session?.status !== 'completed' && (
            <button type="button" onClick={handleFinishSession} className="btn-primary" disabled={saving}>
              Finish Session
            </button>
          )}
        </div>
      </div>

      {error && <div className="alert error">{error}</div>}
      {successMsg && <div className="alert success">{successMsg}</div>}

      <div className="workspace-body">
        <div className="workspace-tabs">
          {['attendance', 'notes', 'progress', 'announcement'].map((tab) => (
            <button
              key={tab}
              type="button"
              className={activeTab === tab ? 'active' : ''}
              onClick={() => setActiveTab(tab)}
            >
              {tab === 'notes' ? 'Notes & Resources' : tab.charAt(0).toUpperCase() + tab.slice(1)}
            </button>
          ))}
        </div>

        <div className="workspace-content premium-card">
          {activeTab === 'attendance' && (
            <div className="attendance-view">
              <h2>Mark Attendance</h2>
              <p className="text-muted mb-4">Click to mark student status</p>

              {students.length === 0 ? (
                <div className="empty-state">
                  <p>No students enrolled in this batch yet. Generate invite links from Overview.</p>
                </div>
              ) : (
                <>
                  <div className="attendance-list">
                    {students.map((student) => (
                      <div key={student.studentId} className="attendance-row">
                        <div className="student-name">{student.name}</div>
                        <div className="attendance-actions">
                          {['present', 'absent', 'late'].map((status) => (
                            <button
                              key={status}
                              type="button"
                              className={`att-btn ${status} ${attendance[student.studentId] === status ? 'selected' : ''}`}
                              onClick={() => markAttendance(student.studentId, status)}
                            >
                              {status.charAt(0).toUpperCase() + status.slice(1)}
                            </button>
                          ))}
                          {attendance[student.studentId] && (
                            <button
                              type="button"
                              className="danger-button"
                              onClick={() => handleClearAttendance(student.studentId)}
                            >
                              Delete
                            </button>
                          )}
                        </div>
                      </div>
                    ))}
                  </div>

                  <div className="mt-6 text-right">
                    <button type="button" onClick={handleSaveAttendance} className="btn-primary" disabled={saving}>
                      {saving ? 'Saving...' : 'Save Attendance'}
                    </button>
                  </div>
                </>
              )}
            </div>
          )}

          {activeTab === 'notes' && (
            <div className="notes-view">
              <h2>Notes & Resources</h2>

              <div className="resource-upload mb-6">
                <h3>Upload file</h3>
                <input type="file" accept=".pdf,.png,.jpg,.jpeg,.webp,.txt,.doc,.docx" onChange={(e) => setUploadFile(e.target.files?.[0] ?? null)} />
                <button type="button" className="btn-primary mt-4" onClick={handleUploadResource} disabled={!uploadFile || saving}>
                  Upload
                </button>
              </div>

              <div className="resource-link mb-6">
                <h3>Add external link</h3>
                <div className="auth-field">
                  <input value={linkTitle} onChange={(e) => setLinkTitle(e.target.value)} placeholder="Title" />
                </div>
                <div className="auth-field">
                  <input value={linkUrl} onChange={(e) => setLinkUrl(e.target.value)} placeholder="https://..." />
                </div>
                <button type="button" className="btn-outline" onClick={handleAddLink} disabled={saving}>
                  Add link
                </button>
              </div>

              {resources.length === 0 ? (
                <div className="empty-state">
                  <p>No resources shared yet for this batch.</p>
                </div>
              ) : (
                <ul className="resource-list">
                  {resources.map((r) => (
                    <li key={r._id}>
                      {r.type === 'file' ? (
                        <a href={r.url} target="_blank" rel="noreferrer">
                          {r.title}
                        </a>
                      ) : (
                        <a href={r.url} target="_blank" rel="noreferrer">
                          {r.title} (link)
                        </a>
                      )}
                      <span className="text-muted text-sm">{new Date(r.createdAt).toLocaleDateString()}</span>
                    </li>
                  ))}
                </ul>
              )}
            </div>
          )}

          {activeTab === 'progress' && (
            <div className="progress-view">
              <h2>Student Progress</h2>

              {students.length === 0 ? (
                <div className="empty-state">
                  <p>Add students to the batch before recording progress.</p>
                </div>
              ) : (
                <form className="progress-form mb-6" onSubmit={handleAddProgress}>
                  <div className="auth-field">
                    <label htmlFor="prog-student">Student</label>
                    <select
                      id="prog-student"
                      value={progressForm.studentId}
                      onChange={(e) => setProgressForm({ ...progressForm, studentId: e.target.value })}
                      required
                    >
                      {students.map((s) => (
                        <option key={s.studentId} value={s.studentId}>
                          {s.name}
                        </option>
                      ))}
                    </select>
                  </div>
                  <div className="auth-field">
                    <label htmlFor="prog-subject">Subject</label>
                    <input
                      id="prog-subject"
                      value={progressForm.subject}
                      onChange={(e) => setProgressForm({ ...progressForm, subject: e.target.value })}
                      placeholder={session?.batchId ? 'Algebra' : 'Subject'}
                      list="batch-subjects"
                    />
                    <datalist id="batch-subjects">
                      {(session?.subjects ?? []).map((s) => (
                        <option key={s} value={s} />
                      ))}
                    </datalist>
                  </div>
                  <div className="auth-field">
                    <label htmlFor="prog-topic">Topic / test</label>
                    <input
                      id="prog-topic"
                      value={progressForm.topic}
                      onChange={(e) => setProgressForm({ ...progressForm, topic: e.target.value })}
                      placeholder="Unit Test 1"
                      required
                    />
                  </div>
                  <div className="invite-grid">
                    <div className="auth-field">
                      <label htmlFor="prog-score">Score</label>
                      <input
                        id="prog-score"
                        type="number"
                        value={progressForm.score}
                        onChange={(e) => setProgressForm({ ...progressForm, score: e.target.value })}
                        required
                      />
                    </div>
                    <div className="auth-field">
                      <label htmlFor="prog-max">Max score</label>
                      <input
                        id="prog-max"
                        type="number"
                        value={progressForm.maxScore}
                        onChange={(e) => setProgressForm({ ...progressForm, maxScore: e.target.value })}
                        required
                      />
                    </div>
                  </div>
                  <div className="auth-field">
                    <label htmlFor="prog-remark">Remark</label>
                    <input
                      id="prog-remark"
                      value={progressForm.remark}
                      onChange={(e) => setProgressForm({ ...progressForm, remark: e.target.value })}
                      placeholder="Optional note"
                    />
                  </div>
                  <button type="submit" className="btn-primary" disabled={saving}>
                    Add progress entry
                  </button>
                </form>
              )}

              {progressEntries.length > 0 && (
                <ul className="progress-feed">
                  {progressEntries.map((p) => (
                    <li key={p._id} className="progress-item">
                      <strong>{p.subject ? `${p.subject} · ${p.topic}` : p.topic}</strong> — {p.score}/{p.maxScore}
                      {p.remark && <p className="text-muted">{p.remark}</p>}
                    </li>
                  ))}
                </ul>
              )}
            </div>
          )}

          {activeTab === 'announcement' && (
            <div className="announcement-view">
              <h2>Post Announcement</h2>
              <p className="text-muted mb-4">Visible to all students and parents in this batch.</p>
              <textarea
                className="form-input"
                rows="4"
                value={announcementText}
                onChange={(e) => setAnnouncementText(e.target.value)}
                placeholder="Type your announcement here..."
              />
              <div className="mt-4 text-right">
                <button type="button" className="btn-primary" onClick={handlePostAnnouncement} disabled={saving}>
                  Post
                </button>
              </div>

              {announcements.length > 0 && (
                <div className="mt-8">
                  <h3>Previous announcements</h3>
                  <ul className="announcement-list">
                    {announcements.map((a) => (
                      <li key={a._id} className="announcement-item">
                        <p>{a.text}</p>
                        <span className="text-muted text-sm">{new Date(a.createdAt).toLocaleString()}</span>
                      </li>
                    ))}
                  </ul>
                </div>
              )}
            </div>
          )}
        </div>
      </div>
    </div>
  )
}
