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
    notificationPreferences: {
      messages: { type: Boolean, default: true },
      attendance: { type: Boolean, default: true },
      progress: { type: Boolean, default: true },
      announcements: { type: Boolean, default: true },
      batch: { type: Boolean, default: true },
    },
    bio: { type: String, default: '', trim: true },
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
    bio: user.bio ?? '',
    linkedStudentIds: user.linkedStudentIds,
    status: user.status,
    notificationPreferences: user.notificationPreferences ?? {
      messages: true,
      attendance: true,
      progress: true,
      announcements: true,
      batch: true,
    },
  }
}
