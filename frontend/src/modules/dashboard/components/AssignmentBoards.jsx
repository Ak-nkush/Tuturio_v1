import { useEffect, useState } from 'react'
import { assignmentApi, formatDateTime } from '../../../lib/api'

const FILE_ACCEPT = '.pdf,.png,.jpg,.jpeg,.webp,.txt,.doc,.docx,image/gif'

function localDateTimeValue(value = new Date(Date.now() + 7 * 864e5)) {
  const date = new Date(value)
  date.setMinutes(date.getMinutes() - date.getTimezoneOffset())
  return date.toISOString().slice(0, 16)
}

function statusInfo(assignment) {
  if (assignment.submission) {
    return { label: 'Submitted', tone: 'submitted' }
  }
  return { label: 'Not submitted', tone: 'pending' }
}

export function StudentAssignmentBoard({ batches = [] }) {
  const [assignments, setAssignments] = useState([])
  const [files, setFiles] = useState({})
  const [savingId, setSavingId] = useState('')
  const [error, setError] = useState('')

  async function load() {
    const res = await assignmentApi.student()
    setAssignments(res.assignments ?? [])
  }

  useEffect(() => {
    load().catch((err) => setError(err.message))
  }, [])

  async function submit(assignmentId) {
    const file = files[assignmentId]
    if (!file) return
    try {
      setSavingId(assignmentId)
      setError('')
      await assignmentApi.submit(assignmentId, file)
      setFiles((prev) => ({ ...prev, [assignmentId]: null }))
      await load()
    } catch (err) {
      setError(err.message)
    } finally {
      setSavingId('')
    }
  }

  const nameByBatch = Object.fromEntries(batches.map((batch) => [batch.batchId, batch.name]))

  return (
    <section className="premium-card">
      {error && <div className="alert error mb-4">{error}</div>}
      {assignments.length === 0 ? (
        <p className="text-muted">No assignments yet.</p>
      ) : (
        <div className="assignment-student-list">
          {assignments.map((item) => {
            const status = statusInfo(item)
            const chosenFile = files[item._id]

            return (
              <article key={item._id} className="assignment-student-card">
                <div className="assignment-student-main">
                  <div className="assignment-student-header">
                    <strong className="assignment-student-title">{item.title}</strong>
                    <span className={`assignment-status-pill ${status.tone}`}>
                      {status.label}
                    </span>
                  </div>

                  <p className="assignment-student-meta">
                    {nameByBatch[item.batchId] ?? 'Batch'} · Due {formatDateTime(item.dueDate)}
                  </p>

                  {item.description && (
                    <p className="assignment-student-desc">{item.description}</p>
                  )}

                  {item.submission?.downloadUrl && (
                    <div className="assignment-submission-link">
                      <a href={item.submission.downloadUrl} download={item.submission.fileName || 'submission.pdf'}>
                        📥 {item.submission.fileName || 'Download submitted work'}
                      </a>
                    </div>
                  )}
                </div>

                <div className="assignment-student-action">
                  {chosenFile ? (
                    <div className="assignment-file-picked">
                      <span className="assignment-picked-name" title={chosenFile.name}>
                        📄 {chosenFile.name}
                      </span>
                      <div className="button-row">
                        <button
                          type="button"
                          className="btn-primary btn-sm"
                          disabled={savingId === item._id}
                          onClick={() => submit(item._id)}
                        >
                          {savingId === item._id ? 'Uploading…' : 'Submit work'}
                        </button>
                        <button
                          type="button"
                          className="btn-outline btn-sm"
                          disabled={savingId === item._id}
                          onClick={() => setFiles((prev) => ({ ...prev, [item._id]: null }))}
                        >
                          Cancel
                        </button>
                      </div>
                    </div>
                  ) : (
                    <label className="assignment-upload-trigger">
                      <span>{item.submission ? 'Replace file' : 'Upload work'}</span>
                      <input
                        type="file"
                        accept={FILE_ACCEPT}
                        style={{ display: 'none' }}
                        onChange={(e) => {
                          const file = e.target.files?.[0] ?? null
                          setFiles((prev) => ({ ...prev, [item._id]: file }))
                        }}
                      />
                    </label>
                  )}
                </div>
              </article>
            )
          })}
        </div>
      )}
    </section>
  )
}

