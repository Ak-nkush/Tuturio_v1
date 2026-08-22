import { Batch } from '../models/Batch.js'
import { User } from '../models/User.js'

export async function canAccessBatch(user, batchId) {
  const batch = await Batch.findOne({ batchId, status: 'active' })
  if (!batch) return { allowed: false, batch: null }
  if (user.role === 'tutor') return { allowed: batch.tutorId === user.userId, batch }
  if (user.role === 'student') {
    return { allowed: batch.enrollment.some((entry) => entry.studentId === user.userId && entry.status === 'active'), batch }
  }
  const parent = await User.findOne({ userId: user.userId })
  return {
    allowed: Boolean(parent && batch.enrollment.some((entry) => parent.linkedStudentIds.includes(entry.studentId) && entry.status === 'active')),
    batch,
  }
}
