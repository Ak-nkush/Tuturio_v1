import { describe, it } from 'node:test'
import assert from 'node:assert/strict'
import { requireRole } from '../../src/middleware/auth.js'

function mockRes() {
  return {
    statusCode: null,
    body: null,
    status(code) {
      this.statusCode = code
      return this
    },
    json(data) {
      this.body = data
      return this
    },
  }
}

describe('requireRole', () => {
  it('allows a matching role', () => {
    const mw = requireRole('parent')
    let next = false
    mw({ user: { role: 'parent' } }, mockRes(), () => { next = true })
    assert.equal(next, true)
  })

  it('forbids a student from a parent-only route', () => {
    const mw = requireRole('parent')
    const res = mockRes()
    mw({ user: { role: 'student' } }, res, () => assert.fail('next'))
    assert.equal(res.statusCode, 403)
    assert.equal(res.body.message, 'Forbidden')
  })
})
