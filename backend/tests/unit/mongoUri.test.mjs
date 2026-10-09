import { describe, it } from 'node:test'
import assert from 'node:assert/strict'
import { mongoConnectOptions } from '../../src/db/mongoUri.js'

describe('mongoConnectOptions', () => {
  it('defaults to the tuturio database when the URI has no path', () => {
    const uri = 'mongodb+srv://user:pass@cluster0.example.net/?appName=Cluster0'
    assert.deepEqual(mongoConnectOptions(uri), { dbName: 'tuturio' })
  })

  it('leaves a named database in the URI unchanged', () => {
    const uri = 'mongodb+srv://user:pass@cluster0.example.net/classroom?appName=Cluster0'
    assert.deepEqual(mongoConnectOptions(uri), {})
  })
})
