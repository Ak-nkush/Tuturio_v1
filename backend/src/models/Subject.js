import mongoose, { Schema } from 'mongoose'

const subjectSchema = new Schema(
  {
    subjectId: { type: String, required: true, unique: true },
    tutorId: { type: String, required: true },
    name: { type: String, required: true, trim: true },
    status: { type: String, enum: ['active', 'archived'], default: 'active' },
  },
  { timestamps: true },
)

subjectSchema.index({ tutorId: 1, name: 1 }, { unique: true })

export const Subject = mongoose.model('Subject', subjectSchema)

export function publicSubject(subject) {
  return {
    subjectId: subject.subjectId,
    tutorId: subject.tutorId,
    name: subject.name,
    status: subject.status,
  }
}
