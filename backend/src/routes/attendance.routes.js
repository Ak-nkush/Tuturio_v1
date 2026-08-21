import { Router } from 'express'
import { Attendance } from '../models/Attendance.js'
import { Session } from '../models/Session.js'
import { Batch } from '../models/Batch.js'
import { User } from '../models/User.js'
import { requireAuth, requireRole } from '../middleware/auth.js'
import { ATTENDANCE_STATUSES, validObjectIdParam } from '../utils/validate.js'
import { notifyMany } from '../services/notificationService.js'

const router = Router()

router.use(requireAuth)

router.get('/session/:sessionId', requireRole('tutor'), validObjectIdParam('sessionId'), async (req, res) => {
  try {
    const session = await Session.findById(req.params.sessionId)
    if (!session) return res.status(404).json({ error: 'Session not found' })

    if (session.tutorId !== req.user.userId) {
      return res.status(403).json({ error: 'Forbidden' })
    }

    const attendanceRecords = await Attendance.find({ sessionId: req.params.sessionId })
    res.json({ attendance: attendanceRecords })
  } catch (error) {
    res.status(500).json({ error: 'Server error' })
  }
})

router.get('/tutor/student/:studentId', requireRole('tutor'), async (req, res) => {
  try {
    const studentId = req.params.studentId
    const owns = await Batch.exists({
      tutorId: req.user.userId,
      'enrollment.studentId': studentId,
    })
    if (!owns) return res.status(403).json({ error: 'This student is not in your batches' })

    const attendance = await Attendance.find({ studentId }).sort({ createdAt: -1 }).limit(200).lean()
    const sessionIds = attendance.map((row) => row.sessionId).filter(Boolean)
    const sessions = await Session.find({ _id: { $in: sessionIds }, tutorId: req.user.userId }).select(
      'date topic batchId',
    )
    const byId = Object.fromEntries(sessions.map((session) => [String(session._id), session]))
    res.json({
      attendance: attendance.map((row) => ({
        ...row,
        sessionDate: byId[String(row.sessionId)]?.date ?? null,
        sessionTopic: byId[String(row.sessionId)]?.topic ?? null,
      })),
    })
  } catch (error) {
    res.status(500).json({ error: 'Server error' })
  }
})

router.get('/student/me', async (req, res) => {
  try {
    const filter = { studentId: req.user.userId }
    if (req.query.batchId) filter.batchId = req.query.batchId

    const attendanceRecords = await Attendance.find(filter)
    res.json({ attendance: attendanceRecords })
  } catch (error) {
    console.error('Error fetching student attendance:', error)
    res.status(500).json({ error: 'Server error' })
  }
})

router.get('/parent/students', async (req, res) => {
  try {
    const parent = await User.findOne({ userId: req.user.userId })
    if (!parent) return res.status(404).json({ error: 'User not found' })

    const filter = { studentId: { $in: parent.linkedStudentIds } }
    if (req.query.batchId) filter.batchId = req.query.batchId

    const attendanceRecords = await Attendance.find(filter)
    res.json({ attendance: attendanceRecords })
  } catch (error) {
    console.error('Error fetching parent attendance:', error)
    res.status(500).json({ error: 'Server error' })
  }
})

router.post('/session/:sessionId', requireRole('tutor'), validObjectIdParam('sessionId'), async (req, res) => {
  try {
    const { sessionId } = req.params
    const records = Array.isArray(req.body.records) ? req.body.records : []

    const session = await Session.findOne({ _id: sessionId, tutorId: req.user.userId })
    if (!session) return res.status(404).json({ error: 'Session not found or unauthorized' })

    // batchId must match the session's own batch
    const batchId = String(req.body.batchId ?? '')
    if (batchId && batchId !== session.batchId) {
      return res.status(400).json({ error: 'batchId does not match this session' })
    }

    const batch = await Batch.findOne({ batchId: session.batchId, status: 'active' })
    if (!batch) return res.status(404).json({ error: 'Batch not found' })

    // Validate every record before writing anything
    for (const record of records) {
      if (!record || typeof record.studentId !== 'string') {
        return res.status(400).json({ error: 'Each record needs a studentId' })
      }
      if (!ATTENDANCE_STATUSES.includes(record.status)) {
        return res.status(400).json({ error: `status must be one of: ${ATTENDANCE_STATUSES.join(', ')}` })
      }
      const enrolled = batch.enrollment.some(
        (e) => e.studentId === record.studentId && e.status === 'active',
      )
      if (!enrolled) {
        return res.status(400).json({ error: `Student ${record.studentId} is not enrolled in this batch` })
      }
    }

    if (records.length > 0) {
      await Attendance.bulkWrite(
        records.map((record) => ({
          updateOne: {
            filter: { sessionId, studentId: record.studentId },
            update: { $set: { batchId: session.batchId, status: record.status } },
            upsert: true,
          },
        })),
      )

      // Notify affected students + their linked parents
      const enrolledRows = batch.enrollment.filter((e) =>
        records.some((r) => r.studentId === e.studentId),
      )
      const recipients = new Set()
      for (const row of enrolledRows) {
        recipients.add(row.studentId)
        if (row.parentId) recipients.add(row.parentId)
      }
      await notifyMany([...recipients], {
        title: 'Attendance recorded',
        message: `Attendance was marked for "${batch.name}"`,
        type: 'student',
        event: 'attendance',
      })
    }

    res.json({ message: 'Attendance saved successfully' })
  } catch (error) {
    console.error('Error saving attendance:', error)
    res.status(500).json({ error: 'Server error' })
  }
})

router.delete('/session/:sessionId/student/:studentId', requireRole('tutor'), validObjectIdParam('sessionId'), async (req, res) => {
  try {
    const session = await Session.findOne({ _id: req.params.sessionId, tutorId: req.user.userId })
    if (!session) return res.status(404).json({ error: 'Session not found' })

    await Attendance.deleteOne({
      sessionId: req.params.sessionId,
      studentId: req.params.studentId,
    })

    res.json({ message: 'Attendance record removed' })
  } catch (error) {
    res.status(500).json({ error: 'Server error' })
  }
})

export default router
