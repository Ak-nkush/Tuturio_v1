async function parseJson(res) {
  let data
  try {
    const text = await res.text()
    data = text ? JSON.parse(text) : {}
  } catch (err) {
    throw new Error('Unable to reach the server. Is the backend running?')
  }

  if (!res.ok) {
    let msg = data.message;
    if (!msg && (res.status === 502 || res.status === 504)) {
       msg = 'Unable to reach the server. Please ensure the backend is running (npm run dev in the backend folder).';
    }
    const err = new Error(msg ?? 'Request failed')
    err.reason = data.reason
    err.currentRole = data.currentRole
    err.inviteRole = data.inviteRole
    err.existingRole = data.existingRole
    throw err
  }
  return data
}

export async function apiFetch(path, init) {
  const res = await fetch(path, {
    ...init,
    credentials: 'include',
    headers: {
      'Content-Type': 'application/json',
      ...(init?.headers ?? {}),
    },
  })
  return parseJson(res)
}

export const authApi = {
  me: () => apiFetch('/api/auth/me'),
  login: (email, password) =>
    apiFetch('/api/auth/login', {
      method: 'POST',
      body: JSON.stringify({ email, password }),
    }),
  logout: () => apiFetch('/api/auth/logout', { method: 'POST' }),
  refresh: () => apiFetch('/api/auth/refresh', { method: 'POST' }),
  forgotPassword: (email) =>
    apiFetch('/api/auth/forgot-password', {
      method: 'POST',
      body: JSON.stringify({ email }),
    }),
  resetPassword: (token, password) =>
    apiFetch('/api/auth/reset-password', {
      method: 'POST',
      body: JSON.stringify({ token, password }),
    }),
}

export const inviteApi = {
  get: (code) => apiFetch(`/api/invites/${code}`),
  batches: () => apiFetch('/api/invites/tutor/batches'),
  createPaired: (body) =>
    apiFetch('/api/invites/paired', {
      method: 'POST',
      body: JSON.stringify(body),
    }),
  redeem: (code, body) =>
    apiFetch(`/api/invites/${code}/redeem`, {
      method: 'POST',
      body: JSON.stringify(body),
    }),
  send: (code) => apiFetch(`/api/invites/${code}/send`, { method: 'POST' }),
}

export const PASSWORD_MIN_LENGTH = 16

export function validatePassword(password) {
  if (password.length < PASSWORD_MIN_LENGTH) {
    return `At least ${PASSWORD_MIN_LENGTH} characters required`
  }
  return null
}

export function dashboardPath(role) {
  if (role === 'tutor') return '/tutor/dashboard'
  if (role === 'parent') return '/parent/dashboard'
  return '/student/dashboard'
}
