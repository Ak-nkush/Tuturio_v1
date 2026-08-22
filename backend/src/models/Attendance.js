import mongoose, { Schema } from 'mongoose'

const correctionSchema = new Schema(
  {
    previousStatus: { type: String, required: true },
    newStatus: { type: String, required: true },
    note: { type: String, default: '', trim: true },
    changedBy: { type: String, required: true },
    changedAt: { type: Date, default: Date.now },
  },
  { _id: false },
)

const attendanceSchema = new Schema(
  {
    sessionId: { type: Schema.Types.ObjectId, ref: 'Session', required: true },
    studentId: { type: String, required: true },
    batchId: { type: String, required: true },
    status: {
      type: String,
      enum: ['present', 'absent', 'late', 'excused'],
      required: true,
    },
    markedBy: { type: String, default: null },
    markedAt: { type: Date, default: Date.now },
    corrections: { type: [correctionSchema], default: [] },
  },
  { timestamps: true },
)

attendanceSchema.index({ sessionId: 1, studentId: 1 }, { unique: true })

export const Attendance = mongoose.model('Attendance', attendanceSchema)
