import { describe, it } from 'node:test'
import assert from 'node:assert/strict'
import { signAccessToken, signRefreshToken, verifyAccessToken, verifyRefreshToken } from '../../src/utils/tokens.js'

const user = { userId: 'USR-00001', role: 'tutor', tokenVersion: 3 }

describe('auth tokens', () => {
  it('signs and verifies an access token', () => {
    const token = signAccessToken(user)
    const payload = verifyAccessToken(token)
    assert.equal(payload.sub, 'USR-00001')
    assert.equal(payload.role, 'tutor')
    assert.equal(payload.type, 'access')
    assert.equal(payload.tokenVersion, 3)
  })

  it('signs and verifies a refresh token', () => {
    const token = signRefreshToken(user)
    const payload = verifyRefreshToken(token)
    assert.equal(payload.sub, 'USR-00001')
    assert.equal(payload.type, 'refresh')
    assert.equal(payload.role, undefined)
  })

  it('rejects a refresh token as an access token', () => {
    const token = signRefreshToken(user)
    assert.throws(() => verifyAccessToken(token))
  })
})
