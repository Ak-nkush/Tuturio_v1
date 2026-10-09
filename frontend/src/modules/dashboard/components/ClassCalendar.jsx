import { useEffect, useMemo, useState } from 'react'
import { Link } from 'react-router-dom'
import { sessionApi } from '../../../lib/api'

const VIEWS = [
  { id: 'week', label: 'Week' },
  { id: 'month', label: 'Month' },
  { id: 'year', label: 'Year' },
]

const WEEKDAYS = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun']

function isTestRecord(item) {
  return /integration test|mt2[a-z0-9]+/i.test(`${item.name ?? ''} ${item.topic ?? ''} ${item.batchId ?? ''}`)
}

function startOfDay(value) {
  const date = new Date(value)
  date.setHours(0, 0, 0, 0)
  return date
}

function endOfDay(value) {
  const date = new Date(value)
  date.setHours(23, 59, 59, 999)
  return date
}

function startOfWeek(value) {
  const date = startOfDay(value)
  const day = date.getDay()
  date.setDate(date.getDate() + (day === 0 ? -6 : 1 - day))
  return date
}

function endOfWeek(value) {
  const date = startOfWeek(value)
  date.setDate(date.getDate() + 6)
  return endOfDay(date)
}

function startOfMonth(value) {
  const date = new Date(value)
  return startOfDay(new Date(date.getFullYear(), date.getMonth(), 1))
}

function endOfMonth(value) {
  const date = new Date(value)
  return endOfDay(new Date(date.getFullYear(), date.getMonth() + 1, 0))
}

function startOfYear(value) {
  const date = new Date(value)
  return startOfDay(new Date(date.getFullYear(), 0, 1))
}

function endOfYear(value) {
  const date = new Date(value)
  return endOfDay(new Date(date.getFullYear(), 11, 31))
}

function rangeForView(view, cursor) {
  if (view === 'week') return { start: startOfWeek(cursor), end: endOfWeek(cursor) }
  if (view === 'year') return { start: startOfYear(cursor), end: endOfYear(cursor) }
  return { start: startOfMonth(cursor), end: endOfMonth(cursor) }
}

function dayKey(value) {
  const date = new Date(value)
  return `${date.getFullYear()}-${date.getMonth()}-${date.getDate()}`
}

function sameDay(a, b) {
  return dayKey(a) === dayKey(b)
}

function monthCells(year, month) {
  const first = new Date(year, month, 1)
  const last = new Date(year, month + 1, 0)
  const start = startOfWeek(first)
  const end = endOfWeek(last)
  const cells = []
  for (let cursor = new Date(start); cursor <= end; cursor.setDate(cursor.getDate() + 1)) {
    cells.push(new Date(cursor))
  }
  return cells
}

function timeLabel(value) {
  return new Date(value).toLocaleTimeString('en-GB', { hour: 'numeric', minute: '2-digit' })
}

function rangeLabel(view, cursor) {
  if (view === 'week') {
    const start = startOfWeek(cursor)
    const end = endOfWeek(cursor)
    const startText = start.toLocaleDateString('en-GB', { day: 'numeric', month: 'long' })
    const endText = end.toLocaleDateString('en-GB', { day: 'numeric', month: 'long', year: 'numeric' })
    return `${startText} – ${endText}`
  }
  if (view === 'month') {
    return cursor.toLocaleDateString('en-GB', { month: 'long', year: 'numeric' })
  }
  return String(cursor.getFullYear())
}

function SessionChip({ session, className, title, sessionHref, children, stopClick }) {
  if (sessionHref) {
    return (
      <Link
        to={sessionHref(session._id)}
        className={className}
        title={title}
        onClick={stopClick ? (event) => event.stopPropagation() : undefined}
      >
        {children}
      </Link>
    )
  }
  return (
    <div className={className} title={title}>
      {children}
    </div>
  )
}

