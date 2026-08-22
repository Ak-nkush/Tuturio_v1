import { Router } from 'express'
import { Message } from '../models/Message.js'
import { User } from '../models/User.js'
import { requireAuth } from '../middleware/auth.js'
import { messageRateLimiter } from '../middleware/rateLimit.js'
import { areRelated, conversationTypeForRoles } from '../services/relationshipService.js'
import { notify } from '../services/notificationService.js'
import { emitToUser } from '../services/socketService.js'
import { createUpload, SAFE_DOCUMENT_TYPES } from '../middleware/uploads.js'
import { storeFile } from '../services/storageService.js'

const upload = createUpload({ allowedTypes: SAFE_DOCUMENT_TYPES, maxFileSize: 10 * 1024 * 1024, maxFiles: 3 })

function publicMessage(message) {
  const value = message.toObject ? message.toObject() : message
  return {
    ...value,
    attachments: (value.attachments ?? []).map((file, index) => ({
      ...file,
      url: `/api/files/messages/${value._id}/${index}`,
    })),
  }
}

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

// Contacts are limited to the tutor and their active students/parents.
// Students and parents never appear as contacts for each other.
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
      if (me.role !== 'tutor') continue
      for (const e of batch.enrollment) {
        if (e.status !== 'active') continue
        ids.add(e.studentId)
        if (e.parentId && e.parentId !== me.userId) ids.add(e.parentId)
      }
    }

    const users = await User.find({ userId: { $in: [...ids] }, status: 'active' })
    const meRole = me.role
    res.json({
      contacts: users.map((u) => ({
        userId: u.userId,
        name: u.name,
        role: u.role,
        type: conversationTypeForRoles(meRole, u.role),
      })),
    })
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
    const byId = Object.fromEntries(users.map((u) => [u.userId, u]))
    const me = await User.findOne({ userId: req.user.userId })
    const related = []
    for (const c of contacts) {
      if (!(await areRelated(req.user.userId, c.userId))) continue
      const other = byId[c.userId]
      c.name = other?.name ?? c.userId
      c.role = other?.role ?? null
      c.type = conversationTypeForRoles(me?.role, other?.role)
      related.push(c)
    }

    res.json({ conversations: related })
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

    res.json({ messages: messages.map(publicMessage) })
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

    const attachments = await Promise.all(files.map(async (file) => {
      const stored = await storeFile({
        buffer: file.buffer,
        originalName: file.originalname,
        mimeType: file.mimetype,
        folder: `messages/${req.user.userId}`,
      })
      return {
        storageKey: stored.storageKey,
        filename: file.originalname,
        mimeType: file.mimetype,
        sizeBytes: file.size,
      }
    }))

    const message = await Message.create({
      senderId: req.user.userId,
      receiverId,
      content,
      attachments,
    })

    const chatLink =
      receiver.role === 'parent'
        ? '/parent/dashboard?tab=chat'
        : receiver.role === 'student'
          ? '/student/dashboard?tab=chat'
          : '/tutor/dashboard/chat'
    await notify(receiverId, {
      title: 'New message',
      message: `You have a new message from ${sender?.name ?? 'someone'}`,
      type: 'system',
      event: 'messages',
      link: chatLink,
    })

    // Real-time Socket.io emissions
    const safeMessage = publicMessage(message)
    emitToUser(receiverId, 'message:received', safeMessage)
    emitToUser(req.user.userId, 'message:sent', safeMessage)

    res.status(201).json({ message: safeMessage })
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
