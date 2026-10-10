import { useEffect, useState } from 'react'
import { announcementApi, attendanceApi, progressApi, resourceApi, formatDate, formatDateTime } from '../../../lib/api'

export function AnnouncementBoard({ batchId, items, onChange }) {
  const [text, setText] = useState('')
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState('')

  async function post(e) {
    e.preventDefault()
    if (!text.trim()) return
    try {
      setSaving(true)
      setError('')
      const res = await announcementApi.create({ batchId, text: text.trim() })
      onChange([res.announcement, ...items])
      setText('')
    } catch (err) {
      setError(err.message)
    } finally {
      setSaving(false)
    }
  }

  async function remove(id) {
    if (!window.confirm('Delete this announcement?')) return
    try {
      await announcementApi.remove(id)
      onChange(items.filter((item) => item._id !== id))
    } catch (err) {
      setError(err.message)
    }
  }

  return (
    <div>
      {error && <div className="alert error">{error}</div>}
      <form onSubmit={post}>
        <textarea
          className="form-input"
          rows="3"
          value={text}
          onChange={(e) => setText(e.target.value)}
          placeholder="Post to the batch notice board…"
        />
        <div className="mt-4 text-right">
          <button type="submit" className="btn-primary" disabled={saving}>
            {saving ? 'Posting…' : 'Post announcement'}
          </button>
        </div>
      </form>
      {items.length === 0 ? (
        <p className="text-muted mt-4">No announcements yet.</p>
      ) : (
        <ul className="announcement-feed mt-4">
          {items.map((item) => (
            <li key={item._id} className="announcement-card">
              <div className="announcement-main">
                <p className="announcement-text">{item.text}</p>
                <div className="announcement-footer">
                  <span className="announcement-date">
                    <span className="announcement-icon">🗓️</span>
                    {formatDateTime(item.createdAt)}
                  </span>
                </div>
              </div>
              <div className="announcement-actions">
                <button type="button" className="danger-button" onClick={() => remove(item._id)}>
                  Delete
                </button>
              </div>
            </li>
          ))}
        </ul>
      )}
    </div>
  )
}

export function ResourceBoard({ batchId, items, onChange }) {
  const [uploadFile, setUploadFile] = useState(null)
  const [linkTitle, setLinkTitle] = useState('')
  const [linkUrl, setLinkUrl] = useState('')
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState('')

  async function upload() {
    if (!uploadFile) return
    try {
      setSaving(true)
      setError('')
      const res = await resourceApi.upload(batchId, uploadFile)
      onChange([res.resource, ...items])
      setUploadFile(null)
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
      setError('')
      const res = await resourceApi.addLink({
        batchId,
        title: linkTitle.trim(),
        url: linkUrl.trim(),
      })
      onChange([res.resource, ...items])
      setLinkTitle('')
      setLinkUrl('')
    } catch (err) {
      setError(err.message)
    } finally {
      setSaving(false)
    }
  }

  async function remove(id) {
    if (!window.confirm('Remove this material?')) return
    try {
      await resourceApi.remove(id)
      onChange(items.filter((item) => item._id !== id))
    } catch (err) {
      setError(err.message)
    }
  }

  return (
    <div>
      {error && <div className="alert error">{error}</div>}
      <div className="resource-upload mb-6">
        <h3>Upload file</h3>
        <p className="text-muted text-sm">PDF, images, Word, or plain text.</p>
        <input
          type="file"
          accept=".pdf,.png,.jpg,.jpeg,.webp,.gif,.txt,.doc,.docx"
          onChange={(e) => setUploadFile(e.target.files?.[0] ?? null)}
        />
        <button type="button" className="btn-primary mt-4" onClick={upload} disabled={!uploadFile || saving}>
          Upload
        </button>
      </div>
      <form className="resource-link mb-6" onSubmit={addLink}>
        <h3>Add external link</h3>
        <div className="auth-field">
          <input value={linkTitle} onChange={(e) => setLinkTitle(e.target.value)} placeholder="Title" />
        </div>
        <div className="auth-field">
          <input value={linkUrl} onChange={(e) => setLinkUrl(e.target.value)} placeholder="https://..." />
        </div>
        <button type="submit" className="btn-outline" disabled={saving}>
          Add link
        </button>
      </form>
      {items.length === 0 ? (
        <p className="text-muted">No materials shared yet.</p>
      ) : (
        <ul className="resource-list">
          {items.map((item) => (
            <li key={item._id}>
              <a href={item.url} target="_blank" rel="noreferrer">
                {item.title}
                {item.type === 'link' ? ' (link)' : ''}
              </a>
              <span className="text-muted text-sm">{formatDate(item.createdAt)}</span>
              <button type="button" className="danger-button" onClick={() => remove(item._id)}>
                Delete
              </button>
            </li>
          ))}
        </ul>
      )}
    </div>
  )
}

