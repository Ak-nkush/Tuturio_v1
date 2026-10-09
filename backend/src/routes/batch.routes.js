import { Router } from 'express'
import { Batch, publicBatch } from '../models/Batch.js'
import { Invite } from '../models/Invite.js'
import { Session } from '../models/Session.js'
import { User } from '../models/User.js'
import { requireAuth, requireRole } from '../middleware/auth.js'
import { generateBatchId } from '../utils/ids.js'
import { generateSessionsForBatch, previewScheduleChange, regenerateFutureSessions } from '../services/sessionService.js'
import { notifyMany, parentIdsForStudents } from '../services/notificationService.js'

const router = Router()

router.use(requireAuth)

function parseSubjects(value) {
  if (Array.isArray(value)) {
    return value.map((s) => String(s).trim()).filter(Boolean)
  }
  if (typeof value === 'string') {
    return value.split(',').map((s) => s.trim()).filter(Boolean)
  }
  return []
}

function parseSchedule(body) {
  const days = Array.isArray(body.days)
    ? body.days.map(Number).filter((d) => d >= 0 && d <= 6)
    : []
  const time = String(body.time ?? '18:00').trim()
  return { days, time }
}

function parseWeeksAhead(value) {
  const weeks = Number(value ?? 4)
  return [4, 8, 12].includes(weeks) ? weeks : 4
}

function parseClassTopic(value, fallback) {
  const topic = String(value ?? '').trim()
  return topic || fallback
}

function parseExtraClasses(value) {
  if (!Array.isArray(value)) return []
  return value
    .map((item) => ({
      topic: String(item?.topic ?? '').trim(),
      date: item?.date ? new Date(item.date) : null,
    }))
    .filter((item) => item.topic && item.date && !Number.isNaN(item.date.getTime()))
}

async function createExtraClasses(batch, extras) {
  const created = []
  for (const extra of extras) {
    created.push(
      await Session.create({
        batchId: batch.batchId,
        tutorId: batch.tutorId,
        date: extra.date,
        topic: extra.topic,
        status: 'scheduled',
        oneOff: true,
      }),
    )
  }
  return created
}

function schedulesMatch(a, b) {
  const leftDays = [...(a?.days ?? [])].map(Number).sort().join(',')
  const rightDays = [...(b?.days ?? [])].map(Number).sort().join(',')
  return leftDays === rightDays && String(a?.time ?? '18:00') === String(b?.time ?? '18:00')
}

async function resolveStudents(enrollment, { includeRemoved = false } = {}) {
  const rows = includeRemoved
    ? enrollment
    : enrollment.filter((e) => e.status === 'active' || e.status === 'pending')
  const studentIds = rows.map((e) => e.studentId)
  const parentIds = rows.map((e) => e.parentId).filter(Boolean)
  const pendingIds = rows.filter((e) => e.status === 'pending').map((e) => e.studentId)
  const [users, invites] = await Promise.all([
    User.find({ userId: { $in: [...studentIds, ...parentIds] } }),
    pendingIds.length
      ? Invite.find({ linkedStudentId: { $in: pendingIds }, role: 'student' })
      : Promise.resolve([]),
  ])
  const byId = Object.fromEntries(users.map((u) => [u.userId, u]))
  const inviteByStudent = Object.fromEntries(invites.map((invite) => [invite.linkedStudentId, invite]))

  return rows.map((e) => {
    const user = byId[e.studentId]
    const invite = inviteByStudent[e.studentId]
    return {
      studentId: e.studentId,
      name: user?.name ?? (e.status === 'pending' ? 'Awaiting registration' : e.studentId),
      email: user?.email ?? invite?.email ?? null,
      accountStatus: user?.status ?? (e.status === 'pending' ? 'pending' : 'active'),
      parentId: e.parentId ?? null,
      parentName: e.parentId ? byId[e.parentId]?.name ?? e.parentId : null,
      joinedAt: e.joinedAt,
      status: e.status,
      inviteExpiresAt: invite?.expiresAt ?? null,
    }
  })
}

router.get('/', requireRole('tutor'), async (req, res) => {
  try {
    const batches = await Batch.find({ tutorId: req.user.userId, status: 'active' }).sort({ createdAt: -1 })
    res.json({ batches: batches.map(publicBatch) })
  } catch (error) {
    console.error(error)
    res.status(500).json({ error: 'Server error' })
  }
})

router.get('/students/all', requireRole('tutor'), async (req, res) => {
  try {
    const batches = await Batch.find({ tutorId: req.user.userId, status: 'active' })
    const rows = []
    for (const batch of batches) {
      const students = await resolveStudents(batch.enrollment, { includeRemoved: true })
      students.forEach((s) => rows.push({ ...s, batchId: batch.batchId, batchName: batch.name }))
    }
    res.json({ students: rows })
  } catch (error) {
    console.error(error)
    res.status(500).json({ error: 'Server error' })
  }
})

