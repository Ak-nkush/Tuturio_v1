import { Router } from 'express'
import { Notification } from '../models/Notification.js'
import { User, publicUser } from '../models/User.js'
import { requireAuth } from '../middleware/auth.js'

const router = Router()

router.use(requireAuth)

const PREF_KEYS = ['messages', 'attendance', 'progress', 'announcements', 'batch']

function defaultPrefs() {
  return {
    messages: true,
    attendance: true,
    progress: true,
    announcements: true,
    batch: true,
  }
}

router.get('/', async (req, res) => {
  try {
    const notifications = await Notification.find({ userId: req.user.userId, isRead: false })
      .sort({ createdAt: -1 })
      .limit(50)
    res.json({ notifications })
  } catch (error) {
    console.error(error)
    res.status(500).json({ error: 'Server error' })
  }
})

router.get('/preferences', async (req, res) => {
  try {
    const user = await User.findOne({ userId: req.user.userId })
    if (!user) return res.status(404).json({ error: 'User not found' })
    res.json({ preferences: user.notificationPreferences ?? defaultPrefs() })
  } catch (error) {
    console.error(error)
    res.status(500).json({ error: 'Server error' })
  }
})

router.patch('/preferences', async (req, res) => {
  try {
    const user = await User.findOne({ userId: req.user.userId })
    if (!user) return res.status(404).json({ error: 'User not found' })

    const next = { ...(user.notificationPreferences?.toObject?.() ?? user.notificationPreferences ?? defaultPrefs()) }
    for (const key of PREF_KEYS) {
      if (typeof req.body[key] === 'boolean') next[key] = req.body[key]
    }
    user.notificationPreferences = next
    await user.save()
    res.json({ preferences: user.notificationPreferences, user: publicUser(user) })
  } catch (error) {
    console.error(error)
    res.status(500).json({ error: 'Server error' })
  }
})

router.patch('/read-all', async (req, res) => {
  try {
    await Notification.deleteMany({ userId: req.user.userId, isRead: false })
    res.json({ message: 'All notifications cleared' })
  } catch (error) {
    console.error(error)
    res.status(500).json({ error: 'Server error' })
  }
})

router.patch('/:id/read', async (req, res) => {
  try {
    const notification = await Notification.findById(req.params.id)
    if (!notification || notification.userId !== req.user.userId) {
      return res.status(404).json({ error: 'Notification not found' })
    }

    await notification.deleteOne()
    res.json({ message: 'Notification dismissed' })
  } catch (error) {
    console.error(error)
    res.status(500).json({ error: 'Server error' })
  }
})

export default router
