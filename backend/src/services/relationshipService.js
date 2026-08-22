import { User } from '../models/User.js'

export function conversationTypeForRoles(roleA, roleB) {
  const roles = [roleA, roleB].sort().join('_')
  if (roles === 'student_tutor') return 'tutor_student'
  if (roles === 'parent_tutor') return 'tutor_parent'
  return null
}

// Private chat is limited to tutor <-> student and tutor <-> parent.
export async function areRelated(userAId, userBId) {
  if (!userAId || !userBId || userAId === userBId) return false

  const [a, b] = await Promise.all([
    User.findOne({ userId: userAId }),
    User.findOne({ userId: userBId }),
  ])
  if (!a || !b) return false

  const tutor = a.role === 'tutor' ? a : b.role === 'tutor' ? b : null
  const learner = tutor === a ? b : tutor === b ? a : null
  if (!tutor || !learner || !['student', 'parent'].includes(learner.role)) return false

  const { Batch } = await import('../models/Batch.js')
  const studentIds = learner.role === 'student' ? [learner.userId] : learner.linkedStudentIds
  return Boolean(await Batch.exists({
    tutorId: tutor.userId,
    status: 'active',
    enrollment: { $elemMatch: { studentId: { $in: studentIds }, status: 'active' } },
  }))
}
