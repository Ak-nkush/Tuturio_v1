export function mongoConnectOptions(uri) {
  try {
    const normalized = uri.replace(/^mongodb(\+srv)?:\/\//i, 'http://')
    const pathname = new URL(normalized).pathname.replace(/^\//, '')
    if (pathname) return {}
  } catch {
    // Invalid URI parsing falls through to the classroom default.
  }
  return { dbName: 'tuturio' }
}
