const url = process.env.API_HEALTH_URL ?? 'http://localhost:5000/api/health'
const timeoutAt = Date.now() + 30_000

while (Date.now() < timeoutAt) {
  try {
    const response = await fetch(url)
    if (response.ok) process.exit(0)
  } catch {
    // The API is still starting.
  }
  await new Promise((resolve) => setTimeout(resolve, 500))
}

console.error(`Timed out waiting for ${url}`)
process.exit(1)
