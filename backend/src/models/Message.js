import mongoose, { Schema } from 'mongoose'

const messageSchema = new Schema(
  {
    senderId: { type: String, required: true },
    receiverId: { type: String, required: true },
    content: { type: String, default: '', trim: true },
    attachments: {
      type: [
        {
          url: { type: String, required: true },
          filename: { type: String, required: true },
          mimeType: { type: String, default: '' },
        },
      ],
      default: [],
    },
    isRead: { type: Boolean, default: false },
  },
  { timestamps: true }
)

export const Message = mongoose.model('Message', messageSchema)
