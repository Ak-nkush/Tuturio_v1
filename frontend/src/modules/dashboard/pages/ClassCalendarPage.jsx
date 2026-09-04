import { useEffect, useMemo, useState } from 'react'
import { useSearchParams } from 'react-router-dom'
import { useAuth } from '../../../context/AuthContext'
import { batchApi } from '../../../lib/api'
import { ClassCalendar } from '../components/ClassCalendar'

function isTestRecord(item) {
  return /integration test|mt2[a-z0-9]+/i.test(`${item.name ?? ''} ${item.batchId ?? ''}`)
}

export function ClassCalendarPage() {
  const { user } = useAuth()
  const [searchParams, setSearchParams] = useSearchParams()
  const [batches, setBatches] = useState([])
  const [children, setChildren] = useState([])
  const [error, setError] = useState('')

  const role = user?.role
  const childId = searchParams.get('child') || ''

  useEffect(() => {
    let cancelled = false
    async function load() {
      try {
        if (role === 'tutor') {
          const res = await batchApi.list()
          if (!cancelled) setBatches((res.batches ?? []).filter((batch) => !isTestRecord(batch)))
          return
        }
        if (role === 'student') {
          const res = await batchApi.getStudentEnrolled()
          if (!cancelled) setBatches(res.batches ?? [])
          return
        }
        const [enrolled, kids] = await Promise.all([batchApi.getParentEnrolled(), batchApi.getParentStudents()])
        if (cancelled) return
        const list = kids.students ?? []
        setBatches(enrolled.batches ?? [])
        setChildren(list)
        if (!childId && list[0]) {
          setSearchParams((prev) => {
            const next = new URLSearchParams(prev)
            next.set('child', list[0].userId)
            return next
          }, { replace: true })
        }
      } catch (err) {
        if (!cancelled) setError(err.message ?? 'Could not load the calendar')
      }
    }
    if (role) load()
    return () => {
      cancelled = true
    }
  }, [role, childId, setSearchParams])

  const visibleBatches = useMemo(() => {
    if (role !== 'parent' || !childId) return batches
    return batches.filter((batch) =>
      (batch.enrollment ?? []).some((row) => row.studentId === childId && row.status === 'active'),
    )
  }, [batches, childId, role])

  const title = role === 'parent'
    ? 'Family calendar'
    : role === 'student'
      ? 'My calendar'
      : 'Class calendar'

  return (
    <div>
      <div className="dashboard-header section-heading">
        <div>
          <span className="eyebrow">Timetable</span>
          <h1>Calendar</h1>
          <p>
            {role === 'tutor'
              ? 'Week, month, and year views of classes that already exist across your batches.'
              : role === 'parent'
                ? 'See which days have a class. Empty days simply mean nothing is scheduled yet.'
                : 'See your upcoming and past classes. Empty days mean no class has been created yet.'}
          </p>
        </div>
      </div>
      {error && <div className="alert error">{error}</div>}
      {role === 'parent' && children.length > 0 && (
        <div className="parent-child-picks">
          <span>Looking at</span>
          {children.map((child) => (
            <button
              key={child.userId}
              type="button"
              className={child.userId === childId ? 'is-active' : ''}
              onClick={() => {
                setSearchParams((prev) => {
                  const next = new URLSearchParams(prev)
                  next.set('child', child.userId)
                  return next
                }, { replace: true })
              }}
            >
              {child.name}
            </button>
          ))}
        </div>
      )}
      <ClassCalendar
        batches={visibleBatches}
        studentId={role === 'parent' ? childId : ''}
        sessionHref={role === 'tutor' ? (id) => `/tutor/dashboard/sessions/${id}` : null}
        defaultView="week"
        title={title}
      />
    </div>
  )
}
