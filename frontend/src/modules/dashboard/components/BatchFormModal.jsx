import { useEffect, useState } from 'react'
import { DAY_LABELS, batchApi, formatDateTime, formatSchedule, subjectApi } from '../../../lib/api'

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

function localDateTimeValue(value = new Date()) {
  const date = new Date(value)
  date.setMinutes(date.getMinutes() - date.getTimezoneOffset())
  return date.toISOString().slice(0, 16)
}

const EMPTY_FORM = {
  name: '',
  days: [],
  time: '18:00',
  classTopic: '',
  weeksAhead: 4,
}

export function BatchFormModal({ batch, onClose, onSave }) {
  const isEdit = Boolean(batch)
  const [form, setForm] = useState(
    batch
      ? {
          name: batch.name,
          days: batch.schedule?.days ?? [],
          time: batch.schedule?.time ?? '18:00',
          classTopic: '',
          weeksAhead: 4,
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
  const [extraClasses, setExtraClasses] = useState([])
  const [extraDraft, setExtraDraft] = useState({ topic: '', date: localDateTimeValue() })

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
        classTopic: (form.classTopic ?? '').trim(),
        weeksAhead: Number(form.weeksAhead ?? 4),
        extraClasses: extraClasses.map((item) => ({
          topic: item.topic,
          date: new Date(item.date).toISOString(),
        })),
      }
      if (isEdit) {
        const prevDays = JSON.stringify([...(batch.schedule?.days ?? [])].map(Number).sort())
        const nextDays = JSON.stringify([...form.days].map(Number).sort())
        const scheduleChanged = prevDays !== nextDays || (batch.schedule?.time ?? '18:00') !== form.time
        if (scheduleChanged) {
          const res = await batchApi.previewScheduleChange(batch.batchId, {
            schedule: payload.schedule,
            weeksAhead: Number(form.weeksAhead ?? 4),
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
            : 'Set subjects, weekly class days, and any extra classes. Weekly classes are created with this batch.'}
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
                  renderItem={(session) => `${formatDateTime(session.date)}${session.topic ? ` · ${session.topic}` : ''}`}
                />
              </section>
              <section>
                <h3>To create ({schedulePreview.toCreate?.length ?? 0})</h3>
                <PreviewList
                  items={schedulePreview.toCreate}
                  empty="No new sessions in this window."
                  itemKey={(session) => session.date}
                  renderItem={(session) => formatDateTime(session.date)}
                />
              </section>
              <section>
                <h3>To modify ({schedulePreview.toModify?.length ?? 0})</h3>
                <PreviewList
                  items={schedulePreview.toModify}
                  empty="No existing sessions change time."
                  itemKey={(item) => item.existing?._id ?? item.proposed?.date}
                  renderItem={(item) =>
                    `${formatDateTime(item.existing?.date)} → ${formatDateTime(item.proposed?.date)}`
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

          <div className="auth-field">
            <label htmlFor="class-topic">Class topic</label>
            <input
              id="class-topic"
              value={form.classTopic ?? ''}
              onChange={(e) => setForm({ ...form, classTopic: e.target.value })}
              placeholder="Used for the weekly classes created with this batch"
            />
          </div>

          <div className="auth-field">
            <label htmlFor="class-weeks">Create weekly classes for</label>
            <select
              id="class-weeks"
              value={form.weeksAhead ?? 4}
              onChange={(e) => {
                const next = Number(e.target.value)
                setForm({ ...form, weeksAhead: next })
                setWeeksAhead(next)
              }}
            >
              <option value={4}>Next 4 weeks</option>
              <option value={8}>Next 8 weeks</option>
              <option value={12}>Next 12 weeks</option>
            </select>
          </div>

          <div className="auth-field">
            <label>Extra class (optional)</label>
            <p className="text-muted text-sm">Add a one-off class for this batch, not a separate schedule.</p>
            <div className="invite-grid mt-4">
              <input
                value={extraDraft.topic}
                onChange={(e) => setExtraDraft({ ...extraDraft, topic: e.target.value })}
                placeholder="Topic"
              />
              <input
                type="datetime-local"
                value={extraDraft.date}
                onChange={(e) => setExtraDraft({ ...extraDraft, date: e.target.value })}
              />
            </div>
            <button
              type="button"
              className="btn-outline mt-4"
              onClick={() => {
                if (!extraDraft.topic.trim() || !extraDraft.date) return
                setExtraClasses((current) => [...current, { ...extraDraft, topic: extraDraft.topic.trim() }])
                setExtraDraft({ topic: '', date: localDateTimeValue() })
              }}
            >
              Add extra class
            </button>
            {extraClasses.length > 0 && (
              <ul className="session-list-mini mt-4">
                {extraClasses.map((item, index) => (
                  <li key={`${item.date}-${index}`}>
                    <span>{item.topic} · {formatDateTime(item.date)}</span>
                    <button
                      type="button"
                      className="danger-button"
                      onClick={() => setExtraClasses((current) => current.filter((_, i) => i !== index))}
                    >
                      Remove
                    </button>
                  </li>
                ))}
              </ul>
            )}
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
