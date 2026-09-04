import { useState, useEffect } from 'react'
import { useParams, useNavigate } from 'react-router-dom'
import {
  sessionApi,
  attendanceApi,
  formatDateTime,
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
  const [savedAttendance, setSavedAttendance] = useState({})
  const [attendanceRecords, setAttendanceRecords] = useState([])
  const [correctionNote, setCorrectionNote] = useState('')
  const [saving, setSaving] = useState(false)
  const [successMsg, setSuccessMsg] = useState(null)

  useEffect(() => {
    loadSession()
  }, [sessionId])

  async function loadSession() {
    try {
      setLoading(true)
      setError(null)

      const res = await sessionApi.getById(sessionId)
      setSession(res.session)

      const [studentsRes, attRes] = await Promise.all([
        sessionApi.getStudents(sessionId),
        attendanceApi.getBySession(sessionId),
      ])

      setStudents(studentsRes.students)

      const attMap = {}
      attRes.attendance.forEach((record) => {
        attMap[record.studentId] = record.status
      })
      setAttendance(attMap)
      setSavedAttendance({ ...attMap })
      setAttendanceRecords(attRes.attendance ?? [])
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

      const records = Object.keys(attendance).map((studentId) => {
        const status = attendance[studentId]
        const record = { studentId, status }
        if (savedAttendance[studentId] && savedAttendance[studentId] !== status) {
          record.note = correctionNote.trim() || `Changed from ${savedAttendance[studentId]} to ${status}`
        }
        return record
      })

      await attendanceApi.save(sessionId, {
        batchId: session.batchId,
        records,
      })

      if (session.status === 'scheduled') {
        await sessionApi.updateStatus(sessionId, 'active')
        setSession((prev) => ({ ...prev, status: 'active' }))
      }

      setSuccessMsg('Attendance saved successfully')
      setCorrectionNote('')
      const attRes = await attendanceApi.getBySession(sessionId)
      const attMap = {}
      attRes.attendance.forEach((record) => {
        attMap[record.studentId] = record.status
      })
      setAttendance(attMap)
      setSavedAttendance({ ...attMap })
      setAttendanceRecords(attRes.attendance ?? [])
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
      if (session?.batchId) {
        navigate(`/tutor/dashboard/batches/${session.batchId}?section=attendance`)
      } else {
        navigate('/tutor/dashboard')
      }
    } catch (err) {
      setError(err.message)
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

  const backTo = session?.batchId
    ? `/tutor/dashboard/batches/${session.batchId}?section=attendance`
    : '/tutor/dashboard/batches'

  return (
    <div className="dashboard-content-wrap session-workspace">
      <div className="page-toolbar">
        <button type="button" onClick={() => navigate(backTo)} className="back-btn">
          ← Back
        </button>
        {session?.status !== 'completed' && (
          <button type="button" onClick={handleFinishSession} className="btn-primary" disabled={saving}>
            Finish Session
          </button>
        )}
      </div>
      <div className="workspace-header">
        <div className="session-meta">
          <span className={`status-badge ${session?.status}`}>{session?.status}</span>
          <h1>{session?.topic}</h1>
          <p>{formatDateTime(session?.date)}</p>
        </div>
      </div>

      {error && <div className="alert error">{error}</div>}
      {successMsg && <div className="alert success">{successMsg}</div>}

      <div className="workspace-body">
        <div className="workspace-content premium-card">
          <div className="attendance-view">
            <h2>Mark Attendance</h2>
            <p className="text-muted mb-4">
              Choose Present, Absent, Late, or Excused for each student, then save. You can change Present to Absent and save again.
            </p>

            {students.length === 0 ? (
              <div className="empty-state">
                <p>No students enrolled in this batch yet. Generate invite links from the batch.</p>
              </div>
            ) : (
              <>
                <div className="attendance-list">
                  {students.map((student) => (
                    <div key={student.studentId} className="attendance-row">
                      <div className="student-name">{student.name}</div>
                      <div className="attendance-actions">
                        {['present', 'absent', 'late', 'excused'].map((status) => (
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
                      {attendanceRecords.find((row) => row.studentId === student.studentId)?.corrections?.length > 0 && (
                        <p className="text-muted text-sm">
                          Last correction: {attendanceRecords.find((row) => row.studentId === student.studentId).corrections.at(-1).note}
                          {' · '}
                          {formatDateTime(attendanceRecords.find((row) => row.studentId === student.studentId).corrections.at(-1).changedAt)}
                        </p>
                      )}
                    </div>
                  ))}
                </div>

                <div className="auth-field mt-4">
                  <label htmlFor="correction-note">Note (optional when changing a saved mark)</label>
                  <input
                    id="correction-note"
                    value={correctionNote}
                    onChange={(e) => setCorrectionNote(e.target.value)}
                    placeholder="Why this status is being changed"
                  />
                </div>
                <div className="form-actions">
                  <button type="button" onClick={handleSaveAttendance} className="btn-primary" disabled={saving}>
                    {saving ? 'Saving...' : 'Save Attendance'}
                  </button>
                </div>
              </>
            )}
          </div>
        </div>
      </div>
    </div>
  )
}