router.get('/student/enrolled', async (req, res) => {
  try {
    const batches = await Batch.find({
      'enrollment': {
        $elemMatch: { studentId: req.user.userId, status: 'active' }
      },
      status: 'active'
    }).sort({ createdAt: -1 })
    res.json({ batches: batches.map(publicBatch) })
  } catch (error) {
    console.error(error)
    res.status(500).json({ error: 'Server error' })
  }
})

router.get('/parent/students', async (req, res) => {
  try {
    const parent = await User.findOne({ userId: req.user.userId })
    if (!parent) return res.status(404).json({ error: 'User not found' })
    
    const students = await User.find({ userId: { $in: parent.linkedStudentIds } })
    const batches = await Batch.find({ status: 'active', 'enrollment.parentId': parent.userId })
    const pending = []
    for (const batch of batches) {
      for (const row of batch.enrollment) {
        if (row.parentId === parent.userId && row.status === 'pending') {
          pending.push({ batchId: batch.batchId, batchName: batch.name, studentId: row.studentId })
        }
      }
    }
    res.json({
      students: students.map((s) => ({ userId: s.userId, name: s.name, email: s.email })),
      pending,
    })
  } catch (error) {
    console.error(error)
    res.status(500).json({ error: 'Server error' })
  }
})

router.get('/parent/enrolled', async (req, res) => {
  try {
    const parent = await User.findOne({ userId: req.user.userId })
    if (!parent) return res.status(404).json({ error: 'User not found' })
    
    const batches = await Batch.find({
      'enrollment': {
        $elemMatch: { studentId: { $in: parent.linkedStudentIds }, status: 'active' }
      },
      status: 'active'
    }).sort({ createdAt: -1 })
    res.json({ batches: batches.map(publicBatch) })
  } catch (error) {
    console.error(error)
    res.status(500).json({ error: 'Server error' })
  }
})

router.get('/:batchId', async (req, res) => {
  try {
    const batch = await Batch.findOne({ batchId: req.params.batchId, status: 'active' })
    if (!batch) return res.status(404).json({ error: 'Batch not found' })

    let isAuthorized = false
    if (req.user.role === 'tutor' && batch.tutorId === req.user.userId) isAuthorized = true
    if (req.user.role === 'student' && batch.enrollment.some(e => e.studentId === req.user.userId && e.status === 'active')) isAuthorized = true
    if (req.user.role === 'parent') {
      const parent = await User.findOne({ userId: req.user.userId })
      if (parent && batch.enrollment.some(e => parent.linkedStudentIds.includes(e.studentId) && e.status === 'active')) {
        isAuthorized = true
      }
    }
    
    if (!isAuthorized) return res.status(403).json({ error: 'Forbidden' })

    const includeRemoved = req.user.role === 'tutor'
    const students = await resolveStudents(batch.enrollment, { includeRemoved })
    res.json({ batch: publicBatch(batch), students })
  } catch (error) {
    console.error(error)
    res.status(500).json({ error: 'Server error' })
  }
})

router.post('/', requireRole('tutor'), async (req, res) => {
  try {
    const name = String(req.body.name ?? '').trim()
    const subjects = parseSubjects(req.body.subjects)
    const schedule = parseSchedule(req.body.schedule ?? req.body)

    if (!name) return res.status(400).json({ error: 'Batch name is required' })

    const batchId = await generateBatchId()
    const batch = await Batch.create({
      batchId,
      tutorId: req.user.userId,
      name,
      subjects,
      schedule,
    })

    let sessionsCreated = []
    const classTopic = parseClassTopic(req.body.classTopic, `${name} — Class`)
    const weeksAhead = parseWeeksAhead(req.body.weeksAhead)
    if (schedule.days.length > 0) {
      sessionsCreated = await generateSessionsForBatch(batch, weeksAhead, classTopic)
    }
    const extras = await createExtraClasses(batch, parseExtraClasses(req.body.extraClasses))

    res.status(201).json({
      batch: publicBatch(batch),
      sessionsCreated: sessionsCreated.length + extras.length,
    })
  } catch (error) {
    console.error(error)
    res.status(500).json({ error: 'Server error' })
  }
})

