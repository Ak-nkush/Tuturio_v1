import { Router } from 'express'
import multer from 'multer'
import path from 'path'
import fs from 'fs'
import { fileURLToPath } from 'url'
import { Assignment } from '../models/Assignment.js'
import { Submission } from '../models/Submission.js'
import { Batch } from '../models/Batch.js'
import { User } from '../models/User.js'
import { requireAuth, requireRole } from '../middleware/auth.js'
import { validObjectIdParam } from '../utils/validate.js'
import { notify, notifyMany } from '../services/notificationService.js'

const __dirname = path.dirname(fileURLToPath(import.meta.url))
const uploadsDir = path.join(__dirname, '../../uploads/submissions')

if (!fs.existsSync(uploadsDir)) {
  fs.mkdirSync(uploadsDir, { recursive: true })
}

const storage = multer.diskStorage({
  destination: (_req, _file, cb) => cb(null, uploadsDir),
  filename: (_req, file, cb) => {
    const safe = file.originalname.replace(/[^a-zA-Z0-9._-]/g, '_')
    cb(null, `${Date.now()}-${safe}`)
  },
})

// 10MB limit + safe file types (no HTML/SVG — prevents stored XSS via uploads)
const ALLOWED_SUBMISSION_TYPES = new Set([
  'application/pdf',
  'image/jpeg',
  'image/png',
  'image/webp',
  'image/gif',
  'application/msword',
  'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
  'text/plain',
])

const upload = multer({
  storage,
  limits: { fileSize: 10 * 1024 * 1024 },
  fileFilter: (_req, file, cb) => {
    if (ALLOWED_SUBMISSION_TYPES.has(file.mimetype)) cb(null, true)
    else cb(new Error('File type not allowed. Only PDF, images, Word documents, and text files.'))
  },
})

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
    res.json({ assignments })
  } catch (error) {
    console.error(error)
    res.status(500).json({ error: 'Server error' })
  }
})

// Fetch assignments for parent's linked students
router.get('/parent/students', async (req, res) => {
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
    const filter = { batchId: { $in: batchIds } }
    if (req.query.batchId) filter.batchId = req.query.batchId

    const assignments = await Assignment.find(filter).sort({ dueDate: 1 })
    res.json({ assignments })
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

    res.json({ submission })
  } catch (error) {
    console.error(error)
    res.status(500).json({ error: 'Server error' })
  }
})

// Fetch a student's submission for a parent
router.get('/:assignmentId/submission/student/:studentId', validObjectIdParam('assignmentId'), async (req, res) => {
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

    res.json({ submission })
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
    res.json({ submissions })
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
      attachments: Array.isArray(req.body.attachments) ? req.body.attachments : [],
    })

    // Notify active students + their parents
    const recipients = new Set()
    for (const e of batch.enrollment) {
      if (e.status !== 'active') continue
      recipients.add(e.studentId)
      if (e.parentId) recipients.add(e.parentId)
    }
    await notifyMany([...recipients], {
      title: 'New assignment',
      message: `"${trimmedTitle}" was posted in ${batch.name}`,
      type: 'batch',
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

    const submission = await Submission.findOneAndUpdate(
      { assignmentId: assignment._id, studentId: req.user.userId },
      {
        fileUrl: `/uploads/submissions/${req.file.filename}`,
        status: 'submitted',
        score: null,
        feedback: '',
      },
      { new: true, upsert: true },
    )

    res.status(201).json({ submission })
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
    })

    res.json({ submission })
  } catch (error) {
    console.error(error)
    res.status(500).json({ error: 'Server error' })
  }
})

export default router
