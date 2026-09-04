import { Router } from 'express'
import { Attendance } from '../models/Attendance.js'
import { Session } from '../models/Session.js'
import { Batch } from '../models/Batch.js'
import { User } from '../models/User.js'
import { requireAuth, requireRole } from '../middleware/auth.js'
import { ATTENDANCE_STATUSES, validObjectIdParam } from '../utils/validate.js'
import { notifyMany } from '../services/notificationService.js'

async function withSessionMeta(records) {
  const list = records.map((row) => (row.toObject ? row.toObject() : row))
  const sessionIds = list.map((row) => row.sessionId).filter(Boolean)
  const sessions = await Session.find({ _id: { $in: sessionIds } }).select('date topic batchId')
  const byId = Object.fromEntries(sessions.map((session) => [String(session._id), session]))
  return list.map((row) => ({
    ...row,
    sessionDate: byId[String(row.sessionId)]?.date ?? null,
    sessionTopic: byId[String(row.sessionId)]?.topic ?? null,
  }))
}

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

    const attendanceRecords = await Attendance.find(filter).sort({ createdAt: -1 })
    res.json({ attendance: await withSessionMeta(attendanceRecords) })
  } catch (error) {
    console.error('Error fetching student attendance:', error)
    res.status(500).json({ error: 'Server error' })
  }
})

router.get('/batch/:batchId', requireRole('tutor'), async (req, res) => {
  try {
    const batch = await Batch.findOne({
      batchId: req.params.batchId,
      tutorId: req.user.userId,
      status: 'active',
    })
    if (!batch) return res.status(404).json({ error: 'Batch not found' })

    const activeStudents = batch.enrollment.filter((row) => row.status === 'active')
    const studentIds = activeStudents.map((row) => row.studentId)
    const users = await User.find({ userId: { $in: studentIds } })
    const nameById = Object.fromEntries(users.map((user) => [user.userId, user.name]))

    const classes = await Session.find({
      batchId: batch.batchId,
      isHoliday: { $ne: true },
      status: { $ne: 'cancelled' },
    }).sort({ date: -1 }).limit(40)

    const records = await Attendance.find({ batchId: batch.batchId })
    const withMeta = await withSessionMeta(records)

    const students = studentIds.map((studentId) => {
      const rows = records.filter((row) => row.studentId === studentId)
      const present = rows.filter((row) => row.status === 'present').length
      const late = rows.filter((row) => row.status === 'late').length
      const absent = rows.filter((row) => row.status === 'absent').length
      const excused = rows.filter((row) => row.status === 'excused').length
      const attended = present + late
      const percentage = rows.length > 0 ? Math.round((attended / rows.length) * 100) : null
      return {
        studentId,
        name: nameById[studentId] ?? studentId,
        present,
        late,
        absent,
        excused,
        marked: rows.length,
        attendancePercentage: percentage,
      }
    })

    const classRows = classes.map((session) => {
      const sessionRecords = records.filter((row) => String(row.sessionId) === String(session._id))
      return {
        sessionId: String(session._id),
        date: session.date,
        topic: session.topic,
        status: session.status,
        markedCount: sessionRecords.length,
        expectedCount: studentIds.length,
      }
    })

    res.json({
      batchId: batch.batchId,
      students,
      classes: classRows,
      records: withMeta,
    })
  } catch (error) {
    console.error(error)
    res.status(500).json({ error: 'Server error' })
  }
})

router.get('/parent/students', async (req, res) => {
  try {
    const parent = await User.findOne({ userId: req.user.userId })
    if (!parent) return res.status(404).json({ error: 'User not found' })

    const requested = req.query.studentId ? String(req.query.studentId) : null
    if (requested && !parent.linkedStudentIds.includes(requested)) {
      return res.status(403).json({ error: 'Forbidden' })
    }

    const filter = { studentId: requested ? requested : { $in: parent.linkedStudentIds } }
    if (req.query.batchId) filter.batchId = req.query.batchId

    const attendanceRecords = await Attendance.find(filter).sort({ createdAt: -1 })
    res.json({ attendance: await withSessionMeta(attendanceRecords) })
  } catch (error) {
    console.error('Error fetching parent attendance:', error)
    res.status(500).json({ error: 'Server error' })
  }
})