export function ParentAssignmentBoard({ childId, childName, batches = [] }) {
  const [assignments, setAssignments] = useState([])
  const [error, setError] = useState('')

  useEffect(() => {
    if (!childId) {
      setAssignments([])
      return
    }
    assignmentApi
      .parent(childId)
      .then((res) => setAssignments(res.assignments ?? []))
      .catch((err) => setError(err.message))
  }, [childId])

  const nameByBatch = Object.fromEntries(batches.map((batch) => [batch.batchId, batch.name]))

  return (
    <section className="premium-card">
      {error && <div className="alert error mb-4">{error}</div>}
      {!childId ? (
        <p className="text-muted">Select a child to see their assignments.</p>
      ) : assignments.length === 0 ? (
        <p className="text-muted">No assignments yet.</p>
      ) : (
        <div className="assignment-student-list">
          {assignments.map((item) => {
            const status = statusInfo(item)

            return (
              <article key={item._id} className="assignment-student-card">
                <div className="assignment-student-main">
                  <div className="assignment-student-header">
                    <strong className="assignment-student-title">{item.title}</strong>
                    <span className={`assignment-status-pill ${status.tone}`}>
                      {status.label}
                    </span>
                  </div>

                  <p className="assignment-student-meta">
                    {nameByBatch[item.batchId] ?? 'Batch'} · Due {formatDateTime(item.dueDate)}
                  </p>

                  {item.description && (
                    <p className="assignment-student-desc">{item.description}</p>
                  )}

                  {item.submission?.downloadUrl && (
                    <div className="assignment-submission-link">
                      <a href={item.submission.downloadUrl} download={item.submission.fileName || `${childName}'s submission`}>
                        📥 {item.submission.fileName || `${childName}'s submission`}
                      </a>
                    </div>
                  )}
                </div>
              </article>
            )
          })}
        </div>
      )}
    </section>
  )
}

