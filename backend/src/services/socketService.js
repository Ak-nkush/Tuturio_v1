import { verifyAccessToken } from '../utils/tokens.js'
import { User } from '../models/User.js'
import { Message } from '../models/Message.js'
import { areRelated } from './relationshipService.js'

const activeUsers = new Map()
let ioInstance = null

function parseCookies(cookieHeader) {
  if (!cookieHeader) return {}
  const list = {}
  cookieHeader.split(';').forEach((c) => {
    const parts = c.split('=')
    if (parts.length >= 2) {
      list[parts[0].trim()] = decodeURIComponent(parts.slice(1).join('='))
    }
  })
  return list
}

function conversationRoom(userA, userB) {
  return `dm:${[userA, userB].sort().join(':')}`
}

export function initSocket(io) {
  ioInstance = io

  io.use(async (socket, next) => {
    try {
      const cookieHeader = socket.handshake.headers.cookie
      const cookies = parseCookies(cookieHeader)
      const token = cookies.accessToken

      if (!token) {
        return next(new Error('Authentication required'))
      }

      const payload = verifyAccessToken(token)
      if (payload.type !== 'access') {
        return next(new Error('Invalid token'))
      }

      const user = await User.findOne({ userId: payload.sub })
      if (!user || user.tokenVersion !== payload.tokenVersion) {
        return next(new Error('Session expired'))
      }

      if (user.status === 'archived') {
        return next(new Error('Your access has been paused'))
      }

      socket.user = { userId: user.userId, role: user.role }
      next()
    } catch {
      next(new Error('Authentication failed'))
    }
  })

  io.on('connection', (socket) => {
    const userId = socket.user.userId
    if (!activeUsers.has(userId)) {
      activeUsers.set(userId, new Set())
    }
    activeUsers.get(userId).add(socket.id)
    markInboxDelivered(userId).catch(() => {})

    socket.on('conversation:join', async (peerId, ack) => {
      const allowed = await areRelated(userId, String(peerId ?? ''))
      if (!allowed) {
        if (typeof ack === 'function') ack({ ok: false, error: 'Forbidden' })
        return
      }
      socket.join(conversationRoom(userId, peerId))
      if (typeof ack === 'function') ack({ ok: true })
    })

    socket.on('disconnect', () => {
      const sockets = activeUsers.get(userId)
      if (sockets) {
        sockets.delete(socket.id)
        if (sockets.size === 0) {
          activeUsers.delete(userId)
        }
      }
    })
  })
}

export function isUserOnline(userId) {
  const sockets = activeUsers.get(userId)
  return Boolean(sockets && sockets.size > 0)
}

async function markInboxDelivered(userId) {
  const pending = await Message.find({ receiverId: userId, isDelivered: false }).select('senderId')
  if (pending.length === 0) return

  const senders = [...new Set(pending.map((row) => row.senderId))]
  await Message.updateMany(
    { receiverId: userId, isDelivered: false },
    { $set: { isDelivered: true, deliveredAt: new Date() } },
  )
  for (const senderId of senders) {
    emitToUser(senderId, 'messages:delivered', { recipientId: userId })
  }
}

export function emitToUser(userId, event, data) {
  const sockets = activeUsers.get(userId)
  if (sockets && ioInstance) {
    for (const socketId of sockets) {
      ioInstance.to(socketId).emit(event, data)
    }
  }
}

