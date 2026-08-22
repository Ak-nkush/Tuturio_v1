import mongoose from 'mongoose'

export function escapeRegex(input) {
  return String(input).replace(/[.*+?^${}()|[\]\\]/g, '\\$&')
}

export function isValidObjectId(value) {
  return mongoose.Types.ObjectId.isValid(String(value))
}

// Express middleware: returns 404 for route params that are not valid ObjectIds,
// so Mongoose CastErrors never surface as 500s.
export function validObjectIdParam(paramName) {
  return (req, res, next) => {
    if (!isValidObjectId(req.params[paramName])) {
      return res.status(404).json({ error: 'Not found' })
    }
    next()
  }
}

export const SESSION_STATUSES = ['scheduled', 'active', 'completed', 'cancelled']
export const ATTENDANCE_STATUSES = ['present', 'absent', 'late', 'excused']
