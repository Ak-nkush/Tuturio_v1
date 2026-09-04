const FRONTEND = process.env.FRONTEND_BASE ?? 'http://localhost:5173'
const API = process.env.API_BASE ?? 'http://localhost:5000'
const results = []

function check(name, cond, extra) {
  results.push({ name, pass: Boolean(cond) })
  console.log(`${cond ? '  PASS' : '  FAIL'}  ${name}${cond ? '' : `  ->  ${JSON.stringify(extra ?? '').slice(0, 240)}`}`)
}

async function get(url) {
  const res = await fetch(url, { redirect: 'follow' })
  const text = await res.text()
  return { status: res.status, text, url: res.url }
}

console.log(`E2E smoke: web ${FRONTEND}  api ${API}`)

const home = await get(FRONTEND + '/')
check('Landing page loads', home.status === 200 && /tuturio/i.test(home.text), { status: home.status })

const login = await get(FRONTEND + '/auth/login')
check('Login page loads', login.status === 200 && (/tuturio/i.test(login.text) || /root/i.test(login.text)), { status: login.status })

const health = await get(API + '/api/health')
check('API health from E2E harness', health.status === 200 && /ok/i.test(health.text), health)

const unknown = await get(FRONTEND + '/this-route-does-not-exist')
check('Unknown frontend route still serves the app shell', unknown.status === 200, { status: unknown.status })

const failed = results.filter((row) => !row.pass)
console.log(`\nE2E smoke summary: ${results.length - failed.length}/${results.length} passed`)
if (failed.length) process.exit(1)