router.get('/student/:studentId', async (req, res) => {
  try {
    const studentId = req.params.studentId
    if (req.user.role === 'student' && req.user.userId !== studentId) {
      return res.status(403).json({ error: 'Forbidden' })
    }
    if (req.user.role === 'parent') {
      const parent = await User.findOne({ userId: req.user.userId })
      if (!parent?.linkedStudentIds.includes(studentId)) return res.status(403).json({ error: 'Forbidden' })
    }
    if (req.user.role === 'tutor') {
      const owns = await Batch.exists({ tutorId: req.user.userId, 'enrollment.studentId': studentId })
      if (!owns) return res.status(403).json({ error: 'This student is not in your batches' })
    }

    const attendance = await Attendance.find({ studentId }).sort({ createdAt: -1 }).limit(200)
    res.json({ attendance: await withSessionMeta(attendance) })
  } catch (error) {
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
      for (const record of records) {
        const existing = await Attendance.findOne({ sessionId, studentId: record.studentId })
        if (existing && existing.status !== record.status) {
          const note = String(record.note ?? '').trim() || `Changed from ${existing.status} to ${record.status}`
          existing.corrections.push({
            previousStatus: existing.status,
            newStatus: record.status,
            note,
            changedBy: req.user.userId,
            changedAt: new Date(),
          })
          existing.status = record.status
          existing.markedBy = req.user.userId
          existing.markedAt = new Date()
          await existing.save()
        } else if (!existing) {
          await Attendance.create({
            sessionId,
            studentId: record.studentId,
            batchId: session.batchId,
            status: record.status,
            markedBy: req.user.userId,
            markedAt: new Date(),
          })
        }
      }

      // Notify affected students + their linked parents
      const enrolledRows = batch.enrollment.filter((e) =>
        records.some((r) => r.studentId === e.studentId),
      )
      await notifyMany(enrolledRows.map((row) => row.studentId), {
        title: 'Attendance recorded',
        message: `Attendance was marked for "${batch.name}"`,
        type: 'student',
        event: 'attendance',
        link: '/student/dashboard/attendance',
      })
      await notifyMany(enrolledRows.map((row) => row.parentId).filter(Boolean), {
        title: 'Attendance recorded',
        message: `Attendance was marked for "${batch.name}"`,
        type: 'student',
        event: 'attendance',
        link: '/parent/dashboard/attendance',
      })
    }

    res.json({ message: 'Attendance saved successfully' })
  } catch (error) {
    console.error('Error saving attendance:', error)
    res.status(500).json({ error: 'Server error' })
  }
})

router.patch('/session/:sessionId/student/:studentId', requireRole('tutor'), validObjectIdParam('sessionId'), async (req, res) => {
  try {
    const session = await Session.findOne({ _id: req.params.sessionId, tutorId: req.user.userId })
    if (!session) return res.status(404).json({ error: 'Session not found or unauthorized' })

    const status = String(req.body.status ?? '')
    if (!ATTENDANCE_STATUSES.includes(status)) {
      return res.status(400).json({ error: `status must be one of: ${ATTENDANCE_STATUSES.join(', ')}` })
    }

    const record = await Attendance.findOne({ sessionId: req.params.sessionId, studentId: req.params.studentId })
    if (!record) return res.status(404).json({ error: 'Attendance record not found' })

    if (record.status !== status) {
      const note = String(req.body.note ?? '').trim() || `Changed from ${record.status} to ${status}`
      record.corrections.push({
        previousStatus: record.status,
        newStatus: status,
        note,
        changedBy: req.user.userId,
        changedAt: new Date(),
      })
      record.status = status
      record.markedBy = req.user.userId
      record.markedAt = new Date()
      await record.save()
    }

    res.json({ attendance: record })
  } catch (error) {
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