function MonthGrid({ year, month, sessionsByDay, batchName, toneFor, compact, selectedKey, onSelectDay, sessionHref }) {
  const cells = monthCells(year, month)
  const today = new Date()
  const maxChips = compact ? 2 : 3

  return (
    <div className={`cal-month ${compact ? 'is-compact' : ''}`}>
      {compact && (
        <h3 className="cal-month-title">
          {new Date(year, month, 1).toLocaleDateString('en-GB', { month: 'long', year: 'numeric' })}
        </h3>
      )}
      <div className="cal-weekdays">
        {WEEKDAYS.map((day) => (
          <span key={day}>{compact ? day.slice(0, 1) : day}</span>
        ))}
      </div>
      <div className="cal-grid">
        {cells.map((day) => {
          const key = dayKey(day)
          const outside = day.getMonth() !== month
          const items = sessionsByDay.get(key) ?? []
          const shown = items.slice(0, maxChips)
          const extra = items.length - shown.length
          return (
            <button
              type="button"
              key={key}
              className={`cal-day${outside ? ' is-outside' : ''}${sameDay(day, today) ? ' is-today' : ''}${selectedKey === key ? ' is-selected' : ''}${items.length ? ' has-classes' : ''}`}
              onClick={() => onSelectDay?.(day, items)}
            >
              <span className="cal-day-number">{day.getDate()}</span>
              <div className="cal-day-items">
                {shown.map((session) => (
                  <SessionChip
                    key={session._id}
                    session={session}
                    sessionHref={sessionHref}
                    stopClick
                    className={`cal-chip tone-${toneFor(session.batchId)}${session.status === 'cancelled' || session.isHoliday ? ' is-cancelled' : ''}${compact ? ' is-compact' : ''}`}
                    title={`${batchName(session.batchId)} · ${session.topic}`}
                  >
                    {compact ? (
                      <span className="cal-dot" />
                    ) : (
                      <>
                        <span>{timeLabel(session.date)}</span>
                        <strong>{session.topic}</strong>
                      </>
                    )}
                  </SessionChip>
                ))}
                {extra > 0 && <span className="cal-more">+{extra}</span>}
              </div>
            </button>
          )
        })}
      </div>
    </div>
  )
}

