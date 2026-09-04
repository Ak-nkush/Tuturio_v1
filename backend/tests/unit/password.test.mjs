import { describe, it } from 'node:test'
import assert from 'node:assert/strict'
import { validatePassword, hashPassword, verifyPassword, normalizeEmail } from '../../src/utils/password.js'

describe('password utils', () => {
  it('rejects passwords shorter than 8 characters', () => {
    assert.equal(validatePassword('short'), 'Password must be at least 8 characters')
  })

  it('accepts passwords of 8 or more characters', () => {
    assert.equal(validatePassword('longenough'), null)
  })

  it('normalizes email to trimmed lowercase', () => {
    assert.equal(normalizeEmail('  Parent@Tuturio.Local '), 'parent@tuturio.local')
  })

  it('hashes and verifies a password', async () => {
    const hash = await hashPassword('StudentPass123456!')
    assert.equal(await verifyPassword('StudentPass123456!', hash), true)
    assert.equal(await verifyPassword('wrong-password', hash), false)
  })
})
