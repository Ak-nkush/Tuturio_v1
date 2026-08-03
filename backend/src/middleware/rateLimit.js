import rateLimit from 'express-rate-limit'

export const loginRateLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 5,
  standardHeaders: true,
  legacyHeaders: false,
  message: { message: 'Too many login attempts. Try again in 15 minutes.' },
  keyGenerator: (req) => `${req.ip}:${String(req.body?.email ?? '').toLowerCase()}`,
})

export const forgotPasswordRateLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 5,
  standardHeaders: true,
  legacyHeaders: false,
  message: { message: 'Too many reset requests. Try again later.' },
})
