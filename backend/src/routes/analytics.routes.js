import { Router } from 'express'
import { Batch } from '../models/Batch.js'
import { Attendance } from '../models/Attendance.js'
import { Session } from '../models/Session.js'
import { Progress } from '../models/Progress.js'
import { User } from '../models/User.js'
import { requireAuth, requireRole } from '../middleware/auth.js'

const router = Router()

router.use(requireAuth)

router.get('/batch/:batchId', requireRole('tutor'), async (req, res) => {
  try {
    const batch = await Batch.findOne({ batchId: req.params.batchId, tutorId: req.user.userId, status: 'active' })
    if (!batch) return res.status(404).json({ error: 'Batch not found' })

    const activeStudents = batch.enrollment.filter((e) => e.status === 'active')
    const studentIds = activeStudents.map((e) => e.studentId)

    const sessions = await Session.find({
      batchId: batch.batchId,
      status: { $in: ['active', 'completed'] },
      isHoliday: { $ne: true },
    })
    const sessionIds = sessions.map((s) => s._id)

    const attendanceRecords = await Attendance.find({
      batchId: batch.batchId,
      sessionId: { $in: sessionIds },
    })

    const users = await User.find({ userId: { $in: studentIds } })
    const nameById = Object.fromEntries(users.map((u) => [u.userId, u.name]))

    const studentStats = studentIds.map((studentId) => {
      const records = attendanceRecords.filter((r) => r.studentId === studentId)
      const total = records.length
      const present = records.filter((r) => r.status === 'present' || r.status === 'late').length
      const percentage = total > 0 ? Math.round((present / total) * 100) : null
      return {
        studentId,
        name: nameById[studentId] ?? studentId,
        totalSessions: total,
        present,
        attendancePercentage: percentage,
      }
    })

    const progressEntries = await Progress.find({ batchId: batch.batchId })
      .sort({ createdAt: -1 })
      .limit(20)

    const trendSource = await Progress.find({ batchId: batch.batchId }).sort({ date: 1 }).limit(200)
    const trendMap = new Map()
    for (const entry of trendSource) {
      const d = new Date(entry.date || entry.createdAt)
      const key = d.toISOString().slice(0, 10)
      const pct = entry.maxScore > 0 ? (entry.score / entry.maxScore) * 100 : 0
      const bucket = trendMap.get(key) ?? { date: key, total: 0, count: 0 }
      bucket.total += pct
      bucket.count += 1
      trendMap.set(key, bucket)
    }
    const scoreTrends = [...trendMap.values()]
      .sort((a, b) => a.date.localeCompare(b.date))
      .slice(-12)
      .map((b) => ({ date: b.date, averagePercent: Math.round(b.total / b.count) }))

    res.json({
      batchName: batch.name,
      totalSessions: sessions.length,
      studentStats,
      recentProgress: progressEntries,
      scoreTrends,
    })
  } catch (error) {
    console.error(error)
    res.status(500).json({ error: 'Server error' })
  }
})

