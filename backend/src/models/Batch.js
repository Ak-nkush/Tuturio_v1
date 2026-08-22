import mongoose, { Schema } from 'mongoose'

const enrollmentSchema = new Schema(
  {
    studentId: { type: String, required: true },
    parentId: { type: String, default: null },
    joinedAt: { type: Date, default: Date.now },
    status: { type: String, enum: ['pending', 'active', 'removed', 'archived'], default: 'pending' },
  },
  { _id: false },
)

const batchSchema = new Schema(
  {
    batchId: { type: String, required: true, unique: true },
    tutorId: { type: String, required: true },
    name: { type: String, required: true, trim: true },
    subjects: { type: [String], default: [] },
    schedule: {
      days: { type: [Number], default: [] },
      time: { type: String, default: '18:00' },
    },
    enrollment: { type: [enrollmentSchema], default: [] },
    holidays: { type: [Date], default: [] },
    status: { type: String, enum: ['active', 'archived'], default: 'active' },
  },
  { timestamps: true },
)

export const Batch = mongoose.model('Batch', batchSchema)

export function publicBatch(batch) {
  const enrollment = batch.enrollment ?? []
  return {
    batchId: batch.batchId,
    tutorId: batch.tutorId,
    name: batch.name,
    subjects: batch.subjects,
    schedule: batch.schedule,
    enrollment,
    activeCount: enrollment.filter((entry) => entry.status === 'active').length,
    pendingCount: enrollment.filter((entry) => entry.status === 'pending').length,
    removedCount: enrollment.filter((entry) => entry.status === 'removed').length,
    archivedCount: enrollment.filter((entry) => entry.status === 'archived').length,
    holidays: batch.holidays ?? [],
    status: batch.status,
    createdAt: batch.createdAt,
    updatedAt: batch.updatedAt,
  }
}
