// Focused API security checks. Full role/isolation coverage lives in api-integration.test.mjs.
const BASE = process.env.API_BASE ?? 'http://localhost:5000'
const results = []

function check(name, cond, extra) {
  results.push({ name, pass: Boolean(cond) })
  console.log(`${cond ? '  PASS' : '  FAIL'}  ${name}${cond ? '' : `  ->  ${JSON.stringify(extra ?? '').slice(0, 240)}`}`)
}

async function req(method, path, opts = {}) {
  const headers = { ...(opts.headers ?? {}) }
  let body
  if (opts.body !== undefined) {
    headers['Content-Type'] = 'application/json'
    body = JSON.stringify(opts.body)
  }
  const res = await fetch(BASE + path, { method, headers, body })
  const text = await res.text()
  let data
  try {
    data = JSON.parse(text)
  } catch {
    data = text
  }
  return { status: res.status, data, headers: res.headers }
}

console.log(`Security API checks at ${BASE}`)

const health = await req('GET', '/api/health')
check('Health is public', health.status === 200, health)

const me = await req('GET', '/api/auth/me')
check('Protected route without cookie is 401', me.status === 401, me)

const batches = await req('GET', '/api/batches')
check('Batch list without cookie is 401', batches.status === 401, batches)

const files = await req('GET', '/api/files/submissions/507f1f77bcf86cd799439011')
check('Private file without cookie is 401', files.status === 401, files)

const login = await req('POST', '/api/auth/login', {
  body: { email: 'tutor@tuturio.local', password: 'MeeraJoshi8' },
})
const setCookie = login.headers.getSetCookie?.() ?? []
check('Login sets cookies', login.status === 200 && setCookie.length > 0, { status: login.status, cookies: setCookie.length })
check(
  'Auth cookies are HttpOnly',
  setCookie.some((c) => c.toLowerCase().includes('httponly')),
  setCookie,
)

const nosql = await req('POST', '/api/auth/login', {
  body: { email: { $gt: '' }, password: { $gt: '' } },
})
check('Login rejects non-string email (NoSQL probe)', nosql.status === 400 || nosql.status === 401, nosql)

const xssPath = await req('GET', '/api/sessions/<script>alert(1)</script>')
check('Script in ObjectId path is not a 500', xssPath.status !== 500 && xssPath.status < 500, xssPath)

const failed = results.filter((row) => !row.pass)
console.log(`\nSecurity summary: ${results.length - failed.length}/${results.length} passed`)
if (failed.length) process.exit(1)
