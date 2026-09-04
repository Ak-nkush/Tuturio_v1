import { describe, it } from 'node:test'
import assert from 'node:assert/strict'
import { generateReservedUserId, generateInviteCode } from '../../src/utils/ids.js'

describe('id generators', () => {
  it('generates reserved user ids with USR- prefix', () => {
    const id = generateReservedUserId()
    assert.match(id, /^USR-[0-9a-z]{6}$/)
  })

  it('generates unique invite codes', () => {
    const a = generateInviteCode()
    const b = generateInviteCode()
    assert.match(a, /^[0-9a-z]{6}$/)
    assert.notEqual(a, b)
  })
})
