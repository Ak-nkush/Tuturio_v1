import mongoose, { Schema } from 'mongoose'

const userSchema = new Schema(
  {
    userId: { type: String, required: true, unique: true },
    name: { type: String, required: true, trim: true },
    role: { type: String, required: true, enum: ['tutor', 'student', 'parent'] },
    email: { type: String, required: true, unique: true, lowercase: true, trim: true },
    passwordHash: { type: String, required: true },
    linkedParentIds: { type: [String], default: [] },
    linkedStudentIds: { type: [String], default: [] },
    status: { type: String, enum: ['active', 'archived'], default: 'active' },
    tokenVersion: { type: Number, default: 0 },
    failedLoginAttempts: { type: Number, default: 0 },
    lockedUntil: { type: Date, default: null },
    passwordResetTokenHash: { type: String, default: null },
    passwordResetExpiresAt: { type: Date, default: null },
  },
  { timestamps: true },
)

export const User = mongoose.model('User', userSchema)

export function publicUser(user) {
  return {
    userId: user.userId,
    name: user.name,
    role: user.role,
    email: user.email,
    linkedStudentIds: user.linkedStudentIds,
    status: user.status,
  }
}
