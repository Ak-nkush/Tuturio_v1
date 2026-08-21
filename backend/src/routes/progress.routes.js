import { Router } from 'express'
import { Progress } from '../models/Progress.js'
import { Batch } from '../models/Batch.js'
import { User } from '../models/User.js'
import { requireAuth, requireRole } from '../middleware/auth.js'
import { validObjectIdParam } from '../utils/validate.js'

const router = Router()

router.use(requireAuth)

router.get('/batch/:batchId', async (req, res) => {
  try {
    const batch = await Batch.findOne({ batchId: req.params.batchId, status: 'active' })
    if (!batch) return res.status(404).json({ error: 'Batch not found' })

    if (req.user.role === 'tutor' && batch.tutorId !== req.user.userId) {
      return res.status(403).json({ error: 'Forbidden' })
    }

    if (req.user.role === 'student') {
      const isEnrolled = batch.enrollment.some((e) => e.studentId === req.user.userId && e.status === 'active')
      if (!isEnrolled) return res.status(403).json({ error: 'Forbidden' })
    }

    if (req.user.role === 'parent') {
      const parent = await User.findOne({ userId: req.user.userId })
      if (!parent || !batch.enrollment.some((e) => parent.linkedStudentIds.includes(e.studentId) && e.status === 'active')) {
        return res.status(403).json({ error: 'Forbidden' })
      }
    }

    const filter = { batchId: req.params.batchId }
    if (req.query.studentId) filter.studentId = String(req.query.studentId)

    const entries = await Progress.find(filter).sort({ date: -1 }).limit(100)
    res.json({ progress: entries })
  } catch (error) {
    console.error(error)
    res.status(500).json({ error: 'Server error' })
  }
})

router.get('/student/me', async (req, res) => {
  try {
    const filter = { studentId: req.user.userId }
    if (req.query.batchId) filter.batchId = req.query.batchId

    const progress = await Progress.find(filter).sort({ createdAt: -1 })
    res.json({ progress })
  } catch (error) {
    console.error(error)
    res.status(500).json({ error: 'Server error' })
  }
})

router.get('/parent/students', async (req, res) => {
  try {
    const parent = await User.findOne({ userId: req.user.userId })
    if (!parent) return res.status(404).json({ error: 'User not found' })

    const filter = { studentId: { $in: parent.linkedStudentIds } }
    if (req.query.batchId) filter.batchId = req.query.batchId

    const progress = await Progress.find(filter).sort({ createdAt: -1 })
    res.json({ progress })
  } catch (error) {
    console.error(error)
    res.status(500).json({ error: 'Server error' })
  }
})

router.get('/session/:sessionId', requireRole('tutor'), validObjectIdParam('sessionId'), async (req, res) => {
  try {
    const entries = await Progress.find({ sessionId: req.params.sessionId }).sort({ createdAt: -1 })
    res.json({ progress: entries })
  } catch (error) {
    console.error(error)
    res.status(500).json({ error: 'Server error' })
  }
})

function validateScore(score, maxScore) {
  if (!Number.isFinite(score) || !Number.isFinite(maxScore)) {
    return 'score and maxScore are required numbers'
  }
  if (score < 0 || maxScore <= 0) {
    return 'score must be >= 0 and maxScore must be > 0'
  }
  if (score > maxScore) {
    return 'score cannot exceed maxScore'
  }
  return null
}

router.post('/', requireRole('tutor'), async (req, res) => {
  try {
    const batchId = String(req.body.batchId ?? '')
    const studentId = String(req.body.studentId ?? '')
    const topic = String(req.body.topic ?? '').trim()
    const subject = String(req.body.subject ?? '').trim()
    const score = Number(req.body.score)
    const maxScore = Number(req.body.maxScore)
    const remark = req.body.remark ? String(req.body.remark).trim() : ''

    if (!batchId || !studentId || !topic) {
      return res.status(400).json({ error: 'batchId, studentId, and topic are required' })
    }
    if (remark.length > 500) {
      return res.status(400).json({ error: 'Remark too long (max 500 characters)' })
    }

    const scoreError = validateScore(score, maxScore)
    if (scoreError) return res.status(400).json({ error: scoreError })

    const batch = await Batch.findOne({ batchId, tutorId: req.user.userId, status: 'active' })
    if (!batch) return res.status(404).json({ error: 'Batch not found' })

    const enrolled = batch.enrollment.some((e) => e.studentId === studentId && e.status === 'active')
    if (!enrolled) return res.status(400).json({ error: 'Student is not enrolled in this batch' })

    const entry = await Progress.create({
      tutorId: req.user.userId,
      batchId,
      studentId,
      subject,
      topic,
      score,
      maxScore,
      remark,
      sessionId: req.body.sessionId ? String(req.body.sessionId) : null,
    })

    const student = await User.findOne({ userId: studentId })
    const enrollment = batch.enrollment.find((e) => e.studentId === studentId)
    const recipients = [studentId]
    if (enrollment?.parentId) recipients.push(enrollment.parentId)
    await notifyManySafe(recipients, batch.name, topic)

    res.status(201).json({
      progress: entry,
      studentName: student?.name ?? studentId,
    })
  } catch (error) {
    console.error(error)
    res.status(500).json({ error: 'Server error' })
  }
})

async function notifyManySafe(recipients, batchName, topic) {
  const { notifyMany } = await import('../services/notificationService.js')
  await notifyMany(recipients, {
    title: 'Progress updated',
    message: `New progress entry for "${batchName}": ${topic}`,
    type: 'student',
    event: 'progress',
  })
}

router.patch('/:id', requireRole('tutor'), validObjectIdParam('id'), async (req, res) => {
  try {
    const entry = await Progress.findById(req.params.id)
    if (!entry || entry.tutorId !== req.user.userId) {
      return res.status(404).json({ error: 'Progress entry not found' })
    }

    if (req.body.subject !== undefined) entry.subject = String(req.body.subject).trim()
    if (req.body.topic !== undefined) {
      const topic = String(req.body.topic).trim()
      if (!topic) return res.status(400).json({ error: 'Topic cannot be empty' })
      entry.topic = topic
    }
    if (req.body.score !== undefined || req.body.maxScore !== undefined) {
      const score = req.body.score !== undefined ? Number(req.body.score) : entry.score
      const maxScore = req.body.maxScore !== undefined ? Number(req.body.maxScore) : entry.maxScore
      const scoreError = validateScore(score, maxScore)
      if (scoreError) return res.status(400).json({ error: scoreError })
      entry.score = score
      entry.maxScore = maxScore
    }
    if (req.body.remark !== undefined) entry.remark = String(req.body.remark).trim()

    await entry.save()
    res.json({ progress: entry })
  } catch (error) {
    console.error(error)
    res.status(500).json({ error: 'Server error' })
  }
})

router.delete('/:id', requireRole('tutor'), validObjectIdParam('id'), async (req, res) => {
  try {
    const entry = await Progress.findById(req.params.id)
    if (!entry || entry.tutorId !== req.user.userId) {
      return res.status(404).json({ error: 'Progress entry not found' })
    }
    await entry.deleteOne()
    res.json({ message: 'Deleted' })
  } catch (error) {
    console.error(error)
    res.status(500).json({ error: 'Server error' })
  }
})

export default router