router.patch('/:batchId', requireRole('tutor'), async (req, res) => {
  try {
    const batch = await Batch.findOne({ batchId: req.params.batchId, tutorId: req.user.userId, status: 'active' })
    if (!batch) return res.status(404).json({ error: 'Batch not found' })

    if (req.body.name !== undefined) {
      const name = String(req.body.name).trim()
      if (!name) return res.status(400).json({ error: 'Batch name cannot be empty' })
      batch.name = name
    }

    if (req.body.subjects !== undefined) {
      batch.subjects = parseSubjects(req.body.subjects)
    }

    let scheduleChanged = false
    let nextSchedule = batch.schedule
    if (req.body.schedule !== undefined || req.body.days !== undefined || req.body.time !== undefined) {
      nextSchedule = parseSchedule(req.body.schedule ?? req.body)
      scheduleChanged = !schedulesMatch(batch.schedule, nextSchedule)
    }

    if (scheduleChanged) batch.schedule = nextSchedule

    await batch.save()

    let sessionsCreated = 0
    const weeksAhead = parseWeeksAhead(req.body.weeksAhead)
    const classTopic = parseClassTopic(req.body.classTopic, `${batch.name} — Class`)
    if (req.body.regenerateSessions === true) {
      const sessions = await regenerateFutureSessions(batch, weeksAhead, classTopic)
      sessionsCreated = sessions.length
    }
    const extras = await createExtraClasses(batch, parseExtraClasses(req.body.extraClasses))
    sessionsCreated += extras.length

    res.json({ batch: publicBatch(batch), sessionsCreated })

    // Notify students + parents when the schedule changed (R6, R7 — tutor excluded)
    if (scheduleChanged) {
      const studentIds = batch.enrollment.filter((e) => e.status === 'active').map((e) => e.studentId)
      const parentIds = await parentIdsForStudents(studentIds)
      const dayNames = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat']
      const days = (nextSchedule.days ?? []).map((d) => dayNames[d]).join(', ') || 'TBD'
      const payload = {
        title: 'Schedule updated',
        message: `The schedule for ${batch.name} has changed to ${days} at ${nextSchedule.time}.`,
        type: 'batch',
        event: 'batch',
        link: null,
      }
      notifyMany(studentIds, payload)
      notifyMany(parentIds, payload)
    }
  } catch (error) {
    console.error(error)
    res.status(500).json({ error: 'Server error' })
  }
})

router.delete('/:batchId', requireRole('tutor'), async (req, res) => {
  try {
    const batch = await Batch.findOne({ batchId: req.params.batchId, tutorId: req.user.userId, status: 'active' })
    if (!batch) return res.status(404).json({ error: 'Batch not found' })

    batch.status = 'archived'
    await batch.save()
    res.json({ message: 'Batch archived' })
  } catch (error) {
    console.error(error)
    res.status(500).json({ error: 'Server error' })
  }
})

router.get('/:batchId/students', requireRole('tutor'), async (req, res) => {
  try {
    const batch = await Batch.findOne({ batchId: req.params.batchId, tutorId: req.user.userId, status: 'active' })
    if (!batch) return res.status(404).json({ error: 'Batch not found' })
    const students = await resolveStudents(batch.enrollment)
    res.json({ students })
  } catch (error) {
    console.error(error)
    res.status(500).json({ error: 'Server error' })
  }
})

router.patch('/:batchId/students/:studentId', requireRole('tutor'), async (req, res) => {
  try {
    const batch = await Batch.findOne({ batchId: req.params.batchId, tutorId: req.user.userId, status: 'active' })
    if (!batch) return res.status(404).json({ error: 'Batch not found' })

    const enrollment = batch.enrollment.find((e) => e.studentId === req.params.studentId)
    if (!enrollment) return res.status(404).json({ error: 'Student not found in batch' })

    const allowed = ['pending', 'active', 'removed', 'archived']
    const status = req.body.status === undefined ? 'removed' : String(req.body.status)
    if (!allowed.includes(status)) {
      return res.status(400).json({ error: `status must be one of: ${allowed.join(', ')}` })
    }

    enrollment.status = status
    await batch.save()
    res.json({
      message: status === 'removed'
        ? 'Student removed from batch. Attendance and progress records are kept.'
        : `Student status updated to ${status}.`,
      enrollment: { studentId: enrollment.studentId, status: enrollment.status },
      batch: publicBatch(batch),
    })
  } catch (error) {
    console.error(error)
    res.status(500).json({ error: 'Server error' })
  }
})

