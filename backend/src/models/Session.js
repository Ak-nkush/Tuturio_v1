import mongoose, { Schema } from 'mongoose'

const sessionSchema = new Schema(
  {
    batchId: { type: String, required: true },
    tutorId: { type: String, required: true },
    date: { type: Date, required: true },
    topic: { type: String, required: true, trim: true },
    status: {
      type: String,
      enum: ['scheduled', 'active', 'completed', 'cancelled'],
      default: 'scheduled',
    },
    isHoliday: { type: Boolean, default: false },
    oneOff: { type: Boolean, default: false },
  },
  { timestamps: true }
)

// Compound index for efficient querying by tutor and batch
sessionSchema.index({ tutorId: 1, batchId: 1, date: -1 })

export const Session = mongoose.model('Session', sessionSchema)
