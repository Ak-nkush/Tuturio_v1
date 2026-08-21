import { Router } from 'express'
import { Announcement } from '../models/Announcement.js'
import { Batch } from '../models/Batch.js'
import { User } from '../models/User.js'
import { requireAuth, requireRole } from '../middleware/auth.js'
import { notifyMany } from '../services/notificationService.js'

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

    const announcements = await Announcement.find({ batchId: req.params.batchId })
      .sort({ createdAt: -1 })
      .limit(50)

    res.json({ announcements })
  } catch (error) {
    console.error(error)
    res.status(500).json({ error: 'Server error' })
  }
})

router.post('/', requireRole('tutor'), async (req, res) => {
  try {
    const batchId = String(req.body.batchId ?? '')
    const text = String(req.body.text ?? '').trim()

    if (!batchId || !text) {
      return res.status(400).json({ error: 'batchId and text are required' })
    }

    const batch = await Batch.findOne({ batchId, tutorId: req.user.userId, status: 'active' })
    if (!batch) return res.status(404).json({ error: 'Batch not found' })

    const announcement = await Announcement.create({
      tutorId: req.user.userId,
      batchId,
      text,
      attachments: req.body.attachments ?? [],
    })

    const recipients = new Set()
    for (const row of batch.enrollment) {
      if (row.status !== 'active') continue
      recipients.add(row.studentId)
      if (row.parentId) recipients.add(row.parentId)
    }
    await notifyMany([...recipients], {
      title: 'New announcement',
      message: `Notice posted in "${batch.name}"`,
      type: 'batch',
      event: 'announcements',
    })

    res.status(201).json({ announcement })
  } catch (error) {
    console.error(error)
    res.status(500).json({ error: 'Server error' })
  }
})

router.delete('/:id', requireRole('tutor'), async (req, res) => {
  try {
    const announcement = await Announcement.findById(req.params.id)
    if (!announcement || announcement.tutorId !== req.user.userId) {
      return res.status(404).json({ error: 'Announcement not found' })
    }
    await announcement.deleteOne()
    res.json({ message: 'Deleted' })
  } catch (error) {
    console.error(error)
    res.status(500).json({ error: 'Server error' })
  }
})

export default router