export function TutorBatchAssignments({ batchId, students = [] }) {
  const [assignments, setAssignments] = useState([])
  const [openId, setOpenId] = useState('')
  const [submissions, setSubmissions] = useState([])
  const [form, setForm] = useState({
    title: '',
    description: '',
    dueDate: localDateTimeValue(),
  })
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState('')

  async function loadAssignments() {
    try {
      const res = await assignmentApi.byBatch(batchId)
      setAssignments(res.assignments ?? [])
    } catch (err) {
      setError(err.message)
    }
  }

  useEffect(() => {
    loadAssignments()
  }, [batchId])

  async function create(e) {
    e.preventDefault()
    if (!form.title.trim()) return
    try {
      setSaving(true)
      setError('')
      await assignmentApi.create({
        batchId,
        title: form.title.trim(),
        description: form.description.trim(),
        dueDate: new Date(form.dueDate).toISOString(),
        maxScore: 100,
      })
      setForm({ title: '', description: '', dueDate: localDateTimeValue() })
      await loadAssignments()
    } catch (err) {
      setError(err.message)
    } finally {
      setSaving(false)
    }
  }

  async function toggleSubmissions(assignmentId) {
    if (openId === assignmentId) {
      setOpenId('')
      setSubmissions([])
      return
    }
    try {
      setError('')
      const res = await assignmentApi.submissions(assignmentId)
      setOpenId(assignmentId)
      setSubmissions(res.submissions ?? [])
    } catch (err) {
      setError(err.message)
    }
  }

  return (
    <section className="premium-card mb-6">
      <h2>Assignments</h2>
      <p className="text-muted">Post assignments for this batch and track student submissions.</p>
      {error && <div className="alert error mt-4">{error}</div>}

      <form className="mt-4" onSubmit={create}>
        <div className="invite-grid">
          <div className="batch-field" style={{ gridColumn: 'span 2' }}>
            <label htmlFor={`assignment-title-${batchId}`}>Assignment title</label>
            <input
              id={`assignment-title-${batchId}`}
              className="form-input"
              value={form.title}
              onChange={(e) => setForm({ ...form, title: e.target.value })}
              placeholder="e.g. Chemical Bonding Worksheet"
              maxLength="120"
              required
            />
          </div>
          <div className="batch-field">
            <label htmlFor={`assignment-due-${batchId}`}>Due date</label>
            <input
              id={`assignment-due-${batchId}`}
              className="form-input"
              type="datetime-local"
              value={form.dueDate}
              onChange={(e) => setForm({ ...form, dueDate: e.target.value })}
              required
            />
          </div>
        </div>
        <div className="batch-field mt-4">
          <label htmlFor={`assignment-notes-${batchId}`}>Instructions (optional)</label>
          <textarea
            id={`assignment-notes-${batchId}`}
            className="form-input"
            rows="2"
            value={form.description}
            onChange={(e) => setForm({ ...form, description: e.target.value })}
            placeholder="Provide instructions, questions, or links for students"
          />
        </div>
        <div className="form-actions mt-4">
          <button type="submit" className="btn-primary" disabled={saving}>
            {saving ? 'Creating…' : 'Post assignment'}
          </button>
        </div>
      </form>

      <hr className="section-divider" />

      {assignments.length === 0 ? (
        <p className="text-muted mt-4">No assignments posted yet for this batch.</p>
      ) : (
        <ul className="session-list-mini mt-4">
          {assignments.map((item) => {
            const isExpanded = openId === item._id
            const activeSubs = isExpanded ? submissions : (item.submissions ?? [])
            const subMap = Object.fromEntries(activeSubs.map((s) => [s.studentId, s]))
            const submittedCount = students.filter((s) => !!subMap[s.studentId]).length
            const totalStudents = students.length || 1

            return (
              <li key={item._id} style={{ flexDirection: 'column', alignItems: 'stretch' }}>
                <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', flexWrap: 'wrap', gap: '0.75rem' }}>
                  <div>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', flexWrap: 'wrap' }}>
                      <strong style={{ fontSize: '1.05rem', color: 'var(--chalk)' }}>{item.title}</strong>
                      <span style={{ fontSize: '0.8rem', background: submittedCount === totalStudents ? 'rgba(52,211,153,0.15)' : 'rgba(99,102,241,0.15)', color: submittedCount === totalStudents ? '#34d399' : '#818cf8', padding: '2px 8px', borderRadius: '4px', fontWeight: 600 }}>
                        {submittedCount}/{totalStudents} submitted
                      </span>
                    </div>
                    <p className="text-muted text-sm" style={{ margin: '3px 0 0' }}>
                      Due: {formatDateTime(item.dueDate)}
                    </p>
                    {item.description && (
                      <p className="text-muted text-sm" style={{ marginTop: '4px' }}>
                        {item.description}
                      </p>
                    )}
                  </div>
                  <button
                    type="button"
                    className="btn-outline btn-sm"
                    onClick={() => toggleSubmissions(item._id)}
                  >
                    {isExpanded ? 'Hide submissions' : `View submissions (${submittedCount}/${totalStudents})`}
                  </button>
                </div>

                {isExpanded && (
                  <div className="mt-4" style={{ width: '100%', borderTop: '1px solid rgba(255,255,255,0.08)', paddingTop: '0.85rem' }}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '0.5rem', marginBottom: '0.75rem' }}>
                      <div>
                        <span className="text-sm font-semibold" style={{ color: 'var(--teacher)' }}>
                          📋 Submissions for: <strong>{item.title}</strong>
                        </span>
                        <span className="text-muted text-sm" style={{ marginLeft: '0.5rem' }}>
                          (Due {formatDateTime(item.dueDate)})
                        </span>
                      </div>
                      <div className="text-sm">
                        <span style={{ color: '#34d399', fontWeight: 600 }}>{submittedCount} Submitted</span>
                        <span className="text-muted"> · </span>
                        <span style={{ color: '#f59e0b', fontWeight: 600 }}>{Math.max(0, totalStudents - submittedCount)} Pending</span>
                      </div>
                    </div>

                    {students.length === 0 ? (
                      <p className="text-muted" style={{ margin: 0 }}>No students enrolled in this batch.</p>
                    ) : (
                      <div style={{ display: 'flex', flexDirection: 'column', gap: '0.65rem' }}>
                        {students.map((student) => {
                          const sub = subMap[student.studentId]
                          const isSubmitted = !!sub

                          return (
                            <div
                              key={student.studentId}
                              style={{
                                display: 'flex',
                                alignItems: 'center',
                                justifyContent: 'space-between',
                                flexWrap: 'wrap',
                                gap: '0.75rem',
                                padding: '0.75rem 1rem',
                                borderRadius: '8px',
                                background: isSubmitted ? 'rgba(52, 211, 153, 0.05)' : 'rgba(255, 255, 255, 0.02)',
                                border: isSubmitted ? '1px solid rgba(52, 211, 153, 0.2)' : '1px solid rgba(255, 255, 255, 0.05)',
                              }}
                            >
                              <div>
                                <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                                  <strong style={{ color: 'var(--chalk)' }}>{student.name}</strong>
                                  {isSubmitted ? (
                                    <span style={{ color: '#34d399', fontSize: '0.78rem', background: 'rgba(52, 211, 153, 0.15)', padding: '2px 7px', borderRadius: '4px', fontWeight: 600 }}>
                                      ✓ Submitted
                                    </span>
                                  ) : (
                                    <span style={{ color: '#f59e0b', fontSize: '0.78rem', background: 'rgba(245, 158, 11, 0.15)', padding: '2px 7px', borderRadius: '4px', fontWeight: 600 }}>
                                      ⏳ Not Submitted
                                    </span>
                                  )}
                                </div>
                                <div className="text-xs text-muted" style={{ marginTop: '3px' }}>
                                  {isSubmitted ? (
                                    <span>
                                      Uploaded on {formatDateTime(sub.submittedAt || sub.createdAt || item.dueDate)}
                                    </span>
                                  ) : (
                                    <span>Waiting for student upload</span>
                                  )}
                                </div>
                              </div>

                              <div>
                                {isSubmitted && sub.downloadUrl ? (
                                  <a
                                    href={sub.downloadUrl}
                                    download={sub.fileName || 'submission.pdf'}
                                    className="btn-outline btn-sm"
                                    style={{ display: 'inline-flex', alignItems: 'center', gap: '0.35rem', textDecoration: 'none' }}
                                  >
                                    📥 Download {sub.fileName}
                                  </a>
                                ) : (
                                  <span className="text-muted text-xs">No file submitted</span>
                                )}
                              </div>
                            </div>
                          )
                        })}
                      </div>
                    )}
                  </div>
                )}
              </li>
            )
          })}
        </ul>
      )}
    </section>
  )
}
