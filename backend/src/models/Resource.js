import mongoose, { Schema } from 'mongoose'

const resourceSchema = new Schema(
  {
    tutorId: { type: String, required: true },
    batchId: { type: String, required: true },
    title: { type: String, required: true, trim: true },
    type: { type: String, enum: ['file', 'link'], required: true },
    url: { type: String, required: true }, // URL to the file or the external link
  },
  { timestamps: true }
)

resourceSchema.index({ batchId: 1, createdAt: -1 })

export const Resource = mongoose.model('Resource', resourceSchema)