const EMPTY_PROGRESS = {
  studentId: '',
  subject: '',
  topic: '',
  score: '',
  maxScore: '100',
  remark: '',
}

export function ProgressBoard({ batchId, sessionId, students, subjects, items, onChange }) {
  const [form, setForm] = useState({
    ...EMPTY_PROGRESS,
    studentId: students[0]?.studentId ?? '',
    subject: subjects[0] ?? '',
  })
  const [editingId, setEditingId] = useState('')
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState('')

  const payload = () => ({
    batchId,
    sessionId: sessionId || undefined,
    studentId: form.studentId,
    subject: form.subject.trim(),
    topic: form.topic.trim(),
    score: Number(form.score),
    maxScore: Number(form.maxScore),
    remark: form.remark.trim(),
  })

  async function submit(e) {
    e.preventDefault()
    try {
      setSaving(true)
      setError('')
      if (editingId) {
        const res = await progressApi.update(editingId, payload())
        onChange(items.map((item) => (item._id === editingId ? res.progress : item)))
        setEditingId('')
      } else {
        const res = await progressApi.create(payload())
        onChange([res.progress, ...items])
      }
      setForm((prev) => ({ ...EMPTY_PROGRESS, studentId: prev.studentId, subject: prev.subject, maxScore: '100' }))
    } catch (err) {
      setError(err.message)
    } finally {
      setSaving(false)
    }
  }

  function startEdit(entry) {
    setEditingId(entry._id)
    setForm({
      studentId: entry.studentId,
      subject: entry.subject ?? '',
      topic: entry.topic ?? '',
      score: String(entry.score ?? ''),
      maxScore: String(entry.maxScore ?? '100'),
      remark: entry.remark ?? '',
    })
  }

  async function remove(id) {
    if (!window.confirm('Delete this progress entry?')) return
    try {
      await progressApi.remove(id)
      onChange(items.filter((item) => item._id !== id))
      if (editingId === id) setEditingId('')
    } catch (err) {
      setError(err.message)
    }
  }

  const nameById = Object.fromEntries(students.map((student) => [student.studentId, student.name]))

  return (
    <div>
      {error && <div className="alert error">{error}</div>}
      {students.length === 0 ? (
        <p className="text-muted">Add students to the batch before recording progress.</p>
      ) : (
        <form className="progress-form mb-6" onSubmit={submit}>
          <div className="auth-field">
            <label htmlFor="prog-student">Student</label>
            <select
              id="prog-student"
              value={form.studentId}
              onChange={(e) => setForm({ ...form, studentId: e.target.value })}
              required
            >
              {students.map((student) => (
                <option key={student.studentId} value={student.studentId}>
                  {student.name}
                </option>
              ))}
            </select>
          </div>
          <div className="auth-field">
            <label htmlFor="prog-subject">Subject</label>
            <input
              id="prog-subject"
              value={form.subject}
              onChange={(e) => setForm({ ...form, subject: e.target.value })}
              list="board-subjects"
              required
            />
            <datalist id="board-subjects">
              {subjects.map((subject) => (
                <option key={subject} value={subject} />
              ))}
            </datalist>
          </div>
          <div className="auth-field">
            <label htmlFor="prog-topic">Topic / test</label>
            <input
              id="prog-topic"
              value={form.topic}
              onChange={(e) => setForm({ ...form, topic: e.target.value })}
              required
            />
          </div>
          <div className="invite-grid">
            <div className="auth-field">
              <label htmlFor="prog-score">Marks obtained</label>
              <input
                id="prog-score"
                type="number"
                value={form.score}
                onChange={(e) => setForm({ ...form, score: e.target.value })}
                required
              />
            </div>
            <div className="auth-field">
              <label htmlFor="prog-max">Maximum marks</label>
              <input
                id="prog-max"
                type="number"
                value={form.maxScore}
                onChange={(e) => setForm({ ...form, maxScore: e.target.value })}
                required
              />
            </div>
          </div>
          <div className="auth-field">
            <label htmlFor="prog-remark">Remark</label>
            <input
              id="prog-remark"
              value={form.remark}
              onChange={(e) => setForm({ ...form, remark: e.target.value })}
            />
          </div>
          <div className="button-row">
            <button type="submit" className="btn-primary" disabled={saving}>
              {saving ? 'Saving…' : editingId ? 'Save changes' : 'Add progress entry'}
            </button>
            {editingId && (
              <button type="button" className="btn-outline" onClick={() => setEditingId('')}>
                Cancel edit
              </button>
            )}
          </div>
        </form>
      )}
      {items.length === 0 ? (
        <p className="text-muted">No scores recorded yet.</p>
      ) : (
        <ul className="progress-feed">
          {items.map((entry) => (
            <li key={entry._id} className="progress-item">
              <strong>
                {nameById[entry.studentId] ?? entry.studentId}
                {entry.subject ? ` · ${entry.subject}` : ''} · {entry.topic}
              </strong>{' '}
              — {entry.score}/{entry.maxScore}
              {entry.remark && <p className="text-muted">{entry.remark}</p>}
              <div className="button-row mt-4">
                <button type="button" className="btn-outline btn-sm" onClick={() => startEdit(entry)}>
                  Edit
                </button>
                <button type="button" className="danger-button" onClick={() => remove(entry._id)}>
                  Delete
                </button>
              </div>
            </li>
          ))}
        </ul>
      )}
    </div>
  )
}

