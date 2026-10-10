import { Router } from 'express'
import { Assignment } from '../models/Assignment.js'
import { Submission } from '../models/Submission.js'
import { Batch } from '../models/Batch.js'
import { User } from '../models/User.js'
import { requireAuth, requireRole } from '../middleware/auth.js'
import { validObjectIdParam } from '../utils/validate.js'
import { notify, notifyMany } from '../services/notificationService.js'
import { createUpload, SAFE_DOCUMENT_TYPES } from '../middleware/uploads.js'
import { storeFile } from '../services/storageService.js'

const upload = createUpload({ allowedTypes: SAFE_DOCUMENT_TYPES, maxFileSize: 10 * 1024 * 1024 })

function publicSubmission(submission) {
  const value = submission.toObject ? submission.toObject() : submission
  return { ...value, downloadUrl: `/api/files/submissions/${value._id}` }
}

const router = Router()

router.use(requireAuth)

// Fetch assignments for a batch
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

    const assignments = await Assignment.find({ batchId: req.params.batchId }).sort({ createdAt: -1 })
    if (req.user.role === 'tutor') {
      const assignmentIds = assignments.map((a) => a._id)
      const submissions = await Submission.find({ assignmentId: { $in: assignmentIds } })
      const subsByAssignment = {}
      for (const sub of submissions) {
        const aId = String(sub.assignmentId)
        if (!subsByAssignment[aId]) subsByAssignment[aId] = []
        subsByAssignment[aId].push(publicSubmission(sub))
      }
      return res.json({
        assignments: assignments.map((item) => ({
          ...(item.toObject ? item.toObject() : item),
          submissions: subsByAssignment[String(item._id)] ?? [],
        })),
      })
    }
    res.json({ assignments })
  } catch (error) {
    console.error(error)
    res.status(500).json({ error: 'Server error' })
  }
})

// Fetch all assignments for the current student across enrolled batches
router.get('/student/me', async (req, res) => {
  try {
    const batches = await Batch.find({
      'enrollment': {
        $elemMatch: { studentId: req.user.userId, status: 'active' },
      },
      status: 'active',
    })

    const batchIds = batches.map((b) => b.batchId)

    const assignments = await Assignment.find({ batchId: { $in: batchIds } }).sort({ dueDate: 1 })
    const submissions = await Submission.find({
      studentId: req.user.userId,
      assignmentId: { $in: assignments.map((item) => item._id) },
    })
    const byAssignment = Object.fromEntries(
      submissions.map((item) => [String(item.assignmentId), publicSubmission(item)]),
    )
    res.json({
      assignments: assignments.map((item) => ({
        ...(item.toObject ? item.toObject() : item),
        submission: byAssignment[String(item._id)] ?? null,
      })),
    })
  } catch (error) {
    console.error(error)
    res.status(500).json({ error: 'Server error' })
  }
})

// Fetch assignments for parent's linked students, with that child's status and grade
router.get('/parent/students', requireRole('parent'), async (req, res) => {
  try {
    const parent = await User.findOne({ userId: req.user.userId })
    if (!parent) return res.status(404).json({ error: 'User not found' })

    const requestedStudentId = req.query.studentId ? String(req.query.studentId) : ''
    if (requestedStudentId && !parent.linkedStudentIds.includes(requestedStudentId)) {
      return res.status(403).json({ error: 'Forbidden' })
    }
    const studentIds = requestedStudentId ? [requestedStudentId] : parent.linkedStudentIds

    const batches = await Batch.find({
      'enrollment': {
        $elemMatch: { studentId: { $in: studentIds }, status: 'active' },
      },
      status: 'active',
    })

    const batchIds = batches.map((b) => b.batchId)
    const filter = { batchId: { $in: batchIds } }
    if (req.query.batchId) filter.batchId = req.query.batchId

    const assignments = await Assignment.find(filter).sort({ dueDate: 1 })
    const submissions = await Submission.find({
      studentId: { $in: studentIds },
      assignmentId: { $in: assignments.map((item) => item._id) },
    })
    const byKey = Object.fromEntries(
      submissions.map((item) => [`${item.assignmentId}:${item.studentId}`, publicSubmission(item)]),
    )

    res.json({
      assignments: assignments.map((item) => {
        const value = item.toObject ? item.toObject() : item
        if (requestedStudentId) {
          return { ...value, submission: byKey[`${item._id}:${requestedStudentId}`] ?? null }
        }
        return {
          ...value,
          submissions: studentIds
            .map((studentId) => byKey[`${item._id}:${studentId}`] ?? null)
            .filter(Boolean),
        }
      }),
    })
  } catch (error) {
    console.error(error)
    res.status(500).json({ error: 'Server error' })
  }
})

