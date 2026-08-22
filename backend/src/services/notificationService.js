import { Notification } from '../models/Notification.js'
import { User } from '../models/User.js'
import { emitToUser } from './socketService.js'

const DEFAULT_PREFS = {
  messages: true,
  attendance: true,
  progress: true,
  announcements: true,
  batch: true,
}

function wantsEvent(user, event) {
  const prefs = user?.notificationPreferences ?? DEFAULT_PREFS
  if (event && prefs[event] === false) return false
  return true
}

// Fire-and-forget notification creation. Never throws into the request path.
export async function notify(userId, { title, message, type = 'system', link = null, event = 'batch' }) {
  if (!userId) return
  try {
    const user = await User.findOne({ userId })
    if (!wantsEvent(user, event)) return
    const n = await Notification.create({ userId, title, message, type, link, event })
    emitToUser(userId, 'notification:new', n)
  } catch (err) {
    console.error('Failed to create notification:', err.message)
  }
}

export async function notifyMany(userIds, payload) {
  const unique = [...new Set(userIds.filter(Boolean))]
  if (!unique.length) return
  try {
    const users = await User.find({ userId: { $in: unique } })
    const allowed = users.filter((u) => wantsEvent(u, payload.event ?? 'batch')).map((u) => u.userId)
    if (!allowed.length) return
    const { event, ...rest } = payload
    const docs = await Notification.insertMany(allowed.map((userId) => ({ userId, event, ...rest })))
    for (const doc of docs) {
      emitToUser(doc.userId, 'notification:new', doc)
    }
  } catch (err) {
    console.error('Failed to create notifications:', err.message)
  }
}

