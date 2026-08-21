import mongoose, { Schema } from 'mongoose'

const attendanceSchema = new Schema(
  {
    sessionId: { type: Schema.Types.ObjectId, ref: 'Session', required: true },
    studentId: { type: String, required: true },
    batchId: { type: String, required: true },
    status: {
      type: String,
      enum: ['present', 'absent', 'late'],
      required: true,
    },
  },
  { timestamps: true }
)

// Ensure one attendance record per student per session
attendanceSchema.index({ sessionId: 1, studentId: 1 }, { unique: true })

export const Attendance = mongoose.model('Attendance', attendanceSchema)
