import { verifyAccessToken } from '../utils/tokens.js'
import { User } from '../models/User.js'

const activeUsers = new Map() // userId -> Set of socketIds (handles multiple browser tabs/sessions)
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

export function initSocket(io) {
  ioInstance = io

  // Authenticate socket connections using JWT from HTTP-only cookies
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

    console.log(`[SOCKET] User connected: ${userId} (socketId: ${socket.id})`)

    socket.on('disconnect', () => {
      const sockets = activeUsers.get(userId)
      if (sockets) {
        sockets.delete(socket.id)
        if (sockets.size === 0) {
          activeUsers.delete(userId)
        }
      }
      console.log(`[SOCKET] User disconnected: ${userId} (socketId: ${socket.id})`)
    })
  })
}

// Sends an event to all active sockets of a specific user
export function emitToUser(userId, event, data) {
  const sockets = activeUsers.get(userId)
  if (sockets && ioInstance) {
    for (const socketId of sockets) {
      ioInstance.to(socketId).emit(event, data)
    }
  }
}