router.get('/overview', requireRole('tutor'), async (req, res) => {
  try {
    const batches = await Batch.find({ tutorId: req.user.userId, status: 'active' })
    const totalStudents = batches.reduce(
      (sum, b) => sum + b.enrollment.filter((e) => e.status === 'active').length,
      0,
    )

    const startOfDay = new Date()
    startOfDay.setHours(0, 0, 0, 0)
    const endOfDay = new Date()
    endOfDay.setHours(23, 59, 59, 999)

    const todaySessions = await Session.countDocuments({
      tutorId: req.user.userId,
      date: { $gte: startOfDay, $lte: endOfDay },
    })

    const completedSessions = await Session.countDocuments({
      tutorId: req.user.userId,
      status: 'completed',
    })

    const batchIds = batches.map((b) => b.batchId)
    const attendanceRecords = await Attendance.find({ batchId: { $in: batchIds } })
    const presentCount = attendanceRecords.filter((r) => r.status === 'present' || r.status === 'late').length
    const attendancePercentage =
      attendanceRecords.length > 0 ? Math.round((presentCount / attendanceRecords.length) * 100) : null

    const progressEntries = await Progress.find({ batchId: { $in: batchIds } }).sort({ date: 1 }).limit(200)
    const trendMap = new Map()
    for (const entry of progressEntries) {
      const d = new Date(entry.date || entry.createdAt)
      const key = d.toISOString().slice(0, 10)
      const pct = entry.maxScore > 0 ? (entry.score / entry.maxScore) * 100 : 0
      const bucket = trendMap.get(key) ?? { date: key, total: 0, count: 0 }
      bucket.total += pct
      bucket.count += 1
      trendMap.set(key, bucket)
    }
    const scoreTrends = [...trendMap.values()]
      .sort((a, b) => a.date.localeCompare(b.date))
      .slice(-12)
      .map((b) => ({ date: b.date, averagePercent: Math.round(b.total / b.count) }))

    const recentRemarks = progressEntries
      .filter((p) => p.remark)
      .slice(-8)
      .reverse()
      .map((p) => ({
        studentId: p.studentId,
        subject: p.subject || '',
        topic: p.topic,
        remark: p.remark,
        score: p.score,
        maxScore: p.maxScore,
        date: p.date || p.createdAt,
      }))

    res.json({
      batchCount: batches.length,
      totalStudents,
      todaySessions,
      completedSessions,
      attendancePercentage,
      scoreTrends,
      recentRemarks,
    })
  } catch (error) {
    console.error(error)
    res.status(500).json({ error: 'Server error' })
  }
})

router.get('/student/overview', async (req, res) => {
  try {
    const batches = await Batch.find({
      'enrollment': {
        $elemMatch: { studentId: req.user.userId, status: 'active' }
      },
      status: 'active'
    })
    
    const batchIds = batches.map(b => b.batchId)
    
    // Overall Attendance
    const totalSessions = await Session.countDocuments({
      batchId: { $in: batchIds },
      status: { $in: ['active', 'completed'] },
      isHoliday: { $ne: true }
    })
    const attended = await Attendance.countDocuments({
      studentId: req.user.userId,
      batchId: { $in: batchIds },
      status: { $in: ['present', 'late'] }
    })
    const attendancePercentage = totalSessions > 0 ? Math.round((attended / totalSessions) * 100) : null
    
    // Next Session
    const now = new Date()
    const nextSession = await Session.findOne({
      batchId: { $in: batchIds },
      date: { $gte: now },
      status: 'scheduled',
      isHoliday: { $ne: true }
    }).sort({ date: 1 })
    
    // Recent Progress
    const recentProgress = await Progress.find({
      studentId: req.user.userId,
      batchId: { $in: batchIds }
    }).sort({ createdAt: -1 }).limit(5)
    
    res.json({
      batchCount: batches.length,
      attendancePercentage,
      nextSession,
      recentProgress
    })
  } catch (error) {
    console.error(error)
    res.status(500).json({ error: 'Server error' })
  }
})

