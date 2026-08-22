async function parseJson(res) {
  let data
  try {
    const text = await res.text()
    data = text ? JSON.parse(text) : {}
  } catch {
    throw new Error('Unable to reach the server. Is the backend running?')
  }

  if (!res.ok) {
    let msg = data.message || data.error;
    if (!msg && (res.status === 502 || res.status === 504)) {
       msg = 'Unable to reach the server. Please ensure the backend is running (npm run dev in the backend folder).';
    }
    const err = new Error(msg ?? 'Request failed')
    err.reason = data.reason
    err.currentRole = data.currentRole
    err.inviteRole = data.inviteRole
    err.existingRole = data.existingRole
    err.futureSessionsAffected = data.futureSessionsAffected
    err.preview = data.preview
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
  register: (body) =>
    apiFetch('/api/auth/register', {
      method: 'POST',
      body: JSON.stringify(body),
    }),
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
  revoke: (code) => apiFetch(`/api/invites/${code}/revoke`, { method: 'POST' }),
}

export const batchApi = {
  list: () => apiFetch('/api/batches'),
  get: (batchId) => apiFetch(`/api/batches/${batchId}`),
  students: () => apiFetch('/api/batches/students/all'),
  getStudentEnrolled: () => apiFetch('/api/batches/student/enrolled'),
  getParentEnrolled: () => apiFetch('/api/batches/parent/enrolled'),
  getParentStudents: () => apiFetch('/api/batches/parent/students'),
  create: (body) => apiFetch('/api/batches', { method: 'POST', body: JSON.stringify(body) }),
  update: (batchId, body) => apiFetch(`/api/batches/${batchId}`, { method: 'PATCH', body: JSON.stringify(body) }),
  previewScheduleChange: (batchId, body) =>
    apiFetch(`/api/batches/${batchId}/preview-schedule-change`, {
      method: 'POST',
      body: JSON.stringify(body),
    }),
  archive: (batchId) => apiFetch(`/api/batches/${batchId}`, { method: 'DELETE' }),
  removeStudent: (batchId, studentId) =>
    apiFetch(`/api/batches/${batchId}/students/${studentId}`, { method: 'PATCH' }),
  updateStudentStatus: (batchId, studentId, status) =>
    apiFetch(`/api/batches/${batchId}/students/${studentId}`, {
      method: 'PATCH',
      body: JSON.stringify({ status }),
    }),
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
  tutorStudent: (studentId) => apiFetch(`/api/attendance/tutor/student/${studentId}`),
  byStudent: (studentId) => apiFetch(`/api/attendance/student/${studentId}`),
  correct: (sessionId, studentId, body) =>
    apiFetch(`/api/attendance/session/${sessionId}/student/${studentId}`, {
      method: 'PATCH',
      body: JSON.stringify(body),
    }),
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
  getBySession: (sessionId) => apiFetch(`/api/progress/session/${sessionId}`),
  student: () => apiFetch('/api/progress/student/me'),
  parent: () => apiFetch('/api/progress/parent/students'),
  tutorStudent: (studentId, includeArchived = false) =>
    apiFetch(`/api/progress/tutor/student/${studentId}${includeArchived ? '?includeArchived=1' : ''}`),
  create: (body) => apiFetch('/api/progress', { method: 'POST', body: JSON.stringify(body) }),
  update: (id, body) => apiFetch(`/api/progress/${id}`, { method: 'PATCH', body: JSON.stringify(body) }),
  remove: (id) => apiFetch(`/api/progress/${id}`, { method: 'DELETE' }),
}

export const analyticsApi = {
  overview: () => apiFetch('/api/analytics/overview'),
  batch: (batchId) => apiFetch(`/api/analytics/batch/${batchId}`),
  student: () => apiFetch('/api/analytics/student/overview'),
  parent: () => apiFetch('/api/analytics/parent/overview'),
  exportAttendance: (batchId) => downloadCsv(`/api/analytics/export/attendance/${batchId}`),
  exportProgress: (batchId) => downloadCsv(`/api/analytics/export/progress/${batchId}`),
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

export const conversationApi = {
  create: (peerId) =>
    apiFetch('/api/conversations', { method: 'POST', body: JSON.stringify({ peerId }) }),
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
  updateProfile: (body) => apiFetch('/api/users/profile', { method: 'PUT', body: JSON.stringify(body) }),
  uploadProfilePicture: (file) => {
    const body = new FormData()
    body.append('file', file)
    return apiFetch('/api/users/profile-picture', { method: 'POST', body })
  },
  archive: (userId) => apiFetch(`/api/users/${userId}/archive`, { method: 'POST' }),
  unarchive: (userId) => apiFetch(`/api/users/${userId}/unarchive`, { method: 'POST' }),
}

export const subjectApi = {
  list: (includeArchived = false) =>
    apiFetch(`/api/subjects${includeArchived ? '?includeArchived=true' : ''}`),
  create: (name) => apiFetch('/api/subjects', { method: 'POST', body: JSON.stringify({ name }) }),
  update: (subjectId, body) =>
    apiFetch(`/api/subjects/${subjectId}`, { method: 'PATCH', body: JSON.stringify(body) }),
  archive: (subjectId) => apiFetch(`/api/subjects/${subjectId}`, { method: 'DELETE' }),
}

async function downloadCsv(path) {
  const res = await fetch(path, { credentials: 'include' })
  if (!res.ok) throw new Error('Could not download file')
  const blob = await res.blob()
  const url = URL.createObjectURL(blob)
  const link = document.createElement('a')
  const match = /filename=([^;]+)/.exec(res.headers.get('Content-Disposition') ?? '')
  link.href = url
  link.download = match?.[1] ?? 'export.csv'
  link.click()
  URL.revokeObjectURL(url)
}

export const DAY_LABELS = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat']

export function formatSchedule(schedule) {
  const days = (schedule?.days ?? []).map((day) => DAY_LABELS[day]).filter(Boolean)
  const time = schedule?.time
  if (!days.length && !time) return 'No schedule set'
  if (!days.length) return time
  return `${days.join(', ')} · ${time ?? 'No time'}`
}

export function studentRosterState(student) {
  if (student.status === 'removed') return { key: 'removed', label: 'Removed' }
  if (student.status === 'archived') return { key: 'archived', label: 'Archived' }
  if (student.status === 'pending') return { key: 'pending', label: 'Pending invite' }
  if (student.accountStatus === 'archived') return { key: 'archived', label: 'Paused' }
  return { key: 'active', label: 'Active' }
}

export const PASSWORD_MIN_LENGTH = 8

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
