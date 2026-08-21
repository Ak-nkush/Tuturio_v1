import { useEffect, useState } from 'react'
import { DAY_LABELS, subjectApi } from '../../../lib/api'

const EMPTY_FORM = {
  name: '',
  days: [],
  time: '18:00',
}

export function BatchFormModal({ batch, onClose, onSave }) {
  const isEdit = Boolean(batch)
  const [form, setForm] = useState(
    batch
      ? {
          name: batch.name,
          days: batch.schedule?.days ?? [],
          time: batch.schedule?.time ?? '18:00',
        }
      : EMPTY_FORM,
  )
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState('')
  const [catalog, setCatalog] = useState([])
  const [selected, setSelected] = useState(batch ? [...(batch.subjects ?? [])] : [])
  const [newSubject, setNewSubject] = useState('')

  useEffect(() => {
    subjectApi
      .list()
      .then((res) => setCatalog(res.subjects ?? []))
      .catch(() => setCatalog([]))
  }, [])

  function toggleDay(day) {
    setForm((prev) => ({
      ...prev,
      days: prev.days.includes(day) ? prev.days.filter((d) => d !== day) : [...prev.days, day].sort(),
    }))
  }

  async function handleSubmit(e) {
    e.preventDefault()
    setError('')
    setSaving(true)
    try {
      const payload = {
        name: form.name.trim(),
        subjects: selected,
        schedule: { days: form.days, time: form.time },
      }
      if (isEdit) {
        const prevDays = JSON.stringify(batch.schedule?.days ?? [])
        const nextDays = JSON.stringify(form.days)
        const scheduleChanged = prevDays !== nextDays || (batch.schedule?.time ?? '18:00') !== form.time
        if (scheduleChanged) {
          const confirmed = window.confirm(
            'This will replace future scheduled sessions to match the new timetable. Past sessions stay as they are. Continue?',
          )
          if (!confirmed) {
            setSaving(false)
            return
          }
          payload.regenerateSessions = true
        }
      }
      await onSave(payload, isEdit)
      onClose()
    } catch (err) {
      setError(err?.message ?? 'Could not save batch')
    } finally {
      setSaving(false)
    }
  }

  return (
    <div className="modal-overlay" onClick={onClose}>
      <div className="modal-card" onClick={(e) => e.stopPropagation()}>
        <h2>{isEdit ? 'Edit batch' : 'Create batch'}</h2>
        <p className="modal-sub">Set subjects and weekly schedule. Sessions auto-generate for the next 4 weeks.</p>

        <form onSubmit={handleSubmit}>
          {error && <div className="auth-error">{error}</div>}

          <div className="auth-field">
            <label htmlFor="batch-name">Batch name</label>
            <input
              id="batch-name"
              value={form.name}
              onChange={(e) => setForm({ ...form, name: e.target.value })}
              placeholder="Grade 10 Math — Evening"
              required
            />
          </div>

          <div className="auth-field">
            <label>Subjects</label>
            {catalog.length === 0 && selected.length === 0 ? (
              <p className="text-muted text-sm">Add a subject below, or manage them from Subjects in the sidebar.</p>
            ) : (
              <div className="day-picker">
                {[...new Set([...catalog.map((s) => s.name), ...selected])].map((name) => (
                  <button
                    key={name}
                    type="button"
                    className={`day-chip ${selected.includes(name) ? 'selected' : ''}`}
                    onClick={() =>
                      setSelected((prev) =>
                        prev.includes(name) ? prev.filter((item) => item !== name) : [...prev, name],
                      )
                    }
                  >
                    {name}
                  </button>
                ))}
              </div>
            )}
            <div className="holiday-row mt-4">
              <input
                value={newSubject}
                onChange={(e) => setNewSubject(e.target.value)}
                placeholder="New subject name"
              />
              <button
                type="button"
                className="btn-outline"
                onClick={async () => {
                  const name = newSubject.trim()
                  if (!name) return
                  try {
                    const res = await subjectApi.create(name)
                    setCatalog((prev) => [...prev, res.subject])
                    setSelected((prev) => (prev.includes(res.subject.name) ? prev : [...prev, res.subject.name]))
                    setNewSubject('')
                  } catch (err) {
                    setError(err.message)
                  }
                }}
              >
                Add subject
              </button>
            </div>
          </div>

          <div className="auth-field">
            <label>Class days</label>
            <div className="day-picker">
              {DAY_LABELS.map((label, i) => (
                <button
                  key={label}
                  type="button"
                  className={`day-chip ${form.days.includes(i) ? 'selected' : ''}`}
                  onClick={() => toggleDay(i)}
                >
                  {label}
                </button>
              ))}
            </div>
          </div>

          <div className="auth-field">
            <label htmlFor="batch-time">Class time</label>
            <input
              id="batch-time"
              type="time"
              value={form.time}
              onChange={(e) => setForm({ ...form, time: e.target.value })}
            />
          </div>

          <div className="modal-actions">
            <button type="button" className="btn-outline" onClick={onClose}>
              Cancel
            </button>
            <button type="submit" className="auth-btn" disabled={saving}>
              {saving ? 'Saving…' : isEdit ? 'Save changes' : 'Create batch'}
            </button>
          </div>
        </form>
      </div>
    </div>
  )
}

export function ScheduleClassModal({ batches, onClose, onSave }) {
  const [batchId, setBatchId] = useState(batches[0]?.batchId ?? '')
  const [topic, setTopic] = useState('')
  const [date, setDate] = useState(() => {
    const d = new Date()
    d.setMinutes(d.getMinutes() - d.getTimezoneOffset())
    return d.toISOString().slice(0, 16)
  })
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState('')

  async function handleSubmit(e) {
    e.preventDefault()
    setError('')
    setSaving(true)
    try {
      await onSave({ batchId, topic: topic.trim(), date: new Date(date).toISOString() })
      onClose()
    } catch (err) {
      setError(err?.message ?? 'Could not schedule class')
    } finally {
      setSaving(false)
    }
  }

  return (
    <div className="modal-overlay" onClick={onClose}>
      <div className="modal-card" onClick={(e) => e.stopPropagation()}>
        <h2>Schedule class</h2>
        <p className="modal-sub">Create a one-off session outside the recurring schedule.</p>

        <form onSubmit={handleSubmit}>
          {error && <div className="auth-error">{error}</div>}

          <div className="auth-field">
            <label htmlFor="session-batch">Batch</label>
            <select id="session-batch" value={batchId} onChange={(e) => setBatchId(e.target.value)} required>
              {batches.map((b) => (
                <option key={b.batchId} value={b.batchId}>
                  {b.name}
                </option>
              ))}
            </select>
          </div>

          <div className="auth-field">
            <label htmlFor="session-topic">Topic</label>
            <input
              id="session-topic"
              value={topic}
              onChange={(e) => setTopic(e.target.value)}
              placeholder="Chapter 5 — Algebra"
              required
            />
          </div>

          <div className="auth-field">
            <label htmlFor="session-date">Date & time</label>
            <input
              id="session-date"
              type="datetime-local"
              value={date}
              onChange={(e) => setDate(e.target.value)}
              required
            />
          </div>

          <div className="modal-actions">
            <button type="button" className="btn-outline" onClick={onClose}>
              Cancel
            </button>
            <button type="submit" className="auth-btn" disabled={saving || !batchId}>
              {saving ? 'Scheduling…' : 'Schedule class'}
            </button>
          </div>
        </form>
      </div>
    </div>
  )
}