export function ClassCalendar({
  batches = [],
  lockedBatchId = '',
  studentId = '',
  sessionHref = null,
  defaultView = 'week',
  title = 'Class calendar',
}) {
  const [view, setView] = useState(defaultView === 'quarter' ? 'month' : defaultView)
  const [cursor] = useState(() => new Date())
  const [batchFilter, setBatchFilter] = useState(lockedBatchId)
  const [sessions, setSessions] = useState([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [selected, setSelected] = useState(null)

  useEffect(() => {
    setBatchFilter(lockedBatchId)
  }, [lockedBatchId])

  useEffect(() => {
    let cancelled = false
    async function load() {
      setError('')
      setLoading(true)
      const { start, end } = rangeForView(view, cursor)
      try {
        const res = await sessionApi.calendar({
          from: start.toISOString(),
          to: end.toISOString(),
          batchId: batchFilter || undefined,
          studentId: studentId || undefined,
        })
        if (cancelled) return
        setSessions((res.sessions ?? []).filter((session) => !isTestRecord(session)))
      } catch (err) {
        if (!cancelled) setError(err.message ?? 'Could not load classes')
      } finally {
        if (!cancelled) setLoading(false)
      }
    }
    load()
    return () => {
      cancelled = true
    }
  }, [view, cursor, batchFilter, studentId])

  const sessionsByDay = useMemo(() => {
    const map = new Map()
    for (const session of sessions) {
      const key = dayKey(session.date)
      const list = map.get(key) ?? []
      list.push(session)
      map.set(key, list)
    }
    return map
  }, [sessions])

  const batchName = (batchId) => batches.find((batch) => batch.batchId === batchId)?.name ?? 'Batch'
  const toneFor = (batchId) => {
    const index = Math.max(0, batches.findIndex((batch) => batch.batchId === batchId))
    return index % 6
  }

  const weekDays = useMemo(() => {
    const start = startOfWeek(cursor)
    return Array.from({ length: 7 }, (_, index) => {
      const day = new Date(start)
      day.setDate(start.getDate() + index)
      return day
    })
  }, [cursor])

  const yearMonths = useMemo(
    () => Array.from({ length: 12 }, (_, month) => new Date(cursor.getFullYear(), month, 1)),
    [cursor],
  )

  function selectDay(day, items) {
    setSelected({ day, items })
  }

  return (
    <section className="premium-card class-calendar">
      <div className="section-heading cal-toolbar">
        <div>
          <span className="eyebrow">Created classes only</span>
          <h2>{title}</h2>
          <p className="text-muted">{rangeLabel(view, cursor)}</p>
        </div>
        <div className="cal-controls">
          {!lockedBatchId && batches.length > 1 && (
            <select
              value={batchFilter}
              onChange={(e) => setBatchFilter(e.target.value)}
              aria-label="Filter by batch"
            >
              <option value="" style={{ background: '#1d3931', color: '#f4f1e6' }}>
                All batches
              </option>
              {batches.map((batch) => (
                <option
                  key={batch.batchId}
                  value={batch.batchId}
                  style={{ background: '#1d3931', color: '#f4f1e6' }}
                >
                  {batch.name}
                </option>
              ))}
            </select>
          )}
          <div className="cal-view-switch" role="tablist" aria-label="Calendar view">
            {VIEWS.map((item) => (
              <button
                key={item.id}
                type="button"
                role="tab"
                aria-selected={view === item.id}
                className={view === item.id ? 'is-active' : ''}
                onClick={() => {
                  setView(item.id)
                  setSelected(null)
                }}
              >
                {item.label}
              </button>
            ))}
          </div>
        </div>
      </div>

      <div className="cal-meta">
        <span>{sessions.length} class{sessions.length === 1 ? '' : 'es'} in this view</span>
        <span>Empty days have no created class.</span>
      </div>
      {error && <div className="alert error mt-4">{error}</div>}
      {loading ? (
        <div className="empty-state">Loading classes…</div>
      ) : view === 'week' ? (
        <div className="cal-week">
          {weekDays.map((day) => {
            const items = sessionsByDay.get(dayKey(day)) ?? []
            return (
              <article
                key={dayKey(day)}
                className={`cal-week-day${sameDay(day, new Date()) ? ' is-today' : ''}${items.length ? ' has-classes' : ''}`}
              >
                <header>
                  <span className="cal-week-name">{WEEKDAYS[day.getDay() === 0 ? 6 : day.getDay() - 1]}</span>
                  <span className="cal-week-date">{day.getDate()}</span>
                </header>
                <div className="cal-week-body">
                  {items.length === 0 ? (
                    <p className="cal-empty">No class</p>
                  ) : (
                    items.map((session) => (
                      <SessionChip
                        key={session._id}
                        session={session}
                        sessionHref={sessionHref}
                        className={`cal-chip tone-${toneFor(session.batchId)}${session.status === 'cancelled' || session.isHoliday ? ' is-cancelled' : ''}`}
                      >
                        <span>{timeLabel(session.date)}</span>
                        <strong>{session.topic}</strong>
                        <small>{batchName(session.batchId)}</small>
                      </SessionChip>
                    ))
                  )}
                </div>
              </article>
            )
          })}
        </div>
      ) : view === 'month' ? (
        <MonthGrid
          year={cursor.getFullYear()}
          month={cursor.getMonth()}
          sessionsByDay={sessionsByDay}
          batchName={batchName}
          toneFor={toneFor}
          selectedKey={selected ? dayKey(selected.day) : ''}
          onSelectDay={selectDay}
          sessionHref={sessionHref}
        />
      ) : (
        <div className="cal-year">
          {yearMonths.map((monthDate) => (
            <MonthGrid
              key={monthDate.getMonth()}
              year={monthDate.getFullYear()}
              month={monthDate.getMonth()}
              sessionsByDay={sessionsByDay}
              batchName={batchName}
              toneFor={toneFor}
              compact
              selectedKey={selected ? dayKey(selected.day) : ''}
              onSelectDay={selectDay}
              sessionHref={sessionHref}
            />
          ))}
        </div>
      )}

      {selected && (
        <div className="cal-day-detail">
          <h3>
            {selected.day.toLocaleDateString('en-GB', { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' })}
          </h3>
          {selected.items.length === 0 ? (
            <p className="text-muted">No class on this day.</p>
          ) : (
            <ul>
              {selected.items.map((session) => (
                <li key={session._id}>
                  {sessionHref ? (
                    <Link className={`cal-chip tone-${toneFor(session.batchId)}`} to={sessionHref(session._id)}>
                      <span>{timeLabel(session.date)}</span>
                      <strong>{session.topic}</strong>
                      <small>{batchName(session.batchId)} · {session.status}</small>
                    </Link>
                  ) : (
                    <div className={`cal-chip tone-${toneFor(session.batchId)}`}>
                      <span>{timeLabel(session.date)}</span>
                      <strong>{session.topic}</strong>
                      <small>{batchName(session.batchId)} · {session.status}</small>
                    </div>
                  )}
                </li>
              ))}
            </ul>
          )}
        </div>
      )}
    </section>
  )
}
