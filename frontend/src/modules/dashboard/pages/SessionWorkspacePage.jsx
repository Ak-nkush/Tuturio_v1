import { useState, useEffect, useRef } from 'react'
import { useParams, useNavigate } from 'react-router-dom'
import {
  sessionApi,
  attendanceApi,
  analyticsApi,
  formatDateTime,
} from '../../../lib/api'
import '../../../styles/session.css'
import '../../../styles/dashboard.css'

const STATUS_OPTIONS = ['present', 'absent', 'late', 'excused']

const STATUS_STYLE = {
  present: { background: 'rgba(52, 211, 153, 0.16)', color: '#34d399', border: '1px solid rgba(52, 211, 153, 0.4)' },
  absent:  { background: 'rgba(248, 113, 113, 0.16)', color: '#f87171', border: '1px solid rgba(248, 113, 113, 0.4)' },
  late:    { background: 'rgba(251, 191, 36, 0.16)', color: '#fbbf24', border: '1px solid rgba(251, 191, 36, 0.4)' },
  excused: { background: 'rgba(96, 165, 250, 0.16)', color: '#60a5fa', border: '1px solid rgba(96, 165, 250, 0.4)' },
}

function StatusSelect({ value, onChange, disabled }) {
  const style = value ? STATUS_STYLE[value] : { background: 'rgba(255, 255, 255, 0.05)', color: 'var(--chalk-dim, #b9c2bc)', border: '1px solid var(--rule, rgba(244, 241, 230, 0.18))' }
  return (
    <select
      value={value ?? ''}
      onChange={(e) => onChange(e.target.value || null)}
      disabled={disabled}
      className="att-select"
      style={{
        ...style,
        borderRadius: 8,
        padding: '6px 12px',
        fontWeight: value ? 600 : 400,
        fontSize: '0.875rem',
        cursor: disabled ? 'default' : 'pointer',
        minWidth: 140,
        outline: 'none',
      }}
    >
      <option value="" style={{ background: '#1d3931', color: '#b9c2bc' }}>— not marked —</option>
      {STATUS_OPTIONS.map((s) => (
        <option key={s} value={s} style={{ background: '#1d3931', color: '#f4f1e6' }}>
          {s.charAt(0).toUpperCase() + s.slice(1)}
        </option>
      ))}
    </select>
  )
}

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

  // Export & Chat state
  const [exporting, setExporting] = useState(false)
  const [sendingChat, setSendingChat] = useState(false)

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
    setAttendance((prev) => ({ ...prev, [studentId]: status === null ? undefined : status }))
  }

  const handleSaveAttendance = async () => {
    try {
      setSaving(true)
      setSuccessMsg(null)
      setError(null)

      const records = Object.keys(attendance)
        .filter((sid) => attendance[sid])
        .map((studentId) => {
          const status = attendance[studentId]
          const record = { studentId, status }
          if (savedAttendance[studentId] && savedAttendance[studentId] !== status) {
            record.note = correctionNote.trim() || `Changed from ${savedAttendance[studentId]} to ${status}`
          }
          return record
        })

      await attendanceApi.save(sessionId, { batchId: session.batchId, records })

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

  // ── Export ──────────────────────────────────────────────────────────────────
  const handleExport = async () => {
    if (!session?.batchId) return
    try {
      setExporting(true)
      setError(null)
      const hasUnsaved = Object.keys(attendance).some((sid) => attendance[sid] !== savedAttendance[sid])
      if (hasUnsaved) {
        const records = Object.keys(attendance)
          .filter((sid) => attendance[sid])
          .map((studentId) => {
            const status = attendance[studentId]
            const record = { studentId, status }
            if (savedAttendance[studentId] && savedAttendance[studentId] !== status) {
              record.note = correctionNote.trim() || `Changed from ${savedAttendance[studentId]} to ${status}`
            }
            return record
          })
        await attendanceApi.save(sessionId, { batchId: session.batchId, records })
        setSavedAttendance({ ...attendance })
      }
      await analyticsApi.exportAttendance(session.batchId, sessionId)
    } catch (err) {
      setError(err.message || 'Export failed')
    } finally {
      setExporting(false)
    }
  }

  // ── Send via Chat ───────────────────────────────────────────────────────────
  const handleSendViaChat = async () => {
    if (!session?.batchId) return
    try {
      setSendingChat(true)
      setError(null)
      const hasUnsaved = Object.keys(attendance).some((sid) => attendance[sid] !== savedAttendance[sid])
      if (hasUnsaved) {
        const records = Object.keys(attendance)
          .filter((sid) => attendance[sid])
          .map((studentId) => {
            const status = attendance[studentId]
            const record = { studentId, status }
            if (savedAttendance[studentId] && savedAttendance[studentId] !== status) {
              record.note = correctionNote.trim() || `Changed from ${savedAttendance[studentId]} to ${status}`
            }
            return record
          })
        await attendanceApi.save(sessionId, { batchId: session.batchId, records })
        setSavedAttendance({ ...attendance })
      }
      const { blob, filename } = await attendanceApi.exportSessionBlob(session.batchId, sessionId)
      // Store blob in sessionStorage as data URL so chat page can pick it up
      const reader = new FileReader()
      reader.onload = () => {
        try {
          sessionStorage.setItem('chatAttachment', JSON.stringify({ dataUrl: reader.result, filename }))
          navigate('/tutor/dashboard/chat')
        } catch {
          setError('Could not prepare file for chat. Try exporting and attaching manually.')
        }
      }
      reader.readAsDataURL(blob)
    } catch (err) {
      setError(err.message || 'Could not prepare file')
    } finally {
      setSendingChat(false)
    }
  }

  // ─── Render ─────────────────────────────────────────────────────────────────

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

  const markedCount = Object.values(attendance).filter(Boolean).length

  return (
    <div className="dashboard-content-wrap session-workspace">
      {/* Top toolbar */}
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

      {/* Session meta */}
      <div className="workspace-header">
        <div className="session-meta">
          <span className={`status-badge ${session?.status}`}>{session?.status}</span>
          <h1>{session?.topic}</h1>
          <p>{formatDateTime(session?.date)}</p>
        </div>
      </div>

      {/* Alerts */}
      {error && <div className="alert error">{error}</div>}
      {successMsg && <div className="alert success">{successMsg}</div>}

      <div className="workspace-body">
        <div className="workspace-content premium-card">

          {/* Spreadsheet header */}
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: '0.75rem', marginBottom: '1rem' }}>
            <div>
              <h2 style={{ margin: 0 }}>Attendance Sheet</h2>
              <p className="text-muted" style={{ margin: '4px 0 0' }}>
                {markedCount} of {students.length} students marked
              </p>
            </div>

            {/* Export & Chat toolbar */}
            {students.length > 0 && (
              <div className="button-row" style={{ gap: '0.5rem' }}>
                <button
                  type="button"
                  className="btn-outline btn-sm"
                  onClick={handleExport}
                  disabled={exporting || saving}
                  title="Export attendance as .xlsx"
                >
                  {exporting ? 'Exporting…' : '↗ Export .xlsx'}
                </button>
                <button
                  type="button"
                  className="btn-outline btn-sm"
                  onClick={handleSendViaChat}
                  disabled={sendingChat || saving}
                  title="Export this sheet and open it in the chat composer"
                >
                  {sendingChat ? 'Preparing…' : '💬 Send via Chat'}
                </button>
              </div>
            )}
          </div>

          {/* Spreadsheet grid */}
          {students.length === 0 ? (
            <div className="empty-state">
              <p>No students enrolled in this batch yet. Generate invite links from the batch.</p>
            </div>
          ) : (
            <>
              {/* Premium Attendance Grid */}
              <div className="premium-table-container">
                <table className="premium-table" style={{ minWidth: '100%' }}>
                  <thead>
                    <tr>
                      <th style={{ width: '45%' }}>Student Name</th>
                      <th style={{ width: '25%' }}>Email</th>
                      <th style={{ width: '30%', textAlign: 'center' }}>
                        {formatDateTime(session?.date)?.split(',')[0] ?? 'Today'} · Status
                      </th>
                    </tr>
                  </thead>
                  <tbody>
                    {students.map((student) => {
                      const currentStatus = attendance[student.studentId]
                      const lastCorrection = attendanceRecords
                        .find((r) => r.studentId === student.studentId)
                        ?.corrections?.at(-1)
                      return (
                        <tr key={student.studentId}>
                          <td style={{ verticalAlign: 'middle' }}>
                            <div style={{ fontWeight: 600, color: 'var(--chalk, #f4f1e6)', fontSize: '0.95rem' }}>
                              {student.name}
                            </div>
                            {lastCorrection && (
                              <div style={{ fontSize: '0.75rem', color: 'var(--teacher, #6fb6c1)', marginTop: '3px' }}>
                                ✎ Last correction: {lastCorrection.note}
                              </div>
                            )}
                          </td>
                          <td style={{ verticalAlign: 'middle', color: 'var(--chalk-dim, #b9c2bc)', fontSize: '0.85rem' }}>
                            {student.email || '—'}
                          </td>
                          <td style={{ verticalAlign: 'middle', textAlign: 'center' }}>
                            <StatusSelect
                              value={currentStatus}
                              onChange={(status) => markAttendance(student.studentId, status)}
                              disabled={saving}
                            />
                          </td>
                        </tr>
                      )
                    })}
                  </tbody>
                </table>
              </div>

              {/* Correction note + Save */}
              <div className="auth-field mt-4">
                <label htmlFor="correction-note">Note (optional — shown when changing a saved mark)</label>
                <input
                  id="correction-note"
                  value={correctionNote}
                  onChange={(e) => setCorrectionNote(e.target.value)}
                  placeholder="Why this status is being changed"
                />
              </div>
              <div className="form-actions">
                <button type="button" onClick={handleSaveAttendance} className="btn-primary" disabled={saving}>
                  {saving ? 'Saving…' : 'Save Attendance'}
                </button>
              </div>
            </>
          )}
        </div>
      </div>
    </div>
  )
}
