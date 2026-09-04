import { describe, it } from 'node:test'
import assert from 'node:assert/strict'
import { conversationTypeForRoles, areRelated } from '../../src/services/relationshipService.js'

describe('conversationTypeForRoles', () => {
  it('maps tutor and student to tutor_student', () => {
    assert.equal(conversationTypeForRoles('tutor', 'student'), 'tutor_student')
    assert.equal(conversationTypeForRoles('student', 'tutor'), 'tutor_student')
  })

  it('maps tutor and parent to tutor_parent', () => {
    assert.equal(conversationTypeForRoles('tutor', 'parent'), 'tutor_parent')
  })

  it('blocks student-parent and same-role chats', () => {
    assert.equal(conversationTypeForRoles('student', 'parent'), null)
    assert.equal(conversationTypeForRoles('student', 'student'), null)
    assert.equal(conversationTypeForRoles('parent', 'parent'), null)
  })
})

describe('areRelated', () => {
  it('returns false for missing or matching ids without hitting the database', async () => {
    assert.equal(await areRelated('', 'USR-1'), false)
    assert.equal(await areRelated('USR-1', 'USR-1'), false)
    assert.equal(await areRelated(null, 'USR-2'), false)
  })
})
