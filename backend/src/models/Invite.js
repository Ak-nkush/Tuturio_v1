import mongoose, { Schema } from 'mongoose'

const inviteSchema = new Schema(
  {
    inviteId: { type: String, required: true, unique: true },
    batchId: { type: String, required: true },
    code: { type: String, required: true, unique: true },
    role: { type: String, required: true, enum: ['student', 'parent'] },
    linkedStudentId: { type: String, default: null },
    pairedInviteId: { type: String, default: null },
    email: { type: String, default: null, lowercase: true, trim: true },
    used: { type: Boolean, default: false },
    revoked: { type: Boolean, default: false },
    expiresAt: { type: Date, required: true },
  },
  { timestamps: { createdAt: true, updatedAt: false } },
)

export const Invite = mongoose.model('Invite', inviteSchema)

export function publicInvite(invite, batchName) {
  return {
    code: invite.code,
    role: invite.role,
    batchId: invite.batchId,
    batchName,
    linkedStudentId: invite.linkedStudentId,
    pairedInviteId: invite.pairedInviteId,
    email: invite.email,
    expiresAt: invite.expiresAt,
  }
}