// Fetch student's own submission for a specific assignment
router.get('/:assignmentId/submission/me', validObjectIdParam('assignmentId'), async (req, res) => {
  try {
    const submission = await Submission.findOne({
      assignmentId: req.params.assignmentId,
      studentId: req.user.userId,
    })

    if (!submission) return res.status(404).json({ error: 'Submission not found' })

    res.json({ submission: publicSubmission(submission) })
  } catch (error) {
    console.error(error)
    res.status(500).json({ error: 'Server error' })
  }
})

// Fetch a student's submission for a parent
router.get('/:assignmentId/submission/student/:studentId', requireRole('parent'), validObjectIdParam('assignmentId'), async (req, res) => {
  try {
    const parent = await User.findOne({ userId: req.user.userId })
    if (!parent || !parent.linkedStudentIds.includes(req.params.studentId)) {
      return res.status(403).json({ error: 'Forbidden' })
    }

    const submission = await Submission.findOne({
      assignmentId: req.params.assignmentId,
      studentId: req.params.studentId,
    })

    if (!submission) return res.status(404).json({ error: 'Submission not found' })

    res.json({ submission: publicSubmission(submission) })
  } catch (error) {
    console.error(error)
    res.status(500).json({ error: 'Server error' })
  }
})

// Fetch submissions for a specific assignment
router.get('/:assignmentId/submissions', requireRole('tutor'), validObjectIdParam('assignmentId'), async (req, res) => {
  try {
    const assignment = await Assignment.findById(req.params.assignmentId)
    if (!assignment || assignment.tutorId !== req.user.userId) {
      return res.status(404).json({ error: 'Assignment not found' })
    }

    const submissions = await Submission.find({ assignmentId: assignment._id })
    res.json({ submissions: submissions.map(publicSubmission) })
  } catch (error) {
    console.error(error)
    res.status(500).json({ error: 'Server error' })
  }
})

// Create an assignment (Tutor only)
router.post('/', requireRole('tutor'), async (req, res) => {
  try {
    const { batchId, title, description, dueDate, maxScore } = req.body

    if (!batchId || !title || !dueDate || maxScore == null) {
      return res.status(400).json({ error: 'Missing required fields' })
    }

    const trimmedTitle = String(title).trim()
    if (!trimmedTitle || trimmedTitle.length > 120) {
      return res.status(400).json({ error: 'Title is required (max 120 characters)' })
    }

    const parsedDue = new Date(dueDate)
    if (Number.isNaN(parsedDue.getTime())) {
      return res.status(400).json({ error: 'Valid dueDate is required' })
    }

    const parsedMaxScore = Number(maxScore)
    if (!Number.isFinite(parsedMaxScore) || parsedMaxScore <= 0) {
      return res.status(400).json({ error: 'maxScore must be a positive number' })
    }

    const batch = await Batch.findOne({ batchId, tutorId: req.user.userId, status: 'active' })
    if (!batch) return res.status(404).json({ error: 'Batch not found' })

    const assignment = await Assignment.create({
      tutorId: req.user.userId,
      batchId,
      title: trimmedTitle,
      description: description ? String(description).slice(0, 2000) : '',
      dueDate: parsedDue,
      maxScore: parsedMaxScore,
    })

    const studentIds = []
    const parentIds = []
    for (const e of batch.enrollment) {
      if (e.status !== 'active') continue
      studentIds.push(e.studentId)
      if (e.parentId) parentIds.push(e.parentId)
    }
    await notifyMany(studentIds, {
      title: 'New assignment',
      message: `"${trimmedTitle}" was posted in ${batch.name}`,
      type: 'batch',
      event: 'batch',
      link: '/student/dashboard/assignments',
    })
    await notifyMany(parentIds, {
      title: 'New assignment',
      message: `"${trimmedTitle}" was posted in ${batch.name}`,
      type: 'batch',
      event: 'batch',
      link: '/parent/dashboard/assignments',
    })

    res.status(201).json({ assignment })
  } catch (error) {
    console.error(error)
    res.status(500).json({ error: 'Server error' })
  }
})

