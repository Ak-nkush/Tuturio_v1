import { Router } from 'express'
import { Session } from '../models/Session.js'
import { Batch } from '../models/Batch.js'
import { User } from '../models/User.js'
import { requireAuth, requireRole } from '../middleware/auth.js'
import { SESSION_STATUSES, validObjectIdParam } from '../utils/validate.js'
import { generateSessionsForBatch } from '../services/sessionService.js'

const router = Router()

router.use(requireAuth)

async function getTutorSession(sessionId, tutorId) {
  const session = await Session.findById(sessionId)
  if (!session || session.tutorId !== tutorId) return null
  return session
}

// Ensure a batch always has sessions scheduled ahead (4-week rolling window).
async function ensureUpcomingSessions(batch) {
  const now = new Date()
  const upcoming = await Session.countDocuments({
    batchId: batch.batchId,
    date: { $gte: now },
    status: 'scheduled',
  })
  if (upcoming < 2) {
    await generateSessionsForBatch(batch)
  }
}

router.get('/today', requireRole('tutor'), async (req, res) => {
  try {
    const startOfDay = new Date()
    startOfDay.setHours(0, 0, 0, 0)

    const endOfDay = new Date()
    endOfDay.setHours(23, 59, 59, 999)

    // Only count active batches so archived batches don't leak into "today".
    const activeBatches = await Batch.find({ tutorId: req.user.userId, status: 'active' })
    const activeBatchIds = activeBatches.map((b) => b.batchId)

    const sessions = await Session.find({
      tutorId: req.user.userId,
      batchId: { $in: activeBatchIds },
      date: { $gte: startOfDay, $lte: endOfDay },
    }).sort({ date: 1 })

    res.json({ sessions })
  } catch (error) {
    console.error("Error fetching today's sessions:", error)
    res.status(500).json({ error: 'Server error' })
  }
})

const CALENDAR_MAX_MS = 370 * 24 * 60 * 60 * 1000

async function calendarBatchIdsForUser(req) {
  const requestedBatchId = String(req.query.batchId ?? '').trim()
  const requestedStudentId = String(req.query.studentId ?? '').trim()
  const role = req.user.role

  if (role === 'tutor') {
    const activeBatches = await Batch.find({ tutorId: req.user.userId, status: 'active' })
    let batchIds = activeBatches.map((batch) => batch.batchId)
    if (requestedBatchId) {
      if (!batchIds.includes(requestedBatchId)) return { status: 404, error: 'Batch not found' }
      batchIds = [requestedBatchId]
    }
    return { batchIds }
  }

  if (role === 'student') {
    const batches = await Batch.find({
      status: 'active',
      enrollment: { $elemMatch: { studentId: req.user.userId, status: 'active' } },
    })
    let batchIds = batches.map((batch) => batch.batchId)
    if (requestedBatchId) {
      if (!batchIds.includes(requestedBatchId)) return { status: 404, error: 'Batch not found' }
      batchIds = [requestedBatchId]
    }
    return { batchIds }
  }

  if (role === 'parent') {
    const parent = await User.findOne({ userId: req.user.userId })
    if (!parent) return { status: 404, error: 'User not found' }
    let studentIds = parent.linkedStudentIds ?? []
    if (requestedStudentId) {
      if (!studentIds.includes(requestedStudentId)) return { status: 403, error: 'Forbidden' }
      studentIds = [requestedStudentId]
    }
    const batches = await Batch.find({
      status: 'active',
      enrollment: { $elemMatch: { studentId: { $in: studentIds }, status: 'active' } },
    })
    let batchIds = batches.map((batch) => batch.batchId)
    if (requestedBatchId) {
      if (!batchIds.includes(requestedBatchId)) return { status: 404, error: 'Batch not found' }
      batchIds = [requestedBatchId]
    }
    return { batchIds }
  }

  return { status: 403, error: 'Forbidden' }
}

