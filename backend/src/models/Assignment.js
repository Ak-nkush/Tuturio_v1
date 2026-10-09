import mongoose, { Schema } from 'mongoose'

const assignmentSchema = new Schema(
  {
    tutorId: { type: String, required: true },
    batchId: { type: String, required: true },
    title: { type: String, required: true, trim: true },
    description: { type: String, trim: true, default: '' },
    dueDate: { type: Date, required: true },
    maxScore: { type: Number, required: true },
  },
  { timestamps: true }
)

export const Assignment = mongoose.model('Assignment', assignmentSchema)