// Submit homework (Student only)
router.post('/:assignmentId/submit', validObjectIdParam('assignmentId'), upload.single('file'), async (req, res) => {
  try {
    if (!req.file) return res.status(400).json({ error: 'File is required' })

    if (req.user.role !== 'student') {
      return res.status(403).json({ error: 'Only students can submit assignments' })
    }

    const assignment = await Assignment.findById(req.params.assignmentId)
    if (!assignment) return res.status(404).json({ error: 'Assignment not found' })

    const batch = await Batch.findOne({ batchId: assignment.batchId, status: 'active' })
    const enrolled = batch?.enrollment.some((e) => e.studentId === req.user.userId && e.status === 'active')
    if (!enrolled) return res.status(403).json({ error: 'Not enrolled in this batch' })

    const existing = await Submission.findOne({ assignmentId: assignment._id, studentId: req.user.userId })

    const stored = await storeFile({
      buffer: req.file.buffer,
      originalName: req.file.originalname,
      mimeType: req.file.mimetype,
      folder: `submissions/${req.user.userId}`,
    })
    const submission = await Submission.findOneAndUpdate(
      { assignmentId: assignment._id, studentId: req.user.userId },
      {
        storageKey: stored.storageKey,
        fileName: req.file.originalname,
        mimeType: req.file.mimetype,
        sizeBytes: req.file.size,
        status: 'submitted',
        score: null,
        feedback: '',
      },
      { new: true, upsert: true },
    )

    res.status(201).json({ submission: publicSubmission(submission) })
  } catch (error) {
    console.error(error)
    res.status(500).json({ error: 'Server error' })
  }
})

// Grade a submission (Tutor only)
router.patch('/submission/:submissionId/grade', requireRole('tutor'), validObjectIdParam('submissionId'), async (req, res) => {
  try {
    const { score, feedback } = req.body

    if (score == null) {
      return res.status(400).json({ error: 'Score is required' })
    }

    const submission = await Submission.findById(req.params.submissionId)
    if (!submission) return res.status(404).json({ error: 'Submission not found' })

    const assignment = await Assignment.findById(submission.assignmentId)
    if (!assignment || assignment.tutorId !== req.user.userId) {
      return res.status(403).json({ error: 'Forbidden' })
    }

    const parsedScore = Number(score)
    if (!Number.isFinite(parsedScore) || parsedScore < 0 || parsedScore > assignment.maxScore) {
      return res.status(400).json({ error: `Score must be between 0 and ${assignment.maxScore}` })
    }

    submission.score = parsedScore
    submission.feedback = feedback ? String(feedback).trim().slice(0, 1000) : ''
    submission.status = 'graded'

    await submission.save()

    await notify(submission.studentId, {
      title: 'Assignment graded',
      message: `"${assignment.title}" was graded: ${parsedScore}/${assignment.maxScore}`,
      type: 'student',
      event: 'progress',
      link: '/student/dashboard/assignments',
    })

    res.json({ submission: publicSubmission(submission) })
  } catch (error) {
    console.error(error)
    res.status(500).json({ error: 'Server error' })
  }
})

export default router
