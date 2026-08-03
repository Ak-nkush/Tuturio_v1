import jwt from 'jsonwebtoken'
import { env } from '../config/env.js'

export function signAccessToken(user) {
  const payload = {
    sub: user.userId,
    role: user.role,
    tokenVersion: user.tokenVersion,
    type: 'access',
  }
  return jwt.sign(payload, env.jwtAccessSecret, { expiresIn: env.accessTokenExpiry })
}

export function signRefreshToken(user) {
  const payload = {
    sub: user.userId,
    tokenVersion: user.tokenVersion,
    type: 'refresh',
  }
  return jwt.sign(payload, env.jwtRefreshSecret, { expiresIn: env.refreshTokenExpiry })
}

export function setAuthCookies(res, accessToken, refreshToken) {
  const isProd = !env.isDev
  const common = {
    httpOnly: true,
    secure: isProd,
    sameSite: 'lax',
    path: '/',
  }

  res.cookie('accessToken', accessToken, { ...common, maxAge: 15 * 60 * 1000 })
  res.cookie('refreshToken', refreshToken, { ...common, maxAge: 7 * 24 * 60 * 60 * 1000 })
}

export function clearAuthCookies(res) {
  res.clearCookie('accessToken', { path: '/' })
  res.clearCookie('refreshToken', { path: '/' })
}

export function verifyAccessToken(token) {
  return jwt.verify(token, env.jwtAccessSecret)
}

export function verifyRefreshToken(token) {
  return jwt.verify(token, env.jwtRefreshSecret)
}