router.get('/parent/overview', async (req, res) => {
  try {
    const parent = await User.findOne({ userId: req.user.userId })
    if (!parent) return res.status(404).json({ error: 'User not found' })

    const batches = await Batch.find({
      'enrollment': {
        $elemMatch: { studentId: { $in: parent.linkedStudentIds }, status: 'active' }
      },
      status: 'active'
    })
    
    const batchIds = batches.map(b => b.batchId)
    
    let expectedSessions = 0
    let attended = 0
    
    for (const batch of batches) {
        const activeStudentsInBatch = batch.enrollment.filter(e => parent.linkedStudentIds.includes(e.studentId) && e.status === 'active')
        const batchSessionCount = await Session.countDocuments({
            batchId: batch.batchId,
            status: { $in: ['active', 'completed'] },
            isHoliday: { $ne: true }
        })
        expectedSessions += batchSessionCount * activeStudentsInBatch.length
        
        attended += await Attendance.countDocuments({
            studentId: { $in: activeStudentsInBatch.map(s => s.studentId) },
            batchId: batch.batchId,
            status: { $in: ['present', 'late'] }
        })
    }
    
    const attendancePercentage = expectedSessions > 0 ? Math.round((attended / expectedSessions) * 100) : null
    
    const now = new Date()
    const nextSession = await Session.findOne({
      batchId: { $in: batchIds },
      date: { $gte: now },
      status: 'scheduled',
      isHoliday: { $ne: true }
    }).sort({ date: 1 })
    
    const recentProgress = await Progress.find({
      studentId: { $in: parent.linkedStudentIds },
      batchId: { $in: batchIds }
    }).sort({ createdAt: -1 }).limit(5)
    
    res.json({
      batchCount: batches.length,
      attendancePercentage,
      nextSession,
      recentProgress
    })
  } catch (error) {
    console.error(error)
    res.status(500).json({ error: 'Server error' })
  }
})

router.get('/export/attendance/:batchId', requireRole('tutor'), async (req, res) => {
  try {
    const batch = await Batch.findOne({ batchId: req.params.batchId, tutorId: req.user.userId, status: 'active' })
    if (!batch) return res.status(404).json({ error: 'Batch not found' })

    const sessions = await Session.find({ batchId: batch.batchId }).sort({ date: 1 })
    const attendanceRecords = await Attendance.find({ batchId: batch.batchId })
    const studentIds = batch.enrollment.map(e => e.studentId)
    const users = await User.find({ userId: { $in: studentIds } })
    const userMap = Object.fromEntries(users.map(u => [u.userId, u.name]))

    let csv = 'Student ID,Student Name'
    sessions.forEach(s => {
      csv += `,${s.date.toISOString().split('T')[0]}`
    })
    csv += '\n'

    studentIds.forEach(studentId => {
      csv += `${studentId},${userMap[studentId] || 'Unknown'}`
      sessions.forEach(session => {
        const record = attendanceRecords.find(r => r.sessionId === session._id.toString() && r.studentId === studentId)
        csv += `,${record ? record.status : 'absent'}`
      })
      csv += '\n'
    })

    res.setHeader('Content-Type', 'text/csv')
    res.setHeader('Content-Disposition', `attachment; filename=attendance_${batch.batchId}.csv`)
    res.send(csv)
  } catch (error) {
    console.error(error)
    res.status(500).json({ error: 'Server error' })
  }
})

router.get('/export/progress/:batchId', requireRole('tutor'), async (req, res) => {
  try {
    const batch = await Batch.findOne({ batchId: req.params.batchId, tutorId: req.user.userId, status: 'active' })
    if (!batch) return res.status(404).json({ error: 'Batch not found' })

    const progressEntries = await Progress.find({ batchId: batch.batchId }).sort({ createdAt: 1 })
    const studentIds = [...new Set(progressEntries.map(p => p.studentId))]
    const users = await User.find({ userId: { $in: studentIds } })
    const userMap = Object.fromEntries(users.map(u => [u.userId, u.name]))

    let csv = 'Date,Student ID,Student Name,Topic,Score,Max Score,Remark\n'
    
    progressEntries.forEach(entry => {
      const date = entry.createdAt.toISOString().split('T')[0]
      const name = userMap[entry.studentId] || 'Unknown'
      const topic = `"${entry.topic.replace(/"/g, '""')}"`
      const remark = `"${entry.remark.replace(/"/g, '""')}"`
      csv += `${date},${entry.studentId},${name},${topic},${entry.score},${entry.maxScore},${remark}\n`
    })

    res.setHeader('Content-Type', 'text/csv')
    res.setHeader('Content-Disposition', `attachment; filename=progress_${batch.batchId}.csv`)
    res.send(csv)
  } catch (error) {
    console.error(error)
    res.status(500).json({ error: 'Server error' })
  }
})

export default router
