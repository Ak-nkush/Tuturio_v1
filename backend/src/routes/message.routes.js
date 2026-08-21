import { Router } from 'express'
import multer from 'multer'
import path from 'path'
import fs from 'fs'
import { fileURLToPath } from 'url'
import { Message } from '../models/Message.js'
import { User } from '../models/User.js'
import { requireAuth } from '../middleware/auth.js'
import { messageRateLimiter } from '../middleware/rateLimit.js'
import { areRelated } from '../services/relationshipService.js'
import { notify } from '../services/notificationService.js'
import { emitToUser } from '../services/socketService.js'

const __dirname = path.dirname(fileURLToPath(import.meta.url))
const uploadsDir = path.join(__dirname, '../../uploads/messages')

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

function optionalFiles(req, res, next) {
  const ct = String(req.headers['content-type'] ?? '')
  if (ct.includes('multipart/form-data')) {
    return upload.array('files', 3)(req, res, (err) => {
      if (err) return res.status(400).json({ error: err.message })
      next()
    })
  }
  next()
}

const router = Router()

router.use(requireAuth)

// Contacts the current user is allowed to talk to:
// - tutor: all students + linked parents across their batches
// - student: their tutor(s), classmates, linked parents
// - parent: tutors of their children's batches + their children
router.get('/contacts', async (req, res) => {
  try {
    const me = await User.findOne({ userId: req.user.userId })
    if (!me) return res.status(404).json({ error: 'User not found' })

    const { Batch } = await import('../models/Batch.js')
    const batches = await Batch.find({
      status: 'active',
      $or: [
        { tutorId: me.userId },
        { 'enrollment': { $elemMatch: { studentId: { $in: me.role === 'parent' ? me.linkedStudentIds : [me.userId] }, status: 'active' } } },
      ],
    })

    const ids = new Set()
    for (const batch of batches) {
      if (batch.tutorId !== me.userId) ids.add(batch.tutorId)
      for (const e of batch.enrollment) {
        if (e.status !== 'active') continue
        if (e.studentId !== me.userId) ids.add(e.studentId)
        if (e.parentId && e.parentId !== me.userId) ids.add(e.parentId)
      }
    }
    if (me.role === 'parent') ids.add(...me.linkedStudentIds)

    const users = await User.find({ userId: { $in: [...ids] }, status: 'active' })
    res.json({ contacts: users.map((u) => ({ userId: u.userId, name: u.name, role: u.role })) })
  } catch (error) {
    console.error(error)
    res.status(500).json({ error: 'Server error' })
  }
})

// Conversation list: last message per contact + unread count
router.get('/conversations', async (req, res) => {
  try {
    const messages = await Message.find({
      $or: [{ senderId: req.user.userId }, { receiverId: req.user.userId }],
    })
      .sort({ createdAt: -1 })
      .limit(500)

    const byContact = new Map()
    for (const m of messages) {
      const other = m.senderId === req.user.userId ? m.receiverId : m.senderId
      if (!byContact.has(other)) {
        byContact.set(other, {
          userId: other,
          lastMessage: m.content || m.attachments?.[0]?.filename || '',
          lastAt: m.createdAt,
          unread: 0,
        })
      }
      if (m.receiverId === req.user.userId && !m.isRead) {
        byContact.get(other).unread += 1
      }
    }

    const contacts = [...byContact.values()]
    const users = await User.find({ userId: { $in: contacts.map((c) => c.userId) } })
    const nameById = Object.fromEntries(users.map((u) => [u.userId, u.name]))
    for (const c of contacts) c.name = nameById[c.userId] ?? c.userId

    res.json({ conversations: contacts })
  } catch (error) {
    console.error(error)
    res.status(500).json({ error: 'Server error' })
  }
})

// Fetch conversation with a specific user — only if related
router.get('/:userId', async (req, res) => {
  try {
    const otherUserId = req.params.userId

    const otherUser = await User.findOne({ userId: otherUserId })
    if (!otherUser) return res.status(404).json({ error: 'User not found' })

    if (!(await areRelated(req.user.userId, otherUserId))) {
      return res.status(403).json({ error: 'You can only message people in your batches' })
    }

    const messages = await Message.find({
      $or: [
        { senderId: req.user.userId, receiverId: otherUserId },
        { senderId: otherUserId, receiverId: req.user.userId },
      ],
    })
      .sort({ createdAt: 1 })
      .limit(100)

    res.json({ messages })
  } catch (error) {
    console.error(error)
    res.status(500).json({ error: 'Server error' })
  }
})

// Send a message — only to related users. Supports JSON or multipart (files).
router.post('/', messageRateLimiter, optionalFiles, async (req, res) => {
  try {
    const receiverId = String(req.body.receiverId ?? '')
    const content = String(req.body.content ?? '').trim()
    const files = Array.isArray(req.files) ? req.files : []

    if (!receiverId || (!content && files.length === 0)) {
      return res.status(400).json({ error: 'receiverId and content or file are required' })
    }
    if (content.length > 2000) {
      return res.status(400).json({ error: 'Message too long (max 2000 characters)' })
    }

    const receiver = await User.findOne({ userId: receiverId })
    if (!receiver) return res.status(404).json({ error: 'Receiver not found' })

    if (!(await areRelated(req.user.userId, receiverId))) {
      return res.status(403).json({ error: 'You can only message people in your batches' })
    }

    const sender = await User.findOne({ userId: req.user.userId })

    const attachments = files.map((file) => ({
      url: `/uploads/messages/${file.filename}`,
      filename: file.originalname,
      mimeType: file.mimetype,
    }))

    const message = await Message.create({
      senderId: req.user.userId,
      receiverId,
      content,
      attachments,
    })

    await notify(receiverId, {
      title: 'New message',
      message: `You have a new message from ${sender?.name ?? 'someone'}`,
      type: 'system',
      event: 'messages',
    })

    // Real-time Socket.io emissions
    emitToUser(receiverId, 'message:received', message)
    emitToUser(req.user.userId, 'message:sent', message)

    res.status(201).json({ message })
  } catch (error) {
    console.error(error)
    res.status(500).json({ error: 'Server error' })
  }
})

// Mark messages from a specific user as read
router.patch('/read', async (req, res) => {
  try {
    const senderId = String(req.body.senderId ?? '')
    if (!senderId) return res.status(400).json({ error: 'senderId is required' })

    await Message.updateMany(
      { senderId, receiverId: req.user.userId, isRead: false },
      { $set: { isRead: true } },
    )

    // Notify the sender that their messages have been read
    emitToUser(senderId, 'messages:read', { readerId: req.user.userId })

    res.json({ message: 'Messages marked as read' })
  } catch (error) {
    console.error(error)
    res.status(500).json({ error: 'Server error' })
  }
})

export default router
