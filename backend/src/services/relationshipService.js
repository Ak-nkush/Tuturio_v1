import { Batch } from '../models/Batch.js'
import { User } from '../models/User.js'

// Returns true if `a` and `b` are allowed to see each other:
// - tutor <-> any user in a tutor's batch
// - student <-> their linked parents
// - student <-> other students in the same batch (classmates)
// - parent <-> tutor of child's batch, and <-> other parents of same batch
export async function areRelated(userAId, userBId) {
  if (!userAId || !userBId || userAId === userBId) return Boolean(userAId && userBId)

  const [a, b] = await Promise.all([
    User.findOne({ userId: userAId }),
    User.findOne({ userId: userBId }),
  ])
  if (!a || !b) return false

  // Direct links
  if (a.role === 'parent' && b.role === 'student' && a.linkedStudentIds.includes(b.userId)) return true
  if (b.role === 'parent' && a.role === 'student' && b.linkedStudentIds.includes(a.userId)) return true

  function batchQuery(user) {
    const studentIds = user.role === 'parent' ? user.linkedStudentIds : [user.userId]
    return {
      status: 'active',
      $or: [
        { tutorId: user.userId },
        { enrollment: { $elemMatch: { studentId: { $in: studentIds }, status: 'active' } } },
        { enrollment: { $elemMatch: { parentId: user.userId, status: 'active' } } },
      ],
    }
  }

  const [batchesA, batchesB] = await Promise.all([
    Batch.find(batchQuery(a)),
    Batch.find(batchQuery(b)),
  ])
  const idsA = new Set(batchesA.map((x) => x.batchId))
  return batchesB.some((x) => idsA.has(x.batchId))
}