router.get('/calendar', async (req, res) => {
  try {
    const from = req.query.from ? new Date(req.query.from) : null
    const to = req.query.to ? new Date(req.query.to) : null
    if (!from || !to || Number.isNaN(from.getTime()) || Number.isNaN(to.getTime())) {
      return res.status(400).json({ error: 'from and to dates are required' })
    }
    if (to < from) return res.status(400).json({ error: 'to must be after from' })
    if (to.getTime() - from.getTime() > CALENDAR_MAX_MS) {
      return res.status(400).json({ error: 'Date range cannot exceed one year' })
    }

    const resolved = await calendarBatchIdsForUser(req)
    if (resolved.status) return res.status(resolved.status).json({ error: resolved.error })

    const query = {
      batchId: { $in: resolved.batchIds },
      date: { $gte: from, $lte: to },
    }
    if (req.user.role === 'tutor') query.tutorId = req.user.userId

    const sessions = await Session.find(query).sort({ date: 1 }).limit(2500)
    res.json({ sessions, from, to })
  } catch (error) {
    console.error('Error fetching calendar sessions:', error)
    res.status(500).json({ error: 'Server error' })
  }
})

router.get('/batch/:batchId', async (req, res) => {
  try {
    const batch = await Batch.findOne({ batchId: req.params.batchId, status: 'active' })
    if (!batch) return res.status(404).json({ error: 'Batch not found' })

    if (req.user.role === 'tutor' && batch.tutorId !== req.user.userId) {
      return res.status(403).json({ error: 'Forbidden' })
    }
    if (req.user.role === 'student' && !batch.enrollment.some((e) => e.studentId === req.user.userId && e.status === 'active')) {
      return res.status(403).json({ error: 'Forbidden' })
    }
    if (req.user.role === 'parent') {
      const parent = await User.findOne({ userId: req.user.userId })
      if (!parent || !batch.enrollment.some((e) => parent.linkedStudentIds.includes(e.studentId) && e.status === 'active')) {
        return res.status(403).json({ error: 'Forbidden' })
      }
    }

    await ensureUpcomingSessions(batch)

    const sessions = await Session.find({ batchId: batch.batchId }).sort({ date: -1 }).limit(50)
    res.json({ sessions })
  } catch (error) {
    res.status(500).json({ error: 'Server error' })
  }
})

router.get('/student/upcoming', async (req, res) => {
  try {
    const batches = await Batch.find({
      'enrollment': {
        $elemMatch: { studentId: req.user.userId, status: 'active' },
      },
      status: 'active',
    })

    const batchIds = batches.map((b) => b.batchId)
    for (const batch of batches) {
      await ensureUpcomingSessions(batch)
    }

    const now = new Date()
    const upcomingSessions = await Session.find({
      batchId: { $in: batchIds },
      date: { $gte: now },
      status: 'scheduled',
      isHoliday: { $ne: true },
    }).sort({ date: 1 }).limit(10)

    res.json({ sessions: upcomingSessions })
  } catch (error) {
    console.error('Error fetching upcoming sessions:', error)
    res.status(500).json({ error: 'Server error' })
  }
})

router.get('/parent/upcoming', async (req, res) => {
  try {
    const parent = await User.findOne({ userId: req.user.userId })
    if (!parent) return res.status(404).json({ error: 'User not found' })

    const batches = await Batch.find({
      'enrollment': {
        $elemMatch: { studentId: { $in: parent.linkedStudentIds }, status: 'active' },
      },
      status: 'active',
    })

    const batchIds = batches.map((b) => b.batchId)
    for (const batch of batches) {
      await ensureUpcomingSessions(batch)
    }

    const now = new Date()
    const upcomingSessions = await Session.find({
      batchId: { $in: batchIds },
      date: { $gte: now },
      status: 'scheduled',
      isHoliday: { $ne: true },
    }).sort({ date: 1 }).limit(10)

    res.json({ sessions: upcomingSessions })
  } catch (error) {
    console.error('Error fetching parent upcoming sessions:', error)
    res.status(500).json({ error: 'Server error' })
  }
})

