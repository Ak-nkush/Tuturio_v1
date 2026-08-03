import mongoose, { Schema } from 'mongoose'

const enrollmentSchema = new Schema(
  {
    studentId: { type: String, required: true },
    parentId: { type: String, default: null },
    joinedAt: { type: Date, default: Date.now },
    status: { type: String, enum: ['active', 'removed'], default: 'active' },
  },
  { _id: false },
)

const batchSchema = new Schema(
  {
    batchId: { type: String, required: true, unique: true },
    tutorId: { type: String, required: true },
    name: { type: String, required: true, trim: true },
    subjects: { type: [String], default: [] },
    enrollment: { type: [enrollmentSchema], default: [] },
    status: { type: String, enum: ['active', 'archived'], default: 'active' },
  },
  { timestamps: true },
)

export const Batch = mongoose.model('Batch', batchSchema)
