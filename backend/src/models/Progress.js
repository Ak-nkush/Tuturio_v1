import mongoose, { Schema } from 'mongoose'

const progressSchema = new Schema(
  {
    studentId: { type: String, required: true },
    tutorId: { type: String, required: true },
    batchId: { type: String, required: true },
    subject: { type: String, default: '', trim: true },
    topic: { type: String, required: true, trim: true },
    score: { type: Number, required: true },
    maxScore: { type: Number, required: true },
    remark: { type: String, trim: true },
    sessionId: { type: String, default: null },
    archived: { type: Boolean, default: false },
    createdBy: { type: String, default: null },
    date: { type: Date, default: Date.now },
  },
  { timestamps: true }
)

progressSchema.index({ studentId: 1, batchId: 1, date: -1 })

export const Progress = mongoose.model('Progress', progressSchema)