export function AttendanceHistory({ student, batchId, onClose }) {
  const [rows, setRows] = useState([])
  const [error, setError] = useState('')
  const [saving, setSaving] = useState(false)

  useEffect(() => {
    attendanceApi
      .tutorStudent(student.studentId)
      .then((res) => {
        setRows((res.attendance ?? []).filter((row) => !batchId || row.batchId === batchId))
      })
      .catch((err) => setError(err.message))
  }, [student.studentId, batchId])

  async function changeStatus(row, status) {
    try {
      setSaving(true)
      await attendanceApi.save(row.sessionId, {
        batchId: row.batchId,
        records: [{ studentId: student.studentId, status }],
      })
      setRows((prev) => prev.map((item) => (item._id === row._id ? { ...item, status } : item)))
    } catch (err) {
      setError(err.message)
    } finally {
      setSaving(false)
    }
  }

  async function remove(row) {
    try {
      setSaving(true)
      await attendanceApi.remove(row.sessionId, student.studentId)
      setRows((prev) => prev.filter((item) => item._id !== row._id))
    } catch (err) {
      setError(err.message)
    } finally {
      setSaving(false)
    }
  }

  return (
    <section className="premium-card mb-6">
      <div className="section-heading">
        <div>
          <span className="eyebrow">Attendance history</span>
          <h2>{student.name}</h2>
        </div>
        <button type="button" className="btn-outline" onClick={onClose}>
          Close
        </button>
      </div>
      {error && <div className="alert error">{error}</div>}
      {rows.length === 0 ? (
        <p className="text-muted mt-4">No attendance recorded for this student yet.</p>
      ) : (
        <div className="premium-table-container mt-4">
          <table className="premium-table">
            <thead>
              <tr>
                <th>Date</th>
                <th>Topic</th>
                <th>Status</th>
                <th></th>
              </tr>
            </thead>
            <tbody>
              {rows.map((row) => (
                <tr key={row._id}>
                  <td>
                    {row.sessionDate ? formatDate(row.sessionDate) : '—'}
                  </td>
                  <td>{row.sessionTopic ?? '—'}</td>
                  <td>
                    <select
                      value={row.status}
                      disabled={saving}
                      onChange={(e) => changeStatus(row, e.target.value)}
                    >
                      <option value="present">Present</option>
                      <option value="absent">Absent</option>
                      <option value="late">Late</option>
                      <option value="excused">Excused</option>
                    </select>
                  </td>
                  <td>
                    <button type="button" className="danger-button" onClick={() => remove(row)}>
                      Delete
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </section>
  )
}
