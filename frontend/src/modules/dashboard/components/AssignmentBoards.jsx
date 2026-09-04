import { useEffect, useState } from 'react'
import { assignmentApi, formatDateTime } from '../../../lib/api'

const FILE_ACCEPT = '.pdf,.png,.jpg,.jpeg,.webp,.txt,.doc,.docx,image/gif'

function localDateTimeValue(value = new Date(Date.now() + 7 * 864e5)) {
  const date = new Date(value)
  date.setMinutes(date.getMinutes() - date.getTimezoneOffset())
  return date.toISOString().slice(0, 16)
}

function statusLabel(assignment) {
  if (assignment.submission?.status === 'graded') return 'Graded'
  if (assignment.submission?.status === 'submitted') return 'Submitted'
  if (assignment.dueDate && new Date(assignment.dueDate) < new Date()) return 'Past due'
  return 'Not submitted'
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
      {error && <div className="alert error">{error}</div>}
      {assignments.length === 0 ? (
        <p className="text-muted mt-4">No assignments yet.</p>
      ) : (
        <ul className="session-list-mini mt-4">
          {assignments.map((item) => (
            <li key={item._id} className="assignment-row">
              <div>
                <strong>{item.title}</strong>
                <p className="text-muted text-sm">
                  {nameByBatch[item.batchId] ?? 'Batch'} · Due {formatDateTime(item.dueDate)} · {item.maxScore} marks
                </p>
                {item.description && <p className="text-muted text-sm">{item.description}</p>}
                <p className="text-sm mt-4">
                  Status: <strong>{statusLabel(item)}</strong>
                  {item.submission?.fileName ? ` · ${item.submission.fileName}` : ''}
                  {item.submission?.status === 'graded'
                    ? ` · ${item.submission.score}/${item.maxScore}`
                    : ''}
                </p>
                {item.submission?.feedback && (
                  <p className="text-muted text-sm">Tutor remark: {item.submission.feedback}</p>
                )}
                {item.submission?.downloadUrl && (
                  <a href={item.submission.downloadUrl} target="_blank" rel="noreferrer">
                    Download your file
                  </a>
                )}
              </div>
              {item.submission?.status !== 'graded' && (
              <div className="assignment-upload">
                <input
                  type="file"
                  accept={FILE_ACCEPT}
                  onChange={(e) => setFiles((prev) => ({ ...prev, [item._id]: e.target.files?.[0] ?? null }))}
                />
                <button
                  type="button"
                  className="btn-primary"
                  disabled={!files[item._id] || savingId === item._id}
                  onClick={() => submit(item._id)}
                >
                  {savingId === item._id ? 'Uploading…' : item.submission ? 'Replace file' : 'Upload work'}
                </button>
              </div>
              )}
            </li>
          ))}
        </ul>
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
      {error && <div className="alert error">{error}</div>}
      {!childId ? (
        <p className="text-muted mt-4">Select a child to see their assignments.</p>
      ) : assignments.length === 0 ? (
        <p className="text-muted mt-4">No assignments yet.</p>
      ) : (
        <ul className="session-list-mini mt-4">
          {assignments.map((item) => (
            <li key={item._id} className="assignment-row">
              <div>
                <strong>{item.title}</strong>
                <p className="text-muted text-sm">
                  {nameByBatch[item.batchId] ?? 'Batch'} · Due {formatDateTime(item.dueDate)} · {item.maxScore} marks
                </p>
                <p className="text-sm mt-4">
                  Status: <strong>{statusLabel(item)}</strong>
                  {item.submission?.status === 'graded' ? ` · ${item.submission.score}/${item.maxScore}` : ''}
                </p>
                {item.submission?.feedback && (
                  <p className="text-muted text-sm">Tutor remark: {item.submission.feedback}</p>
                )}
              </div>
            </li>
          ))}
        </ul>
      )}
    </section>
  )
}

export function TutorBatchAssignments({ batchId, students }) {
  const [assignments, setAssignments] = useState([])
  const [openId, setOpenId] = useState('')
  const [submissions, setSubmissions] = useState([])
  const [form, setForm] = useState({
    title: '',
    description: '',
    dueDate: localDateTimeValue(),
    maxScore: '100',
  })
  const [gradeDraft, setGradeDraft] = useState({})
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState('')

  useEffect(() => {
    assignmentApi.byBatch(batchId).then((res) => {
      setAssignments(res.assignments ?? [])
    }).catch((err) => setError(err.message))
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
        maxScore: Number(form.maxScore),
      })
      setForm({ title: '', description: '', dueDate: localDateTimeValue(), maxScore: '100' })
      const res = await assignmentApi.byBatch(batchId)
      setAssignments(res.assignments ?? [])
    } catch (err) {
      setError(err.message)
    } finally {
      setSaving(false)
    }
  }

  async function openSubmissions(assignmentId) {
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
      setGradeDraft(
        Object.fromEntries(
          (res.submissions ?? []).map((row) => [
            row._id,
            { score: row.score ?? '', feedback: row.feedback ?? '' },
          ]),
        ),
      )
    } catch (err) {
      setError(err.message)
    }
  }

  async function grade(submissionId) {
    const draft = gradeDraft[submissionId]
    try {
      setSaving(true)
      setError('')
      await assignmentApi.grade(submissionId, {
        score: Number(draft.score),
        feedback: draft.feedback,
      })
      const res = await assignmentApi.submissions(openId)
      setSubmissions(res.submissions ?? [])
    } catch (err) {
      setError(err.message)
    } finally {
      setSaving(false)
    }
  }

  const nameById = Object.fromEntries(students.map((student) => [student.studentId, student.name]))

  return (
    <section className="premium-card mb-6">
      <h2>Assignments</h2>
      <p className="text-muted">Post homework for this batch. Students upload a file; you grade it here.</p>
      {error && <div className="alert error mt-4">{error}</div>}
      <form className="mt-4" onSubmit={create}>
        <div className="invite-grid">
          <div className="batch-field">
            <label htmlFor={`assignment-title-${batchId}`}>Title</label>
            <input
              id={`assignment-title-${batchId}`}
              className="form-input"
              value={form.title}
              onChange={(e) => setForm({ ...form, title: e.target.value })}
              placeholder="Title"
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
          <div className="batch-field">
            <label htmlFor={`assignment-score-${batchId}`}>Max score</label>
            <input
              id={`assignment-score-${batchId}`}
              className="form-input"
              type="number"
              min="1"
              value={form.maxScore}
              onChange={(e) => setForm({ ...form, maxScore: e.target.value })}
              placeholder="Max score"
              required
            />
          </div>
        </div>
        <div className="batch-field mt-4">
          <label htmlFor={`assignment-notes-${batchId}`}>Instructions</label>
          <textarea
            id={`assignment-notes-${batchId}`}
            className="form-input"
            rows="2"
            value={form.description}
            onChange={(e) => setForm({ ...form, description: e.target.value })}
            placeholder="Instructions (optional)"
          />
        </div>
        <div className="form-actions">
          <button type="submit" className="btn-primary" disabled={saving}>
            {saving ? 'Saving…' : 'Post assignment'}
          </button>
        </div>
      </form>
      {assignments.length === 0 ? (
        <p className="text-muted mt-4">No assignments yet.</p>
      ) : (
        <ul className="session-list-mini mt-4">
          {assignments.map((item) => (
            <li key={item._id}>
              <div>
                <strong>{item.title}</strong>
                <p className="text-muted text-sm">
                  Due {formatDateTime(item.dueDate)} · {item.maxScore} marks
                </p>
                {item.description && <p className="text-muted text-sm">{item.description}</p>}
              </div>
              <button type="button" className="btn-outline btn-sm" onClick={() => openSubmissions(item._id)}>
                {openId === item._id ? 'Hide work' : 'View work'}
              </button>
              {openId === item._id && (
                <div className="mt-4" style={{ width: '100%' }}>
                  {submissions.length === 0 ? (
                    <p className="text-muted">No files uploaded yet.</p>
                  ) : (
                    submissions.map((row) => (
                      <div key={row._id} className="assignment-grade-row">
                        <p>
                          <strong>{nameById[row.studentId] ?? row.studentId}</strong>
                          {' · '}
                          <a href={row.downloadUrl} target="_blank" rel="noreferrer">
                            {row.fileName}
                          </a>
                          {row.status === 'graded' ? ` · ${row.score}/${item.maxScore}` : ''}
                        </p>
                        <div className="holiday-row">
                          <input
                            type="number"
                            min="0"
                            max={item.maxScore}
                            value={gradeDraft[row._id]?.score ?? ''}
                            onChange={(e) =>
                              setGradeDraft((prev) => ({
                                ...prev,
                                [row._id]: { ...prev[row._id], score: e.target.value },
                              }))
                            }
                            placeholder="Score"
                          />
                          <input
                            value={gradeDraft[row._id]?.feedback ?? ''}
                            onChange={(e) =>
                              setGradeDraft((prev) => ({
                                ...prev,
                                [row._id]: { ...prev[row._id], feedback: e.target.value },
                              }))
                            }
                            placeholder="Feedback"
                          />
                          <button type="button" className="btn-outline" disabled={saving} onClick={() => grade(row._id)}>
                            Save grade
                          </button>
                        </div>
                      </div>
                    ))
                  )}
                </div>
              )}
            </li>
          ))}
        </ul>
      )}
    </section>
  )
}
