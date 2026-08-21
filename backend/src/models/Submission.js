import mongoose, { Schema } from 'mongoose'

const submissionSchema = new Schema(
  {
    assignmentId: { type: mongoose.Schema.Types.ObjectId, ref: 'Assignment', required: true },
    studentId: { type: String, required: true },
    fileUrl: { type: String, required: true },
    status: { type: String, enum: ['submitted', 'graded', 'returned'], default: 'submitted' },
    score: { type: Number, default: null },
    feedback: { type: String, trim: true, default: '' },
  },
  { timestamps: true }
)

export const Submission = mongoose.model('Submission', submissionSchema)
