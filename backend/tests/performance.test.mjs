// Lightweight load check against a running API. Does not hammer login (rate-limited).
const BASE = process.env.API_BASE ?? 'http://localhost:5000'
const REQUESTS = Number(process.env.LOAD_REQUESTS ?? 40)

function percentile(sorted, p) {
  if (!sorted.length) return null
  const index = Math.min(sorted.length - 1, Math.ceil((p / 100) * sorted.length) - 1)
  return sorted[index]
}

const times = []
let failures = 0

for (let i = 0; i < REQUESTS; i += 1) {
  const started = performance.now()
  try {
    const res = await fetch(`${BASE}/api/health`)
    times.push(performance.now() - started)
    if (!res.ok) failures += 1
  } catch {
    times.push(performance.now() - started)
    failures += 1
  }
}

times.sort((a, b) => a - b)
const summary = {
  requests: REQUESTS,
  failures,
  minMs: Number(times[0].toFixed(1)),
  p50Ms: Number(percentile(times, 50).toFixed(1)),
  p95Ms: Number(percentile(times, 95).toFixed(1)),
  maxMs: Number(times[times.length - 1].toFixed(1)),
}

console.log('Performance / load (GET /api/health)')
console.log(summary)

if (failures > 0) {
  console.error('FAIL: health endpoint returned errors under load')
  process.exit(1)
}
if (summary.p95Ms > 1500) {
  console.error('FAIL: p95 latency exceeded 1500ms')
  process.exit(1)
}
console.log('PASS: health stayed up and p95 was under 1500ms')
