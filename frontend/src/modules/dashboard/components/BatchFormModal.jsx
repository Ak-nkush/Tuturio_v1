import { useEffect, useState } from 'react'
import { DAY_LABELS, batchApi, formatSchedule, subjectApi } from '../../../lib/api'

function formatSessionStamp(value) {
  return new Date(value).toLocaleString([], {
    weekday: 'short',
    day: 'numeric',
    month: 'short',
    hour: 'numeric',
    minute: '2-digit',
  })
}

function PreviewList({ items, empty, renderItem, itemKey }) {
  const list = items ?? []
  const shown = list.slice(0, 10)
  return list.length === 0 ? (
    <p className="text-muted text-sm">{empty}</p>
  ) : (
    <>
      <ul className="session-list-mini">
        {shown.map((item, index) => (
          <li key={itemKey(item, index)}>{renderItem(item)}</li>
        ))}
      </ul>
      {list.length > 10 && <p className="text-muted text-sm">Showing first 10 of {list.length}.</p>}
    </>
  )
}

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
  const [schedulePreview, setSchedulePreview] = useState(null)
  const [pendingPayload, setPendingPayload] = useState(null)
  const [weeksAhead, setWeeksAhead] = useState(4)

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
        const prevDays = JSON.stringify([...(batch.schedule?.days ?? [])].map(Number).sort())
        const nextDays = JSON.stringify([...form.days].map(Number).sort())
        const scheduleChanged = prevDays !== nextDays || (batch.schedule?.time ?? '18:00') !== form.time
        if (scheduleChanged) {
          const res = await batchApi.previewScheduleChange(batch.batchId, {
            schedule: payload.schedule,
            weeksAhead,
          })
          setPendingPayload(payload)
          setSchedulePreview(res.preview)
          return
        }
        await onSave(payload, true)
      } else {
        await onSave(payload, false)
      }
      onClose()
    } catch (err) {
      setError(err?.message ?? 'Could not save batch')
    } finally {
      setSaving(false)
    }
  }

  async function applyScheduleUpdate(regenerate) {
    if (!pendingPayload) return
    setError('')
    setSaving(true)
    try {
      await onSave(
        regenerate ? { ...pendingPayload, regenerateSessions: true } : pendingPayload,
        true,
      )
      onClose()
    } catch (err) {
      setError(err?.message ?? 'Could not update schedule')
    } finally {
      setSaving(false)
    }
  }

  return (
    <div className="modal-overlay" onClick={onClose}>
      <div className={`modal-card ${schedulePreview ? 'modal-card-wide' : ''}`} onClick={(e) => e.stopPropagation()}>
        <h2>{isEdit ? 'Edit batch' : 'Create batch'}</h2>
        <p className="modal-sub">
          {schedulePreview
            ? 'Review the sessions that will change. Nothing is updated until you choose an action.'
            : 'Set subjects and weekly schedule. Sessions auto-generate for the next 4 weeks.'}
        </p>

        {schedulePreview ? (
          <div>
            {error && <div className="auth-error">{error}</div>}
            <h3>Schedule change preview</h3>
            <p className="text-sm mt-4">
              Next {schedulePreview.weeksAhead ?? weeksAhead} weeks · Current:{' '}
              <strong>{formatSchedule(schedulePreview.currentSchedule)}</strong> → Proposed:{' '}
              <strong>{formatSchedule(schedulePreview.proposedSchedule)}</strong>
            </p>
            <p className="text-sm mt-4">
              Sessions to remove: <strong>{schedulePreview.counts?.toRemove ?? schedulePreview.toRemove?.length ?? 0}</strong>
              {' · '}
              Sessions to create: <strong>{schedulePreview.counts?.toCreate ?? schedulePreview.toCreate?.length ?? 0}</strong>
              {' · '}
              Sessions to modify: <strong>{schedulePreview.counts?.toModify ?? schedulePreview.toModify?.length ?? 0}</strong>
            </p>
            <div className="auth-field mt-4">
              <label htmlFor="preview-window">Preview window</label>
              <select
                id="preview-window"
                value={weeksAhead}
                onChange={async (e) => {
                  const next = Number(e.target.value)
                  setWeeksAhead(next)
                  if (!pendingPayload || !batch?.batchId) return
                  try {
                    const res = await batchApi.previewScheduleChange(batch.batchId, {
                      schedule: pendingPayload.schedule,
                      weeksAhead: next,
                    })
                    setSchedulePreview(res.preview)
                  } catch (err) {
                    setError(err?.message ?? 'Could not refresh preview')
                  }
                }}
              >
                <option value={4}>4 weeks</option>
                <option value={8}>8 weeks</option>
                <option value={12}>12 weeks</option>
              </select>
            </div>
            <div className="schedule-preview-grid mt-6">
              <section>
                <h3>To remove ({schedulePreview.toRemove?.length ?? 0})</h3>
                <PreviewList
                  items={schedulePreview.toRemove}
                  empty="No future sessions fall off this timetable."
                  itemKey={(session) => session._id ?? session.date}
                  renderItem={(session) => `${formatSessionStamp(session.date)}${session.topic ? ` · ${session.topic}` : ''}`}
                />
              </section>
              <section>
                <h3>To create ({schedulePreview.toCreate?.length ?? 0})</h3>
                <PreviewList
                  items={schedulePreview.toCreate}
                  empty="No new sessions in this window."
                  itemKey={(session) => session.date}
                  renderItem={(session) => formatSessionStamp(session.date)}
                />
              </section>
              <section>
                <h3>To modify ({schedulePreview.toModify?.length ?? 0})</h3>
                <PreviewList
                  items={schedulePreview.toModify}
                  empty="No existing sessions change time."
                  itemKey={(item) => item.existing?._id ?? item.proposed?.date}
                  renderItem={(item) =>
                    `${formatSessionStamp(item.existing?.date)} → ${formatSessionStamp(item.proposed?.date)}`
                  }
                />
              </section>
            </div>
            <p className="text-muted text-sm mt-4">
              Regenerating replaces future scheduled sessions. Past, completed, cancelled, and one-off sessions on
              other days are left as they are unless they are still marked scheduled in the future.
            </p>
            <div className="modal-actions">
              <button type="button" className="btn-outline" onClick={() => { setSchedulePreview(null); setPendingPayload(null) }}>
                Cancel
              </button>
              <button type="button" className="btn-outline" onClick={() => applyScheduleUpdate(false)} disabled={saving}>
                {saving ? 'Saving…' : 'Save without regenerating'}
              </button>
              <button type="button" className="auth-btn" onClick={() => applyScheduleUpdate(true)} disabled={saving}>
                {saving ? 'Updating…' : 'Confirm & regenerate'}
              </button>
            </div>
          </div>
        ) : (
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
        )}
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
