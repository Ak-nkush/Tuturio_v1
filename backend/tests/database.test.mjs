import { after, before, describe, it } from 'node:test'
import assert from 'node:assert/strict'
import mongoose from 'mongoose'
import { connectDb } from '../src/db/connect.js'
import { User } from '../src/models/User.js'
import { Batch } from '../src/models/Batch.js'
import { Assignment } from '../src/models/Assignment.js'
import { Submission } from '../src/models/Submission.js'

const TAG = `dbtest-${Date.now().toString(36)}`

describe('database schema and constraints', () => {
  before(async () => {
    await connectDb()
  })

  after(async () => {
    await User.deleteMany({ email: new RegExp(`^${TAG}`) })
    await Batch.deleteMany({ batchId: new RegExp(`^${TAG}`) })
    await Assignment.deleteMany({ tutorId: TAG })
    await Submission.deleteMany({ studentId: TAG })
    await mongoose.disconnect()
  })

  it('rejects a user without email', async () => {
    await assert.rejects(
      () => User.create({ userId: `${TAG}-u1`, name: 'No Email', role: 'student', passwordHash: 'x' }),
      (err) => err.name === 'ValidationError',
    )
  })

  it('rejects an invalid user role', async () => {
    await assert.rejects(
      () => User.create({
        userId: `${TAG}-u2`,
        name: 'Bad Role',
        role: 'admin',
        email: `${TAG}-admin@test.local`,
        passwordHash: 'x',
      }),
      (err) => err.name === 'ValidationError',
    )
  })

  it('enforces unique emails', async () => {
    const email = `${TAG}-dup@test.local`
    await User.create({
      userId: `${TAG}-u3`,
      name: 'First',
      role: 'parent',
      email,
      passwordHash: 'x',
    })
    await assert.rejects(
      () => User.create({
        userId: `${TAG}-u4`,
        name: 'Second',
        role: 'parent',
        email,
        passwordHash: 'x',
      }),
      (err) => err.code === 11000,
    )
  })

  it('rejects a batch without a name', async () => {
    await assert.rejects(
      () => Batch.create({ batchId: `${TAG}-bat`, tutorId: 'USR-00001' }),
      (err) => err.name === 'ValidationError',
    )
  })

  it('rejects an assignment without a due date', async () => {
    await assert.rejects(
      () => Assignment.create({
        tutorId: TAG,
        batchId: 'BAT-00001',
        title: 'Homework',
        maxScore: 10,
      }),
      (err) => err.name === 'ValidationError',
    )
  })

  it('rejects an invalid submission status', async () => {
    await assert.rejects(
      () => Submission.create({
        assignmentId: new mongoose.Types.ObjectId(),
        studentId: TAG,
        storageKey: 'key',
        fileName: 'a.txt',
        status: 'hacked',
      }),
      (err) => err.name === 'ValidationError',
    )
  })

  it('round-trips a valid assignment document', async () => {
    const created = await Assignment.create({
      tutorId: TAG,
      batchId: 'BAT-00001',
      title: 'DB round trip',
      dueDate: new Date('2026-09-11T10:00:00.000Z'),
      maxScore: 25,
    })
    const found = await Assignment.findById(created._id)
    assert.equal(found.title, 'DB round trip')
    assert.equal(found.maxScore, 25)
  })
})
