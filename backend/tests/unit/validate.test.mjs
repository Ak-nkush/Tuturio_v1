import { describe, it } from 'node:test'
import assert from 'node:assert/strict'
import { escapeRegex, isValidObjectId, validObjectIdParam, SESSION_STATUSES, ATTENDANCE_STATUSES } from '../../src/utils/validate.js'

describe('validate utils', () => {
  it('escapes regex metacharacters', () => {
    assert.equal(escapeRegex('a.b+c?'), 'a\\.b\\+c\\?')
  })

  it('accepts a 24-char hex ObjectId', () => {
    assert.equal(isValidObjectId('507f1f77bcf86cd799439011'), true)
  })

  it('rejects invalid ObjectIds', () => {
    assert.equal(isValidObjectId('not-a-valid-objectid'), false)
  })

  it('returns 404 middleware for invalid route params', () => {
    const mw = validObjectIdParam('id')
    let status
    let body
    mw({ params: { id: 'bad' } }, { status: (code) => { status = code; return { json: (data) => { body = data } } } }, () => {
      assert.fail('next should not run')
    })
    assert.equal(status, 404)
    assert.equal(body.error, 'Not found')
  })

  it('calls next for a valid ObjectId param', () => {
    const mw = validObjectIdParam('id')
    let called = false
    mw({ params: { id: '507f1f77bcf86cd799439011' } }, {}, () => { called = true })
    assert.equal(called, true)
  })

  it('lists expected session and attendance statuses', () => {
    assert.deepEqual(SESSION_STATUSES, ['scheduled', 'active', 'completed', 'cancelled'])
    assert.deepEqual(ATTENDANCE_STATUSES, ['present', 'absent', 'late', 'excused'])
  })
})
