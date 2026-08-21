async function parseJson(res) {
  let data
  try {
    const text = await res.text()
    data = text ? JSON.parse(text) : {}
  } catch {
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
  const isFormData = init?.body instanceof FormData
  const res = await fetch(path, {
    ...init,
    credentials: 'include',
    headers: {
      ...(isFormData ? {} : { 'Content-Type': 'application/json' }),
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

export const batchApi = {
  list: () => apiFetch('/api/batches'),
  get: (batchId) => apiFetch(`/api/batches/${batchId}`),
  students: () => apiFetch('/api/batches/students/all'),
  getStudentEnrolled: () => apiFetch('/api/batches/student/enrolled'),
  getParentEnrolled: () => apiFetch('/api/batches/parent/enrolled'),
  create: (body) => apiFetch('/api/batches', { method: 'POST', body: JSON.stringify(body) }),
  update: (batchId, body) => apiFetch(`/api/batches/${batchId}`, { method: 'PATCH', body: JSON.stringify(body) }),
  archive: (batchId) => apiFetch(`/api/batches/${batchId}`, { method: 'DELETE' }),
  removeStudent: (batchId, studentId) =>
    apiFetch(`/api/batches/${batchId}/students/${studentId}`, { method: 'PATCH' }),
  addHoliday: (batchId, date) =>
    apiFetch(`/api/batches/${batchId}/holidays`, { method: 'POST', body: JSON.stringify({ date }) }),
  removeHoliday: (batchId, date) =>
    apiFetch(`/api/batches/${batchId}/holidays`, { method: 'DELETE', body: JSON.stringify({ date }) }),
}

export const sessionApi = {
  today: () => apiFetch('/api/sessions/today'),
  byBatch: (batchId) => apiFetch(`/api/sessions/batch/${batchId}`),
  upcomingForStudent: () => apiFetch('/api/sessions/student/upcoming'),
  upcomingForParent: () => apiFetch('/api/sessions/parent/upcoming'),
  getById: (sessionId) => apiFetch(`/api/sessions/${sessionId}`),
  getStudents: (sessionId) => apiFetch(`/api/sessions/${sessionId}/students`),
  create: (body) => apiFetch('/api/sessions', { method: 'POST', body: JSON.stringify(body) }),
  updateStatus: (sessionId, status) =>
    apiFetch(`/api/sessions/${sessionId}/status`, { method: 'PATCH', body: JSON.stringify({ status }) }),
}

export const attendanceApi = {
  getBySession: (sessionId) => apiFetch(`/api/attendance/session/${sessionId}`),
  save: (sessionId, body) =>
    apiFetch(`/api/attendance/session/${sessionId}`, { method: 'POST', body: JSON.stringify(body) }),
  remove: (sessionId, studentId) =>
    apiFetch(`/api/attendance/session/${sessionId}/student/${studentId}`, { method: 'DELETE' }),
  student: () => apiFetch('/api/attendance/student/me'),
  parent: () => apiFetch('/api/attendance/parent/students'),
}

export const announcementApi = {
  getByBatch: (batchId) => apiFetch(`/api/announcements/batch/${batchId}`),
  create: (body) => apiFetch('/api/announcements', { method: 'POST', body: JSON.stringify(body) }),
  remove: (id) => apiFetch(`/api/announcements/${id}`, { method: 'DELETE' }),
}

export const resourceApi = {
  getByBatch: (batchId) => apiFetch(`/api/resources/batch/${batchId}`),
  upload: (batchId, file) => {
    const body = new FormData()
    body.append('batchId', batchId)
    body.append('file', file)
    return apiFetch('/api/resources/upload', { method: 'POST', body })
  },
  addLink: (body) => apiFetch('/api/resources/link', { method: 'POST', body: JSON.stringify(body) }),
  remove: (id) => apiFetch(`/api/resources/${id}`, { method: 'DELETE' }),
}

export const progressApi = {
  byBatch: (batchId) => apiFetch(`/api/progress/batch/${batchId}`),
  bySession: (sessionId) => apiFetch(`/api/progress/session/${sessionId}`),
  student: () => apiFetch('/api/progress/student/me'),
  parent: () => apiFetch('/api/progress/parent/students'),
  create: (body) => apiFetch('/api/progress', { method: 'POST', body: JSON.stringify(body) }),
}

export const analyticsApi = {
  overview: () => apiFetch('/api/analytics/overview'),
  batch: (batchId) => apiFetch(`/api/analytics/batch/${batchId}`),
  student: () => apiFetch('/api/analytics/student/overview'),
  parent: () => apiFetch('/api/analytics/parent/overview'),
}

export const assignmentApi = {
  byBatch: (batchId) => apiFetch(`/api/assignments/batch/${batchId}`),
  student: () => apiFetch('/api/assignments/student/me'),
  create: (body) => apiFetch('/api/assignments', { method: 'POST', body: JSON.stringify(body) }),
  submit: (assignmentId, body) =>
    apiFetch(`/api/assignments/${assignmentId}/submit`, { method: 'POST', body }),
}

export const notificationApi = {
  list: () => apiFetch('/api/notifications'),
  read: (id) => apiFetch(`/api/notifications/${id}/read`, { method: 'PATCH' }),
  readAll: () => apiFetch('/api/notifications/read-all', { method: 'PATCH' }),
  preferences: () => apiFetch('/api/notifications/preferences'),
  updatePreferences: (body) =>
    apiFetch('/api/notifications/preferences', { method: 'PATCH', body: JSON.stringify(body) }),
}

export const messageApi = {
  contacts: () => apiFetch('/api/messages/contacts'),
  conversations: () => apiFetch('/api/messages/conversations'),
  thread: (userId) => apiFetch(`/api/messages/${userId}`),
  markRead: (senderId) =>
    apiFetch('/api/messages/read', { method: 'PATCH', body: JSON.stringify({ senderId }) }),
  send: ({ receiverId, content, files }) => {
    if (files?.length) {
      const body = new FormData()
      body.append('receiverId', receiverId)
      if (content) body.append('content', content)
      files.forEach((file) => body.append('files', file))
      return apiFetch('/api/messages', { method: 'POST', body })
    }
    return apiFetch('/api/messages', {
      method: 'POST',
      body: JSON.stringify({ receiverId, content }),
    })
  },
}

export const userApi = {
  archive: (userId) => apiFetch(`/api/users/${userId}/archive`, { method: 'POST' }),
  unarchive: (userId) => apiFetch(`/api/users/${userId}/unarchive`, { method: 'POST' }),
}

export const DAY_LABELS = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat']

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
