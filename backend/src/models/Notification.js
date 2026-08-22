import mongoose, { Schema } from 'mongoose'

const notificationSchema = new Schema(
  {
    userId: { type: String, required: true },
    title: { type: String, required: true, trim: true },
    message: { type: String, required: true, trim: true },
    type: { type: String, enum: ['system', 'batch', 'student'], default: 'system' },
    isRead: { type: Boolean, default: false },
    link: { type: String, default: null },
    event: { type: String, default: 'batch' },
  },
  { timestamps: true }
)

export const Notification = mongoose.model('Notification', notificationSchema)
