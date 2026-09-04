import { describe, it } from 'node:test'
import assert from 'node:assert/strict'
import {
  formatDate,
  formatDateTime,
  formatSchedule,
  studentRosterState,
  validatePassword,
  dashboardPath,
} from '../../src/lib/api.js'

describe('formatDate / formatDateTime', () => {
  it('returns an em dash for empty or invalid values', () => {
    assert.equal(formatDate(''), '—')
    assert.equal(formatDate('not-a-date'), '—')
    assert.equal(formatDateTime(null), '—')
  })

  it('formats a valid date in en-GB', () => {
    const label = formatDate('2026-09-11T08:59:00.000Z')
    assert.match(label, /2026/)
    assert.match(label, /September/)
  })
})

describe('formatSchedule', () => {
  it('handles a missing schedule', () => {
    assert.equal(formatSchedule(null), 'No schedule set')
  })

  it('joins weekdays and time', () => {
    assert.equal(formatSchedule({ days: [1, 2], time: '18:30' }), 'Mon, Tue · 18:30')
  })
})

describe('studentRosterState', () => {
  it('maps enrollment and account status', () => {
    assert.equal(studentRosterState({ status: 'removed' }).key, 'removed')
    assert.equal(studentRosterState({ status: 'archived' }).key, 'archived')
    assert.equal(studentRosterState({ status: 'pending' }).label, 'Pending invite')
    assert.equal(studentRosterState({ status: 'active', accountStatus: 'archived' }).key, 'archived')
    assert.equal(studentRosterState({ status: 'active' }).key, 'active')
  })
})

describe('auth helpers', () => {
  it('validates password length', () => {
    assert.ok(validatePassword('short'))
    assert.equal(validatePassword('longenough'), null)
  })

  it('routes each role to its dashboard', () => {
    assert.equal(dashboardPath('tutor'), '/tutor/dashboard')
    assert.equal(dashboardPath('parent'), '/parent/dashboard')
    assert.equal(dashboardPath('student'), '/student/dashboard')
  })
})
