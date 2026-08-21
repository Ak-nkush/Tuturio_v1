import { Router } from 'express'
import multer from 'multer'
import path from 'path'
import fs from 'fs'
import { fileURLToPath } from 'url'
import { User, publicUser } from '../models/User.js'
import { requireAuth } from '../middleware/auth.js'
import { escapeRegex } from '../utils/validate.js'

const __dirname = path.dirname(fileURLToPath(import.meta.url))
const uploadsDir = path.join(__dirname, '../../uploads/profiles')

if (!fs.existsSync(uploadsDir)) {
  fs.mkdirSync(uploadsDir, { recursive: true })
}

const ALLOWED_TYPES = new Set(['image/jpeg', 'image/png', 'image/webp'])

const storage = multer.diskStorage({
  destination: (_req, _file, cb) => cb(null, uploadsDir),
  filename: (_req, file, cb) => {
    const safe = file.originalname.replace(/[^a-zA-Z0-9._-]/g, '_')
    cb(null, `${Date.now()}-${safe}`)
  },
})

const upload = multer({
  storage,
  limits: { fileSize: 5 * 1024 * 1024 }, // 5MB limit
  fileFilter: (_req, file, cb) => {
    if (ALLOWED_TYPES.has(file.mimetype)) cb(null, true)
    else cb(new Error('File type not allowed. Only JPEG, PNG, WEBP.'))
  },
})

const router = Router()

router.use(requireAuth)

router.put('/profile', async (req, res) => {
  try {
    const name = req.body.name !== undefined ? String(req.body.name).trim() : undefined
    const bio = req.body.bio !== undefined ? String(req.body.bio).trim() : undefined
    const phone = req.body.phone !== undefined ? String(req.body.phone).trim() : undefined

    if (name !== undefined && (!name || name.length > 80)) {
      return res.status(400).json({ error: 'Name is required (max 80 characters)' })
    }
    if (bio !== undefined && bio.length > 500) {
      return res.status(400).json({ error: 'Bio too long (max 500 characters)' })
    }
    if (phone !== undefined && !/^[0-9+\-\s()]{0,20}$/.test(phone)) {
      return res.status(400).json({ error: 'Phone contains invalid characters' })
    }

    const user = await User.findOne({ userId: req.user.userId })
    if (!user) return res.status(404).json({ error: 'User not found' })

    if (name !== undefined) user.name = name
    if (bio !== undefined) user.bio = bio
    if (phone !== undefined) user.phone = phone

    await user.save()

    res.json({ user: publicUser(user) })
  } catch (error) {
    console.error(error)
    res.status(500).json({ error: 'Server error' })
  }
})

router.post('/profile-picture', upload.single('file'), async (req, res) => {
  try {
    if (!req.file) {
      return res.status(400).json({ error: 'File is required' })
    }

    const user = await User.findOne({ userId: req.user.userId })
    if (!user) return res.status(404).json({ error: 'User not found' })

    // Optional: remove old profile picture if it exists and is local
    if (user.profilePicture && user.profilePicture.startsWith('/uploads/profiles/')) {
      const oldFilePath = path.join(__dirname, '../..', user.profilePicture)
      if (fs.existsSync(oldFilePath)) fs.unlinkSync(oldFilePath)
    }

    user.profilePicture = `/uploads/profiles/${req.file.filename}`
    await user.save()

    res.json({ user: publicUser(user) })
  } catch (error) {
    console.error(error)
    res.status(500).json({ error: error.message ?? 'Server error' })
  }
})

// Search within the current user's circle:
// - tutor: enrolled students in their batches
// - student: tutors + classmates + linked parents of their batches
// - parent: tutors + their linked students
router.get('/search', async (req, res) => {
  try {
    const query = String(req.query.q ?? '').trim()
    if (!query || query.length < 2 || query.length > 50) {
      return res.json({ users: [] })
    }

    const regex = new RegExp(escapeRegex(query), 'i')
    const me = await User.findOne({ userId: req.user.userId })
    if (!me) return res.status(404).json({ error: 'User not found' })

    const { Batch } = await import('../models/Batch.js')

    let candidateIds = new Set()

    if (me.role === 'tutor') {
      const batches = await Batch.find({ tutorId: me.userId, status: 'active' })
      batches.forEach((b) =>
        b.enrollment.forEach((e) => {
          if (e.status === 'active') candidateIds.add(e.studentId)
        }),
      )
    } else {
      // Students & parents: everyone in their own batches
      const matchStudentIds = me.role === 'parent' ? me.linkedStudentIds : [me.userId]
      const batches = await Batch.find({
        status: 'active',
        $or: [
          { tutorId: me.userId },
          { 'enrollment': { $elemMatch: { studentId: { $in: matchStudentIds }, status: 'active' } } },
        ],
      })
      for (const b of batches) {
        candidateIds.add(b.tutorId)
        for (const e of b.enrollment) {
          if (e.status === 'active') candidateIds.add(e.studentId)
          if (e.parentId) candidateIds.add(e.parentId)
        }
      }
      if (me.role === 'parent') me.linkedStudentIds.forEach((id) => candidateIds.add(id))
    }

    candidateIds.delete(me.userId)

    const users = await User.find({
      userId: { $in: [...candidateIds] },
      $or: [{ name: regex }, { email: regex }],
    }).limit(20)

    res.json({ users: users.map(publicUser) })
  } catch (error) {
    console.error(error)
    res.status(500).json({ error: 'Server error' })
  }
})

// Tutor pauses a student's access (student can no longer log in or use the API).
router.post('/:userId/archive', requireAuth, async (req, res) => {
  try {
    if (req.user.role !== 'tutor') {
      return res.status(403).json({ error: 'Forbidden' })
    }

    const target = await User.findOne({ userId: req.params.userId })
    if (!target) return res.status(404).json({ error: 'User not found' })

    // Verify the target belongs to one of this tutor's batches
    const { Batch } = await import('../models/Batch.js')
    const ownsBatch = await Batch.exists({
      tutorId: req.user.userId,
      status: 'active',
      'enrollment': { $elemMatch: { studentId: target.userId } },
    })
    if (!ownsBatch) {
      return res.status(403).json({ error: 'This user is not in any of your batches' })
    }

    target.status = 'archived'
    target.tokenVersion += 1 // kill existing sessions immediately
    await target.save()

    res.json({ message: `${target.name}'s access has been paused`, user: publicUser(target) })
  } catch (error) {
    console.error(error)
    res.status(500).json({ error: 'Server error' })
  }
})

// Tutor restores a paused student's access.
router.post('/:userId/unarchive', requireAuth, async (req, res) => {
  try {
    if (req.user.role !== 'tutor') {
      return res.status(403).json({ error: 'Forbidden' })
    }

    const target = await User.findOne({ userId: req.params.userId })
    if (!target) return res.status(404).json({ error: 'User not found' })

    const { Batch } = await import('../models/Batch.js')
    const ownsBatch = await Batch.exists({
      tutorId: req.user.userId,
      'enrollment': { $elemMatch: { studentId: target.userId } },
    })
    if (!ownsBatch) {
      return res.status(403).json({ error: 'This user is not in any of your batches' })
    }

    target.status = 'active'
    await target.save()

    res.json({ message: `${target.name}'s access has been restored`, user: publicUser(target) })
  } catch (error) {
    console.error(error)
    res.status(500).json({ error: 'Server error' })
  }
})

export default router