router.post('/:batchId/holidays', requireRole('tutor'), async (req, res) => {
  try {
    const batch = await Batch.findOne({ batchId: req.params.batchId, tutorId: req.user.userId, status: 'active' })
    if (!batch) return res.status(404).json({ error: 'Batch not found' })

    const date = new Date(req.body.date)
    if (Number.isNaN(date.getTime())) return res.status(400).json({ error: 'Valid date is required' })

    const exists = batch.holidays.some((h) => {
      const d = new Date(h)
      return d.toDateString() === date.toDateString()
    })
    if (!exists) batch.holidays.push(date)

    await batch.save()

    const dayStart = new Date(date)
    dayStart.setHours(0, 0, 0, 0)
    const dayEnd = new Date(date)
    dayEnd.setHours(23, 59, 59, 999)

    const cancelled = await Session.updateMany(
      { batchId: batch.batchId, date: { $gte: dayStart, $lte: dayEnd } },
      { isHoliday: true, status: 'cancelled' },
    )

    res.json({ batch: publicBatch(batch), sessionsCancelled: cancelled.modifiedCount ?? 0 })

    // Notify active students and their linked parents (R6, R7 — tutor excluded)
    const studentIds = batch.enrollment.filter((e) => e.status === 'active').map((e) => e.studentId)
    const parentIds = await parentIdsForStudents(studentIds)
    const dateLabel = date.toLocaleDateString('en-GB', { day: 'numeric', month: 'long', year: 'numeric' })
    const payload = {
      title: 'Holiday marked',
      message: `${batch.name} has a holiday on ${dateLabel}. Classes scheduled for that day are cancelled.`,
      type: 'batch',
      event: 'batch',
      link: null,
    }
    notifyMany(studentIds, payload)
    notifyMany(parentIds, payload)
  } catch (error) {
    console.error(error)
    res.status(500).json({ error: 'Server error' })
  }
})

router.delete('/:batchId/holidays', requireRole('tutor'), async (req, res) => {
  try {
    const batch = await Batch.findOne({ batchId: req.params.batchId, tutorId: req.user.userId, status: 'active' })
    if (!batch) return res.status(404).json({ error: 'Batch not found' })

    const date = new Date(req.body.date)
    if (Number.isNaN(date.getTime())) return res.status(400).json({ error: 'Valid date is required' })

    batch.holidays = (batch.holidays ?? []).filter((h) => {
      const d = new Date(h)
      return d.toDateString() !== date.toDateString()
    })
    await batch.save()

    const dayStart = new Date(date)
    dayStart.setHours(0, 0, 0, 0)
    const dayEnd = new Date(date)
    dayEnd.setHours(23, 59, 59, 999)

    await Session.updateMany(
      { batchId: batch.batchId, date: { $gte: dayStart, $lte: dayEnd }, isHoliday: true, status: 'cancelled' },
      { isHoliday: false, status: 'scheduled' },
    )

    res.json({ batch: publicBatch(batch) })

    // Notify active students and their linked parents (R6, R7 — tutor excluded)
    const studentIds = batch.enrollment.filter((e) => e.status === 'active').map((e) => e.studentId)
    const parentIds = await parentIdsForStudents(studentIds)
    const dateLabel = date.toLocaleDateString('en-GB', { day: 'numeric', month: 'long', year: 'numeric' })
    const payload = {
      title: 'Holiday removed',
      message: `The holiday on ${dateLabel} for ${batch.name} has been removed. Classes are back on as scheduled.`,
      type: 'batch',
      event: 'batch',
      link: null,
    }
    notifyMany(studentIds, payload)
    notifyMany(parentIds, payload)
  } catch (error) {
    console.error(error)
    res.status(500).json({ error: 'Server error' })
  }
})

router.post('/:batchId/preview-schedule-change', requireRole('tutor'), async (req, res) => {
  try {
    const batch = await Batch.findOne({ batchId: req.params.batchId, tutorId: req.user.userId, status: 'active' })
    if (!batch) return res.status(404).json({ error: 'Batch not found' })

    const schedule = parseSchedule(req.body.schedule ?? req.body)
    let weeksAhead = Number(req.body.weeksAhead ?? 4)
    if (!Number.isFinite(weeksAhead) || weeksAhead < 1) weeksAhead = 4
    weeksAhead = Math.min(12, Math.round(weeksAhead))

    const preview = await previewScheduleChange(batch, schedule, weeksAhead)
    res.json({ preview })
  } catch (error) {
    console.error(error)
    res.status(500).json({ error: 'Server error' })
  }
})

router.post('/:batchId/regenerate-sessions', requireRole('tutor'), async (req, res) => {
  try {
    const batch = await Batch.findOne({ batchId: req.params.batchId, tutorId: req.user.userId, status: 'active' })
    if (!batch) return res.status(404).json({ error: 'Batch not found' })

    const sessions = await regenerateFutureSessions(batch)
    res.json({ sessionsCreated: sessions.length })
  } catch (error) {
    console.error(error)
    res.status(500).json({ error: 'Server error' })
  }
})

export default router