router.get('/:sessionId/students', requireRole('tutor'), validObjectIdParam('sessionId'), async (req, res) => {
  try {
    const session = await getTutorSession(req.params.sessionId, req.user.userId)
    if (!session) return res.status(404).json({ error: 'Session not found' })

    const batch = await Batch.findOne({ batchId: session.batchId, status: 'active' })
    if (!batch) return res.status(404).json({ error: 'Batch not found' })

    const active = batch.enrollment.filter((e) => e.status === 'active')
    const users = await User.find({ userId: { $in: active.map((e) => e.studentId) } })
    const byId = Object.fromEntries(users.map((u) => [u.userId, u]))

    const students = active.map((e) => ({
      studentId: e.studentId,
      name: byId[e.studentId]?.name ?? e.studentId,
      email: byId[e.studentId]?.email ?? null,
    }))

    res.json({ students })
  } catch (error) {
    res.status(500).json({ error: 'Server error' })
  }
})

router.get('/:sessionId', validObjectIdParam('sessionId'), async (req, res) => {
  try {
    const session = await Session.findById(req.params.sessionId)
    if (!session) return res.status(404).json({ error: 'Session not found' })

    if (req.user.role === 'tutor' && session.tutorId !== req.user.userId) {
      return res.status(403).json({ error: 'Forbidden' })
    }

    if (req.user.role === 'student') {
      const batch = await Batch.findOne({ batchId: session.batchId, status: 'active' })
      if (!batch || !batch.enrollment.some((e) => e.studentId === req.user.userId && e.status === 'active')) {
        return res.status(403).json({ error: 'Forbidden' })
      }
    }

    if (req.user.role === 'parent') {
      const batch = await Batch.findOne({ batchId: session.batchId, status: 'active' })
      if (!batch) return res.status(404).json({ error: 'Batch not found' })

      const parent = await User.findOne({ userId: req.user.userId })
      if (!parent || !batch.enrollment.some((e) => parent.linkedStudentIds.includes(e.studentId) && e.status === 'active')) {
        return res.status(403).json({ error: 'Forbidden' })
      }
    }

    res.json({ session })
  } catch (error) {
    res.status(500).json({ error: 'Server error' })
  }
})

router.post('/', requireRole('tutor'), async (req, res) => {
  try {
    const batchId = String(req.body.batchId ?? '')
    const topic = String(req.body.topic ?? '').trim()
    const date = req.body.date ? new Date(req.body.date) : new Date()

    if (!batchId || !topic) {
      return res.status(400).json({ error: 'batchId and topic are required' })
    }
    if (Number.isNaN(date.getTime())) {
      return res.status(400).json({ error: 'Valid date is required' })
    }

    const batch = await Batch.findOne({ batchId, tutorId: req.user.userId, status: 'active' })
    if (!batch) return res.status(404).json({ error: 'Batch not found' })

    const session = await Session.create({
      tutorId: req.user.userId,
      batchId,
      date,
      topic,
      status: 'scheduled',
      oneOff: true,
    })

    res.status(201).json({ session })
  } catch (error) {
    console.error('Error creating session:', error)
    res.status(500).json({ error: 'Server error' })
  }
})

router.patch('/:sessionId/status', requireRole('tutor'), validObjectIdParam('sessionId'), async (req, res) => {
  try {
    const { status } = req.body

    if (!SESSION_STATUSES.includes(status)) {
      return res.status(400).json({ error: `status must be one of: ${SESSION_STATUSES.join(', ')}` })
    }

    const session = await Session.findOneAndUpdate(
      { _id: req.params.sessionId, tutorId: req.user.userId },
      { status },
      { new: true, runValidators: true },
    )

    if (!session) return res.status(404).json({ error: 'Session not found or unauthorized' })

    res.json({ session })
  } catch (error) {
    res.status(500).json({ error: 'Server error' })
  }
})

router.patch('/:sessionId', requireRole('tutor'), validObjectIdParam('sessionId'), async (req, res) => {
  try {
    const session = await getTutorSession(req.params.sessionId, req.user.userId)
    if (!session) return res.status(404).json({ error: 'Session not found' })

    if (req.body.topic !== undefined) {
      const topic = String(req.body.topic).trim()
      if (!topic) return res.status(400).json({ error: 'Topic cannot be empty' })
      session.topic = topic
    }
    if (req.body.date !== undefined) {
      const date = new Date(req.body.date)
      if (Number.isNaN(date.getTime())) return res.status(400).json({ error: 'Valid date is required' })
      session.date = date
    }

    await session.save()
    res.json({ session })
  } catch (error) {
    res.status(500).json({ error: 'Server error' })
  }
})

export default router
