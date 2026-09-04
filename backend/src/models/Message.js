import mongoose, { Schema } from 'mongoose'

const messageSchema = new Schema(
  {
    senderId: { type: String, required: true },
    receiverId: { type: String, required: true },
    content: { type: String, default: '', trim: true },
    attachments: {
      type: [
        {
          storageKey: { type: String, required: true },
          filename: { type: String, required: true },
          mimeType: { type: String, default: '' },
          sizeBytes: { type: Number, default: null },
        },
      ],
      default: [],
    },
    isRead: { type: Boolean, default: false },
    isDelivered: { type: Boolean, default: false },
    deliveredAt: { type: Date, default: null },
    readAt: { type: Date, default: null },
  },
  { timestamps: true }
)

export const Message = mongoose.model('Message', messageSchema)
