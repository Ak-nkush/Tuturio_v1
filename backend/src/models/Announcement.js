import mongoose, { Schema } from 'mongoose'

const announcementSchema = new Schema(
  {
    tutorId: { type: String, required: true },
    batchId: { type: String, required: true },
    text: { type: String, required: true, trim: true },
  },
  { timestamps: true }
)

announcementSchema.index({ batchId: 1, createdAt: -1 })

export const Announcement = mongoose.model('Announcement', announcementSchema)
