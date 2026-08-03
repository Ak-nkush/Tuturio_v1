import { Router } from 'express'
import { User, publicUser } from '../models/User.js'
import {
  hashPassword,
  normalizeEmail,
  validatePassword,
  verifyPassword,
} from '../utils/password.js'
import {
  clearAuthCookies,
  setAuthCookies,
  signAccessToken,
  signRefreshToken,
  verifyRefreshToken,
} from '../utils/tokens.js'
import { generateResetToken, hashResetToken, sendPasswordResetEmail } from '../utils/email.js'
import { env } from '../config/env.js'
import { requireAuth } from '../middleware/auth.js'
import { forgotPasswordRateLimiter, loginRateLimiter } from '../middleware/rateLimit.js'

const router = Router()

const GENERIC_RESET_MESSAGE = 'If that email is registered, a reset link has been sent.'

router.post('/login', loginRateLimiter, async (req, res) => {
  const email = normalizeEmail(String(req.body.email ?? ''))
  const password = String(req.body.password ?? '')

  if (!email || !password) {
    return res.status(400).json({ message: 'Email and password are required' })
  }

  const user = await User.findOne({ email })
  if (!user) {
    return res.status(401).json({ message: 'Invalid email or password' })
  }

  if (user.lockedUntil && user.lockedUntil > new Date()) {
    return res.status(429).json({ message: 'Account temporarily locked. Try again later.' })
  }

  const valid = await verifyPassword(password, user.passwordHash)
  if (!valid) {
    user.failedLoginAttempts += 1
    if (user.failedLoginAttempts >= 5) {
      user.lockedUntil = new Date(Date.now() + 15 * 60 * 1000)
      user.failedLoginAttempts = 0
    }
    await user.save()
    return res.status(401).json({ message: 'Invalid email or password' })
  }

  if (user.status === 'archived') {
    return res.status(403).json({ reason: 'account_archived', message: 'Your access has been paused by your tutor' })
  }

  user.failedLoginAttempts = 0
  user.lockedUntil = null
  await user.save()

  const accessToken = signAccessToken(user)
  const refreshToken = signRefreshToken(user)
  setAuthCookies(res, accessToken, refreshToken)

  return res.json({ user: publicUser(user) })
})

router.post('/logout', (_req, res) => {
  clearAuthCookies(res)
  return res.json({ message: 'Logged out' })
})

router.post('/refresh', async (req, res) => {
  try {
    const token = req.cookies?.refreshToken
    if (!token) return res.status(401).json({ message: 'Refresh token missing' })

    const payload = verifyRefreshToken(token)
    if (payload.type !== 'refresh') {
      return res.status(401).json({ message: 'Invalid refresh token' })
    }

    const user = await User.findOne({ userId: payload.sub })
    if (!user || user.tokenVersion !== payload.tokenVersion || user.status === 'archived') {
      return res.status(401).json({ message: 'Session expired' })
    }

    const accessToken = signAccessToken(user)
    const refreshToken = signRefreshToken(user)
    setAuthCookies(res, accessToken, refreshToken)

    return res.json({ user: publicUser(user) })
  } catch {
    return res.status(401).json({ message: 'Invalid or expired refresh token' })
  }
})

router.get('/me', requireAuth, async (req, res) => {
  const user = await User.findOne({ userId: req.user.userId })
  if (!user) return res.status(404).json({ message: 'User not found' })
  return res.json({ user: publicUser(user) })
})

router.post('/forgot-password', forgotPasswordRateLimiter, async (req, res) => {
  const email = normalizeEmail(String(req.body.email ?? ''))

  if (email) {
    const user = await User.findOne({ email })
    if (user && user.status === 'active') {
      const rawToken = generateResetToken()
      user.passwordResetTokenHash = hashResetToken(rawToken)
      user.passwordResetExpiresAt = new Date(Date.now() + 30 * 60 * 1000)
      await user.save()

      const resetUrl = `${env.clientUrl}/auth/reset-password/${rawToken}`
      await sendPasswordResetEmail(email, resetUrl)
    }
  }

  return res.json({ message: GENERIC_RESET_MESSAGE })
})

router.post('/reset-password', async (req, res) => {
  const token = String(req.body.token ?? '')
  const password = String(req.body.password ?? '')

  const passwordError = validatePassword(password)
  if (!token) return res.status(400).json({ message: 'Reset token is required' })
  if (passwordError) return res.status(400).json({ message: passwordError })

  const tokenHash = hashResetToken(token)
  const user = await User.findOne({
    passwordResetTokenHash: tokenHash,
    passwordResetExpiresAt: { $gt: new Date() },
  })

  if (!user) {
    return res.status(400).json({ reason: 'expired', message: 'This reset link is invalid or has expired' })
  }

  user.passwordHash = await hashPassword(password)
  user.passwordResetTokenHash = null
  user.passwordResetExpiresAt = null
  user.tokenVersion += 1
  await user.save()

  return res.json({ message: 'Password updated. You can log in now.' })
})

export default router
