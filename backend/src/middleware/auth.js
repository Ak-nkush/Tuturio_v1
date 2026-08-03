import { User } from '../models/User.js'
import { verifyAccessToken } from '../utils/tokens.js'

export async function requireAuth(req, res, next) {
  try {
    const token = req.cookies?.accessToken
    if (!token) {
      return res.status(401).json({ message: 'Authentication required' })
    }

    const payload = verifyAccessToken(token)
    if (payload.type !== 'access') {
      return res.status(401).json({ message: 'Invalid token' })
    }

    const user = await User.findOne({ userId: payload.sub })
    if (!user || user.tokenVersion !== payload.tokenVersion) {
      return res.status(401).json({ message: 'Session expired' })
    }

    if (user.status === 'archived') {
      return res.status(403).json({ reason: 'account_archived', message: 'Your access has been paused' })
    }

    req.user = { userId: user.userId, role: user.role, tokenVersion: user.tokenVersion }
    next()
  } catch {
    return res.status(401).json({ message: 'Invalid or expired token' })
  }
}

export function requireRole(...roles) {
  return (req, res, next) => {
    if (!req.user || !roles.includes(req.user.role)) {
      return res.status(403).json({ message: 'Forbidden' })
    }
    next()
  }
}

export async function optionalAuth(req, res, next) {
  try {
    const token = req.cookies?.accessToken
    if (!token) return next()

    const payload = verifyAccessToken(token)
    if (payload.type !== 'access') return next()

    const user = await User.findOne({ userId: payload.sub })
    if (!user || user.tokenVersion !== payload.tokenVersion || user.status === 'archived') {
      return next()
    }

    req.user = { userId: user.userId, role: user.role, tokenVersion: user.tokenVersion }
    next()
  } catch {
    next()
  }
}
