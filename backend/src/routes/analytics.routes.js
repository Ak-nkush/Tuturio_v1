import { Router } from 'express'
import ExcelJS from 'exceljs'
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
      batchId: batch.batchId,
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

// ─── Colour helpers ───────────────────────────────────────────────────────────

const STATUS_FILL = {
  present: { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FFD4EDDA' } },
  late:    { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FFFFF3CD' } },
  absent:  { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FFF8D7DA' } },
  excused: { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FFD1ECF1' } },
}
const STATUS_FONT = {
  present: { color: { argb: 'FF155724' } },
  late:    { color: { argb: 'FF856404' } },
  absent:  { color: { argb: 'FF721C24' } },
  excused: { color: { argb: 'FF0C5460' } },
}

// ─── xlsx export ─────────────────────────────────────────────────────────────

router.get('/export/attendance/:batchId', requireRole('tutor'), async (req, res) => {
  try {
    const batch = await Batch.findOne({ batchId: req.params.batchId, tutorId: req.user.userId, status: 'active' })
    if (!batch) return res.status(404).json({ error: 'Batch not found' })

    // Optionally filter to a single session (used by SessionWorkspacePage)
    const filterSessionId = req.query.sessionId ? String(req.query.sessionId) : null

    let sessionQuery = { batchId: batch.batchId, isHoliday: { $ne: true }, status: { $ne: 'cancelled' } }
    if (filterSessionId) sessionQuery._id = filterSessionId

    const sessions = await Session.find(sessionQuery).sort({ date: 1 })
    const attendanceRecords = await Attendance.find({ batchId: batch.batchId })

    // Only active enrolled students
    const activeEnrollment = batch.enrollment.filter((e) => e.status === 'active')
    const studentIds = activeEnrollment.map((e) => e.studentId)
    const users = await User.find({ userId: { $in: studentIds } })
    const nameById = Object.fromEntries(users.map((u) => [u.userId, u.name]))

    // ── Build workbook ──────────────────────────────────────────────────────
    const wb = new ExcelJS.Workbook()
    wb.creator = 'Tuturio'
    wb.created = new Date()

    const totalSessionCols = sessions.length
    const totalCols = Math.max(2, totalSessionCols + 1)

    // ── Sheet 1: Attendance Register ─────────────────────────────────────────
    const ws = wb.addWorksheet('Attendance')

    // Title Row
    const titleText = filterSessionId && sessions[0]
      ? `${batch.name} — Attendance (${new Date(sessions[0].date).toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric' })} · ${sessions[0].topic})`
      : `${batch.name} — Attendance Register`

    const titleRow = ws.addRow([titleText])
    ws.mergeCells(1, 1, 1, totalCols)
    const titleCell = ws.getCell('A1')
    titleCell.font = { name: 'Calibri', size: 14, bold: true, color: { argb: 'FF155724' } }
    titleCell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FFD4EDDA' } }
    titleCell.alignment = { vertical: 'middle', horizontal: 'left', indent: 1 }
    ws.getRow(1).height = 32

    // Header row
    const headerFill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FFE2F0D9' } }
    const headerFont = { bold: true, color: { argb: 'FF155724' } }

    const headerRow = ['Student Name', ...sessions.map((s) => {
      const d = new Date(s.date)
      const dd = String(d.getDate()).padStart(2, '0')
      const mm = String(d.getMonth() + 1).padStart(2, '0')
      const yyyy = d.getFullYear()
      return `${dd}/${mm}/${yyyy} · ${s.topic}`
    })]

    const hRow = ws.addRow(headerRow)
    hRow.eachCell((cell) => {
      cell.font = headerFont
      cell.fill = headerFill
      cell.border = { bottom: { style: 'medium', color: { argb: 'FF9CCFA8' } }, top: { style: 'thin', color: { argb: 'FF9CCFA8' } } }
      cell.alignment = { vertical: 'middle', horizontal: 'center' }
    })
    hRow.getCell(1).alignment = { vertical: 'middle', horizontal: 'left' }
    ws.getRow(2).height = 24

    // Freeze title + header rows (without vertical column split line)
    ws.views = [{ state: 'frozen', ySplit: 2 }]

    // Column widths
    ws.getColumn(1).width = 28
    for (let i = 2; i <= sessions.length + 1; i++) {
      ws.getColumn(i).width = 28
    }

    // Data rows
    for (const studentId of studentIds) {
      const rowData = [nameById[studentId] ?? studentId]
      for (const session of sessions) {
        const record = attendanceRecords.find(
          (r) => String(r.sessionId) === String(session._id) && r.studentId === studentId,
        )
        rowData.push(record ? record.status.charAt(0).toUpperCase() + record.status.slice(1) : '')
      }
      const dataRow = ws.addRow(rowData)

      // Colour status cells
      for (let col = 2; col <= sessions.length + 1; col++) {
        const cell = dataRow.getCell(col)
        const statusRaw = (cell.value ?? '').toString().toLowerCase()
        if (STATUS_FILL[statusRaw]) {
          cell.fill = STATUS_FILL[statusRaw]
          cell.font = STATUS_FONT[statusRaw]
        } else {
          cell.font = { italic: true, color: { argb: 'FF999999' } }
          cell.value = cell.value || '—'
        }
        cell.alignment = { vertical: 'middle', horizontal: 'center' }
      }
      dataRow.getCell(1).alignment = { vertical: 'middle', horizontal: 'left' }
      dataRow.height = 20
    }

    // ── Sheet 2: Summary (only for full-batch export) ─────────────────────────
    if (!filterSessionId) {
      const ws2 = wb.addWorksheet('Summary')

      // Title Row for Summary
      ws2.addRow([`${batch.name} — Attendance Summary`])
      ws2.mergeCells(1, 1, 1, 7)
      const sumTitleCell = ws2.getCell('A1')
      sumTitleCell.font = { name: 'Calibri', size: 14, bold: true, color: { argb: 'FF155724' } }
      sumTitleCell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FFD4EDDA' } }
      sumTitleCell.alignment = { vertical: 'middle', horizontal: 'left', indent: 1 }
      ws2.getRow(1).height = 32

      const sumHeaderFill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FFE2F0D9' } }
      const sumHeaderFont = { bold: true, color: { argb: 'FF155724' } }

      const sh = ws2.addRow(['Student Name', 'Present', 'Late', 'Absent', 'Excused', 'Total Marked', 'Attendance %'])
      sh.eachCell((cell) => {
        cell.font = sumHeaderFont
        cell.fill = sumHeaderFill
        cell.border = { bottom: { style: 'medium', color: { argb: 'FF9CCFA8' } }, top: { style: 'thin', color: { argb: 'FF9CCFA8' } } }
        cell.alignment = { vertical: 'middle', horizontal: 'center' }
      })
      sh.getCell(1).alignment = { vertical: 'middle', horizontal: 'left' }
      ws2.getRow(2).height = 24
      ws2.views = [{ state: 'frozen', ySplit: 2 }]

      ws2.columns = [
        { width: 28 }, { width: 12 }, { width: 12 },
        { width: 12 }, { width: 12 }, { width: 15 }, { width: 16 },
      ]

      for (const studentId of studentIds) {
        const rows = attendanceRecords.filter((r) => r.studentId === studentId)
        const present = rows.filter((r) => r.status === 'present').length
        const late    = rows.filter((r) => r.status === 'late').length
        const absent  = rows.filter((r) => r.status === 'absent').length
        const excused = rows.filter((r) => r.status === 'excused').length
        const total   = rows.length
        const pct     = total > 0 ? Math.round(((present + late) / total) * 100) : null
        const pctStr  = pct !== null ? `${pct}%` : '—'

        const dr = ws2.addRow([nameById[studentId] ?? studentId, present, late, absent, excused, total, pctStr])
        dr.height = 20
        dr.getCell(1).alignment = { vertical: 'middle', horizontal: 'left' }

        for (let c = 2; c <= 6; c++) {
          dr.getCell(c).alignment = { vertical: 'middle', horizontal: 'center' }
        }

        // Colour percentage cell
        const pctCell = dr.getCell(7)
        if (pct !== null) {
          pctCell.fill = {
            type: 'pattern', pattern: 'solid',
            fgColor: { argb: pct >= 75 ? 'FFD4EDDA' : pct >= 50 ? 'FFFFF3CD' : 'FFF8D7DA' },
          }
          pctCell.font = { color: { argb: pct >= 75 ? 'FF155724' : pct >= 50 ? 'FF856404' : 'FF721C24' } }
        }
        pctCell.alignment = { vertical: 'middle', horizontal: 'center' }
      }
    }

    // ── Stream response ───────────────────────────────────────────────────────
    const safeName = batch.name.replace(/[^a-z0-9]/gi, '_').slice(0, 40)
    const dateSuffix = filterSessionId
      ? sessions[0] ? `_${new Date(sessions[0].date).toISOString().slice(0, 10)}` : ''
      : ''
    const filename = `attendance_${safeName}${dateSuffix}.xlsx`

    res.setHeader('Content-Type', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet')
    res.setHeader('Content-Disposition', `attachment; filename="${filename}"`)
    await wb.xlsx.write(res)
    res.end()
  } catch (error) {
    console.error(error)
    res.status(500).json({ error: 'Server error' })
  }
})


router.get('/export/progress/:batchId', requireRole('tutor'), async (req, res) => {
  try {
    const batch = await Batch.findOne({ batchId: req.params.batchId, tutorId: req.user.userId, status: 'active' })
    if (!batch) return res.status(404).json({ error: 'Batch not found' })

    const progressEntries = await Progress.find({
      batchId: batch.batchId,
      archived: { $ne: true },
    }).sort({ date: -1, createdAt: -1 })

    const activeEnrollment = batch.enrollment.filter((e) => e.status === 'active')
    const activeStudentIds = activeEnrollment.map((e) => e.studentId)
    const allStudentIds = [...new Set([...activeStudentIds, ...progressEntries.map((p) => p.studentId)])]
    const users = await User.find({ userId: { $in: allStudentIds } })
    const userMap = Object.fromEntries(users.map((u) => [u.userId, u.name]))

    const wb = new ExcelJS.Workbook()
    wb.creator = 'Tuturio'
    wb.created = new Date()

    // ── Sheet 1: Scores & Tests ──────────────────────────────────────────────
    const ws = wb.addWorksheet('Scores & Tests')

    // Title Row
    ws.addRow([`${batch.name} — Progress & Marks Report`])
    ws.mergeCells(1, 1, 1, 8)
    const titleCell = ws.getCell('A1')
    titleCell.font = { name: 'Calibri', size: 14, bold: true, color: { argb: 'FF155724' } }
    titleCell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FFD4EDDA' } }
    titleCell.alignment = { vertical: 'middle', horizontal: 'left', indent: 1 }
    ws.getRow(1).height = 32

    // Header Row
    const headerFill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FFE2F0D9' } }
    const headerFont = { bold: true, color: { argb: 'FF155724' } }

    const headerRow = ['Date', 'Student Name', 'Subject', 'Topic / Assessment', 'Score', 'Max Score', 'Percentage', 'Remark / Feedback']
    const hRow = ws.addRow(headerRow)
    hRow.eachCell((cell) => {
      cell.font = headerFont
      cell.fill = headerFill
      cell.border = { bottom: { style: 'medium', color: { argb: 'FF9CCFA8' } }, top: { style: 'thin', color: { argb: 'FF9CCFA8' } } }
      cell.alignment = { vertical: 'middle', horizontal: 'center' }
    })
    hRow.getCell(2).alignment = { vertical: 'middle', horizontal: 'left' }
    hRow.getCell(4).alignment = { vertical: 'middle', horizontal: 'left' }
    hRow.getCell(8).alignment = { vertical: 'middle', horizontal: 'left' }
    ws.getRow(2).height = 24

    ws.views = [{ state: 'frozen', ySplit: 2 }]

    ws.columns = [
      { width: 14 },
      { width: 24 },
      { width: 18 },
      { width: 34 },
      { width: 12 },
      { width: 12 },
      { width: 14 },
      { width: 38 },
    ]

    for (const entry of progressEntries) {
      const entryDate = entry.date || entry.createdAt
      const d = new Date(entryDate)
      const dd = String(d.getDate()).padStart(2, '0')
      const mm = String(d.getMonth() + 1).padStart(2, '0')
      const yyyy = d.getFullYear()
      const dateStr = `${dd}/${mm}/${yyyy}`

      const pct = entry.maxScore > 0 ? Math.round((entry.score / entry.maxScore) * 100) : null
      const pctStr = pct !== null ? `${pct}%` : '—'

      const row = ws.addRow([
        dateStr,
        userMap[entry.studentId] || entry.studentId,
        entry.subject || 'General',
        entry.topic,
        entry.score,
        entry.maxScore,
        pctStr,
        entry.remark || '—',
      ])

      row.height = 20
      row.getCell(1).alignment = { vertical: 'middle', horizontal: 'center' }
      row.getCell(2).alignment = { vertical: 'middle', horizontal: 'left' }
      row.getCell(3).alignment = { vertical: 'middle', horizontal: 'center' }
      row.getCell(4).alignment = { vertical: 'middle', horizontal: 'left' }
      row.getCell(5).alignment = { vertical: 'middle', horizontal: 'center' }
      row.getCell(6).alignment = { vertical: 'middle', horizontal: 'center' }
      row.getCell(7).alignment = { vertical: 'middle', horizontal: 'center' }
      row.getCell(8).alignment = { vertical: 'middle', horizontal: 'left' }

      if (pct !== null) {
        const pctCell = row.getCell(7)
        pctCell.fill = {
          type: 'pattern',
          pattern: 'solid',
          fgColor: { argb: pct >= 75 ? 'FFD4EDDA' : pct >= 50 ? 'FFFFF3CD' : 'FFF8D7DA' },
        }
        pctCell.font = { color: { argb: pct >= 75 ? 'FF155724' : pct >= 50 ? 'FF856404' : 'FF721C24' } }
      }
    }

    // ── Sheet 2: Student Summary ─────────────────────────────────────────────
    const ws2 = wb.addWorksheet('Student Summary')
    ws2.addRow([`${batch.name} — Progress Summary by Student`])
    ws2.mergeCells(1, 1, 1, 6)
    const sumTitle = ws2.getCell('A1')
    sumTitle.font = { name: 'Calibri', size: 14, bold: true, color: { argb: 'FF155724' } }
    sumTitle.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FFD4EDDA' } }
    sumTitle.alignment = { vertical: 'middle', horizontal: 'left', indent: 1 }
    ws2.getRow(1).height = 32

    const sumHeadRow = ws2.addRow(['Student Name', 'Tests Logged', 'Total Scored', 'Total Max Marks', 'Overall Average %', 'Status'])
    sumHeadRow.eachCell((cell) => {
      cell.font = headerFont
      cell.fill = headerFill
      cell.border = { bottom: { style: 'medium', color: { argb: 'FF9CCFA8' } }, top: { style: 'thin', color: { argb: 'FF9CCFA8' } } }
      cell.alignment = { vertical: 'middle', horizontal: 'center' }
    })
    sumHeadRow.getCell(1).alignment = { vertical: 'middle', horizontal: 'left' }
    ws2.getRow(2).height = 24
    ws2.views = [{ state: 'frozen', ySplit: 2 }]

    ws2.columns = [
      { width: 28 },
      { width: 16 },
      { width: 16 },
      { width: 18 },
      { width: 20 },
      { width: 14 },
    ]

    for (const studentId of allStudentIds) {
      const studentEntries = progressEntries.filter((p) => p.studentId === studentId)
      const testsCount = studentEntries.length
      const totalScore = studentEntries.reduce((sum, e) => sum + e.score, 0)
      const totalMax = studentEntries.reduce((sum, e) => sum + e.maxScore, 0)
      const avgPct = totalMax > 0 ? Math.round((totalScore / totalMax) * 100) : null
      const avgPctStr = avgPct !== null ? `${avgPct}%` : '—'

      const isEnrolled = activeStudentIds.includes(studentId)
      const statusLabel = isEnrolled ? 'Active' : 'Past'

      const r = ws2.addRow([
        userMap[studentId] || studentId,
        testsCount,
        totalScore,
        totalMax,
        avgPctStr,
        statusLabel,
      ])
      r.height = 20
      r.getCell(1).alignment = { vertical: 'middle', horizontal: 'left' }
      for (let c = 2; c <= 6; c++) {
        r.getCell(c).alignment = { vertical: 'middle', horizontal: 'center' }
      }

      if (avgPct !== null) {
        const pCell = r.getCell(5)
        pCell.fill = {
          type: 'pattern',
          pattern: 'solid',
          fgColor: { argb: avgPct >= 75 ? 'FFD4EDDA' : avgPct >= 50 ? 'FFFFF3CD' : 'FFF8D7DA' },
        }
        pCell.font = { color: { argb: avgPct >= 75 ? 'FF155724' : avgPct >= 50 ? 'FF856404' : 'FF721C24' } }
      }
    }

    const safeName = batch.name.replace(/[^a-z0-9]/gi, '_').slice(0, 40)
    const filename = `progress_${safeName}.xlsx`

    res.setHeader('Content-Type', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet')
    res.setHeader('Content-Disposition', `attachment; filename="${filename}"`)
    await wb.xlsx.write(res)
    res.end()
  } catch (error) {
    console.error(error)
    res.status(500).json({ error: 'Server error' })
  }
})

export default router
