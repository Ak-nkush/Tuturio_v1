import { Router } from 'express'
import multer from 'multer'
import path from 'path'
import fs from 'fs'
import { fileURLToPath } from 'url'
import { Resource } from '../models/Resource.js'
import { Batch } from '../models/Batch.js'
import { User } from '../models/User.js'
import { requireAuth, requireRole } from '../middleware/auth.js'

const __dirname = path.dirname(fileURLToPath(import.meta.url))
const uploadsDir = path.join(__dirname, '../../uploads')

if (!fs.existsSync(uploadsDir)) {
  fs.mkdirSync(uploadsDir, { recursive: true })
}

const ALLOWED_TYPES = new Set([
  'application/pdf',
  'image/jpeg',
  'image/png',
  'image/webp',
  'image/gif',
  'application/msword',
  'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
  'text/plain',
])

const storage = multer.diskStorage({
  destination: (_req, _file, cb) => cb(null, uploadsDir),
  filename: (_req, file, cb) => {
    const safe = file.originalname.replace(/[^a-zA-Z0-9._-]/g, '_')
    cb(null, `${Date.now()}-${safe}`)
  },
})

const upload = multer({
  storage,
  limits: { fileSize: 10 * 1024 * 1024 },
  fileFilter: (_req, file, cb) => {
    if (ALLOWED_TYPES.has(file.mimetype)) cb(null, true)
    else cb(new Error('File type not allowed'))
  },
})

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
      const isEnrolled = batch.enrollment.some(e => e.studentId === req.user.userId && e.status === 'active')
      if (!isEnrolled) return res.status(403).json({ error: 'Forbidden' })
    }
    
    if (req.user.role === 'parent') {
      const parent = await User.findOne({ userId: req.user.userId })
      if (!parent || !batch.enrollment.some(e => parent.linkedStudentIds.includes(e.studentId) && e.status === 'active')) {
        return res.status(403).json({ error: 'Forbidden' })
      }
    }

    const resources = await Resource.find({ batchId: req.params.batchId }).sort({ createdAt: -1 })
    res.json({ resources })
  } catch (error) {
    console.error(error)
    res.status(500).json({ error: 'Server error' })
  }
})

router.post('/upload', requireRole('tutor'), upload.single('file'), async (req, res) => {
  try {
    const batchId = String(req.body.batchId ?? '')
    const title = String(req.body.title ?? req.file?.originalname ?? 'Untitled').trim()

    if (!batchId || !req.file) {
      return res.status(400).json({ error: 'batchId and file are required' })
    }

    const batch = await Batch.findOne({ batchId, tutorId: req.user.userId, status: 'active' })
    if (!batch) return res.status(404).json({ error: 'Batch not found' })

    const resource = await Resource.create({
      tutorId: req.user.userId,
      batchId,
      title,
      type: 'file',
      url: `/uploads/${req.file.filename}`,
    })

    res.status(201).json({ resource })
  } catch (error) {
    console.error(error)
    res.status(500).json({ error: error.message ?? 'Server error' })
  }
})

router.post('/link', requireRole('tutor'), async (req, res) => {
  try {
    const batchId = String(req.body.batchId ?? '')
    const title = String(req.body.title ?? '').trim()
    const url = String(req.body.url ?? '').trim()

    if (!batchId || !title || !url) {
      return res.status(400).json({ error: 'batchId, title, and url are required' })
    }

    const batch = await Batch.findOne({ batchId, tutorId: req.user.userId, status: 'active' })
    if (!batch) return res.status(404).json({ error: 'Batch not found' })

    const resource = await Resource.create({
      tutorId: req.user.userId,
      batchId,
      title,
      type: 'link',
      url,
    })

    res.status(201).json({ resource })
  } catch (error) {
    console.error(error)
    res.status(500).json({ error: 'Server error' })
  }
})

router.delete('/:id', requireRole('tutor'), async (req, res) => {
  try {
    const resource = await Resource.findById(req.params.id)
    if (!resource || resource.tutorId !== req.user.userId) {
      return res.status(404).json({ error: 'Resource not found' })
    }

    if (resource.type === 'file' && resource.url.startsWith('/uploads/')) {
      const filePath = path.join(uploadsDir, path.basename(resource.url))
      if (fs.existsSync(filePath)) fs.unlinkSync(filePath)
    }

    await resource.deleteOne()
    res.json({ message: 'Deleted' })
  } catch (error) {
    console.error(error)
    res.status(500).json({ error: 'Server error' })
  }
})

export default router
