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
  })
  return generateSessionsForBatch(batch, weeksAhead)
}
