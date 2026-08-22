import { Session } from '../models/Session.js'

const DAY_MS = 24 * 60 * 60 * 1000

function sameCalendarDay(a, b) {
  return a.getFullYear() === b.getFullYear()
    && a.getMonth() === b.getMonth()
    && a.getDate() === b.getDate()
}

function isHolidayDate(date, holidays = []) {
  return holidays.some((holiday) => sameCalendarDay(new Date(holiday), date))
}

function buildSessionDate(day, timeStr) {
  const [hours, minutes] = String(timeStr || '18:00').split(':').map(Number)
  const sessionDate = new Date(day)
  sessionDate.setHours(hours || 18, minutes || 0, 0, 0)
  return sessionDate
}

function calendarDayKey(date) {
  const value = new Date(date)
  return `${value.getFullYear()}-${value.getMonth()}-${value.getDate()}`
}

function parseClock(timeStr) {
  const [hours, minutes] = String(timeStr || '18:00').split(':').map(Number)
  return { hours: hours || 18, minutes: minutes || 0 }
}

function clocksMatch(date, timeStr) {
  const value = new Date(date)
  const clock = parseClock(timeStr)
  return value.getHours() === clock.hours && value.getMinutes() === clock.minutes
}

function sessionSummary(session) {
  return {
    _id: session._id,
    date: session.date,
    topic: session.topic,
  }
}

export function computeProposedSessionDates(batch, schedule, weeksAhead = 4) {
  const days = schedule?.days ?? []
  const time = schedule?.time ?? '18:00'
  if (!days.length) return []

  const today = new Date()
  today.setHours(0, 0, 0, 0)
  const endDate = new Date(today.getTime() + weeksAhead * 7 * DAY_MS)
  const dates = []

  for (let cursor = new Date(today); cursor <= endDate; cursor = new Date(cursor.getTime() + DAY_MS)) {
    if (!days.includes(cursor.getDay())) continue
    if (isHolidayDate(cursor, batch.holidays)) continue
    dates.push(buildSessionDate(cursor, time))
  }

  return dates
}

export async function previewScheduleChange(batch, nextSchedule, weeksAhead = 4) {
  const now = new Date()
  const existing = await Session.find({
    batchId: batch.batchId,
    status: 'scheduled',
    date: { $gte: now },
  }).sort({ date: 1 }).lean()

  const proposedDates = computeProposedSessionDates(batch, nextSchedule, weeksAhead)
    .filter((date) => date >= now)
  const proposedByDay = new Map(proposedDates.map((date) => [calendarDayKey(date), date]))
  const existingByDay = new Map(existing.map((session) => [calendarDayKey(session.date), session]))

  const toRemove = []
  const toModify = []
  const unchanged = []

  for (const session of existing) {
    const proposed = proposedByDay.get(calendarDayKey(session.date))
    if (!proposed) {
      toRemove.push(sessionSummary(session))
      continue
    }
    if (clocksMatch(session.date, nextSchedule?.time)) {
      unchanged.push(sessionSummary(session))
    } else {
      toModify.push({
        existing: sessionSummary(session),
        proposed: { date: proposed, time: nextSchedule?.time ?? '18:00' },
      })
    }
  }

  const toCreate = proposedDates
    .filter((date) => !existingByDay.has(calendarDayKey(date)))
    .map((date) => ({ date, time: nextSchedule?.time ?? '18:00' }))

  return {
    currentSchedule: batch.schedule,
    proposedSchedule: nextSchedule,
    toRemove,
    toCreate,
    toModify,
    unchanged,
    weeksAhead,
    counts: {
      toRemove: toRemove.length,
      toCreate: toCreate.length,
      toModify: toModify.length,
      unchanged: unchanged.length,
    },
  }
}

export async function generateSessionsForBatch(batch, weeksAhead = 4) {
  const schedule = batch.schedule ?? { days: [], time: '18:00' }
  if (!schedule.days?.length) return []

  const created = []
  const today = new Date()
  today.setHours(0, 0, 0, 0)

  const endDate = new Date(today.getTime() + weeksAhead * 7 * DAY_MS)

  for (let cursor = new Date(today); cursor <= endDate; cursor = new Date(cursor.getTime() + DAY_MS)) {
    if (!schedule.days.includes(cursor.getDay())) continue
    if (isHolidayDate(cursor, batch.holidays)) continue

    const sessionDate = buildSessionDate(cursor, schedule.time)

    const dayStart = new Date(cursor)
    dayStart.setHours(0, 0, 0, 0)
    const dayEnd = new Date(cursor)
    dayEnd.setHours(23, 59, 59, 999)

    const existing = await Session.findOne({
      batchId: batch.batchId,
      date: { $gte: dayStart, $lte: dayEnd },
    })
    if (existing) continue

    const session = await Session.create({
      batchId: batch.batchId,
      tutorId: batch.tutorId,
      date: sessionDate,
      topic: `${batch.name} — Class`,
      status: 'scheduled',
      isHoliday: false,
    })
    created.push(session)
  }

  return created
}

export async function regenerateFutureSessions(batch, weeksAhead = 4) {
  const now = new Date()
  await Session.deleteMany({
    batchId: batch.batchId,
    status: 'scheduled',
    date: { $gte: now },
    oneOff: { $ne: true },
  })
  return generateSessionsForBatch(batch, weeksAhead)
}
