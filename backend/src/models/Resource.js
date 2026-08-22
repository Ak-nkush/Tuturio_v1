import mongoose, { Schema } from 'mongoose'

const resourceSchema = new Schema(
  {
    tutorId: { type: String, required: true },
    batchId: { type: String, required: true },
    title: { type: String, required: true, trim: true },
    type: { type: String, enum: ['file', 'link'], required: true },
    url: { type: String, default: null }, // External URL for links only
    storageKey: { type: String, default: null },
    fileName: { type: String, default: null },
    mimeType: { type: String, default: null },
    sizeBytes: { type: Number, default: null },
  },
  { timestamps: true }
)

resourceSchema.index({ batchId: 1, createdAt: -1 })

export const Resource = mongoose.model('Resource', resourceSchema)
