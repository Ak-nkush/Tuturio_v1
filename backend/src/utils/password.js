import bcrypt from 'bcryptjs'

export const PASSWORD_MIN_LENGTH = 16

export function validatePassword(password) {
  if (password.length < PASSWORD_MIN_LENGTH) {
    return `Password must be at least ${PASSWORD_MIN_LENGTH} characters`
  }
  return null
}

export async function hashPassword(password) {
  return bcrypt.hash(password, 12)
}

export async function verifyPassword(password, hash) {
  return bcrypt.compare(password, hash)
}

export function normalizeEmail(email) {
  return email.trim().toLowerCase()
}
