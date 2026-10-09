import { afterEach, describe, it } from 'node:test'
import assert from 'node:assert/strict'
import { apiFetch, authApi, setOnSessionLost } from '../../src/lib/api.js'

const originalFetch = globalThis.fetch

afterEach(() => {
  globalThis.fetch = originalFetch
  setOnSessionLost(null)
})

function jsonResponse(status, body) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { 'Content-Type': 'application/json' },
  })
}

describe('apiFetch session refresh', () => {
  it('refreshes once and retries the original request after a 401', async () => {
    const paths = []
    let enrolledCalls = 0
    globalThis.fetch = async (path) => {
      paths.push(path)
      if (path === '/api/auth/refresh') return jsonResponse(200, { user: { role: 'student' } })
      if (path === '/api/batches/student/enrolled') {
        enrolledCalls += 1
        if (enrolledCalls === 1) return jsonResponse(401, { message: 'Authentication required' })
        return jsonResponse(200, { batches: [{ batchId: 'b1' }] })
      }
      throw new Error(`unexpected path ${path}`)
    }

    const data = await apiFetch('/api/batches/student/enrolled')
    assert.deepEqual(data, { batches: [{ batchId: 'b1' }] })
    assert.deepEqual(paths, [
      '/api/batches/student/enrolled',
      '/api/auth/refresh',
      '/api/batches/student/enrolled',
    ])
  })

  it('shares one refresh across parallel 401s', async () => {
    let refreshCalls = 0
    const enrolledAttempts = { a: 0, b: 0 }
    globalThis.fetch = async (path) => {
      if (path === '/api/auth/refresh') {
        refreshCalls += 1
        return jsonResponse(200, { user: { role: 'student' } })
      }
      enrolledAttempts[path] += 1
      if (enrolledAttempts[path] === 1) return jsonResponse(401, { message: 'Authentication required' })
      return jsonResponse(200, { ok: path })
    }

    const [a, b] = await Promise.all([apiFetch('a'), apiFetch('b')])
    assert.equal(refreshCalls, 1)
    assert.deepEqual(a, { ok: 'a' })
    assert.deepEqual(b, { ok: 'b' })
  })

  it('does not refresh on login failures', async () => {
    const paths = []
    globalThis.fetch = async (path) => {
      paths.push(path)
      return jsonResponse(401, { message: 'Invalid email or password' })
    }

    await assert.rejects(() => authApi.login('a@b.c', 'password12'), /Invalid email or password/)
    assert.deepEqual(paths, ['/api/auth/login'])
  })
})
