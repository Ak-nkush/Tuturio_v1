import { Router } from 'express'
import { Batch, publicBatch } from '../models/Batch.js'
import { Session } from '../models/Session.js'
import { User } from '../models/User.js'
import { requireAuth, requireRole } from '../middleware/auth.js'
import { generateBatchId } from '../utils/ids.js'
import { generateSessionsForBatch, regenerateFutureSessions } from '../services/sessionService.js'

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

async function resolveStudents(enrollment, { includeRemoved = false } = {}) {
  const rows = includeRemoved ? enrollment : enrollment.filter((e) => e.status === 'active')
  const studentIds = rows.map((e) => e.studentId)
  const parentIds = rows.map((e) => e.parentId).filter(Boolean)
  const users = await User.find({ userId: { $in: [...studentIds, ...parentIds] } })
  const byId = Object.fromEntries(users.map((u) => [u.userId, u]))

  return rows.map((e) => ({
    studentId: e.studentId,
    name: byId[e.studentId]?.name ?? e.studentId,
    email: byId[e.studentId]?.email ?? null,
    accountStatus: byId[e.studentId]?.status ?? 'active',
    parentId: e.parentId ?? null,
    parentName: e.parentId ? byId[e.parentId]?.name ?? e.parentId : null,
    joinedAt: e.joinedAt,
    status: e.status,
  }))
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
    res.json({ students: students.map(s => ({ userId: s.userId, name: s.name, email: s.email })) })
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
    if (schedule.days.length > 0) {
      sessionsCreated = await generateSessionsForBatch(batch)
    }

    res.status(201).json({ batch: publicBatch(batch), sessionsCreated: sessionsCreated.length })
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
    if (req.body.schedule !== undefined || req.body.days !== undefined || req.body.time !== undefined) {
      batch.schedule = parseSchedule(req.body.schedule ?? req.body)
      scheduleChanged = true
    }

    await batch.save()

    let sessionsCreated = 0
    if (scheduleChanged && req.body.regenerateSessions !== false) {
      const sessions = await regenerateFutureSessions(batch)
      sessionsCreated = sessions.length
    }

    res.json({ batch: publicBatch(batch), sessionsCreated })
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

    enrollment.status = 'removed'
    await batch.save()
    res.json({ message: 'Student removed from batch. Attendance and progress records are kept.' })
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

    await Session.updateMany(
      { batchId: batch.batchId, date: { $gte: dayStart, $lte: dayEnd } },
      { isHoliday: true, status: 'cancelled' },
    )

    res.json({ batch: publicBatch(batch) })
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
